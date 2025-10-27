const employeeDashboardService = require('../services/employeeDashboardService');
const Employee = require('../models/Employee');

/**
 * Employee Dashboard Controller
 * Handles HTTP requests for employee dashboard operations
 * @module controllers/employeeDashboardController
 */

/**
 * Get employee dashboard overview
 * @route GET /api/employee/dashboard
 * @access Private (Employee)
 */
exports.getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find employee by user ID
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const dashboardData = await employeeDashboardService.getDashboardOverview(employee._id);

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard overview'
    });
  }
};

/**
 * Get employee leave summary
 * @route GET /api/employee/leaves/summary
 * @access Private (Employee)
 */
exports.getLeaveSummary = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const leaveSummary = await employeeDashboardService.getLeaveSummary(employee._id, year);

    res.status(200).json({
      success: true,
      data: leaveSummary
    });
  } catch (error) {
    console.error('Error fetching leave summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch leave summary'
    });
  }
};

/**
 * Get employee attendance summary
 * @route GET /api/employee/attendance/summary
 * @access Private (Employee)
 */
exports.getAttendanceSummary = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const month = req.query.month ? parseInt(req.query.month) : new Date().getMonth();
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const attendanceSummary = await employeeDashboardService.getAttendanceSummary(
      employee._id, 
      month, 
      year
    );

    res.status(200).json({
      success: true,
      data: attendanceSummary
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch attendance summary'
    });
  }
};

/**
 * Get employee payslip history
 * @route GET /api/employee/payslips
 * @access Private (Employee)
 */
exports.getPayslipHistory = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const limit = req.query.limit ? parseInt(req.query.limit) : 12;
    const payslips = await employeeDashboardService.getPayslipHistory(employee._id, limit);

    res.status(200).json({
      success: true,
      data: payslips
    });
  } catch (error) {
    console.error('Error fetching payslip history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payslip history'
    });
  }
};

/**
 * Get employee projects
 * @route GET /api/employee/projects
 * @access Private (Employee)
 */
exports.getEmployeeProjects = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const projects = await employeeDashboardService.getEmployeeProjects(employee._id);

    res.status(200).json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching employee projects:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employee projects'
    });
  }
};

/**
 * Get employee requests
 * @route GET /api/employee/requests
 * @access Private (Employee)
 */
exports.getEmployeeRequests = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const status = req.query.status || null;
    const requests = await employeeDashboardService.getEmployeeRequests(employee._id, status);

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching employee requests:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employee requests'
    });
  }
};

/**
 * Get employee profile
 * @route GET /api/employee/profile
 * @access Private (Employee)
 */
exports.getEmployeeProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email })
      .populate('department')
      .populate('reportingManager', 'firstName lastName email designation')
      .populate('currentProject')
      .populate('currentClient');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employee profile'
    });
  }
};

/**
 * Update employee profile
 * @route PUT /api/employee/profile
 * @access Private (Employee)
 */
exports.updateEmployeeProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    // Only allow updating specific fields
    const allowedUpdates = [
      'phone',
      'alternatePhone',
      'address',
      'emergencyContact',
      'profileImage',
      'bankDetails'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedEmployee = await Employee.findByIdAndUpdate(
      employee._id,
      { $set: updates },
      { new: true, runValidators: true }
    )
    .populate('department')
    .populate('reportingManager', 'firstName lastName email designation');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedEmployee
    });
  } catch (error) {
    console.error('Error updating employee profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update employee profile'
    });
  }
};
