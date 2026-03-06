const { getTenantModel } = require('../utils/tenantModels');
const LeaveAccrualPolicySchema = require('../models/tenant/LeaveAccrualPolicy');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const TenantUserSchema = require('../models/tenant/TenantUser');

// Leave types enum
const LEAVE_TYPES = [
  'Personal Leave',
  'Sick Leave',
  'Casual Leave',
  'Comp Offs',
  'Floater Leave',
  'Marriage Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Unpaid Leave'
];

/**
 * Helper function to apply quotas to employees dynamically
 */
const applyQuotasToEmployeesInternal = async (tenantConnection, leaveType = null) => {
  const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
  const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
  const TenantUser = tenantConnection.model('User', TenantUserSchema);
  const Department = getTenantModel(tenantConnection, 'Department');

  const currentYear = new Date().getFullYear();

  // Get all active employees
  const employees = await TenantUser.find({
    role: { $in: ['employee', 'manager'] },
    isActive: true
  }).select('_id email firstName lastName department departmentId designation createdAt');

  if (employees.length === 0) {
    return { applied: 0, skipped: 0, errors: [] };
  }

  // Get all active policies (defaults and overrides)
  const policyQuery = { isActive: true };
  if (leaveType) {
    policyQuery.leaveType = leaveType;
  }
  const policies = await LeaveAccrualPolicy.find(policyQuery).populate('departments', 'name');

  const results = {
    applied: 0,
    skipped: 0,
    errors: []
  };

  // Process each employee
  for (const employee of employees) {
    try {
      const employeeDeptId = employee.departmentId || employee.department;
      const employeeDesignation = employee.designation;

      // Process leave types - either the specified one or all
      const leaveTypesToProcess = leaveType ? [leaveType] : LEAVE_TYPES;

      for (const lt of leaveTypesToProcess) {
        // Find applicable policy (override takes precedence over default)
        let applicablePolicy = null;

        // Check policies for this leave type
        for (const policy of policies) {
          if (policy.leaveType !== lt) continue;

          if (policy.applicableTo === 'all') {
            // Default policy - use if no override found
            if (!applicablePolicy) {
              applicablePolicy = policy;
            }
          } else if (policy.applicableTo === 'specific-departments') {
            // Check if employee's department matches
            if (employeeDeptId && policy.departments.some(dept => 
              (dept._id ? dept._id.toString() : dept.toString()) === employeeDeptId.toString()
            )) {
              applicablePolicy = policy; // Override found
              break;
            }
          } else if (policy.applicableTo === 'specific-designations') {
            // Check if employee's designation matches
            if (employeeDesignation && policy.designations.includes(employeeDesignation)) {
              applicablePolicy = policy; // Override found
              break;
            }
          }
        }

        // If no policy found or no allocation, skip this leave type
        if (!applicablePolicy || !applicablePolicy.yearlyAllocation) {
          continue;
        }

        // Calculate pro-rated allocation if mid-year
        let allocation = applicablePolicy.yearlyAllocation;
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);

        // If employee joined mid-year, calculate pro-rated
        if (employee.createdAt && new Date(employee.createdAt) > yearStart) {
          const joinDate = new Date(employee.createdAt);
          const daysInYear = (yearEnd - yearStart) / (1000 * 60 * 60 * 24);
          const daysRemaining = (yearEnd - joinDate) / (1000 * 60 * 60 * 24);
          allocation = Math.round((allocation * daysRemaining) / daysInYear * 10) / 10;
        }

        // Find or create leave balance
        const balanceQuery = {
          employeeId: employee._id,
          employeeEmail: employee.email,
          year: currentYear,
          leaveType: lt
        };

        let leaveBalance = await LeaveBalance.findOne(balanceQuery);

        if (leaveBalance) {
          // Update existing balance (preserve consumed)
          const consumed = leaveBalance.consumed || 0;
          leaveBalance.total = allocation;
          leaveBalance.accrued = allocation;
          leaveBalance.available = Math.max(0, allocation - consumed);
          await leaveBalance.save();
        } else {
          // Create new balance
          leaveBalance = await LeaveBalance.create({
            ...balanceQuery,
            total: allocation,
            accrued: allocation,
            consumed: 0,
            available: allocation,
            carriedForward: 0,
            lapsed: 0
          });
        }

        results.applied++;
      }
    } catch (error) {
      console.error(`Error processing employee ${employee.email}:`, error);
      results.errors.push({
        employee: employee.email,
        error: error.message
      });
      results.skipped++;
    }
  }

  return results;
};

/**
 * Get all leave quotas (defaults and group overrides)
 */
exports.getLeaveQuotas = async (req, res) => {
  try {
    const LeaveAccrualPolicy = req.tenant.connection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
    const Department = getTenantModel(req.tenant.connection, 'Department');

    // Get all policies
    const policies = await LeaveAccrualPolicy.find({})
      .populate('departments', 'name')
      .sort({ leaveType: 1, applicableTo: 1 });

    // Separate defaults and overrides
    const defaults = policies.filter(p => p.applicableTo === 'all');
    const overrides = policies.filter(p => p.applicableTo !== 'all');

    // Create a map of default quotas by leave type
    const defaultQuotas = {};
    defaults.forEach(policy => {
      defaultQuotas[policy.leaveType] = {
        _id: policy._id,
        yearlyAllocation: policy.yearlyAllocation || 0,
        accrualFrequency: policy.accrualFrequency,
        accrualAmount: policy.accrualAmount,
        carryForwardEnabled: policy.carryForwardEnabled,
        maxCarryForward: policy.maxCarryForward,
        isActive: policy.isActive,
        applicableFrom: policy.applicableFrom
      };
    });

    // Format overrides
    const formattedOverrides = overrides.map(policy => ({
      _id: policy._id,
      leaveType: policy.leaveType,
      yearlyAllocation: policy.yearlyAllocation || 0,
      accrualFrequency: policy.accrualFrequency,
      accrualAmount: policy.accrualAmount,
      applicableTo: policy.applicableTo,
      departments: policy.departments,
      designations: policy.designations || [],
      locations: policy.locations || [],
      isActive: policy.isActive
    }));

    // Get all leave types and ensure defaults exist
    const allLeaveTypes = LEAVE_TYPES.map(leaveType => ({
      leaveType,
      default: defaultQuotas[leaveType] || {
        yearlyAllocation: 0,
        accrualFrequency: 'yearly',
        isActive: false
      },
      hasOverride: overrides.some(o => o.leaveType === leaveType)
    }));

    res.status(200).json({
      success: true,
      data: {
        defaults: allLeaveTypes,
        overrides: formattedOverrides,
        summary: {
          totalCategories: LEAVE_TYPES.length,
          activeDefaults: defaults.filter(d => d.isActive).length,
          totalOverrides: overrides.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching leave quotas:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Set/Update default quota for a leave category
 */
exports.setDefaultQuota = async (req, res) => {
  try {
    const LeaveAccrualPolicy = req.tenant.connection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
    const {
      leaveType,
      yearlyAllocation,
      accrualFrequency = 'yearly',
      accrualAmount,
      carryForwardEnabled = false,
      maxCarryForward = 0,
      isActive = true
    } = req.body;

    if (!leaveType || yearlyAllocation === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Leave type and yearly allocation are required'
      });
    }

    if (!LEAVE_TYPES.includes(leaveType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type. Valid types: ${LEAVE_TYPES.join(', ')}`
      });
    }

    // Calculate accrual amount if not provided
    let calculatedAccrualAmount = accrualAmount;
    if (!calculatedAccrualAmount) {
      if (accrualFrequency === 'yearly' || accrualFrequency === 'one-time') {
        calculatedAccrualAmount = yearlyAllocation;
      } else if (accrualFrequency === 'monthly') {
        calculatedAccrualAmount = yearlyAllocation / 12;
      } else if (accrualFrequency === 'quarterly') {
        calculatedAccrualAmount = yearlyAllocation / 4;
      }
    }

    // Check if default policy already exists
    let policy = await LeaveAccrualPolicy.findOne({
      leaveType,
      applicableTo: 'all'
    });

    if (policy) {
      // Update existing
      policy.yearlyAllocation = yearlyAllocation;
      policy.accrualFrequency = accrualFrequency;
      policy.accrualAmount = calculatedAccrualAmount;
      policy.carryForwardEnabled = carryForwardEnabled;
      policy.maxCarryForward = maxCarryForward;
      policy.isActive = isActive;
      policy.createdBy = req.user._id;
      await policy.save();
    } else {
      // Create new
      policy = await LeaveAccrualPolicy.create({
        leaveType,
        yearlyAllocation,
        accrualFrequency,
        accrualAmount: calculatedAccrualAmount,
        carryForwardEnabled,
        maxCarryForward,
        applicableTo: 'all',
        isActive,
        applicableFrom: new Date(),
        createdBy: req.user._id
      });
    }

    // Automatically apply quotas to all employees for this leave type
    try {
      await applyQuotasToEmployeesInternal(req.tenant.connection, leaveType);
    } catch (applyError) {
      console.error('Error applying quotas automatically:', applyError);
      // Don't fail the request if auto-apply fails
    }

    res.status(200).json({
      success: true,
      message: 'Default quota set successfully and applied to employees',
      data: policy
    });
  } catch (error) {
    console.error('Error setting default quota:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create group-specific override
 */
exports.createGroupOverride = async (req, res) => {
  try {
    const LeaveAccrualPolicy = req.tenant.connection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
    const {
      leaveType,
      yearlyAllocation,
      applicableTo,
      departments = [],
      designations = [],
      locations = [],
      accrualFrequency = 'yearly',
      accrualAmount,
      carryForwardEnabled = false,
      maxCarryForward = 0,
      isActive = true
    } = req.body;

    if (!leaveType || yearlyAllocation === undefined || !applicableTo) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, yearly allocation, and applicable to are required'
      });
    }

    if (!LEAVE_TYPES.includes(leaveType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type. Valid types: ${LEAVE_TYPES.join(', ')}`
      });
    }

    if (!['specific-departments', 'specific-designations', 'specific-locations'].includes(applicableTo)) {
      return res.status(400).json({
        success: false,
        message: 'Applicable to must be specific-departments, specific-designations, or specific-locations'
      });
    }

    // Validate that at least one group is selected
    if (applicableTo === 'specific-departments' && departments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one department must be selected'
      });
    }
    if (applicableTo === 'specific-designations' && designations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one designation must be selected'
      });
    }
    if (applicableTo === 'specific-locations' && locations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one location must be selected'
      });
    }

    // Calculate accrual amount if not provided
    let calculatedAccrualAmount = accrualAmount;
    if (!calculatedAccrualAmount) {
      if (accrualFrequency === 'yearly' || accrualFrequency === 'one-time') {
        calculatedAccrualAmount = yearlyAllocation;
      } else if (accrualFrequency === 'monthly') {
        calculatedAccrualAmount = yearlyAllocation / 12;
      } else if (accrualFrequency === 'quarterly') {
        calculatedAccrualAmount = yearlyAllocation / 4;
      }
    }

    const policy = await LeaveAccrualPolicy.create({
      leaveType,
      yearlyAllocation,
      accrualFrequency,
      accrualAmount: calculatedAccrualAmount,
      carryForwardEnabled,
      maxCarryForward,
      applicableTo,
      departments: applicableTo === 'specific-departments' ? departments : [],
      designations: applicableTo === 'specific-designations' ? designations : [],
      locations: applicableTo === 'specific-locations' ? locations : [],
      isActive,
      applicableFrom: new Date(),
      createdBy: req.user._id
    });

    await policy.populate('departments', 'name');

    // Automatically apply quotas to affected employees
    try {
      await applyQuotasToEmployeesInternal(req.tenant.connection, leaveType);
    } catch (applyError) {
      console.error('Error applying quotas automatically:', applyError);
      // Don't fail the request if auto-apply fails
    }

    res.status(201).json({
      success: true,
      message: 'Group override created successfully and applied to employees',
      data: policy
    });
  } catch (error) {
    console.error('Error creating group override:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update group override
 */
exports.updateGroupOverride = async (req, res) => {
  try {
    const LeaveAccrualPolicy = req.tenant.connection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
    const { id } = req.params;
    const {
      yearlyAllocation,
      departments = [],
      designations = [],
      locations = [],
      accrualFrequency,
      accrualAmount,
      carryForwardEnabled,
      maxCarryForward,
      isActive
    } = req.body;

    const policy = await LeaveAccrualPolicy.findById(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Override not found'
      });
    }

    if (policy.applicableTo === 'all') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update default quota using this endpoint. Use setDefaultQuota instead.'
      });
    }

    // Update fields
    if (yearlyAllocation !== undefined) {
      policy.yearlyAllocation = yearlyAllocation;
      
      // Recalculate accrual amount if needed
      if (!accrualAmount) {
        const freq = accrualFrequency || policy.accrualFrequency;
        if (freq === 'yearly' || freq === 'one-time') {
          policy.accrualAmount = yearlyAllocation;
        } else if (freq === 'monthly') {
          policy.accrualAmount = yearlyAllocation / 12;
        } else if (freq === 'quarterly') {
          policy.accrualAmount = yearlyAllocation / 4;
        }
      }
    }

    if (accrualFrequency !== undefined) policy.accrualFrequency = accrualFrequency;
    if (accrualAmount !== undefined) policy.accrualAmount = accrualAmount;
    if (carryForwardEnabled !== undefined) policy.carryForwardEnabled = carryForwardEnabled;
    if (maxCarryForward !== undefined) policy.maxCarryForward = maxCarryForward;
    if (isActive !== undefined) policy.isActive = isActive;

    // Update group selections
    if (policy.applicableTo === 'specific-departments' && departments.length > 0) {
      policy.departments = departments;
    }
    if (policy.applicableTo === 'specific-designations' && designations.length > 0) {
      policy.designations = designations;
    }
    if (policy.applicableTo === 'specific-locations' && locations.length > 0) {
      policy.locations = locations;
    }

    await policy.save();
    await policy.populate('departments', 'name');

    // Automatically apply quotas to affected employees
    try {
      await applyQuotasToEmployeesInternal(req.tenant.connection, policy.leaveType);
    } catch (applyError) {
      console.error('Error applying quotas automatically:', applyError);
      // Don't fail the request if auto-apply fails
    }

    res.status(200).json({
      success: true,
      message: 'Override updated successfully and applied to employees',
      data: policy
    });
  } catch (error) {
    console.error('Error updating group override:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete group override
 */
exports.deleteGroupOverride = async (req, res) => {
  try {
    const LeaveAccrualPolicy = req.tenant.connection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
    const { id } = req.params;

    const policy = await LeaveAccrualPolicy.findById(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Override not found'
      });
    }

    if (policy.applicableTo === 'all') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default quota. Use setDefaultQuota to deactivate instead.'
      });
    }

    await LeaveAccrualPolicy.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Override deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting group override:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Apply quotas to all employees (manual trigger - still available)
 */
exports.applyQuotasToEmployees = async (req, res) => {
  try {
    const { year } = req.body;
    // Note: year is not used in internal function (uses current year)
    // This endpoint can be kept for manual bulk application if needed
    
    const results = await applyQuotasToEmployeesInternal(req.tenant.connection);

    res.status(200).json({
      success: true,
      message: `Quotas applied to employees for year ${new Date().getFullYear()}`,
      data: results
    });
  } catch (error) {
    console.error('Error applying quotas to employees:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
