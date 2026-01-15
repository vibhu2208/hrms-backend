const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const {
  getThemePreference,
  updateThemePreference,
  getUserProfile,
  getAllUsers
} = require('../controllers/userController');

// All routes are protected
router.use(protect);
router.use(tenantMiddleware);

// Theme preference routes
router.get('/theme', getThemePreference);
router.put('/theme', updateThemePreference);

// User profile route
router.get('/profile', getUserProfile);

// Admin only - Get all users for current tenant
router.get('/all', authorize('admin', 'hr', 'company_admin'), getAllUsers);

module.exports = router;
