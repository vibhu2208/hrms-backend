const { getTenantModel } = require('../utils/tenantModels');

exports.getTimesheets = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const Client = getTenantModel(req.tenant.connection, 'Client');

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
    if (req.user.role === 'employee') {
      const employeeUser = await TenantUser.findOne({ email: req.user.email });
      if (employeeUser) {
        query.employee = employeeUser._id;
      }
    }

    const timesheets = await Timesheet.find(query).sort({ weekStartDate: -1 }).lean();

    // Manually populate references
    for (let timesheet of timesheets) {
      if (timesheet.employee) {
        const emp = await TenantUser.findById(timesheet.employee).select('firstName lastName employeeCode').lean();
        if (emp) timesheet.employee = emp;
      }
      if (timesheet.project) {
        const proj = await Project.findById(timesheet.project).select('name projectCode').lean();
        if (proj) timesheet.project = proj;
      }
      if (timesheet.client) {
        const cli = await Client.findById(timesheet.client).select('name clientCode').lean();
        if (cli) timesheet.client = cli;
      }
      if (timesheet.approvedBy) {
        const approver = await TenantUser.findById(timesheet.approvedBy).select('firstName lastName').lean();
        if (approver) timesheet.approvedBy = approver;
      }
    }

    res.status(200).json({ success: true, count: timesheets.length, data: timesheets });
  } catch (error) {
    console.error('Error fetching timesheets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const Client = getTenantModel(req.tenant.connection, 'Client');

    const timesheet = await Timesheet.findById(req.params.id).lean();
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    // Populate references
    if (timesheet.employee) {
      const emp = await TenantUser.findById(timesheet.employee).lean();
      if (emp) timesheet.employee = emp;
    }
    if (timesheet.project) {
      const proj = await Project.findById(timesheet.project).lean();
      if (proj) timesheet.project = proj;
    }
    if (timesheet.client) {
      const cli = await Client.findById(timesheet.client).lean();
      if (cli) timesheet.client = cli;
    }
    if (timesheet.approvedBy) {
      const approver = await TenantUser.findById(timesheet.approvedBy).select('firstName lastName email').lean();
      if (approver) timesheet.approvedBy = approver;
    }

    res.status(200).json({ success: true, data: timesheet });
  } catch (error) {
    console.error('Error fetching timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    // If employee role, set employee to their own ID
    if (req.user.role === 'employee') {
      const employeeUser = await TenantUser.findOne({ email: req.user.email });
      if (employeeUser) {
        req.body.employee = employeeUser._id;
      }
    }

    const timesheet = await Timesheet.create(req.body);
    res.status(201).json({ success: true, message: 'Timesheet created successfully', data: timesheet });
  } catch (error) {
    console.error('Error creating timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
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
    console.error('Error updating timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    if (timesheet.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Timesheet already submitted' });
    }

    timesheet.status = 'submitted';
    timesheet.submittedAt = new Date();
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet submitted successfully', data: timesheet });
  } catch (error) {
    console.error('Error submitting timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    if (timesheet.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Timesheet not submitted for approval' });
    }

    // Get approver user ID
    const approver = await TenantUser.findOne({ email: req.user.email });
    if (!approver) {
      return res.status(404).json({ success: false, message: 'Approver not found' });
    }

    timesheet.status = 'approved';
    timesheet.approvedBy = approver._id;
    timesheet.approvedAt = new Date();
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet approved successfully', data: timesheet });
  } catch (error) {
    console.error('Error approving timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const { rejectionReason } = req.body;
    const timesheet = await Timesheet.findById(req.params.id);
    
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }

    // Get approver user ID
    const approver = await TenantUser.findOne({ email: req.user.email });
    if (!approver) {
      return res.status(404).json({ success: false, message: 'Approver not found' });
    }

    timesheet.status = 'rejected';
    timesheet.rejectionReason = rejectionReason;
    timesheet.approvedBy = approver._id;
    timesheet.approvedAt = new Date();
    await timesheet.save();

    res.status(200).json({ success: true, message: 'Timesheet rejected', data: timesheet });
  } catch (error) {
    console.error('Error rejecting timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTimesheet = async (req, res) => {
  try {
    const Timesheet = getTenantModel(req.tenant.connection, 'Timesheet');
    const timesheet = await Timesheet.findByIdAndDelete(req.params.id);
    if (!timesheet) {
      return res.status(404).json({ success: false, message: 'Timesheet not found' });
    }
    res.status(200).json({ success: true, message: 'Timesheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting timesheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
