const { getTenantConnection } = require('../config/database.config');
const approvalEngine = require('../services/approvalEngine');
const approvalValidationService = require('../services/approvalValidationService');
const auditService = require('../services/auditService');

/**
 * Get pending approvals for current user
 */
exports.getMyPendingApprovals = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.userId;

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);

    const approvals = await ApprovalInstance.find({
      'approvalChain.approverId': userId,
      'approvalChain.status': 'pending',
      status: 'pending'
    })
    .populate('requestedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Filter to only show approvals at current user's level
    const myApprovals = approvals.filter(approval => {
      const currentStep = approval.getCurrentApprover();
      return currentStep && currentStep.approverId.toString() === userId.toString();
    });

    res.json({
      success: true,
      count: myApprovals.length,
      data: myApprovals
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message
    });
  }
};

/**
 * Get approval history for a request
 */
exports.getApprovalHistory = async (req, res) => {
  try {
    const { requestType, requestId } = req.params;
    const companyId = req.companyId;

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);

    const instance = await ApprovalInstance.findOne({
      requestType,
      requestId
    })
    .populate('requestedBy', 'firstName lastName email')
    .populate('approvalChain.approverId', 'firstName lastName email')
    .populate('history.performedBy', 'firstName lastName email');

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Approval instance not found'
      });
    }

    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval history',
      error: error.message
    });
  }
};

/**
 * Approve a request
 */
exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const companyId = req.companyId;
    const userId = req.user.userId;

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);

    // Get the approval instance
    const instance = await ApprovalInstance.findById(id);
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found'
      });
    }

    // Validate approval
    const validation = await approvalValidationService.canApprove(
      instance.requestedBy,
      req.user,
      {
        type: instance.requestType,
        amount: instance.metadata?.amount,
        duration: instance.metadata?.duration
      }
    );

    if (!validation.canApprove) {
      return res.status(403).json({
        success: false,
        message: validation.reason,
        code: validation.code
      });
    }

    // Process approval
    const updatedInstance = await approvalEngine.processApproval(
      id,
      userId,
      'approved',
      comments,
      tenantConnection
    );

    // Log the approval
    await approvalValidationService.logApprovalAttempt(
      userId,
      id,
      'approve',
      true,
      null,
      tenantConnection
    );

    res.json({
      success: true,
      message: 'Request approved successfully',
      data: updatedInstance
    });
  } catch (error) {
    console.error('Error approving request:', error);
    
    // Log failed approval attempt
    await approvalValidationService.logApprovalAttempt(
      req.user.userId,
      req.params.id,
      'approve',
      false,
      error.message,
      await getTenantConnection(req.companyId)
    );

    res.status(400).json({
      success: false,
      message: error.message || 'Failed to approve request'
    });
  }
};

/**
 * Reject a request
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const companyId = req.companyId;
    const userId = req.user.userId;

    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);

    // Get the approval instance
    const instance = await ApprovalInstance.findById(id);
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found'
      });
    }

    // Validate approval authority
    const validation = await approvalValidationService.canApprove(
      instance.requestedBy,
      req.user,
      {
        type: instance.requestType,
        amount: instance.metadata?.amount,
        duration: instance.metadata?.duration
      }
    );

    if (!validation.canApprove) {
      return res.status(403).json({
        success: false,
        message: validation.reason,
        code: validation.code
      });
    }

    // Process rejection
    const updatedInstance = await approvalEngine.processApproval(
      id,
      userId,
      'rejected',
      comments,
      tenantConnection
    );

    // Log the rejection
    await approvalValidationService.logApprovalAttempt(
      userId,
      id,
      'reject',
      true,
      null,
      tenantConnection
    );

    res.json({
      success: true,
      message: 'Request rejected',
      data: updatedInstance
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
    
    // Log failed rejection attempt
    await approvalValidationService.logApprovalAttempt(
      req.user.userId,
      req.params.id,
      'reject',
      false,
      error.message,
      await getTenantConnection(req.companyId)
    );

    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject request'
    });
  }
};

/**
 * Get approval statistics
 */
exports.getApprovalStats = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.userId;

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);

    const stats = await ApprovalInstance.aggregate([
      {
        $match: {
          'approvalChain.approverId': userId
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const pending = await ApprovalInstance.countDocuments({
      'approvalChain.approverId': userId,
      'approvalChain.status': 'pending',
      status: 'pending'
    });

    const breached = await ApprovalInstance.countDocuments({
      'approvalChain.approverId': userId,
      'slaStatus.isBreached': true,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        byStatus: stats,
        pending,
        breached
      }
    });
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval statistics',
      error: error.message
    });
  }
};
