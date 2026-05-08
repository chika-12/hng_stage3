const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');
const { protectMiddleWare } = require('../middleWare/protectMiddleWare');
const { seedAnalyst, seedAdmin } = require('../controllers/authController');

authRouter.get('/seed-analyst', seedAnalyst);
authRouter.get('/seed-admin', seedAdmin);
authRouter.get('/github', authController.redirectFunction);
authRouter.get('/github/callback', authController.githubCallbackHandler);
authRouter.post('/refresh', authController.refreshToken);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', protectMiddleWare, authController.whoami);
module.exports = authRouter;
