const Profile = require('../models/usermodel');
const externalFunctions = require('../service/external_services/external_api_functions');
const catchAsync = require('../utils/catchAsync');
const { v7: uuidv7 } = require('uuid');
const queryBuilder = require('../queryFeatures/features.js');
const validateQuery = require('../queryFeatures/validateQuery.js');
const parseSearchQuery = require('../queryFeatures/searchParser.js');
const AppError = require('../utils/appError.js');
const { Parser } = require('json2csv');
const { redis } = require('../utils/redisClient.js');
const { invalidateProfileCache } = require('../utils/redisClient.js');
const { validateRow, normalizeRow } = require('../utils/validateProfileRow');
const fs = require('fs');
const csv = require('csv-parser');

const CHUNK_SIZE = 500;

//Get all profiles and accepts query params
exports.getProfiles = catchAsync(async (req, res, next) => {
  validateQuery(req.query);

  //Cache implementation
  const cachedKey = `profiles:${JSON.stringify(req.query)}`;
  const cached = await redis.get(cachedKey);
  if (cached) {
    return res.status(200).json({
      cached,
      source: 'redis',
    });
  }
  const { filter, sortBy, page, limit, skip } = queryBuilder(req.query);

  const [profiles, total] = await Promise.all([
    Profile.find(filter).sort(sortBy).skip(skip).limit(limit),
    Profile.countDocuments(filter),
  ]);
  const total_pages = Math.ceil(total / limit);
  const base = `/api/v1/profiles`;

  const response = {
    status: 'success',
    page,
    limit,
    total,
    total_pages,
    links: {
      first: `${base}?page=1&limit=${limit}`,
      prev: page > 1 ? `${base}?page=${page - 1}&limit=${limit}` : null,
      next:
        page < total_pages ? `${base}?page=${page + 1}&limit=${limit}` : null,
      last: `${base}?page=${total_pages}&limit=${limit}`,
    },
    data: profiles,
  };
  await redis.set(cachedKey, response, { ex: 1800 });
  return res.status(200).json(response);
});

//Create profile
exports.createProfiles = catchAsync(async (req, res, next) => {
  const requestedName = req.body.name;

  if (!requestedName || typeof requestedName !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid name provided',
    });
  }

  const name = requestedName.toLowerCase().trim();

  // Idempotency check
  const existing = await Profile.findOne({ name });
  if (existing) {
    return res.status(200).json({
      status: 'success',
      message: 'Profile already exists',
      data: existing,
    });
  }

  // Gender
  const external_api_gender = await externalFunctions.genderise(name);
  const {
    gender,
    probability: gender_probability,
    count,
  } = external_api_gender;

  if (!gender || gender_probability === undefined || count === 0) {
    return res.status(502).json({
      status: 'error',
      message: 'Genderize returned an invalid response',
    });
  }

  // Age
  const external_api_agify = await externalFunctions.agify(name);
  const { age } = external_api_agify;

  if (age === null || age === undefined) {
    return res.status(502).json({
      status: 'error',
      message: 'Agify returned an invalid response',
    });
  }

  let age_group;
  if (age <= 12) {
    age_group = 'child';
  } else if (age <= 19) {
    age_group = 'teenager';
  } else if (age <= 59) {
    age_group = 'adult';
  } else {
    age_group = 'senior';
  }

  // Nationality
  const external_api_nationalize = await externalFunctions.nationalize(name);
  const { country } = external_api_nationalize;

  if (!country || country.length === 0) {
    return res.status(502).json({
      status: 'error',
      message: 'Nationalize returned an invalid response',
    });
  }

  const topCountry = country.reduce((max, current) =>
    current.probability > max.probability ? current : max
  );

  const { country_id, probability: country_probability } = topCountry;

  // Derive country name from country_id — no extra package needed
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const country_name = regionNames.of(country_id) || country_id;

  //const id = uuidv7();

  const profile = await Profile.create({
    id,
    name,
    gender,
    gender_probability,
    age,
    age_group,
    country_id,
    country_name,
    country_probability,
  });

  return res.status(201).json({
    status: 'success',
    data: profile,
  });
});

exports.ingestCSV = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  const filePath = req.file.path;

  const stats = {
    total_rows: 0,
    inserted: 0,
    skipped: 0,
    reasons: {},
  };

  const recordSkip = (reason) => {
    stats.skipped++;
    stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
  };

  const flushChunk = async (chunk) => {
    if (chunk.length === 0) return;

    try {
      const result = await Profile.insertMany(chunk, { ordered: false });
      stats.inserted += result.length;
    } catch (err) {
      if (err.name === 'MongoBulkWriteError') {
        stats.inserted += err.result.nInserted;
        for (const writeError of err.writeErrors) {
          if (writeError.code === 11000) {
            recordSkip('duplicate_name');
          } else {
            recordSkip('write_error');
          }
        }
      } else {
        throw err;
      }
    }
  };

  try {
    const readStream = fs.createReadStream(filePath).pipe(csv());
    let chunk = [];

    for await (const row of readStream) {
      stats.total_rows++;
      console.log('RAW ROW:', row);

      const validation = validateRow(row);
      if (!validation.valid) {
        recordSkip(validation.reason);
        continue;
      }

      chunk.push(normalizeRow(row));

      if (chunk.length >= CHUNK_SIZE) {
        await flushChunk(chunk);
        chunk = [];
      }
    }

    await flushChunk(chunk);
    await invalidateProfileCache();

    return res.status(200).json({
      status: 'success',
      total_rows: stats.total_rows,
      inserted: stats.inserted,
      skipped: stats.skipped,
      reasons: stats.reasons,
    });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

//Get profile by Id
exports.getProfilesById = catchAsync(async (req, res, next) => {
  const id = req.params.id?.trim();

  if (!id) {
    return res.status(400).json({
      status: 'error',
      message: 'ID is required',
    });
  }

  const profile = await Profile.findOne({ id }).select('-_id');
  if (!profile) {
    return res.status(404).json({
      status: 'error',
      message: 'Profile not found',
    });
  }

  return res.status(200).json({
    status: 'success',
    data: profile,
  });
});

//Delete profile by id
exports.deleteProfileById = catchAsync(async (req, res, next) => {
  const id = req.params.id?.trim();

  if (!id) {
    return res.status(400).json({
      status: 'error',
      message: 'ID is required',
    });
  }

  const deleted = await Profile.findOneAndDelete({ id });

  if (!deleted) {
    return res.status(404).json({
      status: 'error',
      message: 'Profile not found',
    });
  }
  return res.status(204).send();
});

exports.searchProfiles = catchAsync(async (req, res, next) => {
  const { q, page, limit } = req.query;

  if (!q || !q.trim()) {
    return next(new AppError('Query parameter "q" is required', 400));
  }

  const parsedFilter = parseSearchQuery(q);

  if (!parsedFilter) {
    return res.status(400).json({
      status: 'error',
      message: 'Unable to interpret query',
    });
  }

  // Build the Mongoose filter from parsed result
  const mongoFilter = {};

  if (parsedFilter.gender) mongoFilter.gender = parsedFilter.gender;
  if (parsedFilter.age_group) mongoFilter.age_group = parsedFilter.age_group;
  if (parsedFilter.country_id) mongoFilter.country_id = parsedFilter.country_id;
  if (parsedFilter.min_age || parsedFilter.max_age) {
    mongoFilter.age = {};
    if (parsedFilter.min_age) mongoFilter.age.$gte = parsedFilter.min_age;
    if (parsedFilter.max_age) mongoFilter.age.$lte = parsedFilter.max_age;
  }

  const pg = Math.max(1, Number(page) || 1);
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (pg - 1) * lim;

  //const { filter, sortBy, page, limit, skip } = queryBuilder(mongoFilter);
  const [profiles, total] = await Promise.all([
    Profile.find(mongoFilter).sort('-created_at').skip(skip).limit(lim).lean(),
    Profile.countDocuments(mongoFilter),
  ]);

  if (!profiles) {
    return next(AppError('Unable to interpret query', 400));
  }

  const totalPages = Math.ceil(total / lim);

  return res.status(200).json({
    status: 'success',
    query: q,
    interpreted: parsedFilter,
    total,
    page: pg,
    limit: lim,
    totalPages,
    hasNextPage: pg < totalPages,
    hasPrevPage: pg > 1,
    data: profiles,
  });
});
exports.exportProfiles = catchAsync(async (req, res, next) => {
  const profiles = await Profile.find().lean();
  if (!profiles || profiles.length === 0) {
    return next(new AppError('No profiles found to export', 404));
  }

  const fields = [
    'id',
    'name',
    'gender',
    'age',
    'age_group',
    'country_id',
    'country_name',
    'gender_probability',
    'country_probability',
    'created_at', // ← add this
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(profiles);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=profiles.csv');
  return res.status(200).send(csv);
});
