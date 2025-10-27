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

router.use(protect);

// Bulk upload routes
router.post('/bulk/validate', authorize('admin', 'hr'), validateBulkEmployees);
router.post('/bulk/create', authorize('admin', 'hr'), bulkCreateEmployees);
router.get('/bulk/template', getTemplate);

// Google Sheets integration routes
router.post('/google-sheets/fetch', authorize('admin', 'hr'), fetchGoogleSheetData);
router.get('/google-sheets/auth-url', authorize('admin', 'hr'), getAuthUrl);
router.get('/google-sheets/callback', handleOAuthCallback);

router.get('/stats', authorize('admin', 'hr'), getEmployeeStats);
router.route('/')
  .get(getEmployees)
  .post(authorize('admin', 'hr'), createEmployee);

router.route('/:id')
  .get(getEmployee)
  .put(authorize('admin', 'hr'), updateEmployee)
  .delete(authorize('admin'), deleteEmployee);

module.exports = router;
