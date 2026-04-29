const AppError = require('../utils/appError');

const queryBuilder = (query) => {
  const filter = {};

  const VALID_SORT_FIELDS = ['age', 'created_at', 'gender_probability'];
  const VALID_ORDERS = ['asc', 'desc'];

  if (query.gender) {
    filter.gender = query.gender;
  }
  if (query.age_group) {
    const age_list = query.age_group.split(',');
    filter.age_group = { $in: age_list };
  }
  if (query.country_id) {
    const country_list = query.country_id.toUpperCase().split(',');
    filter.country_id = { $in: country_list };
  }
  if (query.min_age || query.max_age) {
    filter.age = {};
    if (query.min_age) filter.age.$gte = Number(query.min_age);
    if (query.max_age) filter.age.$lte = Number(query.max_age);
  }

  if (query.min_gender_probability) {
    filter.gender_probability = { $gte: Number(query.min_gender_probability) };
  }

  if (query.min_country_probability) {
    filter.country_probability = {
      $gte: Number(query.min_country_probability),
    };
  }

  const sortField = query.sort_by;
  const sortOrder = query.order || 'asc';

  // Validate
  if (sortField && !VALID_SORT_FIELDS.includes(sortField)) {
    throw new AppError('Invalid query parameters', 400);
  }
  if (query.order && !VALID_ORDERS.includes(query.order)) {
    throw new AppError('Invalid query parameters', 400);
  }

  // Build sort string: "age" + "desc" → "-age", "age" + "asc" → "age"
  const sortBy = sortField
    ? sortOrder === 'desc'
      ? `-${sortField}`
      : sortField
    : '-created_at';

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;
  return { filter, sortBy, page, limit, skip };
};

module.exports = queryBuilder;
