const express = require('express');
const router = express.Router();
const {
  analyzeSingleCandidate,
  analyzeJobCandidates,
  getRankedCandidates,
  getCandidateInsights,
  getAnalysisStats,
  parseResume,
  clearAnalysis,
  resumeSearchAndShortlist
} = require('../controllers/aiAnalysisController');
const reductoService = require('../services/reductoService');
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
  authorize('admin', 'hr', 'company_admin'), 
  analyzeSingleCandidate
);

/**
 * @route   POST /api/ai-analysis/jobs/:jobId/analyze
 * @desc    Analyze all candidates for a job posting
 * @access  Private (HR, Admin)
 */
router.post('/jobs/:jobId/analyze', 
  authorize('admin', 'hr', 'company_admin'), 
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
  authorize('admin', 'hr', 'company_admin'), 
  parseResume
);

/**
 * @route   DELETE /api/ai-analysis/jobs/:jobId/clear
 * @desc    Clear AI analysis for all candidates of a job (for testing)
 * @access  Private (Admin only)
 */
router.delete('/jobs/:jobId/clear', 
  authorize('admin', 'company_admin'), 
  clearAnalysis
);

/**
 * @route   POST /api/ai-analysis/resume-search
 * @desc    AI-powered resume search and shortlisting
 * @access  Private (HR, Admin)
 */
router.post('/resume-search',
  authorize('admin', 'hr', 'company_admin'),
  resumeSearchAndShortlist
);

/**
 * @route   GET /api/ai-analysis/reducto/health
 * @desc    Get Reducto service health status
 * @access  Private (Admin only)
 */
router.get('/reducto/health',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const health = await reductoService.healthCheck();
      res.status(200).json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/ai-analysis/reducto/status
 * @desc    Get detailed Reducto service status and metrics
 * @access  Private (Admin only)
 */
router.get('/reducto/status',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const status = reductoService.getServiceStatus();
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Status check failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/ai-analysis/reducto/metrics
 * @desc    Get Reducto service performance metrics
 * @access  Private (Admin only)
 */
router.get('/reducto/metrics',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const metrics = reductoService.getMetrics();
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Metrics retrieval failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/ai-analysis/reducto/cache/clear
 * @desc    Clear Reducto service cache
 * @access  Private (Admin only)
 */
router.post('/reducto/cache/clear',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const result = reductoService.clearCache();
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Cache clear failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/ai-analysis/reducto/cache/cleanup
 * @desc    Force cleanup of expired cache entries
 * @access  Private (Admin only)
 */
router.post('/reducto/cache/cleanup',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const result = reductoService.forceCacheCleanup();
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Cache cleanup failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/ai-analysis/reducto/metrics/reset
 * @desc    Reset Reducto service metrics
 * @access  Private (Admin only)
 */
router.post('/reducto/metrics/reset',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const result = reductoService.resetAllMetrics();
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Metrics reset failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/ai-analysis/reducto/monitoring
 * @desc    Get comprehensive monitoring data
 * @access  Private (Admin only)
 */
router.get('/reducto/monitoring',
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const monitoring = reductoService.getMonitoringData();
      res.status(200).json({
        success: true,
        data: monitoring
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Monitoring data retrieval failed',
        error: error.message
      });
    }
  }
);

module.exports = router;
