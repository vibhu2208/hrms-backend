const express = require('express');
const router = express.Router();
const {
  getPublicJobs,
  getPublicJob,
  submitApplication,
  getJobStats
} = require('../controllers/publicJobController');
const { submitToTalentPool } = require('../controllers/talentPoolController');
const { uploadResumeToS3, handleUploadError } = require('../middlewares/s3Upload');

// Public routes - no authentication required
router.get('/stats', getJobStats);
router.get('/', getPublicJobs);
router.get('/:id', getPublicJob);

// Job application route with S3 file upload middleware
router.post('/:id/apply', uploadResumeToS3, handleUploadError, submitApplication);

// Talent pool submission (public)
router.post('/talent-pool/submit', submitToTalentPool);

module.exports = router;
