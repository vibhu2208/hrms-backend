const express = require('express');
const router = express.Router();
const {
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  syncEmployeeMaster,
  syncLeaveBalance,
  syncAttendance,
  getSyncLogs,
  getConflicts,
  resolveConflict
} = require('../controllers/sapController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Connection management routes
router.route('/connection')
  .get(authorize('admin', 'hr'), getConnections)
  .post(authorize('admin', 'hr'), createConnection);

router.route('/connection/:id')
  .get(authorize('admin', 'hr'), getConnection)
  .put(authorize('admin', 'hr'), updateConnection)
  .delete(authorize('admin', 'hr'), deleteConnection);

router.post('/connection/:id/test', authorize('admin', 'hr'), testConnection);

// Sync operations
router.post('/connection/:connectionId/sync/employee', authorize('admin', 'hr'), syncEmployeeMaster);
router.post('/connection/:connectionId/sync/leave', authorize('admin', 'hr'), syncLeaveBalance);
router.post('/connection/:connectionId/sync/attendance', authorize('admin', 'hr'), syncAttendance);

// Logs and conflicts
router.get('/logs', authorize('admin', 'hr'), getSyncLogs);
router.get('/conflicts', authorize('admin', 'hr'), getConflicts);
router.put('/connection/:connectionId/conflicts/:conflictId/resolve', authorize('admin', 'hr'), resolveConflict);

module.exports = router;


