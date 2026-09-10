const { getTenantModel } = require('../utils/tenantModels');
const { asString, asEnum, pickAllowed } = require('../utils/safeQuery');

const LEAVE_CREATE_FIELDS = [
  'employee', 'leaveType', 'startDate', 'endDate', 'reason', 'halfDay', 'session', 'days'
];
const LEAVE_UPDATE_FIELDS = [
  'leaveType', 'startDate', 'endDate', 'reason', 'halfDay', 'session', 'days'
];

function getLeaveModel(req) {
  if (req.tenant?.connection) {
    return getTenantModel(req.tenant.connection, 'Leave');
  }
  return require('../models/Leave');
}

exports.getLeaves = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const status = asEnum(req.query.status, ['pending', 'approved', 'rejected', 'cancelled']);
    const employee = asString(req.query.employee, { maxLen: 64 });
    const startDate = asString(req.query.startDate, { maxLen: 32 });
    const endDate = asString(req.query.endDate, { maxLen: 32 });

    let query = {};
    if (status) query.status = status;
    if (employee) query.employee = employee;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    if (req.user.role === 'employee') {
      if (req.user.employeeId) {
        query.employee = req.user.employeeId;
      } else {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'firstName lastName email employeeCode')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: leaves.length, data: leaves });
  } catch (error) {
    console.error('Error fetching leaves:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch leaves' });
  }
};

exports.getLeave = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const leave = await Leave.findById(req.params.id)
      .populate('employee')
      .populate('approvedBy');

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    if (req.user.role === 'employee') {
      const leaveEmp = leave.employee?._id?.toString?.() || leave.employee?.toString?.();
      if (!req.user.employeeId || leaveEmp !== req.user.employeeId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this leave' });
      }
    }

    res.status(200).json({ success: true, data: leave });
  } catch (error) {
    console.error('Error fetching leave:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch leave' });
  }
};

exports.createLeave = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const data = pickAllowed(req.body, LEAVE_CREATE_FIELDS);

    if (req.user.role === 'employee' && req.user.employeeId) {
      data.employee = req.user.employeeId;
    }

    // Never accept status/approval fields from client on create
    data.status = 'pending';
    delete data.approvedBy;
    delete data.approvedAt;
    delete data.rejectionReason;

    const leave = await Leave.create(data);
    res.status(201).json({ success: true, message: 'Leave application submitted successfully', data: leave });
  } catch (error) {
    console.error('Error creating leave:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create leave' });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    if (req.user.role === 'employee') {
      if (!req.user.employeeId || leave.employee.toString() !== req.user.employeeId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this leave' });
      }
      if (leave.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Only pending leaves can be updated' });
      }
    }

    const updates = pickAllowed(req.body, LEAVE_UPDATE_FIELDS);
    Object.assign(leave, updates);
    await leave.save();

    res.status(200).json({ success: true, message: 'Leave updated successfully', data: leave });
  } catch (error) {
    console.error('Error updating leave:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update leave' });
  }
};

exports.approveLeave = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    if (req.user.employeeId && leave.employee.toString() === req.user.employeeId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You cannot approve your own leave request',
        code: 'SELF_APPROVAL_FORBIDDEN'
      });
    }

    leave.status = 'approved';
    leave.approvedBy = req.user.employeeId || req.user._id;
    leave.approvedAt = Date.now();
    await leave.save();

    res.status(200).json({ success: true, message: 'Leave approved successfully', data: leave });
  } catch (error) {
    console.error('Error approving leave:', error.message);
    res.status(500).json({ success: false, message: 'Failed to approve leave' });
  }
};

exports.rejectLeave = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const rejectionReason = asString(req.body.rejectionReason, { maxLen: 500 });
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    if (req.user.employeeId && leave.employee.toString() === req.user.employeeId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You cannot reject your own leave request',
        code: 'SELF_APPROVAL_FORBIDDEN'
      });
    }

    leave.status = 'rejected';
    leave.approvedBy = req.user.employeeId || req.user._id;
    leave.approvedAt = Date.now();
    leave.rejectionReason = rejectionReason;
    await leave.save();

    res.status(200).json({ success: true, message: 'Leave rejected', data: leave });
  } catch (error) {
    console.error('Error rejecting leave:', error.message);
    res.status(500).json({ success: false, message: 'Failed to reject leave' });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const Leave = getLeaveModel(req);
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    if (req.user.role === 'employee') {
      if (!req.user.employeeId || leave.employee.toString() !== req.user.employeeId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this leave' });
      }
      if (leave.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Only pending leaves can be deleted' });
      }
    }

    await leave.deleteOne();
    res.status(200).json({ success: true, message: 'Leave deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete leave' });
  }
};
