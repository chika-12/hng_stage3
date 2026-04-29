const crypto = require('crypto');

const generatePkce = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
};

module.exports = generatePkce;
