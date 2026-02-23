const Feedback = require('../models/Feedback');
const TenantEmployeeSchema = require('../models/tenant/TenantEmployee');
const { getTenantConnection } = require('../config/database.config');
const { getTenantModel } = require('../middlewares/tenantMiddleware');

exports.getFeedbacks = async (req, res) => {
  try {
    const { employee, project, feedbackType, status } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (project) query.project = project;
    if (feedbackType) query.feedbackType = feedbackType;
    if (status) query.status = status;

    const feedbacks = await Feedback.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .populate('project', 'name projectCode')
      .populate('client', 'name')
      .populate('submittedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: feedbacks.length, data: feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('employee')
      .populate('project')
      .populate('client')
      .populate('submittedBy')
      .populate('acknowledgedBy');

    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFeedback = async (req, res) => {
  try {
    let submittedByEmployeeId = req.user.employeeId;
    
    // If user doesn't have employeeId, try to find Employee by email
    if (!submittedByEmployeeId && req.user.email && req.companyId) {
      try {
        const tenantConnection = await getTenantConnection(req.companyId);
        const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);
        const employee = await TenantEmployee.findOne({ email: req.user.email.toLowerCase() }).select('_id');
        
        if (employee) {
          submittedByEmployeeId = employee._id;
          // Optionally update the user's employeeId for future use
          // This would require access to TenantUser model
        }
      } catch (tenantError) {
        console.warn('Could not find employee by email:', tenantError.message);
      }
    }
    
    // If still no employeeId found, return error
    if (!submittedByEmployeeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Your user account is not linked to an employee record. Please contact HR to link your account.' 
      });
    }
    
    req.body.submittedBy = submittedByEmployeeId;
    const feedback = await Feedback.create(req.body);
    res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    if (feedback.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Cannot update submitted feedback' });
    }

    Object.assign(feedback, req.body);
    await feedback.save();

    res.status(200).json({ success: true, message: 'Feedback updated successfully', data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    feedback.status = 'submitted';
    feedback.submittedAt = Date.now();
    await feedback.save();

    res.status(200).json({ success: true, message: 'Feedback submitted successfully', data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.acknowledgeFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    let acknowledgedByEmployeeId = req.user.employeeId;
    
    // If user doesn't have employeeId, try to find Employee by email
    if (!acknowledgedByEmployeeId && req.user.email && req.companyId) {
      try {
        const tenantConnection = await getTenantConnection(req.companyId);
        const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);
        const employee = await TenantEmployee.findOne({ email: req.user.email.toLowerCase() }).select('_id');
        
        if (employee) {
          acknowledgedByEmployeeId = employee._id;
        }
      } catch (tenantError) {
        console.warn('Could not find employee by email:', tenantError.message);
      }
    }

    // If still no employeeId found, return error
    if (!acknowledgedByEmployeeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Your user account is not linked to an employee record. Please contact HR to link your account.' 
      });
    }

    feedback.status = 'acknowledged';
    feedback.acknowledgedBy = acknowledgedByEmployeeId;
    feedback.acknowledgedAt = Date.now();
    await feedback.save();

    res.status(200).json({ success: true, message: 'Feedback acknowledged', data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
