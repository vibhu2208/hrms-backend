const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const { getTenantModel } = require('../utils/tenantModels');
const Payroll = require('../models/Payroll');
const mongoose = require('mongoose');

exports.getDashboardStats = async (req, res) => {
  try {
    // Get tenant connection
    const tenantConnection = req.tenant.connection;
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    const Attendance = getTenantModel(tenantConnection, 'Attendance');
    const Payroll = getTenantModel(tenantConnection, 'Payroll');
    const Asset = getTenantModel(tenantConnection, 'Asset');
    const JobPosting = getTenantModel(tenantConnection, 'JobPosting');
    const Candidate = getTenantModel(tenantConnection, 'Candidate');
    
    // Employee stats
    const totalEmployees = await TenantUser.countDocuments({ 
      role: { $in: ['employee', 'manager'] },
      isActive: true 
    });
    const activeEmployees = totalEmployees;
    
    // Calculate employees on leave today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const onLeaveEmployees = await LeaveRequest.countDocuments({
      status: 'approved',
      startDate: { $lte: tomorrow },
      endDate: { $gte: today }
    });

    // Leave stats
    const pendingLeaves = await LeaveRequest.countDocuments({ status: 'pending' });
    const approvedLeaves = await LeaveRequest.countDocuments({ status: 'approved' });

    // Attendance stats for today
    let todayAttendance = 0;
    if (Attendance) {
      todayAttendance = await Attendance.countDocuments({
        date: { $gte: today, $lt: tomorrow },
        status: 'present'
      });
    }

    // Payroll stats
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    let pendingPayroll = 0;
    if (Payroll) {
      pendingPayroll = await Payroll.countDocuments({
        month: currentMonth,
        year: currentYear,
        paymentStatus: 'pending'
      });
    }

    // Job stats
    let activeJobs = 0;
    if (JobPosting) {
      activeJobs = await JobPosting.countDocuments({ status: 'active' });
    }

    // Asset stats
    let totalAssets = 0;
    let assignedAssets = 0;
    if (Asset) {
      totalAssets = await Asset.countDocuments();
      assignedAssets = await Asset.countDocuments({ status: 'assigned' });
    }

    // Department-wise employee distribution
    const employeesByDepartment = await TenantUser.aggregate([
      { $match: { role: { $in: ['employee', 'manager'] }, isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $project: { department: { $ifNull: ['$_id', 'Unassigned'] }, count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent leaves (employeeName is already stored in the schema, no need to populate)
    const recentLeaves = await LeaveRequest.find()
      .sort({ appliedOn: -1 })
      .limit(5)
      .select('employeeName leaveType status startDate endDate appliedOn numberOfDays')
      .lean();

    // Attendance trend for last 7 days
    let attendanceTrend = [];
    if (Attendance) {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      attendanceTrend = await Attendance.aggregate([
        {
          $match: {
            date: { $gte: sevenDaysAgo, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            present: {
              $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
            },
            absent: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 7 }
      ]);
    }

    console.log(`📊 Dashboard stats for company ${req.tenant.companyId}:`, {
      totalEmployees,
      pendingLeaves,
      approvedLeaves,
      todayAttendance
    });

    res.status(200).json({
      success: true,
      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          onLeave: onLeaveEmployees
        },
        attendance: {
          today: todayAttendance,
          trend: attendanceTrend
        },
        leaves: {
          pending: pendingLeaves,
          approved: approvedLeaves
        },
        payroll: {
          pending: pendingPayroll
        },
        jobs: {
          active: activeJobs
        },
        assets: {
          total: totalAssets,
          assigned: assignedAssets
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
    const Candidate = getTenantModel(tenantConnection, 'Candidate');
    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    
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
        paymentStatus: { $in: ['paid', 'processing'] }
      });
      payrollThisMonth = payrolls.reduce((sum, payroll) => sum + (payroll.netSalary || 0), 0);
    }

    // Open Positions count (active job postings)
    let openPositions = 0;
    if (JobPosting) {
      openPositions = await JobPosting.countDocuments({ status: 'active' });
    }

    // Recruitment stats
    let recruitmentStats = {
      totalApplications: 0,
      shortlisted: 0,
      interviewScheduled: 0,
      selected: 0,
      rejected: 0
    };
    if (Candidate) {
      recruitmentStats.totalApplications = await Candidate.countDocuments({ isActive: true });
      recruitmentStats.shortlisted = await Candidate.countDocuments({ stage: 'shortlisted' });
      recruitmentStats.interviewScheduled = await Candidate.countDocuments({ stage: 'interview-scheduled' });
      recruitmentStats.selected = await Candidate.countDocuments({ 
        stage: { $in: ['offer-accepted', 'sent-to-onboarding'] }
      });
      recruitmentStats.rejected = await Candidate.countDocuments({ stage: 'rejected' });
    }

    // Onboarding stats
    let onboardingStats = {
      total: 0,
      preboarding: 0,
      inProgress: 0,
      completed: 0
    };
    if (Onboarding) {
      onboardingStats.total = await Onboarding.countDocuments();
      onboardingStats.preboarding = await Onboarding.countDocuments({ status: 'preboarding' });
      onboardingStats.inProgress = await Onboarding.countDocuments({ 
        status: { $in: ['offer_sent', 'offer_accepted', 'docs_pending', 'docs_verified', 'ready_for_joining'] }
      });
      onboardingStats.completed = await Onboarding.countDocuments({ status: 'completed' });
    }

    console.log(`📊 HR Dashboard stats for company ${req.tenant.companyId}:`, {
      totalEmployees,
      pendingLeaves,
      payrollThisMonth,
      openPositions,
      recruitmentStats,
      onboardingStats
    });

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        pendingLeaves,
        payrollThisMonth,
        openPositions,
        recruitment: recruitmentStats,
        onboarding: onboardingStats
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
