const { getTenantModels } = require('../utils/tenantModels');

exports.getDashboardStats = async (req, res) => {
  try {
    // Get tenant-specific models
    const { Employee, Leave, Attendance, Payroll, Asset, JobPosting } = getTenantModels(req.tenant.connection);
    // Employee stats
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    const onLeaveEmployees = await Employee.countDocuments({ status: 'on-leave' });

    // Leave stats
    const pendingLeaves = await Leave.countDocuments({ status: 'pending' });
    const approvedLeaves = await Leave.countDocuments({ status: 'approved' });

    // Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'present'
    });

    // Payroll stats - current month
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const pendingPayroll = await Payroll.countDocuments({
      month: currentMonth,
      year: currentYear,
      paymentStatus: 'pending'
    });

    // Asset stats
    const totalAssets = await Asset.countDocuments();
    const assignedAssets = await Asset.countDocuments({ status: 'assigned' });
    const availableAssets = await Asset.countDocuments({ status: 'available' });

    // Job postings
    const activeJobs = await JobPosting.countDocuments({ status: 'active' });

    // Department-wise employee distribution
    const employeesByDepartment = await Employee.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { department: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent leaves
    const recentLeaves = await Leave.find()
      .populate('employee', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Attendance trend - last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const attendanceTrend = await Attendance.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } }
      }},
      { $sort: { _id: 1 } }
    ]);

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
        attendance: {
          today: todayAttendance,
          trend: attendanceTrend
        },
        payroll: {
          pending: pendingPayroll
        },
        assets: {
          total: totalAssets,
          assigned: assignedAssets,
          available: availableAssets
        },
        jobs: {
          active: activeJobs
        },
        employeesByDepartment,
        recentLeaves
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
