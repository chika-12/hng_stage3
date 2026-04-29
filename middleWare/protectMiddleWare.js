const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.protectMiddleWare = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.header('Authorization') &&
    req.header('Authorization').startsWith('Bearer')
  ) {
    token = req.header('Authorization').split(' ')[1];
  } else {
    token = req.cookies?.access_token;
  }

  if (!token) {
    return next(new AppError('You are not logged in', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    }
    return next(new AppError('Invalid token', 401));
  }

  if (!decoded?.id) {
    return next(new AppError('Invalid token', 401));
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('No user found', 404));
  }

  req.user = user;
  next();
});

exports.requireRole = (role) => {
  return (req, res, next) => {
    if (!role.includes(req.user.role)) {
      return next(new AppError('Access denied', 403));
    }
    next();
  };
};
