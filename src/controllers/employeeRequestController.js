// Multi-tenant compatible request controller
const EmployeeRequestSchema = require('../models/tenant/EmployeeRequest');

/**
 * Helper - fetch tenant-scoped model
 */
const getEmployeeRequestModel = (tenantConnection) => {
  return tenantConnection.model('EmployeeRequest', EmployeeRequestSchema);
};

/**
 * Get all requests for current employee
 */
exports.getRequests = async (req, res) => {
  try {
    const tenantConnection = req?.tenant?.connection;
    if (!tenantConnection) {
      return res.status(500).json({
        success: false,
        message: 'Tenant connection unavailable',
      });
    }

    const EmployeeRequest = getEmployeeRequestModel(tenantConnection);

    const query = { employeeId: req.user._id };
    console.log('🔍 Querying requests with:', { 
      employeeId: req.user._id, 
      employeeIdType: typeof req.user._id,
      email: req.user.email 
    });

    // First, let's see all requests in the collection
    const allRequests = await EmployeeRequest.find({}).lean();
    console.log('🔍 All requests in collection:', allRequests.length);
    console.log('🔍 All request employeeIds:', allRequests.map(r => ({ 
      id: r.employeeId, 
      type: typeof r.employeeId,
      stringified: String(r.employeeId)
    })));

    // Try both ObjectId and string matching
    const requests = await EmployeeRequest.find({
      $or: [
        { employeeId: req.user._id },
        { employeeId: String(req.user._id) }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📄 Employee requests fetched: ${requests.length}`);
    console.log('📄 Sample request:', requests[0]);

    // If still no requests, try without any filter to confirm data exists
    if (requests.length === 0) {
      console.log('🔍 No requests found for current user. Showing all requests for reference:');
      allRequests.forEach((req, idx) => {
        console.log(`  ${idx + 1}. ID: ${req._id}, employeeId: ${req.employeeId} (${typeof req.employeeId}), subject: ${req.subject}`);
      });
    }

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching employee requests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get specific request details for employee
 */
exports.getRequestDetails = async (req, res) => {
  try {
    const tenantConnection = req?.tenant?.connection;
    const EmployeeRequest = getEmployeeRequestModel(tenantConnection);

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employeeId: req.user._id,
    }).lean();

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create new employee request
 */
exports.createRequest = async (req, res) => {
  try {
    const tenantConnection = req?.tenant?.connection;
    const EmployeeRequest = getEmployeeRequestModel(tenantConnection);

    const payload = {
      employeeId: req.user._id,
      requestType: req.body.requestType,
      priority: req.body.priority || 'medium',
      subject: req.body.subject,
      description: req.body.description,
      metadata: req.body.metadata || undefined,
    };

    console.log('🆕 Creating request with payload:', payload);

    const newRequest = await EmployeeRequest.create(payload);

    console.log('🆕 Employee request created:', newRequest.requestNumber, newRequest.requestType);
    console.log('🆕 Stored employeeId:', newRequest.employeeId, 'type:', typeof newRequest.employeeId);

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: newRequest,
    });
  } catch (error) {
    console.error('Error creating employee request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update request (employee can only update own open request)
 */
exports.updateRequest = async (req, res) => {
  try {
    const tenantConnection = req?.tenant?.connection;
    const EmployeeRequest = getEmployeeRequestModel(tenantConnection);

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employeeId: req.user._id,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (!['open', 'pending-info'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Request cannot be updated in its current status' });
    }

    request.subject = req.body.subject ?? request.subject;
    request.description = req.body.description ?? request.description;
    request.priority = req.body.priority ?? request.priority;
    request.metadata = req.body.metadata ?? request.metadata;

    await request.save();

    res.status(200).json({ success: true, message: 'Request updated', data: request });
  } catch (error) {
    console.error('Error updating employee request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Close request (employee self-close)
 */
exports.closeRequest = async (req, res) => {
  try {
    const tenantConnection = req?.tenant?.connection;
    const EmployeeRequest = getEmployeeRequestModel(tenantConnection);

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employeeId: req.user._id,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Request already closed' });
    }

    request.status = 'closed';
    request.resolution = {
      ...(request.resolution || {}),
      resolvedAt: new Date(),
      resolutionNotes: req.body?.resolutionNotes || request.resolution?.resolutionNotes,
    };

    await request.save();

    res.status(200).json({ success: true, message: 'Request closed', data: request });
  } catch (error) {
    console.error('Error closing employee request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add comment to request
 */
exports.addComment = async (req, res) => {
  try {
    const tenantConnection = req?.tenant?.connection;
    const EmployeeRequest = getEmployeeRequestModel(tenantConnection);

    const request = await EmployeeRequest.findOne({
      _id: req.params.id,
      employeeId: req.user._id,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const comment = {
      author: req.user._id,
      authorName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
      content: req.body.content,
      isInternal: false,
    };

    request.comments.push(comment);
    await request.save();

    res.status(200).json({ success: true, message: 'Comment added', data: comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
