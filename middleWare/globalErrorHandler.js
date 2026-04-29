module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    console.log(err);
    return res.status(422).json({
      status: 'error',
      message: 'Invalid query parameter',
    });
  }

  // Mongoose cast error (e.g. bad ObjectId)
  if (err.name === 'CastError') {
    console.log(err);
    return res.status(422).json({
      status: 'error',
      message: 'Invalid query parameter',
    });
  }

  // Operational errors we threw ourselves
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Unknown/unexpected errors
  console.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong. Please try again later.',
  });
};
