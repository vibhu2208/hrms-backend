const express = require('express');
const router = express.Router();
const {
  getJobPostings,
  getJobPosting,
  createJobPosting,
  updateJobPosting,
  publishJobPosting,
  closeJobPosting,
  deleteJobPosting
} = require('../controllers/jobPostingController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getJobPostings)
  .post(authorize('admin', 'hr'), createJobPosting);

router.put('/:id/publish', authorize('admin', 'hr'), publishJobPosting);
router.put('/:id/close', authorize('admin', 'hr'), closeJobPosting);

router.route('/:id')
  .get(getJobPosting)
  .put(authorize('admin', 'hr'), updateJobPosting)
  .delete(authorize('admin'), deleteJobPosting);

module.exports = router;
