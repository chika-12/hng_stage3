const COUNTRY_MAP = {
  nigeria: 'NG',
  ghana: 'GH',
  kenya: 'KE',
  tanzania: 'TZ',
  uganda: 'UG',
  ethiopia: 'ET',
  angola: 'AO',
  cameroon: 'CM',
  senegal: 'SN',
  mali: 'ML',
  niger: 'NE',
  zambia: 'ZM',
  zimbabwe: 'ZW',
  mozambique: 'MZ',
  madagascar: 'MG',
  rwanda: 'RW',
  benin: 'BJ',
  togo: 'TG',
  guinea: 'GN',
  chad: 'TD',
  somalia: 'SO',
  sudan: 'SD',
  egypt: 'EG',
  morocco: 'MA',
  algeria: 'DZ',
  tunisia: 'TN',
  libya: 'LY',
  'south africa': 'ZA',
  'ivory coast': 'CI',
  'cote divoire': 'CI',
  liberia: 'LR',
  sierra: 'SL',
  botswana: 'BW',
  namibia: 'NA',
  malawi: 'MW',
  burundi: 'BI',
  eritrea: 'ER',
  gabon: 'GA',
};

const AGE_GROUP_MAP = {
  child: 'child',
  children: 'child',
  kid: 'child',
  kids: 'child',
  teen: 'teenager',
  teens: 'teenager',
  teenager: 'teenager',
  teenagers: 'teenager',
  adolescent: 'teenager',
  adolescents: 'teenager',
  adult: 'adult',
  adults: 'adult',
  senior: 'senior',
  seniors: 'senior',
  elderly: 'senior',
  elder: 'senior',
};

const parseSearchQuery = (q) => {
  if (!q || typeof q !== 'string') return null;

  const input = q.toLowerCase().trim();
  const filter = {};
  let matched = false;

  // ── GENDER
  const hasMale = /\bmales?\b|\bmen\b|\bman\b|\bboys?\b/.test(input);
  const hasFemale = /\bfemales?\b|\bwomen\b|\bwoman\b|\bgirls?\b/.test(input);

  if (hasMale && !hasFemale) {
    filter.gender = 'male';
    matched = true;
  } else if (hasFemale && !hasMale) {
    filter.gender = 'female';
    matched = true;
  } else if (hasMale && hasFemale) {
    matched = true;
  }

  // ── "YOUNG" 16–24
  if (/\byoung\b/.test(input)) {
    filter.min_age = 16;
    filter.max_age = 24;
    matched = true;
  }

  //AGE GROUP
  for (const [keyword, group] of Object.entries(AGE_GROUP_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`).test(input)) {
      filter.age_group = group;
      matched = true;
      break;
    }
  }

  // ── AGE RANGES
  const aboveMatch = input.match(/(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) {
    filter.min_age = Number(aboveMatch[1]);
    matched = true;
  }

  const belowMatch = input.match(/(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) {
    filter.max_age = Number(belowMatch[1]);
    matched = true;
  }

  const betweenMatch = input.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filter.min_age = Number(betweenMatch[1]);
    filter.max_age = Number(betweenMatch[2]);
    matched = true;
  }

  // ── COUNTRY
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(input)) {
      filter.country_id = code;
      matched = true;
      break;
    }
  }

  if (!matched) return null;
  return filter;
};

module.exports = parseSearchQuery;
