const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const invalidateProfileCache = async () => {
  const keys = await redis.keys('profiles:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Cache invalidated: ${keys.length} keys cleared`);
  }
};

const normalizeQuery = (query) => {
  return Object.keys(query)
    .sort()
    .reduce((acc, key) => {
      acc[key] = query[key].toString().toLowerCase().trim();
      return acc;
    }, {});
};
module.exports = { redis, invalidateProfileCache, normalizeQuery };
