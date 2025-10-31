const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getThemePreference,
  updateThemePreference,
  getUserProfile
} = require('../controllers/userController');

// All routes are protected
router.use(protect);

// Theme preference routes
router.get('/theme', getThemePreference);
router.put('/theme', updateThemePreference);

// User profile route
router.get('/profile', getUserProfile);

module.exports = router;
