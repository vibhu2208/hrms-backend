const express = require('express');
const router = express.Router();
const {
  getEncashmentRules,
  createEncashmentRule,
  updateEncashmentRule,
  checkEligibility,
  createEncashmentRequest,
  getEncashmentRequests,
  approveEncashmentRequest,
  processForPayroll,
  processAutomaticEncashment,
  getAutomaticSettings
} = require('../controllers/leaveEncashmentController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Encashment Rules Management
router.route('/rules')
  .get(authorize('admin', 'hr'), getEncashmentRules)
  .post(authorize('admin', 'hr'), createEncashmentRule);

router.route('/rules/:id')
  .put(authorize('admin', 'hr'), updateEncashmentRule);

// Eligibility Check
router.post('/check-eligibility', authorize('admin', 'hr', 'manager', 'employee'), checkEligibility);

// Encashment Requests
router.route('/requests')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getEncashmentRequests)
  .post(authorize('admin', 'hr', 'employee'), createEncashmentRequest);

router.post('/requests/:id/approve', authorize('admin', 'hr', 'manager'), approveEncashmentRequest);
router.post('/requests/:id/payroll', authorize('admin', 'hr'), processForPayroll);

// Automatic Encashment
router.post('/automatic/process', authorize('admin', 'hr'), processAutomaticEncashment);
router.get('/automatic/settings', authorize('admin', 'hr'), getAutomaticSettings);

module.exports = router;


