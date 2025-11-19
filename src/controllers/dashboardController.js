const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');

exports.getDashboardStats = async (req, res) => {
  try {
    // Get tenant connection
    const tenantConnection = req.tenant.connection;
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    
    // Employee stats
    const totalEmployees = await TenantUser.countDocuments({ 
      role: { $in: ['employee', 'manager'] },
      isActive: true 
    });
    const activeEmployees = totalEmployees; // All active users
    const onLeaveEmployees = 0; // TODO: Calculate from current leaves

    // Leave stats
    const pendingLeaves = await LeaveRequest.countDocuments({ status: 'pending' });
    const approvedLeaves = await LeaveRequest.countDocuments({ status: 'approved' });

    // Department-wise employee distribution
    const employeesByDepartment = await TenantUser.aggregate([
      { $match: { role: { $in: ['employee', 'manager'] }, isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $project: { department: { $ifNull: ['$_id', 'Unassigned'] }, count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent leaves
    const recentLeaves = await LeaveRequest.find()
      .sort({ appliedOn: -1 })
      .limit(5);

    console.log(`📊 Dashboard stats for company ${req.tenant.companyId}:`, {
      totalEmployees,
      pendingLeaves,
      approvedLeaves
    });

    res.status(200).json({
      success: true,
      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          onLeave: onLeaveEmployees
        },
        leaves: {
          pending: pendingLeaves,
          approved: approvedLeaves
        },
        employeesByDepartment,
        recentLeaves
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
