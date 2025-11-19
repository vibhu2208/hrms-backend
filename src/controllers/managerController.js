const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');

// @desc    Get team members reporting to manager
// @route   GET /api/manager/team-members
// @access  Private (Manager only)
exports.getTeamMembers = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId; // From auth middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching team members for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Find all employees reporting to this manager
    const teamMembers = await TenantUser.find({
      reportingManager: managerEmail,
      isActive: true
    }).select('-password').sort({ firstName: 1 });

    // Close connection
    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: teamMembers.length,
      data: teamMembers
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get team statistics
// @route   GET /api/manager/team-stats
// @access  Private (Manager only)
exports.getTeamStats = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId; // From auth middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching team stats for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Get total team members
    const totalMembers = await TenantUser.countDocuments({
      reportingManager: managerEmail,
      isActive: true
    });

    // TODO: Get attendance data for present/absent counts
    // For now, returning mock data structure
    const stats = {
      totalMembers: totalMembers,
      present: 0, // TODO: Calculate from today's attendance
      onLeave: 0, // TODO: Calculate from leave requests
      pendingApprovals: 0 // TODO: Calculate from pending leave requests
    };

    // Close connection
    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching team stats:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get pending leave requests for team
// @route   GET /api/manager/pending-leaves
// @access  Private (Manager only)
exports.getPendingLeaves = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId; // From auth middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching pending leaves for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Fetch pending leave requests for this manager's team
    const pendingLeaves = await LeaveRequest.find({
      reportingManager: managerEmail,
      status: 'pending'
    }).sort({ appliedOn: -1 });

    console.log(`✅ Found ${pendingLeaves.length} pending leave requests`);

    // Close connection
    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: pendingLeaves.length,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('Error fetching pending leaves:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve leave request
// @route   PUT /api/manager/leave/:id/approve
// @access  Private (Manager only)
exports.approveLeave = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const managerEmail = req.user.email;
    const managerName = `${req.user.firstName} ${req.user.lastName}`;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Find leave request
    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Verify it's for this manager's team
    if (leaveRequest.reportingManager !== managerEmail) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this leave request'
      });
    }

    // Update leave request
    leaveRequest.status = 'approved';
    leaveRequest.approvedBy = managerName;
    leaveRequest.approvedByEmail = managerEmail;
    leaveRequest.approvedOn = new Date();
    leaveRequest.approvalComments = comments || '';

    await leaveRequest.save();

    // Update leave balance - deduct consumed days
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    const year = new Date(leaveRequest.startDate).getFullYear();
    
    const leaveBalance = await LeaveBalance.findOne({
      employeeEmail: leaveRequest.employeeEmail,
      year: year,
      leaveType: leaveRequest.leaveType
    });

    if (leaveBalance) {
      leaveBalance.consumed += leaveRequest.numberOfDays;
      leaveBalance.available = leaveBalance.total - leaveBalance.consumed;
      await leaveBalance.save();
      console.log(`📊 Updated balance: ${leaveRequest.leaveType} - Consumed: ${leaveBalance.consumed}/${leaveBalance.total}`);
    }

    console.log(`✅ Leave approved: ${id} by ${managerEmail}`);

    // Close connection
    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Leave request approved successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject leave request
// @route   PUT /api/manager/leave/:id/reject
// @access  Private (Manager only)
exports.rejectLeave = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const managerEmail = req.user.email;
    const managerName = `${req.user.firstName} ${req.user.lastName}`;
    const companyId = req.companyId;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Find leave request
    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Verify it's for this manager's team
    if (leaveRequest.reportingManager !== managerEmail) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this leave request'
      });
    }

    // Update leave request
    leaveRequest.status = 'rejected';
    leaveRequest.rejectedBy = managerName;
    leaveRequest.rejectedByEmail = managerEmail;
    leaveRequest.rejectedOn = new Date();
    leaveRequest.rejectionReason = reason;

    await leaveRequest.save();

    console.log(`❌ Leave rejected: ${id} by ${managerEmail}`);

    // Close connection
    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Leave request rejected successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
