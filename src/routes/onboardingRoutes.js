const express = require('express');
const router = express.Router();
const {
  getOnboardingList,
  getOnboarding,
  createOnboarding,
  updateOnboarding,
  advanceStage,
  setJoiningDate,
  addTask,
  completeTask,
  deleteOnboarding,
  completeOnboardingProcess,
  updateOnboardingStatus,
  sendOffer,
  acceptOffer,
  setJoiningDateAndNotify,
  uploadDocument,
  verifyDocument,
  getDocuments,
  requestDocumentResubmission
} = require('../controllers/onboardingController');
const { protect, authorize } = require('../middlewares/auth');

// Public routes (no authentication required)
router.post('/:id/accept-offer', acceptOffer);

// Protected routes
router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/')
  .get(getOnboardingList)
  .post(createOnboarding);

// Legacy routes (keep for backward compatibility)
router.post('/:id/advance', advanceStage);
router.post('/:id/joining', setJoiningDate);
router.post('/:id/tasks', addTask);
router.put('/:id/tasks/:taskId/complete', completeTask);

// New comprehensive onboarding workflow routes
router.put('/:id/status', updateOnboardingStatus);
router.post('/:id/send-offer', sendOffer);
router.post('/:id/set-joining-date', setJoiningDateAndNotify);

// Document management routes
router.get('/:id/documents', getDocuments);
router.post('/:id/documents', uploadDocument);
router.put('/:id/documents/:docId/verify', verifyDocument);
router.post('/:id/documents/:docId/request-resubmission', requestDocumentResubmission);

// Complete onboarding and create employee account
router.post('/:id/complete', completeOnboardingProcess);

router.route('/:id')
  .get(getOnboarding)
  .put(updateOnboarding)
  .delete(deleteOnboarding);

module.exports = router;
