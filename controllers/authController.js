const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/user');
const generatePKCE = require('../utils/pkce');
const crypto = require('crypto');
const axios = require('axios');
const github_access_url = 'https://github.com/login/oauth/access_token';
const getGitHubUser = 'https://api.github.com/user';
const generateTokens = require('../utils/generateToken');
const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';

const cookieConfig = {
  oauth: {
    httpOnly: true,
    maxAge: 60000,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  },
  accessToken: {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  },
  refreshToken: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  },
};

exports.redirectFunction = catchAsync(async (req, res, next) => {
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePKCE();
  const source = req.query.source || 'web';

  res.cookie('code_verifier', codeVerifier, cookieConfig.oauth);
  res.cookie('oauth_state', state, cookieConfig.oauth);
  res.cookie('oauth_source', source, cookieConfig.oauth);

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    state,
    scope: 'read:user user:email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

exports.githubCallbackHandler = catchAsync(async (req, res, next) => {
  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;
  const code_verifier = req.cookies.code_verifier;
  const source = req.cookies.oauth_source;

  // Explicit guard for every missing/invalid case
  if (!code) return next(new AppError('Missing code', 400));
  if (!state) return next(new AppError('Missing state', 400));
  if (!storedState) return next(new AppError('Missing state cookie', 400));
  if (state !== storedState)
    return next(new AppError('Invalid state parameter', 401));
  if (!code_verifier) return next(new AppError('Missing PKCE verifier', 400));

  // Clear one-time cookies immediately
  res.clearCookie('code_verifier');
  res.clearCookie('oauth_state');
  res.clearCookie('oauth_source');

  const responseFromGit = await axios.post(
    github_access_url,
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
      code_verifier,
    },
    { headers: { Accept: 'application/json' } }
  );

  const githubAccessToken = responseFromGit.data.access_token;

  if (!githubAccessToken) {
    return next(new AppError('Failed to get GitHub access token', 401));
  }

  const userCredentials = await axios.get(getGitHubUser, {
    headers: { Authorization: `Bearer ${githubAccessToken}` },
  });

  const { id: githubId, login: username } = userCredentials.data;
  let { email } = userCredentials.data;

  if (!email) {
    try {
      const emailRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${githubAccessToken}` },
      });
      const primary = emailRes.data.find((e) => e.primary && e.verified);
      email = primary ? primary.email : `${githubId}@noemail.github`;
    } catch {
      email = `${githubId}@noemail.github`;
    }
  }

  const user = await User.findOneAndUpdate(
    { githubId },
    { username, githubId, email },
    { upsert: true, new: true }
  );

  const refreshToken = generateTokens.generateRefreshToken(user._id);
  const accessToken = generateTokens.generateAccessToken(user._id, user.role);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  if (source === 'cli') {
    return res.redirect(
      `http://localhost:4242/?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
  }

  res.cookie('access_token', accessToken, cookieConfig.accessToken);
  res.cookie('refresh_token', refreshToken, cookieConfig.refreshToken);
  res.redirect(process.env.WEB_PORTAL_URL);
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const token = req.body.refreshToken || req.cookies.refresh_token;

  if (!token) return next(new AppError('No refresh token provided', 401));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== token) {
    return next(new AppError('Invalid refresh token', 403));
  }

  const accessToken = generateTokens.generateAccessToken(user._id, user.role);
  return res.status(200).json({ accessToken });
});

exports.logout = catchAsync(async (req, res, next) => {
  const token = req.body.refreshToken || req.cookies.refresh_token;

  if (!token) return next(new AppError('No refresh token provided', 401));

  const user = await User.findOne({ refreshToken: token });
  if (!user) return next(new AppError('Invalid refresh token', 403));

  user.refreshToken = null;
  await user.save({ validateBeforeSave: false });

  res.clearCookie('access_token');
  res.clearCookie('refresh_token');

  return res.status(200).json({ status: 'success' });
});

exports.whoami = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-refreshToken -__v');
  res.status(200).json({ success: true, data: user });
});
