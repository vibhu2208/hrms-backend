const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployee,
  getEmployeesForOffboarding,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
  deleteEmployee,
  getEmployeeStats,
  getMyProfile,
  getMyProfileStats
} = require('../controllers/employeeController');
const {
  validateBulkEmployees,
  bulkCreateEmployees,
  getTemplate
} = require('../controllers/bulkEmployeeController');
const {
  fetchGoogleSheetData,
  getAuthUrl,
  handleOAuthCallback
} = require('../controllers/googleSheetsController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Bulk upload routes
router.post('/bulk/validate', authorize('admin', 'hr', 'company_admin'), validateBulkEmployees);
router.post('/bulk/create', authorize('admin', 'hr', 'company_admin'), bulkCreateEmployees);
router.get('/bulk/template', getTemplate);

// Google Sheets integration routes
router.post('/google-sheets/fetch', authorize('admin', 'hr'), fetchGoogleSheetData);
router.get('/google-sheets/auth-url', authorize('admin', 'hr'), getAuthUrl);
router.get('/google-sheets/callback', handleOAuthCallback);

// IMPORTANT: static paths before /:id (otherwise "profile" is treated as an ObjectId → 500)
router.get('/profile', getMyProfile);
router.get('/profile/stats', getMyProfileStats);

router.get('/stats', authorize('admin', 'hr', 'company_admin'), getEmployeeStats);
router.get('/for-offboarding', authorize('admin', 'hr', 'company_admin'), getEmployeesForOffboarding);
router.route('/')
  .get(authorize('admin', 'hr', 'company_admin', 'manager'), getEmployees)
  .post(authorize('admin', 'hr', 'company_admin'), createEmployee);

router.put('/:id/reset-password', authorize('admin', 'hr', 'company_admin'), resetEmployeePassword);

router.route('/:id')
  .get(authorize('admin', 'hr', 'company_admin', 'manager'), getEmployee)
  .put(authorize('admin', 'hr', 'company_admin'), updateEmployee)
  .delete(authorize('admin', 'company_admin'), deleteEmployee);

module.exports = router;
