const { getTenantModel } = require('../../utils/tenantModels');
const { TENANT_ROLES } = require('../../config/tenantPermissions');

/**
 * Get employee dashboard data based on role and scope
 * GET /api/tenant/employee/dashboard
 */
const getEmployeeDashboard = async (req, res) => {
  try {
    const { roleSlug, scope, clientId, userId } = req.user;

    const Employee = getTenantModel(req.tenant.connection, 'Employee');
    const Leave = getTenantModel(req.tenant.connection, 'Leave');
    const Attendance = getTenantModel(req.tenant.connection, 'Attendance');
    const Project = getTenantModel(req.tenant.connection, 'Project');

    if (!Employee || !Leave || !Attendance || !Project) {
      return res.status(500).json({
        success: false,
        message: 'Required models not available'
      });
    }

    let dashboardData = {
      userInfo: {
        roleSlug,
        scope,
        permissions: req.user.permissions
      }
    };

    // Get employee record
    const employee = await Employee.findOne({ userId: userId });
    
    if (employee) {
      dashboardData.employee = {
        id: employee._id,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        joinDate: employee.joinDate
      };
    }

    // Role-specific dashboard data
    switch (roleSlug) {
      case TENANT_ROLES.REGULAR_EMPLOYEE:
        dashboardData = await getRegularEmployeeDashboard(req, dashboardData);
        break;
      
      case TENANT_ROLES.TEAM_LEAD:
        dashboardData = await getTeamLeadDashboard(req, dashboardData);
        break;
      
      case TENANT_ROLES.CONSULTANT:
        dashboardData = await getConsultantDashboard(req, dashboardData);
        break;
      
      case TENANT_ROLES.INTERN:
        dashboardData = await getInternDashboard(req, dashboardData);
        break;
      
      default:
        dashboardData.modules = ['profile', 'attendance'];
    }

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('❌ Error fetching employee dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
};

/**
 * Regular Employee Dashboard - Self scope
 */
const getRegularEmployeeDashboard = async (req, dashboardData) => {
  const { userId } = req.user;
  
  const Leave = getTenantModel(req.tenant.connection, 'Leave');
  const Attendance = getTenantModel(req.tenant.connection, 'Attendance');
  const Employee = getTenantModel(req.tenant.connection, 'Employee');

  try {
    // Get employee's leave balance and recent leaves
    const employee = await Employee.findOne({ userId });
    if (employee) {
      const recentLeaves = await Leave.find({ employeeId: employee._id })
        .sort({ createdAt: -1 })
        .limit(5);
      
      dashboardData.leaves = {
        balance: employee.leaveBalance || 0,
        recent: recentLeaves
      };
    }

    // Get recent attendance
    const recentAttendance = await Attendance.find({ employeeId: employee?._id })
      .sort({ date: -1 })
      .limit(7);

    dashboardData.attendance = {
      recent: recentAttendance,
      thisMonth: recentAttendance.length
    };

    dashboardData.modules = [
      'profile',
      'leave',
      'attendance', 
      'payroll',
      'documents'
    ];

    dashboardData.quickActions = [
      { name: 'Apply Leave', route: '/employee/leave/apply' },
      { name: 'Mark Attendance', route: '/employee/attendance/mark' },
      { name: 'View Payslip', route: '/employee/payroll/payslip' },
      { name: 'Update Profile', route: '/employee/profile' }
    ];

  } catch (error) {
    console.error('❌ Error in regular employee dashboard:', error);
  }

  return dashboardData;
};

/**
 * Team Lead Dashboard - Team scope
 */
const getTeamLeadDashboard = async (req, dashboardData) => {
  const { userId } = req.user;
  
  const Employee = getTenantModel(req.tenant.connection, 'Employee');
  const Leave = getTenantModel(req.tenant.connection, 'Leave');
  const Attendance = getTenantModel(req.tenant.connection, 'Attendance');
  const Project = getTenantModel(req.tenant.connection, 'Project');

  try {
    // Get team members (employees reporting to this user)
    const currentEmployee = await Employee.findOne({ userId });
    if (currentEmployee) {
      const teamMembers = await Employee.find({ 
        managerId: currentEmployee._id 
      });

      dashboardData.team = {
        size: teamMembers.length,
        members: teamMembers.map(member => ({
          id: member._id,
          name: member.name,
          position: member.position,
          status: member.status
        }))
      };

      // Get pending leave approvals
      const pendingLeaves = await Leave.find({
        approverId: currentEmployee._id,
        status: 'pending'
      }).populate('employeeId', 'name');

      dashboardData.pendingApprovals = {
        leaves: pendingLeaves.length,
        leaveDetails: pendingLeaves
      };

      // Get team attendance summary
      const teamIds = teamMembers.map(member => member._id);
      const today = new Date();
      const todayAttendance = await Attendance.find({
        employeeId: { $in: teamIds },
        date: {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lt: new Date(today.setHours(23, 59, 59, 999))
        }
      });

      dashboardData.teamAttendance = {
        present: todayAttendance.filter(att => att.status === 'present').length,
        absent: teamMembers.length - todayAttendance.length,
        late: todayAttendance.filter(att => att.status === 'late').length
      };
    }

    dashboardData.modules = [
      'profile',
      'team',
      'leave',
      'attendance',
      'projects',
      'approvals',
      'payroll'
    ];

    dashboardData.quickActions = [
      { name: 'Approve Leaves', route: '/teamlead/approvals/leaves' },
      { name: 'Team Attendance', route: '/teamlead/team/attendance' },
      { name: 'Assign Tasks', route: '/teamlead/projects/assign' },
      { name: 'Team Reports', route: '/teamlead/reports' }
    ];

  } catch (error) {
    console.error('❌ Error in team lead dashboard:', error);
  }

  return dashboardData;
};

/**
 * Consultant Dashboard - Self scope with timesheet focus
 */
const getConsultantDashboard = async (req, dashboardData) => {
  const { userId } = req.user;
  
  const Employee = getTenantModel(req.tenant.connection, 'Employee');
  const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
  const Project = getTenantModel(req.tenant.connection, 'Project');

  try {
    const employee = await Employee.findOne({ userId });
    
    if (employee) {
      // Get recent timesheets
      const recentTimesheets = await Timesheet.find({ 
        employeeId: employee._id 
      })
      .sort({ date: -1 })
      .limit(10)
      .populate('projectId', 'name');

      dashboardData.timesheets = {
        recent: recentTimesheets,
        thisWeek: recentTimesheets.filter(ts => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return ts.date >= weekAgo;
        }).length
      };

      // Get assigned projects
      const assignedProjects = await Project.find({
        'team.members': employee._id
      });

      dashboardData.projects = {
        assigned: assignedProjects.length,
        active: assignedProjects.filter(p => p.status === 'active').length,
        details: assignedProjects.map(project => ({
          id: project._id,
          name: project.name,
          status: project.status,
          deadline: project.endDate
        }))
      };
    }

    dashboardData.modules = [
      'profile',
      'timesheet',
      'projects',
      'payroll',
      'attendance'
    ];

    dashboardData.quickActions = [
      { name: 'Submit Timesheet', route: '/consultant/timesheet/submit' },
      { name: 'View Projects', route: '/consultant/projects' },
      { name: 'Track Hours', route: '/consultant/timesheet/track' },
      { name: 'Generate Report', route: '/consultant/reports' }
    ];

  } catch (error) {
    console.error('❌ Error in consultant dashboard:', error);
  }

  return dashboardData;
};

/**
 * Intern Dashboard - Limited self scope
 */
const getInternDashboard = async (req, dashboardData) => {
  const { userId } = req.user;
  
  const Employee = getTenantModel(req.tenant.connection, 'Employee');
  const Attendance = getTenantModel(req.tenant.connection, 'Attendance');
  const Project = getTenantModel(req.tenant.connection, 'Project');

  try {
    const employee = await Employee.findOne({ userId });
    
    if (employee) {
      // Get attendance summary
      const attendanceRecords = await Attendance.find({ 
        employeeId: employee._id 
      })
      .sort({ date: -1 })
      .limit(30);

      dashboardData.attendance = {
        thisMonth: attendanceRecords.length,
        present: attendanceRecords.filter(att => att.status === 'present').length,
        recent: attendanceRecords.slice(0, 7)
      };

      // Get learning projects/tasks
      const learningProjects = await Project.find({
        'team.members': employee._id,
        type: 'learning'
      });

      dashboardData.learning = {
        projects: learningProjects.length,
        completed: learningProjects.filter(p => p.status === 'completed').length,
        details: learningProjects.map(project => ({
          id: project._id,
          name: project.name,
          status: project.status,
          progress: project.progress || 0
        }))
      };
    }

    dashboardData.modules = [
      'profile',
      'attendance',
      'learning',
      'documents'
    ];

    dashboardData.quickActions = [
      { name: 'Mark Attendance', route: '/intern/attendance/mark' },
      { name: 'View Learning Path', route: '/intern/learning' },
      { name: 'Update Profile', route: '/intern/profile' },
      { name: 'View Documents', route: '/intern/documents' }
    ];

  } catch (error) {
    console.error('❌ Error in intern dashboard:', error);
  }

  return dashboardData;
};

/**
 * Get role-specific navigation menu
 * GET /api/tenant/employee/navigation
 */
const getNavigationMenu = async (req, res) => {
  try {
    const { roleSlug, scope } = req.user;

    let navigation = [];

    switch (roleSlug) {
      case TENANT_ROLES.REGULAR_EMPLOYEE:
        navigation = [
          { name: 'Dashboard', route: '/employee/dashboard', icon: 'dashboard' },
          { name: 'Profile', route: '/employee/profile', icon: 'user' },
          { name: 'Leave', route: '/employee/leave', icon: 'calendar' },
          { name: 'Attendance', route: '/employee/attendance', icon: 'clock' },
          { name: 'Payroll', route: '/employee/payroll', icon: 'dollar' },
          { name: 'Documents', route: '/employee/documents', icon: 'file' }
        ];
        break;

      case TENANT_ROLES.TEAM_LEAD:
        navigation = [
          { name: 'Dashboard', route: '/teamlead/dashboard', icon: 'dashboard' },
          { name: 'Team', route: '/teamlead/team', icon: 'users' },
          { name: 'Approvals', route: '/teamlead/approvals', icon: 'check' },
          { name: 'Projects', route: '/teamlead/projects', icon: 'briefcase' },
          { name: 'Reports', route: '/teamlead/reports', icon: 'chart' },
          { name: 'Profile', route: '/teamlead/profile', icon: 'user' }
        ];
        break;

      case TENANT_ROLES.CONSULTANT:
        navigation = [
          { name: 'Dashboard', route: '/consultant/dashboard', icon: 'dashboard' },
          { name: 'Timesheet', route: '/consultant/timesheet', icon: 'clock' },
          { name: 'Projects', route: '/consultant/projects', icon: 'briefcase' },
          { name: 'Reports', route: '/consultant/reports', icon: 'chart' },
          { name: 'Profile', route: '/consultant/profile', icon: 'user' }
        ];
        break;

      case TENANT_ROLES.INTERN:
        navigation = [
          { name: 'Dashboard', route: '/intern/dashboard', icon: 'dashboard' },
          { name: 'Learning', route: '/intern/learning', icon: 'book' },
          { name: 'Attendance', route: '/intern/attendance', icon: 'clock' },
          { name: 'Profile', route: '/intern/profile', icon: 'user' }
        ];
        break;

      default:
        navigation = [
          { name: 'Dashboard', route: '/employee/dashboard', icon: 'dashboard' },
          { name: 'Profile', route: '/employee/profile', icon: 'user' }
        ];
    }

    res.json({
      success: true,
      data: {
        navigation,
        roleSlug,
        scope
      }
    });

  } catch (error) {
    console.error('❌ Error fetching navigation menu:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch navigation menu',
      error: error.message
    });
  }
};

module.exports = {
  getEmployeeDashboard,
  getNavigationMenu
};
