const express = require('express');
const router = express.Router();
const {
  getPayrolls,
  getPayroll,
  createPayroll,
  updatePayroll,
  processPayment,
  deletePayroll
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getPayrolls)
  .post(authorize('admin', 'hr'), createPayroll);

router.put('/:id/process', authorize('admin', 'hr'), processPayment);

router.route('/:id')
  .get(getPayroll)
  .put(authorize('admin', 'hr'), updatePayroll)
  .delete(authorize('admin'), deletePayroll);

module.exports = router;
