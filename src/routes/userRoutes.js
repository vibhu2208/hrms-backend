const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
  getThemePreference,
  updateThemePreference,
  getUserProfile,
  getAllUsers
} = require('../controllers/userController');

// All routes are protected
router.use(protect);

// Theme preference routes
router.get('/theme', getThemePreference);
router.put('/theme', updateThemePreference);

// User profile route
router.get('/profile', getUserProfile);

// Admin only - Get all users
router.get('/all', authorize('admin'), getAllUsers);

module.exports = router;
