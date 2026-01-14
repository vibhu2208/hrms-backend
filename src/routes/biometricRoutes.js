const express = require('express');
const router = express.Router();
const {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  testConnection,
  syncEmployees,
  pullAttendance,
  processAttendance,
  getSyncLogs,
  reprocess
} = require('../controllers/biometricController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Device management routes
router.route('/devices')
  .get(authorize('admin', 'hr'), getDevices)
  .post(authorize('admin', 'hr'), createDevice);

router.route('/devices/:id')
  .get(authorize('admin', 'hr'), getDevice)
  .put(authorize('admin', 'hr'), updateDevice)
  .delete(authorize('admin', 'hr'), deleteDevice);

router.post('/devices/:id/test', authorize('admin', 'hr'), testConnection);

// Sync operations
router.post('/devices/:deviceId/sync/employees', authorize('admin', 'hr'), syncEmployees);
router.post('/devices/:deviceId/sync/attendance', authorize('admin', 'hr'), pullAttendance);

// Processing
router.post('/process', authorize('admin', 'hr'), processAttendance);

// Logs and reprocessing
router.get('/logs', authorize('admin', 'hr'), getSyncLogs);
router.post('/reprocess/:syncLogId', authorize('admin', 'hr'), reprocess);

module.exports = router;


