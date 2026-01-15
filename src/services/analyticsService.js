/**
 * Analytics Service
 * Provides analytics and insights for attendance trends, leave patterns, and compliance metrics
 * @module services/analyticsService
 */

const { getTenantConnection } = require('../config/database.config');
const { getTenantModel } = require('../utils/tenantModels');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const Attendance = require('../models/Attendance');
const Document = require('../models/Document');
const Compliance = require('../models/Compliance');
const Employee = require('../models/Employee');

class AnalyticsService {
  /**
   * Get Attendance Trends
   */
  async getAttendanceTrends(companyId, filters = {}) {
    try {
      const { startDate, endDate, groupBy = 'month' } = filters;

      const tenantConnection = await getTenantConnection(companyId);
      const AttendanceModel = getTenantModel(tenantConnection, 'Attendance') || tenantConnection.model('Attendance', Attendance.schema);
      const EmployeeModel = getTenantModel(tenantConnection, 'Employee') || tenantConnection.model('Employee', Employee.schema);

      const query = {};
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      const attendanceRecords = await AttendanceModel.find(query)
        .populate({ path: 'employee', select: 'firstName lastName department designation employeeCode', model: EmployeeModel })
        .lean();

      // Group by time period
      const trends = {
        byPeriod: {},
        overall: {
          totalDays: attendanceRecords.length,
          present: 0,
          absent: 0,
          late: 0,
          averageWorkingHours: 0,
          totalLateMinutes: 0
        }
      };

      let totalWorkingHours = 0;
      let workingHoursCount = 0;

      attendanceRecords.forEach(record => {
        let periodKey = '';
        if (groupBy === 'month') {
          periodKey = new Date(record.date).toLocaleString('default', { month: 'long', year: 'numeric' });
        } else if (groupBy === 'week') {
          const weekStart = this.getWeekStart(record.date);
          periodKey = weekStart.toLocaleDateString();
        } else if (groupBy === 'day') {
          periodKey = new Date(record.date).toLocaleDateString();
        }

        if (!trends.byPeriod[periodKey]) {
          trends.byPeriod[periodKey] = {
            present: 0,
            absent: 0,
            late: 0,
            totalWorkingHours: 0,
            totalLateMinutes: 0,
            recordCount: 0
          };
        }

        const period = trends.byPeriod[periodKey];
        period.recordCount++;

        if (record.status === 'present') {
          trends.overall.present++;
          period.present++;
        }
        if (record.status === 'absent') {
          trends.overall.absent++;
          period.absent++;
        }
        if (record.lateBy && record.lateBy > 0) {
          trends.overall.late++;
          period.late++;
          trends.overall.totalLateMinutes += record.lateBy;
          period.totalLateMinutes += record.lateBy;
        }
        if (record.workingHours) {
          totalWorkingHours += record.workingHours;
          workingHoursCount++;
          period.totalWorkingHours += record.workingHours;
        }
      });

      trends.overall.averageWorkingHours = workingHoursCount > 0 
        ? totalWorkingHours / workingHoursCount 
        : 0;

      // Calculate percentages
      Object.keys(trends.byPeriod).forEach(period => {
        const periodData = trends.byPeriod[period];
        periodData.presentPercentage = periodData.recordCount > 0
          ? (periodData.present / periodData.recordCount) * 100
          : 0;
        periodData.absentPercentage = periodData.recordCount > 0
          ? (periodData.absent / periodData.recordCount) * 100
          : 0;
        periodData.averageWorkingHours = periodData.recordCount > 0
          ? periodData.totalWorkingHours / periodData.recordCount
          : 0;
      });

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        groupBy: groupBy,
        trends: trends
      };
    } catch (error) {
      throw new Error(`Attendance trends analysis failed: ${error.message}`);
    }
  }

  /**
   * Get Leave Patterns
   */
  async getLeavePatterns(companyId, filters = {}) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

      const { startDate, endDate, leaveType } = filters;

      const query = {};
      if (startDate || endDate) {
        query.startDate = {};
        if (startDate) query.startDate.$gte = new Date(startDate);
        if (endDate) query.startDate.$lte = new Date(endDate);
      }
      if (leaveType) query.leaveType = leaveType;

      const leaveRequests = await LeaveRequest.find(query)
        .populate('employeeId', 'departmentId designation')
        .lean();

      // Analyze patterns
      const patterns = {
        byLeaveType: {},
        byMonth: {},
        byDepartment: {},
        byStatus: {},
        peakDays: {},
        averageDuration: 0
      };

      let totalDuration = 0;
      let requestCount = 0;

      leaveRequests.forEach(request => {
        // By leave type
        if (!patterns.byLeaveType[request.leaveType]) {
          patterns.byLeaveType[request.leaveType] = {
            count: 0,
            totalDays: 0,
            averageDays: 0
          };
        }
        patterns.byLeaveType[request.leaveType].count++;
        patterns.byLeaveType[request.leaveType].totalDays += request.numberOfDays || 0;

        // By month
        const month = new Date(request.startDate).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!patterns.byMonth[month]) {
          patterns.byMonth[month] = { count: 0, totalDays: 0 };
        }
        patterns.byMonth[month].count++;
        patterns.byMonth[month].totalDays += request.numberOfDays || 0;

        // By department
        const deptId = request.employeeId?.departmentId?.toString() || 'unknown';
        if (!patterns.byDepartment[deptId]) {
          patterns.byDepartment[deptId] = { count: 0, totalDays: 0 };
        }
        patterns.byDepartment[deptId].count++;
        patterns.byDepartment[deptId].totalDays += request.numberOfDays || 0;

        // By status
        if (!patterns.byStatus[request.status]) {
          patterns.byStatus[request.status] = { count: 0, totalDays: 0 };
        }
        patterns.byStatus[request.status].count++;
        patterns.byStatus[request.status].totalDays += request.numberOfDays || 0;

        // Peak days (day of week)
        const dayOfWeek = new Date(request.startDate).getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        if (!patterns.peakDays[dayName]) {
          patterns.peakDays[dayName] = 0;
        }
        patterns.peakDays[dayName]++;

        totalDuration += request.numberOfDays || 0;
        requestCount++;
      });

      patterns.averageDuration = requestCount > 0 ? totalDuration / requestCount : 0;

      // Calculate averages
      Object.keys(patterns.byLeaveType).forEach(type => {
        const typeData = patterns.byLeaveType[type];
        typeData.averageDays = typeData.count > 0 ? typeData.totalDays / typeData.count : 0;
      });

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        patterns: patterns,
        totalRequests: requestCount
      };
    } catch (error) {
      throw new Error(`Leave patterns analysis failed: ${error.message}`);
    }
  }

  /**
   * Get Compliance Metrics
   */
  async getComplianceMetrics(companyId, filters = {}) {
    try {
      const { dateFrom, dateTo } = filters;

      // Document compliance
      const documentQuery = {
        expiryDate: { $exists: true, $ne: null }
      };
      if (dateFrom || dateTo) {
        documentQuery.expiryDate = {};
        if (dateFrom) documentQuery.expiryDate.$gte = new Date(dateFrom);
        if (dateTo) documentQuery.expiryDate.$lte = new Date(dateTo);
      }

      const documents = await Document.find(documentQuery)
        .populate('employee', 'department')
        .lean();

      // Compliance tasks
      const complianceQuery = {};
      if (dateFrom || dateTo) {
        complianceQuery.dueDate = {};
        if (dateFrom) complianceQuery.dueDate.$gte = new Date(dateFrom);
        if (dateTo) complianceQuery.dueDate.$lte = new Date(dateTo);
      }

      const compliances = await Compliance.find(complianceQuery)
        .populate('employee', 'department')
        .lean();

      const now = new Date();
      const metrics = {
        documents: {
          total: documents.length,
          expiring: 0,
          expired: 0,
          valid: 0,
          expiringIn30Days: 0,
          expiringIn60Days: 0
        },
        compliances: {
          total: compliances.length,
          pending: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
          dueIn15Days: 0,
          dueIn30Days: 0
        },
        riskLevel: 'low' // low, medium, high, critical
      };

      documents.forEach(doc => {
        if (!doc.expiryDate) {
          metrics.documents.valid++;
          return;
        }

        const daysUntilExpiry = Math.ceil((doc.expiryDate - now) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          metrics.documents.expired++;
        } else if (daysUntilExpiry <= 30) {
          metrics.documents.expiring++;
          metrics.documents.expiringIn30Days++;
        } else if (daysUntilExpiry <= 60) {
          metrics.documents.expiring++;
          metrics.documents.expiringIn60Days++;
        } else {
          metrics.documents.valid++;
        }
      });

      compliances.forEach(comp => {
        if (comp.status === 'pending') metrics.compliances.pending++;
        if (comp.status === 'in-progress') metrics.compliances.inProgress++;
        if (comp.status === 'completed') metrics.compliances.completed++;

        if (comp.dueDate) {
          const daysUntilDue = Math.ceil((comp.dueDate - now) / (1000 * 60 * 60 * 24));
          if (daysUntilDue < 0 && comp.status !== 'completed') {
            metrics.compliances.overdue++;
          } else if (daysUntilDue <= 15 && daysUntilDue > 0) {
            metrics.compliances.dueIn15Days++;
          } else if (daysUntilDue <= 30 && daysUntilDue > 15) {
            metrics.compliances.dueIn30Days++;
          }
        }
      });

      // Calculate risk level
      const expiredRatio = metrics.documents.total > 0 
        ? metrics.documents.expired / metrics.documents.total 
        : 0;
      const overdueRatio = metrics.compliances.total > 0
        ? metrics.compliances.overdue / metrics.compliances.total
        : 0;

      if (expiredRatio > 0.2 || overdueRatio > 0.2) {
        metrics.riskLevel = 'critical';
      } else if (expiredRatio > 0.1 || overdueRatio > 0.1) {
        metrics.riskLevel = 'high';
      } else if (expiredRatio > 0.05 || overdueRatio > 0.05) {
        metrics.riskLevel = 'medium';
      }

      return {
        success: true,
        metrics: metrics
      };
    } catch (error) {
      throw new Error(`Compliance metrics analysis failed: ${error.message}`);
    }
  }

  /**
   * Get Performance Indicators
   */
  async getPerformanceIndicators(companyId, filters = {}) {
    try {
      const { startDate, endDate } = filters;

      const tenantConnection = await getTenantConnection(companyId);
      const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
      const TenantUser = getTenantModel(tenantConnection, 'TenantUser')
        || tenantConnection.model('TenantUser', require('../models/tenant/TenantUser'));
      const AttendanceModel = getTenantModel(tenantConnection, 'Attendance') || tenantConnection.model('Attendance', Attendance.schema);

      // Get active employees
      const activeEmployees = await TenantUser.countDocuments({
        role: 'employee',
        isActive: true
      });

      // Get attendance stats
      const attendanceQuery = {};
      if (startDate || endDate) {
        attendanceQuery.date = {};
        if (startDate) attendanceQuery.date.$gte = new Date(startDate);
        if (endDate) attendanceQuery.date.$lte = new Date(endDate);
      }

      const attendanceRecords = await AttendanceModel.find(attendanceQuery).lean();
      const totalAttendanceDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
      const attendanceRate = totalAttendanceDays > 0 
        ? (presentDays / totalAttendanceDays) * 100 
        : 0;

      // Get leave stats
      const leaveQuery = {};
      if (startDate || endDate) {
        leaveQuery.startDate = {};
        if (startDate) leaveQuery.startDate.$gte = new Date(startDate);
        if (endDate) leaveQuery.startDate.$lte = new Date(endDate);
      }

      const leaveRequests = await LeaveRequest.find(leaveQuery).lean();
      const totalLeaveDays = leaveRequests.reduce((sum, req) => sum + (req.numberOfDays || 0), 0);
      const approvedLeaves = leaveRequests.filter(r => r.status === 'approved').length;
      const leaveApprovalRate = leaveRequests.length > 0
        ? (approvedLeaves / leaveRequests.length) * 100
        : 0;

      const indicators = {
        activeEmployees: activeEmployees,
        attendance: {
          totalDays: totalAttendanceDays,
          presentDays: presentDays,
          attendanceRate: Math.round(attendanceRate * 100) / 100
        },
        leave: {
          totalRequests: leaveRequests.length,
          approvedRequests: approvedLeaves,
          totalLeaveDays: totalLeaveDays,
          approvalRate: Math.round(leaveApprovalRate * 100) / 100
        }
      };

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        indicators: indicators
      };
    } catch (error) {
      if (tenantConnection) await tenantConnection.close();
      throw new Error(`Performance indicators analysis failed: ${error.message}`);
    }
  }

  /**
   * Get week start date
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }
}

module.exports = new AnalyticsService();


