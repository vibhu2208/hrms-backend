const express = require('express');
const router = express.Router();
const {
  getCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
  updateStage,
  scheduleInterview,
  convertToEmployee,
  moveToOnboarding,
  deleteCandidate,
  updateInterviewFeedback,
  sendNotification,
  updateHRCall,
  getCandidateTimeline,
  sendInterviewEmail
} = require('../controllers/candidateController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/')
  .get(getCandidates)
  .post(createCandidate);

router.put('/:id/stage', updateStage);
router.post('/:id/interview', scheduleInterview);
router.post('/:id/convert', convertToEmployee);
router.post('/:id/onboarding', moveToOnboarding);

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

module.exports = router;
