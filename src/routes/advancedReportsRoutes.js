const express = require('express');
const router = express.Router();
const {
  getLeaveEntitlementReport,
  getLeaveBalanceReport,
  getLeaveUtilizationReport,
  getAttendanceSummaryReport,
  getAttendanceExceptionReport,
  getComplianceStatusReport,
  getAttendanceAnalytics,
  getLeaveAnalytics,
  getComplianceAnalytics,
  getPerformanceIndicators
} = require('../controllers/reportController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Leave Reports
router.get('/leave/entitlement', authorize('admin', 'hr', 'manager'), getLeaveEntitlementReport);
router.get('/leave/balance', authorize('admin', 'hr', 'manager'), getLeaveBalanceReport);
router.get('/leave/utilization', authorize('admin', 'hr', 'manager'), getLeaveUtilizationReport);

// Attendance Reports
router.get('/attendance/summary', authorize('admin', 'hr', 'manager'), getAttendanceSummaryReport);
router.get('/attendance/exceptions', authorize('admin', 'hr', 'manager'), getAttendanceExceptionReport);

// Compliance Reports
router.get('/compliance/status', authorize('admin', 'hr'), getComplianceStatusReport);

// Analytics
router.get('/analytics/attendance', authorize('admin', 'hr', 'manager'), getAttendanceAnalytics);
router.get('/analytics/leave', authorize('admin', 'hr', 'manager'), getLeaveAnalytics);
router.get('/analytics/compliance', authorize('admin', 'hr'), getComplianceAnalytics);
router.get('/analytics/performance', authorize('admin', 'hr'), getPerformanceIndicators);

module.exports = router;


