const express = require('express');
const router = express.Router();
const {
  getAccrualPolicies,
  getAccrualPolicy,
  createAccrualPolicy,
  updateAccrualPolicy,
  deleteAccrualPolicy,
  triggerMonthlyAccrual,
  triggerYearlyAccrual,
  triggerCarryForward,
  initializeEmployeeBalances,
  getAccrualHistory
} = require('../controllers/leaveAccrualController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Policy management routes
router.route('/policies')
  .get(authorize('admin', 'hr'), getAccrualPolicies)
  .post(authorize('admin', 'hr'), createAccrualPolicy);

router.route('/policies/:id')
  .get(authorize('admin', 'hr'), getAccrualPolicy)
  .put(authorize('admin', 'hr'), updateAccrualPolicy)
  .delete(authorize('admin', 'hr'), deleteAccrualPolicy);

// Manual trigger routes
router.post('/trigger/monthly', authorize('admin', 'hr'), triggerMonthlyAccrual);
router.post('/trigger/yearly', authorize('admin', 'hr'), triggerYearlyAccrual);
router.post('/trigger/carry-forward', authorize('admin', 'hr'), triggerCarryForward);
router.post('/initialize', authorize('admin', 'hr'), initializeEmployeeBalances);

// History and reports
router.get('/history', authorize('admin', 'hr', 'manager', 'employee'), getAccrualHistory);

module.exports = router;


