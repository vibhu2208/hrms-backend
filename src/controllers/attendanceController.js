const { getTenantModel } = require('../utils/tenantModels');
const { asString, asEnum, pickAllowed } = require('../utils/safeQuery');

function getAttendanceModel(req) {
  if (req.tenant?.connection) {
    return getTenantModel(req.tenant.connection, 'Attendance');
  }
  return require('../models/Attendance');
}

exports.getAttendance = async (req, res) => {
  try {
    const Attendance = getAttendanceModel(req);
    const employee = asString(req.query.employee, { maxLen: 64 });
    const status = asEnum(req.query.status, ['present', 'absent', 'half-day', 'late', 'on-leave', 'holiday']);
    const startDate = asString(req.query.startDate, { maxLen: 32 });
    const endDate = asString(req.query.endDate, { maxLen: 32 });

    let query = {};
    if (employee) query.employee = employee;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (req.user.role === 'employee') {
      if (req.user.employeeId) query.employee = req.user.employeeId;
      else return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const attendance = await Attendance.find(query)
      .populate('employee', 'firstName lastName email employeeCode')
      .sort({ date: -1 });

    res.status(200).json({ success: true, count: attendance.length, data: attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
};

exports.getSingleAttendance = async (req, res) => {
  try {
    const Attendance = getAttendanceModel(req);
    const attendance = await Attendance.findById(req.params.id).populate('employee');
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    if (req.user.role === 'employee') {
      const owner = attendance.employee?._id?.toString?.() || attendance.employee?.toString?.();
      if (!req.user.employeeId || owner !== req.user.employeeId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const Attendance = getAttendanceModel(req);
    const { employee, date, checkIn, checkOut, status, location } = pickAllowed(req.body, [
      'employee', 'date', 'checkIn', 'checkOut', 'status', 'location'
    ]);

    const existingAttendance = await Attendance.findOne({ employee, date: new Date(date) });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for this date' });
    }

    let workHours = 0;
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
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
    console.error('Error marking attendance:', error.message);
    res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const Attendance = getAttendanceModel(req);
    const updates = pickAllowed(req.body, ['checkIn', 'checkOut', 'status', 'location', 'notes']);
    const { checkIn, checkOut } = updates;

    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      updates.workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    }

    const attendance = await Attendance.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    res.status(200).json({ success: true, message: 'Attendance updated successfully', data: attendance });
  } catch (error) {
    console.error('Error updating attendance:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update attendance' });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const Attendance = getAttendanceModel(req);
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.status(200).json({ success: true, message: 'Attendance deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendance:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete attendance' });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const Attendance = getAttendanceModel(req);
    const startDate = asString(req.query.startDate, { maxLen: 32 });
    const endDate = asString(req.query.endDate, { maxLen: 32 });
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const stats = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching attendance stats:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance stats' });
  }
};
