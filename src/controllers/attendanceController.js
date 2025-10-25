const Attendance = require('../models/Attendance');

exports.getAttendance = async (req, res) => {
  try {
    const { employee, startDate, endDate, status } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // If user is employee, only show their attendance
    if (req.user.role === 'employee' && req.user.employeeId) {
      query.employee = req.user.employeeId;
    }

    const attendance = await Attendance.find(query)
      .populate('employee', 'firstName lastName email employeeCode')
      .sort({ date: -1 });

    res.status(200).json({ success: true, count: attendance.length, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSingleAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate('employee');
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const { employee, date, checkIn, checkOut, status, location } = req.body;

    // Check if attendance already exists for this employee and date
    const existingAttendance = await Attendance.findOne({ employee, date: new Date(date) });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for this date' });
    }

    // Calculate work hours if both checkIn and checkOut are provided
    let workHours = 0;
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert to hours
    }

    const attendance = await Attendance.create({
      employee,
      date,
      checkIn,
      checkOut,
      status,
      workHours,
      location
    });

    res.status(201).json({ success: true, message: 'Attendance marked successfully', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.body;

    // Calculate work hours if both checkIn and checkOut are provided
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      req.body.workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    }

    const attendance = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.status(200).json({ success: true, message: 'Attendance updated successfully', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.status(200).json({ success: true, message: 'Attendance deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const stats = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
