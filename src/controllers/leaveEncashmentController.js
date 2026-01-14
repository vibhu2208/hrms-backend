/**
 * Leave Encashment Controller
 * Handles encashment rule management, request creation, approval, and payroll integration
 */

const { getTenantConnection } = require('../config/database.config');
const LeaveEncashmentRuleSchema = require('../models/tenant/LeaveEncashmentRule');
const LeaveEncashmentRequestSchema = require('../models/tenant/LeaveEncashmentRequest');
const leaveEncashmentService = require('../services/leaveEncashmentService');
const approvalWorkflowService = require('../services/approvalWorkflowService');

/**
 * Get all encashment rules
 */
exports.getEncashmentRules = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { isActive, leaveType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveEncashmentRule = tenantConnection.model('LeaveEncashmentRule', LeaveEncashmentRuleSchema);

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (leaveType) query.leaveType = leaveType;

    const rules = await LeaveEncashmentRule.find(query)
      .populate('eligibilityCriteria.allowedDepartments', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ leaveType: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: rules.length,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching encashment rules:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create encashment rule
 */
exports.createEncashmentRule = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const ruleData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!ruleData.leaveType || !ruleData.calculationMethod) {
      return res.status(400).json({
        success: false,
        message: 'Leave type and calculation method are required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveEncashmentRule = tenantConnection.model('LeaveEncashmentRule', LeaveEncashmentRuleSchema);

    // Check if rule already exists
    const existing = await LeaveEncashmentRule.findOne({ leaveType: ruleData.leaveType });
    if (existing) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Rule already exists for this leave type'
      });
    }

    const rule = new LeaveEncashmentRule({
      ...ruleData,
      createdBy: user._id
    });

    await rule.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Encashment rule created successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error creating encashment rule:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update encashment rule
 */
exports.updateEncashmentRule = async (req, res) => {
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
    const LeaveEncashmentRule = tenantConnection.model('LeaveEncashmentRule', LeaveEncashmentRuleSchema);

    // Don't allow changing leaveType
    delete updateData.leaveType;

    const rule = await LeaveEncashmentRule.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('eligibilityCriteria.allowedDepartments', 'name');

    if (!rule) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Encashment rule not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Encashment rule updated successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error updating encashment rule:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Check eligibility for encashment
 */
exports.checkEligibility = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { leaveType, numberOfDays } = req.body;
    const employeeId = req.user.role === 'employee' ? req.user._id : req.body.employeeId || req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!leaveType || !numberOfDays) {
      return res.status(400).json({
        success: false,
        message: 'Leave type and number of days are required'
      });
    }

    const eligibility = await leaveEncashmentService.checkEligibility(
      companyId,
      employeeId,
      leaveType,
      numberOfDays
    );

    if (!eligibility.eligible) {
      return res.status(200).json({
        success: false,
        eligible: false,
        reason: eligibility.reason
      });
    }

    // Calculate amount
    const calculation = await leaveEncashmentService.calculateEncashmentAmount(
      companyId,
      employeeId,
      leaveType,
      numberOfDays,
      eligibility.rule
    );

    res.status(200).json({
      success: true,
      eligible: true,
      data: {
        rule: eligibility.rule,
        leaveBalance: eligibility.leaveBalance,
        calculation: calculation
      }
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create encashment request
 */
exports.createEncashmentRequest = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { leaveType, numberOfDays, reason } = req.body;
    const employeeId = req.user.role === 'employee' ? req.user._id : req.body.employeeId || req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!leaveType || !numberOfDays || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, number of days, and reason are required'
      });
    }

    const result = await leaveEncashmentService.createEncashmentRequest(
      companyId,
      employeeId,
      leaveType,
      numberOfDays,
      reason
    );

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error creating encashment request:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get encashment requests
 */
exports.getEncashmentRequests = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const { status, employeeId, leaveType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);

    const query = {};
    if (user.role === 'employee') {
      query.employeeId = user._id;
    } else if (employeeId) {
      query.employeeId = employeeId;
    }
    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;

    const requests = await LeaveEncashmentRequest.find(query)
      .populate('employeeId', 'firstName lastName email')
      .populate('approvalLevels.approverId', 'firstName lastName email')
      .sort({ appliedOn: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching encashment requests:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Approve encashment request
 */
exports.approveEncashmentRequest = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { action, comments } = req.body;
    const approverId = req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await approvalWorkflowService.processApproval(
      companyId,
      'leave_encashment',
      id,
      req.body.level || 1,
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
    console.error('Error processing encashment approval:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Process encashment for payroll
 */
exports.processForPayroll = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { payrollReference, payrollMonth, payrollYear } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!payrollReference) {
      return res.status(400).json({
        success: false,
        message: 'Payroll reference is required'
      });
    }

    const result = await leaveEncashmentService.processForPayroll(
      companyId,
      id,
      payrollReference,
      payrollMonth,
      payrollYear
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
      payrollUpdated: result.payrollUpdated
    });
  } catch (error) {
    console.error('Error processing for payroll:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

