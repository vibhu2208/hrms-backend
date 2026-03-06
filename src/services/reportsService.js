/**
 * Reports Service
 * Handles comprehensive report generation for leave, attendance, and compliance
 * @module services/reportsService
 */

const { getTenantConnection } = require('../config/database.config');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const TenantUserSchema = require('../models/tenant/TenantUser');
const Attendance = require('../models/Attendance');
const Document = require('../models/Document');
const Compliance = require('../models/Compliance');

class ReportsService {
  /**
   * Generate Leave Entitlement Report
   */
  async generateLeaveEntitlementReport(companyId, filters = {}) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const { year, departmentId, designation, location } = filters;
      const reportYear = year || new Date().getFullYear();

      // Build query for employees
      const employeeQuery = { role: 'employee', isActive: true };
      if (departmentId) employeeQuery.departmentId = departmentId;
      if (designation) employeeQuery.designation = designation;
      if (location) employeeQuery.location = location;

      const employees = await TenantUser.find(employeeQuery);
      const employeeEmails = employees.map(e => e.email);

      // Get leave balances
      const leaveBalances = await LeaveBalance.find({
        employeeEmail: { $in: employeeEmails },
        year: reportYear
      }).populate('employeeId', 'firstName lastName email designation departmentId');

      // Group by employee
      const reportData = [];
      const employeeMap = new Map();

      employees.forEach(emp => {
        employeeMap.set(emp.email, {
          employeeId: emp._id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          designation: emp.designation,
          department: emp.departmentId,
          leaveTypes: {}
        });
      });

      leaveBalances.forEach(balance => {
        const employee = employeeMap.get(balance.employeeEmail);
        if (employee) {
          employee.leaveTypes[balance.leaveType] = {
            total: balance.total,
            consumed: balance.consumed,
            available: balance.available,
            accrued: balance.accrued,
            carriedForward: balance.carriedForward,
            lapsed: balance.lapsed
          };
        }
      });

      // Convert map to array
      employeeMap.forEach((value) => {
        reportData.push(value);
      });

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        year: reportYear,
        totalEmployees: reportData.length,
        data: reportData
      };
    } catch (error) {
      throw new Error(`Leave entitlement report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Leave Balance Report
   */
  async generateLeaveBalanceReport(companyId, filters = {}) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const { year, leaveType, employeeId } = filters;
      const reportYear = year || new Date().getFullYear();

      const query = { year: reportYear };
      if (leaveType) query.leaveType = leaveType;

      const leaveBalances = await LeaveBalance.find(query)
        .populate('employeeId', 'firstName lastName email designation departmentId');

      // Filter by employee if specified
      let filteredBalances = leaveBalances;
      if (employeeId) {
        const employee = await TenantUser.findById(employeeId);
        if (employee) {
          filteredBalances = leaveBalances.filter(b => b.employeeEmail === employee.email);
        }
      }

      const reportData = filteredBalances.map(balance => ({
        employeeId: balance.employeeId?._id,
        employeeName: balance.employeeId ? `${balance.employeeId.firstName} ${balance.employeeId.lastName}` : 'N/A',
        email: balance.employeeEmail,
        designation: balance.employeeId?.designation,
        leaveType: balance.leaveType,
        total: balance.total,
        consumed: balance.consumed,
        available: balance.available,
        accrued: balance.accrued,
        carriedForward: balance.carriedForward,
        lapsed: balance.lapsed,
        year: balance.year
      }));

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        year: reportYear,
        totalRecords: reportData.length,
        data: reportData
      };
    } catch (error) {
      throw new Error(`Leave balance report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Leave Utilization Report
   */
  async generateLeaveUtilizationReport(companyId, filters = {}) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const { startDate, endDate, leaveType, departmentId, status } = filters;

      const query = {};
      if (startDate || endDate) {
        query.startDate = {};
        if (startDate) query.startDate.$gte = new Date(startDate);
        if (endDate) query.startDate.$lte = new Date(endDate);
      }
      if (leaveType) query.leaveType = leaveType;
      if (status) query.status = status;

      const leaveRequests = await LeaveRequest.find(query)
        .populate('employeeId', 'firstName lastName email designation departmentId')
        .sort({ startDate: -1 });

      // Filter by department if specified
      let filteredRequests = leaveRequests;
      if (departmentId) {
        filteredRequests = leaveRequests.filter(req => 
          req.employeeId?.departmentId?.toString() === departmentId.toString()
        );
      }

      // Calculate utilization statistics
      const utilizationStats = {
        totalRequests: filteredRequests.length,
        totalDays: filteredRequests.reduce((sum, req) => sum + (req.numberOfDays || 0), 0),
        byLeaveType: {},
        byStatus: {},
        byMonth: {}
      };

      filteredRequests.forEach(req => {
        // By leave type
        if (!utilizationStats.byLeaveType[req.leaveType]) {
          utilizationStats.byLeaveType[req.leaveType] = { count: 0, days: 0 };
        }
        utilizationStats.byLeaveType[req.leaveType].count++;
        utilizationStats.byLeaveType[req.leaveType].days += req.numberOfDays || 0;

        // By status
        if (!utilizationStats.byStatus[req.status]) {
          utilizationStats.byStatus[req.status] = { count: 0, days: 0 };
        }
        utilizationStats.byStatus[req.status].count++;
        utilizationStats.byStatus[req.status].days += req.numberOfDays || 0;

        // By month
        const month = new Date(req.startDate).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!utilizationStats.byMonth[month]) {
          utilizationStats.byMonth[month] = { count: 0, days: 0 };
        }
        utilizationStats.byMonth[month].count++;
        utilizationStats.byMonth[month].days += req.numberOfDays || 0;
      });

      const reportData = filteredRequests.map(req => ({
        employeeId: req.employeeId?._id,
        employeeName: req.employeeName,
        email: req.employeeEmail,
        leaveType: req.leaveType,
        startDate: req.startDate,
        endDate: req.endDate,
        numberOfDays: req.numberOfDays,
        status: req.status,
        appliedOn: req.appliedOn,
        approvedOn: req.approvedOn
      }));

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        statistics: utilizationStats,
        totalRecords: reportData.length,
        data: reportData
      };
    } catch (error) {
      throw new Error(`Leave utilization report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Attendance Summary Report
   */
  async generateAttendanceSummaryReport(companyId, filters = {}) {
    try {
      const { startDate, endDate, employeeId, departmentId } = filters;

      const query = {};
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }
      if (employeeId) query.employee = employeeId;

      const attendanceRecords = await Attendance.find(query)
        .populate('employee', 'firstName lastName employeeCode department designation')
        .sort({ date: -1 });

      // Filter by department if specified
      let filteredRecords = attendanceRecords;
      if (departmentId) {
        filteredRecords = attendanceRecords.filter(record =>
          record.employee?.department?.toString() === departmentId.toString()
        );
      }

      // Calculate summary statistics
      const summary = {
        totalRecords: filteredRecords.length,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        totalWorkingHours: 0,
        totalLateMinutes: 0
      };

      filteredRecords.forEach(record => {
        if (record.status === 'present') summary.present++;
        if (record.status === 'absent') summary.absent++;
        if (record.status === 'half-day') summary.halfDay++;
        if (record.lateBy && record.lateBy > 0) {
          summary.late++;
          summary.totalLateMinutes += record.lateBy;
        }
        if (record.workingHours) summary.totalWorkingHours += record.workingHours;
      });

      const reportData = filteredRecords.map(record => ({
        employeeId: record.employee?._id,
        employeeName: record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'N/A',
        employeeCode: record.employee?.employeeCode,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        status: record.status,
        workingHours: record.workingHours,
        lateBy: record.lateBy,
        overtime: record.overtime
      }));

      return {
        success: true,
        summary: summary,
        totalRecords: reportData.length,
        data: reportData
      };
    } catch (error) {
      throw new Error(`Attendance summary report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Attendance Exception Report
   */
  async generateAttendanceExceptionReport(companyId, filters = {}) {
    try {
      const { startDate, endDate, exceptionType } = filters;

      const query = {};
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      // Find exceptions based on type
      if (exceptionType === 'late') {
        query.lateBy = { $gt: 0 };
      } else if (exceptionType === 'absent') {
        query.status = 'absent';
      } else if (exceptionType === 'half-day') {
        query.status = 'half-day';
      } else if (exceptionType === 'early-out') {
        query.earlyOut = { $exists: true, $ne: null };
      }

      const exceptionRecords = await Attendance.find(query)
        .populate('employee', 'firstName lastName employeeCode department designation')
        .sort({ date: -1 });

      const reportData = exceptionRecords.map(record => ({
        employeeId: record.employee?._id,
        employeeName: record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'N/A',
        employeeCode: record.employee?.employeeCode,
        date: record.date,
        exceptionType: exceptionType || this.getExceptionType(record),
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        lateBy: record.lateBy,
        earlyOut: record.earlyOut,
        status: record.status,
        remarks: record.remarks
      }));

      return {
        success: true,
        exceptionType: exceptionType || 'all',
        totalRecords: reportData.length,
        data: reportData
      };
    } catch (error) {
      throw new Error(`Attendance exception report generation failed: ${error.message}`);
    }
  }

  /**
   * Get exception type from attendance record
   */
  getExceptionType(record) {
    if (record.status === 'absent') return 'absent';
    if (record.status === 'half-day') return 'half-day';
    if (record.lateBy && record.lateBy > 0) return 'late';
    if (record.earlyOut) return 'early-out';
    return 'other';
  }

  /**
   * Generate Compliance Status Report
   */
  async generateComplianceStatusReport(companyId, filters = {}) {
    try {
      const { status, dueDateFrom, dueDateTo } = filters;

      // Get expiring documents
      const documentQuery = {
        expiryDate: { $exists: true, $ne: null }
      };
      if (dueDateFrom || dueDateTo) {
        documentQuery.expiryDate = {};
        if (dueDateFrom) documentQuery.expiryDate.$gte = new Date(dueDateFrom);
        if (dueDateTo) documentQuery.expiryDate.$lte = new Date(dueDateTo);
      }
      if (status) documentQuery.status = status;

      const expiringDocuments = await Document.find(documentQuery)
        .populate('employee', 'firstName lastName email')
        .lean();

      // Get due compliances
      const complianceQuery = {};
      if (dueDateFrom || dueDateTo) {
        complianceQuery.dueDate = {};
        if (dueDateFrom) complianceQuery.dueDate.$gte = new Date(dueDateFrom);
        if (dueDateTo) complianceQuery.dueDate.$lte = new Date(dueDateTo);
      }
      if (status) complianceQuery.status = status;

      const dueCompliances = await Compliance.find(complianceQuery)
        .populate('employee', 'firstName lastName email')
        .lean();

      const reportData = {
        expiringDocuments: expiringDocuments.map(doc => ({
          documentId: doc._id,
          documentName: doc.documentName,
          documentType: doc.documentType,
          employeeName: doc.employee ? `${doc.employee.firstName} ${doc.employee.lastName}` : 'N/A',
          expiryDate: doc.expiryDate,
          daysUntilExpiry: Math.ceil((doc.expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
          status: doc.status
        })),
        dueCompliances: dueCompliances.map(comp => ({
          complianceId: comp._id,
          title: comp.title,
          employeeName: comp.employee ? `${comp.employee.firstName} ${comp.employee.lastName}` : 'N/A',
          dueDate: comp.dueDate,
          daysUntilDue: Math.ceil((comp.dueDate - new Date()) / (1000 * 60 * 60 * 24)),
          status: comp.status
        }))
      };

      return {
        success: true,
        totalDocuments: reportData.expiringDocuments.length,
        totalCompliances: reportData.dueCompliances.length,
        data: reportData
      };
    } catch (error) {
      throw new Error(`Compliance status report generation failed: ${error.message}`);
    }
  }
}

module.exports = new ReportsService();


