const VALID_GENDERS = ['male', 'female', 'other'];
const REQUIRED_FIELDS = [
  'name',
  'age',
  'gender',
  'gender_probability',
  'age_group',
  'country_id',
  'country_name',
  'country_probability',
];

function validateRow(row) {
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].toString().trim() === '') {
      return { valid: false, reason: 'missing_fields' };
    }
  }
  const age = parseInt(row.age, 10);
  if (isNaN(age) || age < 0 || age > 150) {
    return { valid: false, reason: 'invalid_age' };
  }

  if (!VALID_GENDERS.includes(row.gender.toLowerCase().trim())) {
    return { valid: false, reason: 'invalid_gender' };
  }
  return { valid: true };
}

function normalizeRow(row) {
  return {
    // id: row.id.trim(),
    name: row.name.trim(),
    age: parseInt(row.age, 10),
    gender: row.gender.toLowerCase().trim(),
    gender_probability: parseFloat(row.gender_probability),
    age_group: row.age_group.trim(),
    country_id: row.country_id.trim(),
    country_name: row.country_name.trim(),
    country_probability: parseFloat(row.country_probability),
  };
}
module.exports = { validateRow, normalizeRow };
