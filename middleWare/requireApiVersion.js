module.exports = (req, res, next) => {
  const exempt = [
    '/auth/github',
    '/auth/github/callback',
    '/auth/seed-analyst',
    '/auth/seed-admin',
    '/auth/refresh',
    '/auth/logout',
  ];

  if (exempt.some((path) => req.path.includes(path))) return next();

  const version = req.headers['api-version'] || req.headers['x-api-version'];
  if (!version) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required header: api-version',
    });
  }
  next();
};
