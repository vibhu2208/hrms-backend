const express = require('express');
const router = express.Router();

// Import controllers
const {
  getSystemInfo,
  getMyPermissions,
  createTestRole,
  validatePermissions,
  cleanupTestData
} = require('../../controllers/tenant/testController');

// Import middlewares
const { protect } = require('../../middlewares/auth');
const { 
  authenticateTenantUser,
  checkPasswordChangeRequired
} = require('../../middlewares/tenantAuth');
const { tenantMiddleware } = require('../../middlewares/tenantMiddleware');

/**
 * @route   GET /api/tenant/test/system-info
 * @desc    Get tenant role system information (Admin only)
 * @access  Private (Admin)
 */
router.get('/system-info', 
  tenantMiddleware,
  protect,
  getSystemInfo
);

/**
 * @route   GET /api/tenant/test/my-permissions
 * @desc    Get current tenant user permissions
 * @access  Private (Tenant User)
 */
router.get('/my-permissions', 
  authenticateTenantUser,
  checkPasswordChangeRequired,
  getMyPermissions
);

/**
 * @route   POST /api/tenant/test/create-test-role
 * @desc    Create test role and user for testing (Admin only)
 * @access  Private (Admin)
 */
router.post('/create-test-role', 
  tenantMiddleware,
  protect,
  createTestRole
);

/**
 * @route   POST /api/tenant/test/validate-permissions
 * @desc    Validate user permissions against test set
 * @access  Private (Tenant User)
 */
router.post('/validate-permissions', 
  authenticateTenantUser,
  checkPasswordChangeRequired,
  validatePermissions
);

/**
 * @route   DELETE /api/tenant/test/cleanup
 * @desc    Clean up test data (Admin only)
 * @access  Private (Admin)
 */
router.delete('/cleanup', 
  tenantMiddleware,
  protect,
  cleanupTestData
);

module.exports = router;
