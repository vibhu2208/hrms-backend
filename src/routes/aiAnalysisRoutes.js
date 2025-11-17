const express = require('express');
const router = express.Router();
const {
  analyzeSingleCandidate,
  analyzeJobCandidates,
  getRankedCandidates,
  getCandidateInsights,
  getAnalysisStats,
  parseResume,
  clearAnalysis
} = require('../controllers/aiAnalysisController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Protect all routes
router.use(protect);
router.use(tenantMiddleware);

/**
 * @route   POST /api/ai-analysis/candidates/:candidateId/analyze
 * @desc    Analyze a single candidate
 * @access  Private (HR, Admin)
 */
router.post('/candidates/:candidateId/analyze', 
  authorize('admin', 'hr'), 
  analyzeSingleCandidate
);

/**
 * @route   POST /api/ai-analysis/jobs/:jobId/analyze
 * @desc    Analyze all candidates for a job posting
 * @access  Private (HR, Admin)
 */
router.post('/jobs/:jobId/analyze', 
  authorize('admin', 'hr'), 
  analyzeJobCandidates
);

/**
 * @route   GET /api/ai-analysis/jobs/:jobId/ranked
 * @desc    Get ranked candidates for a job posting
 * @access  Private
 */
router.get('/jobs/:jobId/ranked', 
  getRankedCandidates
);

/**
 * @route   GET /api/ai-analysis/candidates/:candidateId/insights
 * @desc    Get AI insights for a specific candidate
 * @access  Private
 */
router.get('/candidates/:candidateId/insights', 
  getCandidateInsights
);

/**
 * @route   GET /api/ai-analysis/jobs/:jobId/stats
 * @desc    Get analysis statistics for a job posting
 * @access  Private
 */
router.get('/jobs/:jobId/stats', 
  getAnalysisStats
);

/**
 * @route   POST /api/ai-analysis/candidates/:candidateId/parse-resume
 * @desc    Parse resume and extract information
 * @access  Private (HR, Admin)
 */
router.post('/candidates/:candidateId/parse-resume', 
  authorize('admin', 'hr'), 
  parseResume
);

/**
 * @route   DELETE /api/ai-analysis/jobs/:jobId/clear
 * @desc    Clear AI analysis for all candidates of a job (for testing)
 * @access  Private (Admin only)
 */
router.delete('/jobs/:jobId/clear', 
  authorize('admin'), 
  clearAnalysis
);

module.exports = router;
