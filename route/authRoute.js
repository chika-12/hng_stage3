const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');
const { protectMiddleWare } = require('../middleWare/protectMiddleWare');

authRouter.get('/github', authController.redirectFunction);
authRouter.get('/github/callback', authController.githubCallbackHandler);
authRouter.post('/refresh', authController.refreshToken);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', protectMiddleWare, authController.whoami);
module.exports = authRouter;
