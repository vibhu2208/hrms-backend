const express = require('express');
const router = express.Router();
const {
  getFeedbacks,
  getFeedback,
  createFeedback,
  updateFeedback,
  submitFeedback,
  acknowledgeFeedback,
  deleteFeedback
} = require('../controllers/feedbackController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getFeedbacks)
  .post(authorize('admin', 'hr', 'client'), createFeedback);

router.put('/:id/submit', submitFeedback);
router.put('/:id/acknowledge', acknowledgeFeedback);

router.route('/:id')
  .get(getFeedback)
  .put(updateFeedback)
  .delete(authorize('admin', 'hr'), deleteFeedback);

module.exports = router;
