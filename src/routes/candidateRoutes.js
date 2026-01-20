const express = require('express');
const router = express.Router();
const {
  getCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
  updateStage,
  moveToStage,
  scheduleInterview,
  convertToEmployee,
  moveToOnboarding,
  deleteCandidate,
  updateInterviewFeedback,
  sendNotification,
  updateHRCall,
  getCandidateTimeline,
  sendInterviewEmail,
  checkDuplicate,
  getCandidateHistory,
  getCandidateByEmail,
  uploadResume: uploadResumeController
} = require('../controllers/candidateController');
const {
  validateBulkUpload,
  importBulkCandidates,
  downloadTemplate
} = require('../controllers/candidateBulkUploadController');
const { uploadBulk, uploadResume } = require('../middlewares/fileUpload');
const { sendToOnboarding } = require('../controllers/onboardingController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);
router.use(authorize('admin', 'hr', 'company_admin'));

router.route('/')
  .get(getCandidates)
  .post(createCandidate);

// Check for duplicate candidate
router.get('/check-duplicate', checkDuplicate);

// Get candidate history
router.get('/:id/history', getCandidateHistory);

// Get all applications by email
router.get('/by-email/:email', getCandidateByEmail);

router.put('/:id/stage', updateStage);
router.post('/:id/move-to-stage', moveToStage);
router.post('/:id/interview', scheduleInterview);
router.post('/:id/convert', convertToEmployee);
router.post('/:id/onboarding', moveToOnboarding);

// New comprehensive onboarding flow
router.post('/:id/send-to-onboarding', sendToOnboarding);

// New timeline and notification routes
router.get('/:id/timeline', getCandidateTimeline);
router.put('/:candidateId/interview/:interviewId/feedback', updateInterviewFeedback);
router.post('/:id/notification', sendNotification);
router.put('/:id/hr-call', updateHRCall);

// Send interview notification email
router.post('/:id/send-interview-email', sendInterviewEmail);

router.route('/:id')
  .get(getCandidate)
  .put(updateCandidate)
  .delete(deleteCandidate);

// Bulk upload routes
router.post('/bulk/validate', uploadBulk.single('file'), validateBulkUpload);
router.post('/bulk/import', importBulkCandidates);
router.get('/bulk/template', downloadTemplate);

// Resume upload and parsing route
router.post('/upload-resume', uploadResume, uploadResumeController);

module.exports = router;
