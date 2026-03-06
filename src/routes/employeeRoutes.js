const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats
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
router.post('/google-sheets/fetch', authorize('admin', 'hr', 'company_admin'), fetchGoogleSheetData);
router.get('/google-sheets/auth-url', authorize('admin', 'hr', 'company_admin'), getAuthUrl);
router.get('/google-sheets/callback', handleOAuthCallback);

router.get('/stats', authorize('admin', 'hr', 'company_admin'), getEmployeeStats);
router.route('/')
  .get(getEmployees)
  .post(authorize('admin', 'hr', 'company_admin'), createEmployee);

router.route('/:id')
  .get(getEmployee)
  .put(authorize('admin', 'hr', 'company_admin'), updateEmployee)
  .delete(authorize('admin', 'company_admin'), deleteEmployee);

module.exports = router;
