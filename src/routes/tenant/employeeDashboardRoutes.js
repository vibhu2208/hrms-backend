const express = require('express');
const router = express.Router();

// Import controllers
const {
  getEmployeeDashboard,
  getNavigationMenu
} = require('../../controllers/tenant/employeeDashboardController');

// Import middlewares
const { 
  authenticateTenantUser,
  checkPasswordChangeRequired
} = require('../../middlewares/tenantAuth');

/**
 * @route   GET /api/tenant/employee/dashboard
 * @desc    Get role-specific employee dashboard data
 * @access  Private (Tenant Employee)
 */
router.get('/dashboard', 
  authenticateTenantUser,
  checkPasswordChangeRequired,
  getEmployeeDashboard
);

/**
 * @route   GET /api/tenant/employee/navigation
 * @desc    Get role-specific navigation menu
 * @access  Private (Tenant Employee)
 */
router.get('/navigation', 
  authenticateTenantUser,
  checkPasswordChangeRequired,
  getNavigationMenu
);

module.exports = router;
