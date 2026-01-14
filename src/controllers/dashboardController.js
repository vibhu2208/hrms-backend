const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const { getTenantModel } = require('../utils/tenantModels');
const Payroll = require('../models/Payroll');

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

exports.getHRDashboardStats = async (req, res) => {
  try {
    // Get tenant connection
    const tenantConnection = req.tenant.connection;
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    const Payroll = getTenantModel(tenantConnection, 'Payroll');
    const JobPosting = getTenantModel(tenantConnection, 'JobPosting');
    
    // Total Employees count (all active employees and managers)
    const totalEmployees = await TenantUser.countDocuments({ 
      role: { $in: ['employee', 'manager'] },
      isActive: true 
    });

    // Pending Leaves count
    const pendingLeaves = await LeaveRequest.countDocuments({ status: 'pending' });

    // Payroll This Month - sum of netSalary for current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    
    let payrollThisMonth = 0;
    if (Payroll) {
      const payrolls = await Payroll.find({
        month: currentMonth,
        year: currentYear,
        paymentStatus: { $in: ['paid', 'processing'] } // Only count paid or processing payrolls
      });
      payrollThisMonth = payrolls.reduce((sum, payroll) => sum + (payroll.netSalary || 0), 0);
    }

    // Open Positions count (active job postings)
    let openPositions = 0;
    if (JobPosting) {
      openPositions = await JobPosting.countDocuments({ status: 'active' });
    }

    console.log(`📊 HR Dashboard stats for company ${req.tenant.companyId}:`, {
      totalEmployees,
      pendingLeaves,
      payrollThisMonth,
      openPositions
    });

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        pendingLeaves,
        payrollThisMonth,
        openPositions
      }
    });
  } catch (error) {
    console.error('Error fetching HR dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
