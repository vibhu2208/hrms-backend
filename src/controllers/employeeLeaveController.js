// Multi-tenant compatible leave controller
const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');

/**
 * Employee Leave Controller
 * Handles leave application and management for employees
 * @module controllers/employeeLeaveController
 */

/**
 * Fix all negative leave balances for all employees
 */
exports.fixNegativeBalances = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    
    const currentYear = new Date().getFullYear();
    
    // Find all balances with negative available days
    const negativeBalances = await LeaveBalance.find({
      year: currentYear,
      available: { $lt: 0 }
    });

    console.log(`🔍 Found ${negativeBalances.length} negative balances to fix`);

    let fixedCount = 0;
    const fixPromises = negativeBalances.map(async (balance) => {
      const oldAvailable = balance.available;
      // Set available to 0 (minimum)
      balance.available = 0;
      
      console.log(`🔧 Fixed ${balance.employeeEmail} - ${balance.leaveType}: ${oldAvailable} → 0`);
      fixedCount++;
      
      return balance.save();
    });
    
    await Promise.all(fixPromises);

    res.status(200).json({ 
      success: true, 
      message: `Fixed ${fixedCount} negative leave balances`,
      data: { fixedCount, totalFound: negativeBalances.length }
    });
  } catch (error) {
    console.error('Error fixing negative balances:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Force refresh leave balances to match current admin configuration
 */
exports.refreshLeaveBalances = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    
    // Get current admin configuration
    const { getTenantModel } = require('../utils/tenantModels');
    
    let policies = [];
    try {
      const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
      policies = await LeaveAccrualPolicy.find({ isActive: true });
    } catch (policyError) {
      console.error('Error fetching leave policies:', policyError);
    }
    
    if (policies.length === 0) {
      // Create default leave policies if none exist
      console.log('📝 No active leave policies found, creating default policies...');
      
      try {
        const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
        
        const defaultPolicies = [
          {
            leaveType: 'Personal Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 12,
            yearlyAllocation: 12,
            carryForwardEnabled: true,
            maxCarryForward: 6,
            isActive: true,
            description: 'Annual personal leave for employees'
          },
          {
            leaveType: 'Sick Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 7,
            yearlyAllocation: 7,
            carryForwardEnabled: true,
            maxCarryForward: 3,
            isActive: true,
            description: 'Sick leave for medical reasons'
          },
          {
            leaveType: 'Casual Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 8,
            yearlyAllocation: 8,
            carryForwardEnabled: false,
            maxCarryForward: 0,
            isActive: true,
            description: 'Casual leave for personal needs'
          },
          {
            leaveType: 'Comp Offs',
            accrualFrequency: 'yearly',
            accrualAmount: 5,
            yearlyAllocation: 5,
            carryForwardEnabled: true,
            maxCarryForward: 2,
            isActive: true,
            description: 'Compensatory off for overtime work'
          },
          {
            leaveType: 'Floater Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 2,
            yearlyAllocation: 2,
            carryForwardEnabled: false,
            maxCarryForward: 0,
            isActive: true,
            description: 'Floating holidays for personal use'
          },
          {
            leaveType: 'Marriage Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 5,
            yearlyAllocation: 5,
            carryForwardEnabled: false,
            maxCarryForward: 0,
            isActive: true,
            description: 'Leave for marriage'
          },
          {
            leaveType: 'Maternity Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 90,
            yearlyAllocation: 90,
            carryForwardEnabled: false,
            maxCarryForward: 0,
            isActive: true,
            description: 'Maternity leave for new mothers'
          },
          {
            leaveType: 'Paternity Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 15,
            yearlyAllocation: 15,
            carryForwardEnabled: false,
            maxCarryForward: 0,
            isActive: true,
            description: 'Paternity leave for new fathers'
          },
          {
            leaveType: 'Unpaid Leave',
            accrualFrequency: 'yearly',
            accrualAmount: 0,
            yearlyAllocation: 0,
            carryForwardEnabled: false,
            maxCarryForward: 0,
            isActive: true,
            description: 'Unpaid leave for extended time off'
          }
        ];

        const createdPolicies = await LeaveAccrualPolicy.insertMany(defaultPolicies);
        policies = createdPolicies;
        console.log(`✅ Created ${createdPolicies.length} default leave policies`);
        
        return res.status(200).json({
          success: true,
          message: `Created ${createdPolicies.length} default leave policies. Please try again.`,
          data: []
        });
        
      } catch (createError) {
        console.error('Error creating default policies:', createError);
        return res.status(500).json({
          success: false,
          message: 'No active leave policies found and failed to create defaults. Please contact administrator.'
        });
      }
    }

    const currentYear = new Date().getFullYear();
    
    // Update all leave balances for this employee to match current admin config
    const balances = await LeaveBalance.find({
      employeeEmail: user.email,
      year: currentYear
    });

    let updatedCount = 0;
    const updatePromises = balances.map(async (balance) => {
      const policy = policies.find(p => p.leaveType === balance.leaveType);
      if (policy) {
        const newTotal = policy.yearlyAllocation || 0;
        const consumed = balance.consumed || 0;
        const oldTotal = balance.total;
        
        // Preserve consumed days but update total to current admin config
        balance.total = newTotal;
        // Ensure available is never negative
        balance.available = Math.max(0, newTotal - consumed);
        
        if (oldTotal !== newTotal) {
          console.log(`📝 Refreshed ${balance.leaveType}: ${oldTotal} → ${newTotal} total, ${consumed} consumed, ${balance.available} available`);
          updatedCount++;
        }
        
        return balance.save();
      }
      return balance;
    });
    
    await Promise.all(updatePromises);

    res.status(200).json({ 
      success: true, 
      message: `Refreshed ${updatedCount} leave balances to current admin configuration`,
      data: balances 
    });
  } catch (error) {
    console.error('Error refreshing leave balances:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get available leave types for employee
 */
exports.getAvailableLeaveTypes = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { year } = req.query;
    const user = req.user;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    
    // Try to get leave types from admin configuration
    let availableLeaveTypes = [
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

    try {
      const { getTenantModel } = require('../utils/tenantModels');
      
      let policies = [];
      try {
        const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
        policies = await LeaveAccrualPolicy.find({ isActive: true });
      } catch (policyError) {
        console.error('Error fetching leave policies for types:', policyError);
      }
      
      if (policies.length === 0) {
          // Create default leave policies if none exist
          console.log('📝 No active leave policies found, creating default policies...');
          
          try {
            const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
            
            const defaultPolicies = [
              { leaveType: 'Personal Leave', accrualFrequency: 'yearly', accrualAmount: 12, yearlyAllocation: 12, isActive: true },
              { leaveType: 'Sick Leave', accrualFrequency: 'yearly', accrualAmount: 7, yearlyAllocation: 7, isActive: true },
              { leaveType: 'Casual Leave', accrualFrequency: 'yearly', accrualAmount: 8, yearlyAllocation: 8, isActive: true },
              { leaveType: 'Comp Offs', accrualFrequency: 'yearly', accrualAmount: 5, yearlyAllocation: 5, isActive: true },
              { leaveType: 'Floater Leave', accrualFrequency: 'yearly', accrualAmount: 2, yearlyAllocation: 2, isActive: true },
              { leaveType: 'Marriage Leave', accrualFrequency: 'yearly', accrualAmount: 5, yearlyAllocation: 5, isActive: true },
              { leaveType: 'Maternity Leave', accrualFrequency: 'yearly', accrualAmount: 90, yearlyAllocation: 90, isActive: true },
              { leaveType: 'Paternity Leave', accrualFrequency: 'yearly', accrualAmount: 15, yearlyAllocation: 15, isActive: true },
              { leaveType: 'Unpaid Leave', accrualFrequency: 'yearly', accrualAmount: 0, yearlyAllocation: 0, isActive: true }
            ];

            const createdPolicies = await LeaveAccrualPolicy.insertMany(defaultPolicies);
            policies = createdPolicies;
            console.log(`✅ Created ${createdPolicies.length} default leave policies`);
            
          } catch (createError) {
            console.error('Error creating default policies:', createError);
          }
        }
        
        if (policies.length > 0) {
          availableLeaveTypes = policies.map(policy => policy.leaveType);
          console.log(`📋 Found ${availableLeaveTypes.length} configured leave types`);
        }
    } catch (configError) {
      console.log('⚠️  Could not fetch admin configuration, using defaults');
    }

    res.status(200).json({ 
      success: true, 
      data: availableLeaveTypes 
    });
  } catch (error) {
    console.error('Error fetching available leave types:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get leave balance
 */
exports.getLeaveBalance = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

    // Check if balances exist for this year
    let balances = await LeaveBalance.find({
      employeeEmail: user.email,
      year: year
    });

    // Don't filter - show all available leave types from admin configuration
    // This ensures consistency between balance display and apply form

    // If no balances found, initialize with all available leave types from admin configuration
    if (balances.length === 0) {
      console.log(`📊 Initializing leave balances for ${user.email} - Year ${year}`);
      
      // Try to get leave types from admin configuration
      let defaultLeaveTypes = [
        { type: 'Comp Offs', total: 5 },
        { type: 'Personal Leave', total: 12 },
        { type: 'Sick Leave', total: 7 }
      ];

      try {
        // Import here to avoid circular dependency
        const { getTenantModel } = require('../utils/tenantModels');
        
        let policies = [];
        try {
          const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
          policies = await LeaveAccrualPolicy.find({ isActive: true });
        } catch (policyError) {
          console.error('Error fetching leave policies:', policyError);
        }
        
        if (policies.length === 0) {
          // Create default leave policies if none exist
          console.log('📝 No active leave policies found, creating default policies...');
          
          try {
            const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
            
            const defaultPolicies = [
              { leaveType: 'Personal Leave', accrualFrequency: 'yearly', accrualAmount: 12, yearlyAllocation: 12, isActive: true },
              { leaveType: 'Sick Leave', accrualFrequency: 'yearly', accrualAmount: 7, yearlyAllocation: 7, isActive: true },
              { leaveType: 'Casual Leave', accrualFrequency: 'yearly', accrualAmount: 8, yearlyAllocation: 8, isActive: true },
              { leaveType: 'Comp Offs', accrualFrequency: 'yearly', accrualAmount: 5, yearlyAllocation: 5, isActive: true },
              { leaveType: 'Floater Leave', accrualFrequency: 'yearly', accrualAmount: 2, yearlyAllocation: 2, isActive: true },
              { leaveType: 'Marriage Leave', accrualFrequency: 'yearly', accrualAmount: 5, yearlyAllocation: 5, isActive: true },
              { leaveType: 'Maternity Leave', accrualFrequency: 'yearly', accrualAmount: 90, yearlyAllocation: 90, isActive: true },
              { leaveType: 'Paternity Leave', accrualFrequency: 'yearly', accrualAmount: 15, yearlyAllocation: 15, isActive: true },
              { leaveType: 'Unpaid Leave', accrualFrequency: 'yearly', accrualAmount: 0, yearlyAllocation: 0, isActive: true }
            ];

            const createdPolicies = await LeaveAccrualPolicy.insertMany(defaultPolicies);
            policies = createdPolicies;
            console.log(`✅ Created ${createdPolicies.length} default leave policies`);
            
            defaultLeaveTypes = policies.map(policy => ({
              type: policy.leaveType,
              total: policy.yearlyAllocation || 0
            }));
            
          } catch (createError) {
            console.error('Error creating default policies:', createError);
          }
        } else {
          defaultLeaveTypes = policies.map(policy => ({
            type: policy.leaveType,
            total: policy.yearlyAllocation || 0
          }));
          console.log(`📋 Using ${defaultLeaveTypes.length} leave types from admin configuration`);
        }
      } catch (configError) {
        console.log('⚠️  Could not fetch admin configuration, using defaults');
      }

      const balancePromises = defaultLeaveTypes.map(lt => {
        const balance = new LeaveBalance({
          employeeId: user._id,
          employeeEmail: user.email,
          year: year,
          leaveType: lt.type,
          total: lt.total,
          consumed: 0,
          available: lt.total // Ensure available starts as total
        });
        return balance.save();
      });

      balances = await Promise.all(balancePromises);
      console.log(`✅ Initialized ${balances.length} leave types`);
    } else {
      // Update existing balances to match current admin configuration (without pro-rating for existing balances)
      console.log(`📊 Updating existing leave balances for ${user.email} - Year ${year}`);
      
      try {
        const { getTenantModel } = require('../utils/tenantModels');
        
        let policies = [];
        try {
          const LeaveAccrualPolicy = getTenantModel(tenantConnection, 'LeaveAccrualPolicy');
          policies = await LeaveAccrualPolicy.find({ isActive: true });
        } catch (policyError) {
          console.error('Error fetching leave policies for update:', policyError);
        }
        
        if (policies.length > 0) {
          const updatePromises = balances.map(async (balance) => {
            const policy = policies.find(p => p.leaveType === balance.leaveType);
            if (policy) {
              const newTotal = policy.yearlyAllocation || 0;
              const consumed = balance.consumed || 0;
              // Preserve consumed days but update total to current admin config
              balance.total = newTotal;
              // Ensure available is never negative
              balance.available = Math.max(0, newTotal - consumed);
              console.log(`📝 Updated ${balance.leaveType}: ${newTotal} total, ${consumed} consumed, ${balance.available} available`);
              return balance.save();
            }
            return balance;
          });
          
          await Promise.all(updatePromises);
          console.log(`✅ Updated ${balances.length} existing leave balances to current admin configuration`);
        }
      } catch (configError) {
        console.log('⚠️  Could not update with admin configuration, keeping existing values');
      }
    }

    // Don't close connection manually - let connection pooling handle it
    // Mongoose will manage the connection pool automatically

    res.status(200).json({ success: true, data: balances });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    // Don't close connection manually on error either
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get leave applications
 */
exports.getLeaveApplications = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const status = req.query.status; // pending, approved, rejected
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Build query
    const query = {
      employeeEmail: user.email,
      startDate: {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31)
      }
    };

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Fetch leave applications
    const leaveApplications = await LeaveRequest.find(query).sort({ appliedOn: -1 });

    console.log(`📋 Found ${leaveApplications.length} leave applications for ${user.email}`);

    // Don't close connection manually - let connection pooling handle it
    
    res.status(200).json({ success: true, data: leaveApplications });
  } catch (error) {
    console.error('Error fetching leave applications:', error);
    // Don't close connection manually on error either
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get leave details
 */
exports.getLeaveDetails = async (req, res) => {
  try {
    res.status(404).json({ success: false, message: 'Leave not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Map frontend leaveType values to backend enum values
 */
const mapLeaveType = (leaveType) => {
  if (!leaveType) return leaveType;
  
  const mapping = {
    'casual': 'Casual Leave',
    'sick': 'Sick Leave',
    'earned': 'Personal Leave',
    'personal': 'Personal Leave',
    'maternity': 'Maternity Leave',
    'paternity': 'Paternity Leave',
    'unpaid': 'Unpaid Leave',
    'comp off': 'Comp Offs',
    'comp offs': 'Comp Offs',
    'floater': 'Floater Leave',
    'marriage': 'Marriage Leave'
  };
  
  // If already in correct format, return as is
  const validEnums = ['Personal Leave', 'Sick Leave', 'Casual Leave', 'Comp Offs', 'Floater Leave', 'Marriage Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave'];
  if (validEnums.includes(leaveType)) {
    return leaveType;
  }
  
  // Map lowercase/short values to enum values
  const normalized = leaveType.toLowerCase().trim();
  return mapping[normalized] || leaveType;
};

/**
 * Apply for leave
 */
exports.applyLeave = async (req, res) => {
  let tenantConnection = null;
  
  try {
    let { leaveType, startDate, endDate, reason } = req.body;
    const companyId = req.companyId;
    const user = req.user;

    // Validate required fields
    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, start date, and end date are required'
      });
    }
    
    // Map leaveType to valid enum value
    leaveType = mapLeaveType(leaveType);
    
    // Validate that the mapped leaveType is a valid enum value
    const validEnums = ['Personal Leave', 'Sick Leave', 'Casual Leave', 'Comp Offs', 'Floater Leave', 'Marriage Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave'];
    if (!validEnums.includes(leaveType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type. Valid types are: ${validEnums.join(', ')}`
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

    // Get employee details with reporting manager
    const employee = await TenantUser.findById(user._id).select('firstName lastName email reportingManager');

    if (!employee) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    console.log(`📝 Leave application from: ${employee.email}, Manager: ${employee.reportingManager || 'None'}`);

    // Check leave balance (skip for unpaid leave)
    if (leaveType !== 'Unpaid Leave') {
      const currentYear = new Date().getFullYear();
      const balance = await LeaveBalance.findOne({
        employeeId: employee._id,
        employeeEmail: employee.email,
        year: currentYear,
        leaveType: leaveType
      });

      if (!balance) {
        return res.status(400).json({
          success: false,
          message: `No balance found for ${leaveType}. Please contact HR.`
        });
      }

      if (balance.available <= 0) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance for ${leaveType}. Available: ${balance.available} days.`
        });
      }

      if (numberOfDays > balance.available) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance for ${leaveType}. Requested: ${numberOfDays} days, Available: ${balance.available} days.`
        });
      }
    }

    // Create leave request
    const leaveRequest = new LeaveRequest({
      employeeId: employee._id,
      employeeEmail: employee.email,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      leaveType,
      startDate: start,
      endDate: end,
      numberOfDays,
      reason: reason || '',
      status: 'pending',
      reportingManager: employee.reportingManager || null,
      appliedOn: new Date()
    });

    await leaveRequest.save();

    console.log(`✅ Leave request created: ${leaveRequest._id}`);

    // Create approval instance using the approval engine
    try {
      const approvalEngine = require('../services/approvalEngine');
      
      const approvalInstance = await approvalEngine.createApprovalInstance({
        requestType: 'leave',
        requestId: leaveRequest._id,
        requestedBy: employee._id,
        metadata: {
          duration: numberOfDays,
          leaveType: leaveType,
          startDate: start,
          endDate: end,
          priority: 'medium'
        }
      }, tenantConnection);

      // Update leave request with approval instance ID
      leaveRequest.approvalInstanceId = approvalInstance._id;
      await leaveRequest.save();

      console.log(`✅ Approval workflow initiated: ${approvalInstance._id}`);
      console.log(`   Workflow: ${approvalInstance.totalLevels} level(s)`);
    } catch (approvalError) {
      console.error('⚠️  Error creating approval instance:', approvalError.message);
      // Don't fail the leave request if approval creation fails
      // The leave can still be approved manually
    }

    // Don't close connection manually - let connection pooling handle it

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully and sent for approval',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error applying for leave:', error);
    // Don't close connection manually on error either
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to apply for leave'
    });
  }
};

/**
 * Cancel leave
 */
exports.cancelLeave = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Leave cancellation feature coming soon'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
