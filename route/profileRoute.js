const express = require('express');
const profileRoute = express.Router();
const controllers = require('../controllers/profileControllers');
const {
  protectMiddleWare,
  requireRole,
} = require('../middleWare/protectMiddleWare');
const authController = require('../controllers/authController');
const roleLimiter = require('../middleWare/role_limiter')

//profileRoute.use(protectMiddleWare);
profileRoute.get(
  '/profiles/search',
  protectMiddleWare,requireRole(['analyst', 'admin']),roleLimiter.roleLimiter,
  controllers.searchProfiles
);
profileRoute
  .route('/profiles')
  .get(protectMiddleWare, requireRole(['admin', 'analyst']),roleLimiter.roleLimiter, controllers.getProfiles)
  .post(protectMiddleWare, requireRole(['admin']), roleLimiter.roleLimiter, controllers.createProfiles);

profileRoute.get('/users/me', protectMiddleWare, authController.whoami);

profileRoute.get(
  '/profiles/export',
  protectMiddleWare,
  requireRole(['admin', 'analyst']),
  controllers.exportProfiles
);

profileRoute
  .route('/profiles/:id')
  .get(protectMiddleWare, requireRole(['admin', 'analyst']), controllers.getProfilesById)
  .delete(
    protectMiddleWare,
    requireRole(['admin']),
    controllers.deleteProfileById
  );

module.exports = profileRoute;
