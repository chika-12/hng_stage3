const rate_limiter = require('express-rate-limit');

const analystLimiter = rate_limiter({
  max: 200,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (req) => `${req.user.id}:analyst`,
  message: JSON.stringify({
    status: 'error',
    message: 'Query limit reached. Try again later.',
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rate_limiter({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (req) => `${req.user.id}:admin`,
  message: JSON.stringify({
    status: 'error',
    message: 'Request limit reached.',
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

exports.roleLimiter = (req, res, next) => {
  if (req.user.role === 'admin') {
    return adminLimiter(req, res, next);
  }
  return analystLimiter(req, res, next);
};