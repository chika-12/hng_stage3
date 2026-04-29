const jwt = require('jsonwebtoken');
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

// const decoded = (refreshToken, secret) => {
//   return jwt.verify(refreshToken, secret);
// };
module.exports = { generateAccessToken, generateRefreshToken };
