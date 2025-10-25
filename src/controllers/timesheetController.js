const Timesheet = require('../models/Timesheet');

exports.getTimesheets = async (req, res) => {
  try {
    const { employee, project, client, status, startDate, endDate } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (project) query.project = project;
    if (client) query.client = client;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.weekStartDate = {};
      if (startDate) query.weekStartDate.$gte = new Date(startDate);
      if (endDate) query.weekStartDate.$lte = new Date(endDate);
    }

    // If user is employee, only show their timesheets
    if (req.user.role === 'employee' && req.user.employeeId) {
      query.employee = req.user.employeeId;
    }

    const timesheets = await Timesheet.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .populate('project', 'name projectCode')
      .populate('client', 'name clientCode')
      .populate('approvedBy', 'firstName lastName')
      .sort({ weekStartDate: -1 });

    res.status(200).json({ success: true, count: timesheets.length, data: timesheets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id)
      .populate('employee')
      .populate('project')
      .populate('client')
      .populate('approvedBy');

    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    res.status(200).json({ success: true, data: timesheet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTimesheet = async (req, res) => {
  try {
    // If employee role, set employee to their own ID
    if (req.user.role === 'employee' && req.user.employeeId) {
      req.body.employee = req.user.employeeId;
    }

    const timesheet = await Timesheet.create(req.body);
    res.status(201).json({ success: true, message: 'Timesheet created successfully', data: timesheet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    // Only allow updates if status is draft
    if (timesheet.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Cannot update submitted timesheet' });
    }

    Object.assign(timesheet, req.body);
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet updated successfully', data: timesheet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    if (timesheet.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Timesheet already submitted' });
    }

    timesheet.status = 'submitted';
    timesheet.submittedAt = Date.now();
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet submitted successfully', data: timesheet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    if (timesheet.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Timesheet not submitted for approval' });
    }

    timesheet.status = 'approved';
    timesheet.approvedBy = req.user.employeeId;
    timesheet.approvedAt = Date.now();
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet approved successfully', data: timesheet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectTimesheet = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    timesheet.status = 'rejected';
    timesheet.rejectionReason = rejectionReason;
    timesheet.approvedBy = req.user.employeeId;
    timesheet.approvedAt = Date.now();
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet rejected', data: timesheet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findByIdAndDelete(req.params.id);
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }
    res.status(200).json({ success: true, message: 'Timesheet deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
