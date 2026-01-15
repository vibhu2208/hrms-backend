const express = require('express');
const router = express.Router();
const {
  getTimesheets,
  getTimesheet,
  createTimesheet,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  deleteTimesheet
} = require('../controllers/timesheetController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

router.route('/')
  .get(getTimesheets)
  .post(createTimesheet);

router.put('/:id/submit', submitTimesheet);
router.put('/:id/approve', authorize('admin', 'hr', 'client'), approveTimesheet);
router.put('/:id/reject', authorize('admin', 'hr', 'client'), rejectTimesheet);

router.route('/:id')
  .get(getTimesheet)
  .put(updateTimesheet)
  .delete(deleteTimesheet);

module.exports = router;
