const EmployeeRequest = require('../models/EmployeeRequest');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Employee Request Controller
 * Handles employee requests like ID card reissue, HR queries, etc.
 * @module controllers/employeeRequestController
 */

/**
 * Create new request
 * @route POST /api/employee/requests
 * @access Private (Employee)
 */
exports.createRequest = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const {
      requestType,
      priority,
      subject,
      description,
      documents,
      metadata
    } = req.body;

    const request = await EmployeeRequest.create({
      employee: employee._id,
      requestType,
      priority: priority || 'medium',
      subject,
      description,
      documents: documents || [],
      metadata: metadata || {},
      status: 'open'
    });

    // Notify HR team
    const hrUsers = await User.find({ role: { $in: ['hr', 'admin'] } });
    const notifications = hrUsers.map(hr => ({
      recipient: hr._id,
      type: 'employee-request',
      title: 'New Employee Request',
      message: `${employee.firstName} ${employee.lastName} has submitted a ${requestType} request`,
      relatedModel: 'EmployeeRequest',
      relatedId: request._id
    }));

    await Notification.insertMany(notifications);

    const populatedRequest = await EmployeeRequest.findById(request._id)
      .populate('employee', 'firstName lastName employeeCode email');

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: populatedRequest
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create request'
    });
  }
};

/**
 * Get all requests
 * @route GET /api/employee/requests
 * @access Private (Employee)
 */
exports.getRequests = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const { status, requestType } = req.query;
    const query = { employee: employee._id };

    if (status) {
      query.status = status;
    }

    if (requestType) {
      query.requestType = requestType;
    }

    const requests = await EmployeeRequest.find(query)
      .populate('assignedTo', 'email')
      .populate('resolution.resolvedBy', 'email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch requests'
    });
  }
};

/**
 * Get request details
 * @route GET /api/employee/requests/:id
 * @access Private (Employee)
 */
exports.getRequestDetails = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employee: employee._id
    })
    .populate('employee', 'firstName lastName employeeCode email designation')
    .populate('assignedTo', 'email')
    .populate('comments.user', 'email')
    .populate('resolution.resolvedBy', 'email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch request details'
    });
  }
};

/**
 * Add comment to request
 * @route POST /api/employee/requests/:id/comments
 * @access Private (Employee)
 */
exports.addComment = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employee: employee._id
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const { message } = req.body;

    request.comments.push({
      user: req.user.id,
      message,
      isInternal: false,
      createdAt: new Date()
    });

    await request.save();

    // Notify assigned person if exists
    if (request.assignedTo) {
      await Notification.create({
        recipient: request.assignedTo,
        type: 'request-comment',
        title: 'New Comment on Request',
        message: `${employee.firstName} ${employee.lastName} added a comment on request ${request.requestNumber}`,
        relatedModel: 'EmployeeRequest',
        relatedId: request._id
      });
    }

    const updatedRequest = await EmployeeRequest.findById(request._id)
      .populate('comments.user', 'email');

    res.status(200).json({
      success: true,
      message: 'Comment added successfully',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add comment'
    });
  }
};

/**
 * Update request
 * @route PUT /api/employee/requests/:id
 * @access Private (Employee)
 */
exports.updateRequest = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employee: employee._id
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Only allow updates if request is still open
    if (!['open', 'in-progress'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update request in current status'
      });
    }

    const allowedUpdates = ['subject', 'description', 'priority', 'documents'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedRequest = await EmployeeRequest.findByIdAndUpdate(
      request._id,
      { $set: updates },
      { new: true, runValidators: true }
    )
    .populate('employee', 'firstName lastName employeeCode email');

    res.status(200).json({
      success: true,
      message: 'Request updated successfully',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update request'
    });
  }
};

/**
 * Close request
 * @route PUT /api/employee/requests/:id/close
 * @access Private (Employee)
 */
exports.closeRequest = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employee: employee._id
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Request is already closed'
      });
    }

    request.status = 'closed';
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Request closed successfully',
      data: request
    });
  } catch (error) {
    console.error('Error closing request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to close request'
    });
  }
};
