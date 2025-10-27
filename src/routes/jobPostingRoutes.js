const express = require('express');
const router = express.Router();
const {
  getJobPostings,
  getJobPosting,
  createJobPosting,
  updateJobPosting,
  publishJobPosting,
  closeJobPosting,
  updateJobStatus,
  deleteJobPosting,
  getJobApplicants
} = require('../controllers/jobPostingController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getJobPostings)
  .post(authorize('admin', 'hr'), createJobPosting);

router.put('/:id/publish', authorize('admin', 'hr'), publishJobPosting);
router.put('/:id/close', authorize('admin', 'hr'), closeJobPosting);
router.put('/:id/status', authorize('admin', 'hr'), updateJobStatus);
router.get('/:id/applicants', getJobApplicants);

router.route('/:id')
  .get(getJobPosting)
  .put(authorize('admin', 'hr'), updateJobPosting)
  .delete(authorize('admin'), deleteJobPosting);

module.exports = router;
