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
