const Leave = require('../models/Leave');

exports.getLeaves = async (req, res) => {
  try {
    const { status, employee, startDate, endDate } = req.query;
    let query = {};

    if (status) query.status = status;
    if (employee) query.employee = employee;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    // If user is employee, only show their leaves
    if (req.user.role === 'employee' && req.user.employeeId) {
      query.employee = req.user.employeeId;
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'firstName lastName email employeeCode')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: leaves.length, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employee')
      .populate('approvedBy');

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    res.status(200).json({ success: true, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLeave = async (req, res) => {
  try {
    // If employee role, set employee to their own ID
    if (req.user.role === 'employee' && req.user.employeeId) {
      req.body.employee = req.user.employeeId;
    }

    const leave = await Leave.create(req.body);
    res.status(201).json({ success: true, message: 'Leave application submitted successfully', data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    res.status(200).json({ success: true, message: 'Leave updated successfully', data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    leave.status = 'approved';
    leave.approvedBy = req.user.employeeId;
    leave.approvedAt = Date.now();
    await leave.save();

    res.status(200).json({ success: true, message: 'Leave approved successfully', data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectLeave = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    leave.status = 'rejected';
    leave.approvedBy = req.user.employeeId;
    leave.approvedAt = Date.now();
    leave.rejectionReason = rejectionReason;
    await leave.save();

    res.status(200).json({ success: true, message: 'Leave rejected', data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndDelete(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    res.status(200).json({ success: true, message: 'Leave deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
