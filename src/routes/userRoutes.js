const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const {
  getThemePreference,
  updateThemePreference,
  getUserProfile,
  getAllUsers,
  createUser
} = require('../controllers/userController');

// All routes are protected
router.use(protect);
router.use(tenantMiddleware);

// Theme preference routes
router.get('/theme', getThemePreference);
router.put('/theme', updateThemePreference);

// User profile route
router.get('/profile', getUserProfile);

// Admin and Company Admin - Get all users for current tenant
router.get('/all', authorize('admin', 'company_admin'), getAllUsers);

// Admin and Company Admin - Create new user
router.post('/create', authorize('admin', 'company_admin'), createUser);

module.exports = router;
