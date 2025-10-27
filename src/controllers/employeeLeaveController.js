const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');

/**
 * Employee Leave Controller
 * Handles leave application and management for employees
 * @module controllers/employeeLeaveController
 */

/**
 * Apply for leave
 * @route POST /api/employee/leaves/apply
 * @access Private (Employee)
 */
exports.applyLeave = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const {
      leaveType,
      startDate,
      endDate,
      numberOfDays,
      halfDay,
      halfDayPeriod,
      reason,
      handoverNotes,
      emergencyContact,
      isUrgent
    } = req.body;

    // Validate leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await LeaveBalance.findOne({
      employee: employee._id,
      year: currentYear,
      leaveType
    });

    if (!leaveBalance || leaveBalance.remaining < numberOfDays) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient leave balance'
      });
    }

    // Create leave application
    const leave = await Leave.create({
      employee: employee._id,
      leaveType,
      startDate,
      endDate,
      numberOfDays,
      halfDay: halfDay || false,
      halfDayPeriod,
      reason,
      handoverNotes,
      emergencyContact,
      isUrgent: isUrgent || false,
      status: 'pending'
    });

    // Update leave balance - add to pending
    await LeaveBalance.findByIdAndUpdate(leaveBalance._id, {
      $inc: { pending: numberOfDays }
    });

    // Create notification for manager/HR
    if (employee.reportingManager) {
      await Notification.create({
        recipient: employee.reportingManager,
        type: 'leave-request',
        title: 'New Leave Request',
        message: `${employee.firstName} ${employee.lastName} has applied for ${leaveType} leave`,
        relatedModel: 'Leave',
        relatedId: leave._id
      });
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employee', 'firstName lastName employeeCode');

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: populatedLeave
    });
  } catch (error) {
    console.error('Error applying for leave:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to apply for leave'
    });
  }
};

/**
 * Get leave applications
 * @route GET /api/employee/leaves
 * @access Private (Employee)
 */
exports.getLeaveApplications = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const { status, year } = req.query;
    const query = { employee: employee._id };

    if (status) {
      query.status = status;
    }

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    const leaves = await Leave.find(query)
      .populate('approvedBy', 'email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching leave applications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch leave applications'
    });
  }
};

/**
 * Get leave balance
 * @route GET /api/employee/leaves/balance
 * @access Private (Employee)
 */
exports.getLeaveBalance = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const leaveBalances = await LeaveBalance.find({
      employee: employee._id,
      year
    });

    res.status(200).json({
      success: true,
      data: leaveBalances
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch leave balance'
    });
  }
};

/**
 * Cancel leave application
 * @route PUT /api/employee/leaves/:id/cancel
 * @access Private (Employee)
 */
exports.cancelLeave = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const leave = await Leave.findOne({
      _id: req.params.id,
      employee: employee._id
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending leave applications can be cancelled'
      });
    }

    leave.status = 'cancelled';
    await leave.save();

    // Update leave balance - remove from pending
    const currentYear = new Date().getFullYear();
    await LeaveBalance.findOneAndUpdate(
      {
        employee: employee._id,
        year: currentYear,
        leaveType: leave.leaveType
      },
      {
        $inc: { pending: -leave.numberOfDays }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Leave application cancelled successfully',
      data: leave
    });
  } catch (error) {
    console.error('Error cancelling leave:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel leave application'
    });
  }
};

/**
 * Get leave details
 * @route GET /api/employee/leaves/:id
 * @access Private (Employee)
 */
exports.getLeaveDetails = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const leave = await Leave.findOne({
      _id: req.params.id,
      employee: employee._id
    })
    .populate('employee', 'firstName lastName employeeCode designation')
    .populate('approvedBy', 'email');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: leave
    });
  } catch (error) {
    console.error('Error fetching leave details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch leave details'
    });
  }
};
