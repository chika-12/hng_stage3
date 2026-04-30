module.exports = (req, res, next) => {
  const version = req.headers['api-version'] || req.headers['x-api-version'];
  if (!version) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required header: api-version',
    });
  }
  next();
};
