const express = require('express');
const router = express.Router();
const {
  getPayrolls,
  getPayroll,
  createPayroll,
  updatePayroll,
  processPayment,
  deletePayroll,
  bulkGeneratePayroll
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

router.route('/')
  .get(getPayrolls)
  .post(authorize('admin', 'hr'), createPayroll);

router.post('/bulk-generate', authorize('admin', 'hr'), bulkGeneratePayroll);
router.put('/:id/process', authorize('admin', 'hr'), processPayment);

router.route('/:id')
  .get(getPayroll)
  .put(authorize('admin', 'hr'), updatePayroll)
  .delete(authorize('admin'), deletePayroll);

module.exports = router;
