const Feedback = require('../models/Feedback');

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
    req.body.submittedBy = req.user.employeeId;
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

    feedback.status = 'acknowledged';
    feedback.acknowledgedBy = req.user.employeeId;
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
