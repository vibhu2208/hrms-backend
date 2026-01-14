const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Timesheet = require('../models/Timesheet');
const Payroll = require('../models/Payroll');
const Document = require('../models/Document');
const Compliance = require('../models/Compliance');
const Project = require('../models/Project');
const {
  exportEmployeeReport,
  exportAttendanceReport,
  exportTimesheetReport,
  exportPayrollReport
} = require('../utils/excelExport');
const reportsService = require('../services/reportsService');
const analyticsService = require('../services/analyticsService');
const { exportToExcel, exportToCSV } = require('../utils/reportExport');
const { getTenantConnection } = require('../config/database.config');

exports.exportEmployees = async (req, res) => {
  try {
    const { status, department } = req.query;
    let query = {};
    if (status) query.status = status;
    if (department) query.department = department;

    const employees = await Employee.find(query)
      .populate('department', 'name')
      .lean();

    const workbook = await exportEmployeeReport(employees);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employees.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate, employee } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (employee) query.employee = employee;

    const attendance = await Attendance.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .lean();

    const workbook = await exportAttendanceReport(attendance);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportTimesheets = async (req, res) => {
  try {
    const { startDate, endDate, project, client } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.weekStartDate = {};
      if (startDate) query.weekStartDate.$gte = new Date(startDate);
      if (endDate) query.weekStartDate.$lte = new Date(endDate);
    }
    if (project) query.project = project;
    if (client) query.client = client;

    const timesheets = await Timesheet.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .populate('project', 'name projectCode')
      .populate('client', 'name clientCode')
      .lean();

    const workbook = await exportTimesheetReport(timesheets);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=timesheets.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportPayroll = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = {};
    
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);

    const payrolls = await Payroll.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .lean();

    const workbook = await exportPayrollReport(payrolls);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=payroll.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getComplianceReport = async (req, res) => {
  try {
    const expiringDocuments = await Document.find({
      expiryDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      status: { $ne: 'expired' }
    })
      .populate('employee', 'firstName lastName email')
      .lean();

    const dueCompliances = await Compliance.find({
      dueDate: { $lte: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
      status: { $in: ['pending', 'in-progress'] }
    })
      .populate('employee', 'firstName lastName email')
      .lean();

    const expiringContracts = await Project.find({
      endDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      status: 'active'
    })
      .populate('client', 'name')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        expiringDocuments,
        dueCompliances,
        expiringContracts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ Leave Reports ============

exports.getLeaveEntitlementReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await reportsService.generateLeaveEntitlementReport(companyId, filters);

    // Export if requested
    if (req.query.export === 'excel' || req.query.export === 'csv') {
      const format = req.query.export;
      let exportData;

      if (format === 'excel') {
        const workbook = await exportToExcel(result.data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=leave-entitlement-${result.year}.xlsx`);
        const XLSX = require('xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return res.send(buffer);
      } else {
        const csv = await exportToCSV(result.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=leave-entitlement-${result.year}.csv`);
        return res.send(csv);
      }
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeaveBalanceReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await reportsService.generateLeaveBalanceReport(companyId, filters);

    if (req.query.export === 'excel' || req.query.export === 'csv') {
      const format = req.query.export;
      if (format === 'excel') {
        const workbook = await exportToExcel(result.data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=leave-balance-${result.year}.xlsx`);
        const XLSX = require('xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return res.send(buffer);
      } else {
        const csv = await exportToCSV(result.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=leave-balance-${result.year}.csv`);
        return res.send(csv);
      }
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeaveUtilizationReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await reportsService.generateLeaveUtilizationReport(companyId, filters);

    if (req.query.export === 'excel' || req.query.export === 'csv') {
      const format = req.query.export;
      if (format === 'excel') {
        const workbook = await exportToExcel(result.data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=leave-utilization.xlsx');
        const XLSX = require('xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return res.send(buffer);
      } else {
        const csv = await exportToCSV(result.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leave-utilization.csv');
        return res.send(csv);
      }
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ Attendance Reports ============

exports.getAttendanceSummaryReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await reportsService.generateAttendanceSummaryReport(companyId, filters);

    if (req.query.export === 'excel' || req.query.export === 'csv') {
      const format = req.query.export;
      if (format === 'excel') {
        const workbook = await exportToExcel(result.data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance-summary.xlsx');
        const XLSX = require('xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return res.send(buffer);
      } else {
        const csv = await exportToCSV(result.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance-summary.csv');
        return res.send(csv);
      }
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAttendanceExceptionReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await reportsService.generateAttendanceExceptionReport(companyId, filters);

    if (req.query.export === 'excel' || req.query.export === 'csv') {
      const format = req.query.export;
      if (format === 'excel') {
        const workbook = await exportToExcel(result.data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance-exceptions.xlsx');
        const XLSX = require('xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return res.send(buffer);
      } else {
        const csv = await exportToCSV(result.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance-exceptions.csv');
        return res.send(csv);
      }
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ Compliance Reports ============

exports.getComplianceStatusReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await reportsService.generateComplianceStatusReport(companyId, filters);

    if (req.query.export === 'excel' || req.query.export === 'csv') {
      const format = req.query.export;
      // Combine documents and compliances for export
      const exportData = [
        ...result.data.expiringDocuments.map(d => ({ ...d, type: 'Document' })),
        ...result.data.dueCompliances.map(c => ({ ...c, type: 'Compliance' }))
      ];

      if (format === 'excel') {
        const workbook = await exportToExcel(exportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=compliance-status.xlsx');
        const XLSX = require('xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return res.send(buffer);
      } else {
        const csv = await exportToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=compliance-status.csv');
        return res.send(csv);
      }
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ Analytics ============

exports.getAttendanceAnalytics = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await analyticsService.getAttendanceTrends(companyId, filters);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeaveAnalytics = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await analyticsService.getLeavePatterns(companyId, filters);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getComplianceAnalytics = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await analyticsService.getComplianceMetrics(companyId, filters);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPerformanceIndicators = async (req, res) => {
  try {
    const companyId = req.companyId;
    const filters = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await analyticsService.getPerformanceIndicators(companyId, filters);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
