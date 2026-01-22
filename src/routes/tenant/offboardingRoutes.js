const express = require('express');
const router = express.Router();

// Import controllers
const {
  getOffboardingRequests,
  getOffboardingRequest,
  initiateOffboarding,
  approveOffboarding,
  getOffboardingTasks,
  updateTask,
  getAssetClearance,
  updateAssetReturn,
  getFinalSettlement,
  calculateSettlement,
  getExitFeedback,
  submitExitFeedback,
  getOffboardingAnalytics,
  closeOffboarding,
  fixCompletedOffboardings
} = require('../../controllers/tenant/offboardingController');

// Import middleware
const { protect } = require('../../middlewares/auth');
const { tenantMiddleware } = require('../../middlewares/tenantMiddleware');
const { offboardingMiddleware } = require('../../middlewares/offboardingRBAC');
const { getTenantModel } = require('../../middlewares/tenantMiddleware');

// Apply base middleware to all routes
router.use(protect); // Authentication required
router.use(tenantMiddleware); // Tenant context required

/**
 * Offboarding Routes with RBAC Integration
 * Phase 4-11: Complete Route Implementation
 */

// ==================== MAIN OFFBOARDING ROUTES ====================

/**
 * @route   GET /api/offboarding
 * @desc    Get all offboarding requests with filtering
 * @access  HR Manager, HR Executive, Admin
 */
router.get('/', 
  getOffboardingRequests
);

/**
 * @route   GET /api/offboarding/:id
 * @desc    Get specific offboarding request with all details
 * @access  Based on user permissions and request ownership
 */
router.get('/:id',
  getOffboardingRequest
);

/**
 * @route   POST /api/offboarding
 * @desc    Initiate new offboarding process
 * @access  HR, Manager (for team), Employee (self)
 */
router.post('/',
  (req, res, next) => {
    // Simple validation middleware
    if (!req.body.employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }
    next();
  },
  initiateOffboarding
);

/**
 * @route   PUT /api/offboarding/:id/approve
 * @desc    Approve offboarding at current stage
 * @access  Based on approval chain (Manager -> HR -> Finance)
 */
router.put('/:id/approve',
  offboardingMiddleware.approveOffboarding,
  approveOffboarding
);

/**
 * @route   PUT /api/offboarding/:id/close
 * @desc    Close/complete offboarding process
 * @access  HR Manager, Admin
 */
router.put('/:id/close',
  offboardingMiddleware.closeOffboarding,
  closeOffboarding
);

/**
 * @route   PUT /api/offboarding/:id
 * @desc    Update offboarding request
 * @access  HR, Admin
 */
router.put('/:id',
  offboardingMiddleware.manageOffboarding,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const OffboardingRequest = getTenantModel(
        req.tenant.connection,
        'OffboardingRequest',
        require('../../models/tenant/OffboardingRequest')
      );

      const request = await OffboardingRequest.findByIdAndUpdate(id, updateData, { new: true });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Offboarding request not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Offboarding updated successfully',
        data: request
      });
    } catch (error) {
      console.error('Error updating offboarding:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/offboarding/:id/cancel
 * @desc    Cancel offboarding request
 * @access  HR, Admin
 */
router.put('/:id/cancel',
  offboardingMiddleware.manageOffboarding,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const OffboardingRequest = getTenantModel(
        req.tenant.connection,
        'OffboardingRequest',
        require('../../models/tenant/OffboardingRequest')
      );

      const request = await OffboardingRequest.findById(id);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Offboarding request not found' });
      }

      if (request.status === 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel a completed offboarding process'
        });
      }

      request.status = 'cancelled';
      if (reason) {
        request.notes = (request.notes || []).concat([{
          addedBy: req.user._id,
          content: `[Cancelled] ${reason}`,
          addedAt: new Date()
        }]);
      }
      request.completedAt = new Date();
      request.isCompleted = true;

      await request.save();

      res.status(200).json({
        success: true,
        message: 'Offboarding cancelled successfully',
        data: request
      });
    } catch (error) {
      console.error('Error cancelling offboarding:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   DELETE /api/offboarding/:id
 * @desc    Delete offboarding request
 * @access  Admin only
 */
router.delete('/:id',
  offboardingMiddleware.manageOffboarding,
  async (req, res) => {
    try {
      const { id } = req.params;

      const OffboardingRequest = getTenantModel(
        req.tenant.connection,
        'OffboardingRequest',
        require('../../models/tenant/OffboardingRequest')
      );

      const request = await OffboardingRequest.findByIdAndDelete(id);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Offboarding request not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Offboarding deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting offboarding:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ==================== TASK MANAGEMENT ROUTES ====================

/**
 * @route   GET /api/offboarding/:id/tasks
 * @desc    Get tasks for offboarding request
 * @access  Based on task assignment and user permissions
 */
router.get('/:id/tasks',
  offboardingMiddleware.viewOffboardingRequest,
  getOffboardingTasks
);

/**
 * @route   PUT /api/offboarding/tasks/:taskId
 * @desc    Update task status and completion
 * @access  Task assignee, Department heads, HR, Admin
 */
router.put('/tasks/:taskId',
  offboardingMiddleware.completeTasks,
  updateTask
);

// ==================== ASSET CLEARANCE ROUTES ====================

/**
 * @route   GET /api/offboarding/:id/assets
 * @desc    Get asset clearance details
 * @access  IT Admin, HR, Admin, Asset owners
 */
router.get('/:id/assets',
  offboardingMiddleware.viewOffboardingRequest,
  getAssetClearance
);

/**
 * @route   PUT /api/offboarding/:id/assets/return
 * @desc    Update asset return status
 * @access  IT Admin, Asset managers
 */
router.put('/:id/assets/return',
  offboardingMiddleware.manageAssets,
  updateAssetReturn
);

// ==================== FINAL SETTLEMENT ROUTES ====================

/**
 * @route   GET /api/offboarding/:id/settlement
 * @desc    Get final settlement details
 * @access  Finance team, HR Manager, Admin
 */
router.get('/:id/settlement',
  offboardingMiddleware.viewOffboardingRequest,
  getFinalSettlement
);

/**
 * @route   POST /api/offboarding/:id/settlement/calculate
 * @desc    Calculate final settlement
 * @access  Finance Manager, Finance Executive
 */
router.post('/:id/settlement/calculate',
  offboardingMiddleware.manageSettlement,
  calculateSettlement
);

// ==================== EXIT FEEDBACK ROUTES ====================

/**
 * @route   GET /api/offboarding/:id/feedback
 * @desc    Get exit feedback details
 * @access  HR team, Employee (own feedback)
 */
router.get('/:id/feedback',
  offboardingMiddleware.viewOffboardingRequest,
  getExitFeedback
);

/**
 * @route   POST /api/offboarding/:id/feedback
 * @desc    Submit exit feedback
 * @access  Employee (own feedback), HR (on behalf)
 */
router.post('/:id/feedback',
  offboardingMiddleware.viewOffboardingRequest,
  submitExitFeedback
);

// ==================== REPORTING & ANALYTICS ROUTES ====================

/**
 * @route   GET /api/offboarding/analytics/dashboard
 * @desc    Get offboarding analytics and insights
 * @access  HR Manager, Admin
 */
router.get('/analytics/dashboard',
  offboardingMiddleware.viewReports,
  getOffboardingAnalytics
);

/**
 * @route   POST /api/offboarding/fix-completed
 * @desc    Fix existing completed offboardings - mark employees as ex-employees
 * @access  Admin, HR Manager
 */
router.post('/fix-completed',
  offboardingMiddleware.manageOffboarding,
  fixCompletedOffboardings
);

module.exports = router;
