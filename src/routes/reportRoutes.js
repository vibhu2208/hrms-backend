const express = require('express');
const router = express.Router();
const {
  exportEmployees,
  exportAttendance,
  exportTimesheets,
  exportPayroll,
  getComplianceReport
} = require('../controllers/reportController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.get('/export/employees', exportEmployees);
router.get('/export/attendance', exportAttendance);
router.get('/export/timesheets', exportTimesheets);
router.get('/export/payroll', exportPayroll);
router.get('/compliance', getComplianceReport);

module.exports = router;
