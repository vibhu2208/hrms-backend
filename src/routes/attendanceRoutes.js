const express = require('express');
const router = express.Router();
const {
  getAttendance,
  getSingleAttendance,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/stats', authorize('admin', 'hr'), getAttendanceStats);
router.route('/')
  .get(getAttendance)
  .post(authorize('admin', 'hr'), markAttendance);

router.route('/:id')
  .get(getSingleAttendance)
  .put(authorize('admin', 'hr'), updateAttendance)
  .delete(authorize('admin', 'hr'), deleteAttendance);

module.exports = router;
