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
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const advancedReportsRoutes = require('./advancedReportsRoutes');

// Advanced reports (have their own protect/tenant/authorize)
router.use('/', advancedReportsRoutes);

// Classic export/compliance reports
router.use(protect);
router.use(tenantMiddleware);
router.use(authorize('admin', 'hr', 'company_admin'));

router.get('/export/employees', exportEmployees);
router.get('/export/attendance', exportAttendance);
router.get('/export/timesheets', exportTimesheets);
router.get('/export/payroll', exportPayroll);
router.get('/compliance', getComplianceReport);

module.exports = router;
