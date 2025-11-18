const express = require('express');
const router = express.Router();

// Import controllers
const {
  tenantLogin,
  changePassword,
  getProfile,
  updateProfile
} = require('../../controllers/tenant/authController');

// Import middlewares
const { 
  authenticateTenantUser,
  checkPasswordChangeRequired
} = require('../../middlewares/tenantAuth');

/**
 * @route   POST /api/tenant/auth/login
 * @desc    Tenant user login
 * @access  Public
 */
router.post('/login', tenantLogin);

/**
 * @route   PUT /api/tenant/auth/change-password
 * @desc    Change user password (first login or regular change)
 * @access  Private (Tenant User)
 */
router.put('/change-password', 
  authenticateTenantUser,
  changePassword
);

/**
 * @route   GET /api/tenant/auth/profile
 * @desc    Get current user profile
 * @access  Private (Tenant User)
 */
router.get('/profile', 
  authenticateTenantUser,
  checkPasswordChangeRequired,
  getProfile
);

/**
 * @route   PUT /api/tenant/auth/profile
 * @desc    Update user profile
 * @access  Private (Tenant User)
 */
router.put('/profile', 
  authenticateTenantUser,
  checkPasswordChangeRequired,
  updateProfile
);

module.exports = router;
