const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

/**
 * Employee Attendance Controller
 * Handles attendance marking and tracking for employees
 * @module controllers/employeeAttendanceController
 */

/**
 * Mark check-in
 * @route POST /api/employee/attendance/check-in
 * @access Private (Employee)
 */
exports.checkIn = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employee: employee._id,
      date: today
    });

    if (existingAttendance && existingAttendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in for today'
      });
    }

    const checkInTime = new Date();
    const { location, notes } = req.body;

    // Calculate if late (assuming office start time is 9:00 AM)
    const officeStartTime = new Date(today);
    officeStartTime.setHours(9, 0, 0, 0);
    const lateBy = checkInTime > officeStartTime 
      ? Math.floor((checkInTime - officeStartTime) / (1000 * 60)) 
      : 0;

    const attendanceData = {
      employee: employee._id,
      date: today,
      checkIn: checkInTime,
      status: lateBy > 0 ? 'late' : 'present',
      lateBy,
      location: location || 'office',
      notes,
      ipAddress: req.ip,
      device: req.headers['user-agent']
    };

    let attendance;
    if (existingAttendance) {
      attendance = await Attendance.findByIdAndUpdate(
        existingAttendance._id,
        attendanceData,
        { new: true }
      );
    } else {
      attendance = await Attendance.create(attendanceData);
    }

    res.status(200).json({
      success: true,
      message: 'Checked in successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check in'
    });
  }
};

/**
 * Mark check-out
 * @route POST /api/employee/attendance/check-out
 * @access Private (Employee)
 */
exports.checkOut = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: today
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Already checked out for today'
      });
    }

    const checkOutTime = new Date();
    const { notes } = req.body;

    // Calculate work hours
    const workMilliseconds = checkOutTime - attendance.checkIn;
    const workHours = (workMilliseconds / (1000 * 60 * 60)).toFixed(2);

    // Calculate overtime (assuming 8 hours is standard)
    const standardHours = 8;
    const overtime = Math.max(0, parseFloat(workHours) - standardHours);

    // Calculate early departure (assuming office end time is 6:00 PM)
    const officeEndTime = new Date(today);
    officeEndTime.setHours(18, 0, 0, 0);
    const earlyDepartureBy = checkOutTime < officeEndTime 
      ? Math.floor((officeEndTime - checkOutTime) / (1000 * 60)) 
      : 0;

    attendance.checkOut = checkOutTime;
    attendance.workHours = parseFloat(workHours);
    attendance.overtime = parseFloat(overtime.toFixed(2));
    attendance.earlyDepartureBy = earlyDepartureBy;
    if (notes) attendance.notes = notes;

    // Update status if early departure
    if (earlyDepartureBy > 0 && attendance.status === 'present') {
      attendance.status = 'early-departure';
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Checked out successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check out'
    });
  }
};

/**
 * Get today's attendance
 * @route GET /api/employee/attendance/today
 * @access Private (Employee)
 */
exports.getTodayAttendance = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: today
    });

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch today\'s attendance'
    });
  }
};

/**
 * Get attendance history
 * @route GET /api/employee/attendance/history
 * @access Private (Employee)
 */
exports.getAttendanceHistory = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const { month, year, startDate, endDate } = req.query;
    let query = { employee: employee._id };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      query.date = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch attendance history'
    });
  }
};

/**
 * Request attendance regularization
 * @route POST /api/employee/attendance/regularize
 * @access Private (Employee)
 */
exports.requestRegularization = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const { date, checkIn, checkOut, reason } = req.body;

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
      employee: employee._id,
      date: attendanceDate
    });

    if (!attendance) {
      // Create new attendance record for regularization
      attendance = await Attendance.create({
        employee: employee._id,
        date: attendanceDate,
        checkIn: new Date(checkIn),
        checkOut: checkOut ? new Date(checkOut) : null,
        status: 'present',
        isRegularized: true,
        regularizationReason: reason,
        location: 'office'
      });
    } else {
      // Update existing attendance
      attendance.checkIn = new Date(checkIn);
      if (checkOut) attendance.checkOut = new Date(checkOut);
      attendance.isRegularized = true;
      attendance.regularizationReason = reason;
      await attendance.save();
    }

    // Calculate work hours if both check-in and check-out are present
    if (attendance.checkIn && attendance.checkOut) {
      const workMilliseconds = attendance.checkOut - attendance.checkIn;
      attendance.workHours = (workMilliseconds / (1000 * 60 * 60)).toFixed(2);
      await attendance.save();
    }

    res.status(200).json({
      success: true,
      message: 'Regularization request submitted successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error requesting regularization:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request regularization'
    });
  }
};
