// Multi-tenant compatible leave accrual controller
const { getTenantConnection } = require('../config/database.config');
const LeaveAccrualPolicySchema = require('../models/tenant/LeaveAccrualPolicy');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const leaveAccrualService = require('../services/leaveAccrualService');

/**
 * Leave Accrual Controller
 * Handles accrual policy management and manual accrual triggers
 * @module controllers/leaveAccrualController
 */

/**
 * Get all accrual policies
 */
exports.getAccrualPolicies = async (req, res) => {
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
    const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (leaveType) query.leaveType = leaveType;

    const policies = await LeaveAccrualPolicy.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ leaveType: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: policies.length,
      data: policies
    });
  } catch (error) {
    console.error('Error fetching accrual policies:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single accrual policy
 */
exports.getAccrualPolicy = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);

    const policy = await LeaveAccrualPolicy.findById(id)
      .populate('createdBy', 'firstName lastName email');

    if (!policy) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Accrual policy not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Error fetching accrual policy:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create accrual policy
 */
exports.createAccrualPolicy = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const policyData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!policyData.leaveType || !policyData.accrualFrequency) {
      return res.status(400).json({
        success: false,
        message: 'Leave type and accrual frequency are required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);

    // Check if policy already exists for this leave type
    const existing = await LeaveAccrualPolicy.findOne({ leaveType: policyData.leaveType });
    if (existing) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Policy already exists for this leave type'
      });
    }

    const policy = new LeaveAccrualPolicy({
      ...policyData,
      createdBy: user._id
    });

    await policy.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Accrual policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Error creating accrual policy:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update accrual policy
 */
exports.updateAccrualPolicy = async (req, res) => {
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
    const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);

    // Don't allow changing leaveType
    delete updateData.leaveType;

    const policy = await LeaveAccrualPolicy.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    if (!policy) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Accrual policy not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Accrual policy updated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Error updating accrual policy:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete accrual policy
 */
exports.deleteAccrualPolicy = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);

    const policy = await LeaveAccrualPolicy.findByIdAndDelete(id);
    if (!policy) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Accrual policy not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Accrual policy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting accrual policy:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Trigger monthly accrual manually
 */
exports.triggerMonthlyAccrual = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { month, year } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const currentDate = new Date();
    const accrualMonth = month || currentDate.getMonth() + 1;
    const accrualYear = year || currentDate.getFullYear();

    const result = await leaveAccrualService.processMonthlyAccrual(companyId, accrualMonth, accrualYear);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error triggering monthly accrual:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Trigger yearly accrual manually
 */
exports.triggerYearlyAccrual = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { year } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const currentDate = new Date();
    const accrualYear = year || currentDate.getFullYear();

    const result = await leaveAccrualService.processYearlyAccrual(companyId, accrualYear);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error triggering yearly accrual:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Trigger carry forward processing
 */
exports.triggerCarryForward = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { fromYear, toYear } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!fromYear || !toYear) {
      return res.status(400).json({
        success: false,
        message: 'From year and to year are required'
      });
    }

    const result = await leaveAccrualService.processCarryForward(companyId, fromYear, toYear);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error triggering carry forward:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Initialize employee balances
 */
exports.initializeEmployeeBalances = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { employeeId, year } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const currentDate = new Date();
    const balanceYear = year || currentDate.getFullYear();

    const result = await leaveAccrualService.initializeEmployeeBalances(companyId, employeeId, balanceYear);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error initializing employee balances:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get accrual history for employee
 */
exports.getAccrualHistory = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { employeeId, year, leaveType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const query = {};
    if (employeeId) {
      query.employeeId = employeeId;
    } else if (req.user.role === 'employee') {
      query.employeeId = req.user._id;
    }
    if (year) query.year = parseInt(year);
    if (leaveType) query.leaveType = leaveType;

    const balances = await LeaveBalance.find(query)
      .populate('employeeId', 'firstName lastName email')
      .sort({ year: -1, leaveType: 1 });

    // Extract accrual history
    const history = [];
    balances.forEach(balance => {
      if (balance.accrualHistory && balance.accrualHistory.length > 0) {
        balance.accrualHistory.forEach(entry => {
          history.push({
            ...entry.toObject(),
            employeeId: balance.employeeId,
            employeeEmail: balance.employeeEmail,
            leaveType: balance.leaveType,
            year: balance.year
          });
        });
      }
    });

    history.sort((a, b) => new Date(b.accrualDate) - new Date(a.accrualDate));

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching accrual history:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


