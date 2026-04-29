const AppError = require('../utils/appError');

const ALLOWED_PARAMS = [
  'gender',
  'age_group',
  'country_id',
  'min_age',
  'max_age',
  'min_gender_probability',
  'min_country_probability',
  'page',
  'limit',
  'sort',
  'sort_by',
  'order',
];

const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior', 'children'];

const validateQuery = (query) => {
  const errors = [];

  // Unknown parameters
  const unknownParams = Object.keys(query).filter(
    (key) => !ALLOWED_PARAMS.includes(key)
  );
  if (unknownParams.length) {
    errors.push(`Unknown parameter(s): ${unknownParams.join(', ')}`);
  }

  // gender
  if (query.gender && !VALID_GENDERS.includes(query.gender.toLowerCase())) {
    errors.push(`Invalid gender. Accepted: ${VALID_GENDERS.join(', ')}`);
  }

  // age_group
  if (query.age_group) {
    const validAgeGoup = query.age_group.toLowerCase().split(',');
    const isValid = validAgeGoup.every((group) =>
      VALID_AGE_GROUPS.includes(group.trim())
    );
    if (!isValid) {
      errors.push(
        `Invalid age_group. Accepted: ${VALID_AGE_GROUPS.join(', ')}`
      );
    }
  }

  // country_id
  if (
    query.country_id &&
    !/^[A-Za-z]{2}(,[A-Za-z]{2})*$/.test(query.country_id)
  ) {
    errors.push('country_id must be a 2-letter ISO code (e.g. NG, KE)');
  }

  // numeric fields
  const numericFields = [
    'min_age',
    'max_age',
    'min_gender_probability',
    'min_country_probability',
    'page',
    'limit',
  ];
  for (const field of numericFields) {
    if (query[field] !== undefined) {
      const val = Number(query[field]);
      if (isNaN(val)) {
        errors.push(`${field} must be a number`);
      }
    }
  }

  // min_age vs max_age
  if (query.min_age && query.max_age) {
    if (Number(query.min_age) > Number(query.max_age)) {
      errors.push('min_age cannot be greater than max_age');
    }
  }

  // probability range
  for (const field of ['min_gender_probability', 'min_country_probability']) {
    if (query[field] !== undefined) {
      const val = Number(query[field]);
      if (!isNaN(val) && (val < 0 || val > 1)) {
        errors.push(`${field} must be between 0 and 1`);
      }
    }
  }

  if (errors.length) {
    console.log(errors);
    throw new AppError('Invalid query parameters', 400);
  }
};

module.exports = validateQuery;
