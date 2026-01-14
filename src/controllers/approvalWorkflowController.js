/**
 * Approval Workflow Controller
 * Handles workflow configuration, approval actions, delegation, and SLA monitoring
 */

const { getTenantConnection } = require('../config/database.config');
const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
const ApprovalMatrixSchema = require('../models/tenant/ApprovalMatrix');
const ApprovalDelegationSchema = require('../models/tenant/ApprovalDelegation');
const approvalWorkflowService = require('../services/approvalWorkflowService');

/**
 * Get all workflows
 */
exports.getWorkflows = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { entityType, isActive } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const query = {};
    if (entityType) query.entityType = entityType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const workflows = await ApprovalWorkflow.find(query)
      .populate('levels.approverId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ entityType: 1, workflowName: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: workflows.length,
      data: workflows
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create workflow
 */
exports.createWorkflow = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const workflowData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const workflow = new ApprovalWorkflow({
      ...workflowData,
      createdBy: user._id
    });

    await workflow.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Workflow created successfully',
      data: workflow
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update workflow
 */
exports.updateWorkflow = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const updateData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const workflow = await ApprovalWorkflow.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!workflow) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Workflow updated successfully',
      data: workflow
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get approval matrices
 */
exports.getApprovalMatrices = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { entityType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalMatrix = tenantConnection.model('ApprovalMatrix', ApprovalMatrixSchema);

    const query = { isActive: true };
    if (entityType) query.entityType = entityType;

    const matrices = await ApprovalMatrix.find(query)
      .populate('requiredApprovers.approverId', 'firstName lastName email')
      .sort({ priority: -1, name: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: matrices.length,
      data: matrices
    });
  } catch (error) {
    console.error('Error fetching approval matrices:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create approval matrix
 */
exports.createApprovalMatrix = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const matrixData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalMatrix = tenantConnection.model('ApprovalMatrix', ApprovalMatrixSchema);

    const matrix = new ApprovalMatrix({
      ...matrixData,
      createdBy: user._id
    });

    await matrix.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Approval matrix created successfully',
      data: matrix
    });
  } catch (error) {
    console.error('Error creating approval matrix:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get delegations
 */
exports.getDelegations = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { delegatorId, delegateId, isActive } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalDelegation = tenantConnection.model('ApprovalDelegation', ApprovalDelegationSchema);

    const query = {};
    if (delegatorId) query.delegatorId = delegatorId;
    if (delegateId) query.delegateId = delegateId;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const delegations = await ApprovalDelegation.find(query)
      .populate('delegatorId', 'firstName lastName email')
      .populate('delegateId', 'firstName lastName email')
      .sort({ startDate: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: delegations.length,
      data: delegations
    });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create delegation
 */
exports.createDelegation = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const delegationData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalDelegation = tenantConnection.model('ApprovalDelegation', ApprovalDelegationSchema);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Get delegate details
    const delegate = await TenantUser.findById(delegationData.delegateId);
    if (!delegate) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Delegate not found'
      });
    }

    const delegation = new ApprovalDelegation({
      delegatorId: user._id,
      delegatorEmail: user.email,
      delegateId: delegate._id,
      delegateEmail: delegate.email,
      delegateName: `${delegate.firstName} ${delegate.lastName}`,
      entityTypes: delegationData.entityTypes || ['all'],
      startDate: delegationData.startDate,
      endDate: delegationData.endDate,
      reason: delegationData.reason,
      createdBy: user._id
    });

    await delegation.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Delegation created successfully',
      data: delegation
    });
  } catch (error) {
    console.error('Error creating delegation:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Process approval action
 */
exports.processApproval = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { entityType, entityId } = req.params;
    const { level, action, comments } = req.body;
    const approverId = req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await approvalWorkflowService.processApproval(
      companyId,
      entityType,
      entityId,
      level,
      approverId,
      action,
      comments
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.entity
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get SLA monitoring data
 */
exports.getSLAMonitoring = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { entityType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const tenantConnection = await getTenantConnection(companyId);
    const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    const query = { status: 'pending' };
    if (entityType) {
      // For now, only leave requests are supported
    }

    const pendingRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'firstName lastName email')
      .sort({ slaDeadline: 1 });

    const now = new Date();
    const slaData = {
      total: pendingRequests.length,
      withinSLA: 0,
      approachingSLA: 0,
      exceededSLA: 0,
      escalated: 0,
      requests: pendingRequests.map(req => {
        const hoursRemaining = (req.slaDeadline - now) / (1000 * 60 * 60);
        let status = 'within_sla';
        if (req.isEscalated) {
          status = 'escalated';
        } else if (hoursRemaining < 0) {
          status = 'exceeded_sla';
        } else if (hoursRemaining < 24) {
          status = 'approaching_sla';
        }

        if (status === 'within_sla') slaData.withinSLA++;
        else if (status === 'approaching_sla') slaData.approachingSLA++;
        else if (status === 'exceeded_sla') slaData.exceededSLA++;
        else if (status === 'escalated') slaData.escalated++;

        return {
          id: req._id,
          employeeName: req.employeeName,
          leaveType: req.leaveType,
          startDate: req.startDate,
          numberOfDays: req.numberOfDays,
          currentLevel: req.currentLevel,
          slaDeadline: req.slaDeadline,
          hoursRemaining: Math.round(hoursRemaining * 10) / 10,
          status: status,
          isEscalated: req.isEscalated
        };
      })
    };

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      data: slaData
    });
  } catch (error) {
    console.error('Error fetching SLA monitoring:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Trigger SLA escalation check
 */
exports.triggerSLAEscalation = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await approvalWorkflowService.checkSLAEscalations(companyId);

    res.status(200).json({
      success: true,
      message: `Checked ${result.checked} requests, escalated ${result.escalated}`,
      data: result
    });
  } catch (error) {
    console.error('Error triggering SLA escalation:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


