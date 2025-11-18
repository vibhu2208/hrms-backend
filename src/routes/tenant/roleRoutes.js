const express = require('express');
const router = express.Router();

// Import controllers
const {
  createEmployeeRole,
  getEmployeeRoleConfigs,
  getTenantRolesAndUsers,
  updateUserStatus,
  resetUserPassword
} = require('../../controllers/tenant/roleController');

// Import middlewares
const { protect } = require('../../middlewares/auth');
// Note: Removed tenantMiddleware - we handle tenant connections manually in controllers

/**
 * @route   GET /api/tenant/roles/configs
 * @desc    Get available employee role configurations
 * @access  Admin only
 */
router.get('/configs', 
  protect,
  getEmployeeRoleConfigs
);

/**
 * @route   POST /api/tenant/roles
 * @desc    Create new employee role and auto-generate user account
 * @access  Admin only
 */
router.post('/', 
  protect,
  createEmployeeRole
);

/**
 * @route   GET /api/tenant/roles
 * @desc    Get all roles and users for current tenant
 * @access  Admin only
 */
router.get('/', 
  protect,
  getTenantRolesAndUsers
);

/**
 * @route   PUT /api/tenant/roles/users/:userId/status
 * @desc    Update user status (activate/deactivate)
 * @access  Admin only
 */
router.put('/users/:userId/status', 
  protect,
  updateUserStatus
);

/**
 * @route   PUT /api/tenant/roles/users/:userId/reset-password
 * @desc    Reset user password to default
 * @access  Admin only
 */
router.put('/users/:userId/reset-password', 
  protect,
  resetUserPassword
);

module.exports = router;
