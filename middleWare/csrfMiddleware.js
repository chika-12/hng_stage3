const crypto = require('crypto');
const AppError = require('../utils/appError');

const isProd = process.env.NODE_ENV === 'production';

const EXEMPT_PATHS = [
  '/auth/github',
  '/auth/github/callback',
  '/api/v1/auth/github',
  '/api/v1/auth/github/callback',
];

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

exports.csrfCookie = (req, res, next) => {
  if (!req.cookies.csrf_token) {
    const token = generateCsrfToken();
    res.cookie('csrf_token', token, {
      httpOnly: false, // must be readable by JS
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
};

exports.csrfProtect = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  if (EXEMPT_PATHS.includes(req.path)) return next();

  const cookieToken = req.cookies.csrf_token;
  const headerToken =
    req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieToken || !headerToken) {
    return next(new AppError('CSRF token missing', 403));
  }

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (
    cookieBuf.length !== headerBuf.length ||
    !crypto.timingSafeEqual(cookieBuf, headerBuf)
  ) {
    return next(new AppError('Invalid CSRF token', 403));
  }

  next();
};
