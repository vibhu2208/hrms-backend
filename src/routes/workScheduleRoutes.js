const express = require('express');
const router = express.Router();
const {
  // Shift Template routes
  getShiftTemplates,
  getShiftTemplate,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  // Work Schedule routes
  getWorkSchedules,
  createWorkSchedule,
  // Roster Assignment routes
  getRosterAssignments,
  createRosterAssignment,
  bulkUploadRoster,
  // Roster Change Request routes
  getRosterChangeRequests,
  createRosterChangeRequest,
  approveRosterChangeRequest,
  rejectRosterChangeRequest,
  // Calendar view
  getRosterCalendar
} = require('../controllers/workScheduleController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const multer = require('multer');

// Configure multer for memory storage (for Excel files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  }
});

router.use(protect);
router.use(tenantMiddleware);

// ==================== SHIFT TEMPLATE ROUTES ====================
router.route('/shifts')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getShiftTemplates)
  .post(authorize('admin', 'hr'), createShiftTemplate);

router.route('/shifts/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getShiftTemplate)
  .put(authorize('admin', 'hr'), updateShiftTemplate)
  .delete(authorize('admin', 'hr'), deleteShiftTemplate);

// ==================== WORK SCHEDULE ROUTES ====================
router.route('/schedules')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getWorkSchedules)
  .post(authorize('admin', 'hr'), createWorkSchedule);

// ==================== ROSTER ASSIGNMENT ROUTES ====================
router.route('/rosters')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getRosterAssignments)
  .post(authorize('admin', 'hr'), createRosterAssignment);

router.post('/rosters/upload', 
  authorize('admin', 'hr'),
  upload.single('file'),
  bulkUploadRoster
);

// ==================== ROSTER CHANGE REQUEST ROUTES ====================
router.route('/change-requests')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getRosterChangeRequests)
  .post(authorize('admin', 'hr', 'manager', 'employee'), createRosterChangeRequest);

router.put('/change-requests/:id/approve', 
  authorize('admin', 'hr', 'manager'),
  approveRosterChangeRequest
);

router.put('/change-requests/:id/reject', 
  authorize('admin', 'hr', 'manager'),
  rejectRosterChangeRequest
);

// ==================== CALENDAR VIEW ROUTES ====================
router.get('/calendar', 
  authorize('admin', 'hr', 'manager', 'employee'),
  getRosterCalendar
);

module.exports = router;


