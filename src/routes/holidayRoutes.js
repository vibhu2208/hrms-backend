const express = require('express');
const router = express.Router();
const {
  getHolidays,
  getHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidaysByLocation,
  bulkCreateHolidays
} = require('../controllers/holidayController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getHolidays)
  .post(authorize('admin', 'hr'), createHoliday);

router.post('/bulk', authorize('admin', 'hr'), bulkCreateHolidays);

router.get('/location/:location', authorize('admin', 'hr', 'manager', 'employee'), getHolidaysByLocation);

router.route('/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getHoliday)
  .put(authorize('admin', 'hr'), updateHoliday)
  .delete(authorize('admin', 'hr'), deleteHoliday);

module.exports = router;


