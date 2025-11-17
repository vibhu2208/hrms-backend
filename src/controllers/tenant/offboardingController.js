// Utility function to get tenant-specific models
const getTenantModel = (connection, modelName, schema) => {
  return connection.model(modelName, schema);
};
const offboardingWorkflow = require('../../services/offboardingWorkflow');
const offboardingRequestSchema = require('../../models/tenant/OffboardingRequest');
const offboardingTaskSchema = require('../../models/tenant/OffboardingTask');
const handoverDetailSchema = require('../../models/tenant/HandoverDetail');
const assetClearanceSchema = require('../../models/tenant/AssetClearance');
const finalSettlementSchema = require('../../models/tenant/FinalSettlement');
const exitFeedbackSchema = require('../../models/tenant/ExitFeedback');

/**
 * Comprehensive Offboarding Controller
 * Phase 4-11: Complete Implementation
 */

// ==================== MAIN OFFBOARDING OPERATIONS ====================

/**
 * Get all offboarding requests with filtering and pagination
 */
exports.getOffboardingRequests = async (req, res) => {
  try {
    const { status, stage, priority, page = 1, limit = 10, search } = req.query;
    const OffboardingRequest = getTenantModel(req.tenant.connection, 'OffboardingRequest', offboardingRequestSchema);
    
    // Get tenant-specific models
    const { getTenantModels } = require('../../utils/tenantModels');
    const { Employee, Department } = getTenantModels(req.tenant.connection);
    const User = require('../../models/User'); // User stays global
    
    // Build query (no need for clientId filter since we have database isolation)
    let query = {};
    if (status) query.status = status;
    if (stage) query.currentStage = stage;
    if (priority) query.priority = priority;
    if (search) {
      // For now, search by offboarding request fields only
      query.$or = [
        { reason: { $regex: search, $options: 'i' } },
        { reasonDetails: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const requests = await OffboardingRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Manually populate employee data from main database
    for (let request of requests) {
      if (request.employeeId) {
        const employee = await Employee.findById(request.employeeId)
          .populate('department', 'name')
          .populate('reportingManager', 'firstName lastName email');
        request.employeeId = employee;
      }
      if (request.initiatedBy) {
        const user = await User.findById(request.initiatedBy).select('email firstName lastName');
        request.initiatedBy = user;
      }
    }

    const total = await OffboardingRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching offboarding requests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get specific offboarding request with all related data
 */
exports.getOffboardingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const OffboardingRequest = getTenantModel(req.tenant.connection, 'OffboardingRequest', offboardingRequestSchema);
    
    // Use main database models for Employee and User (they are not tenant-specific)
    const Employee = require('../../models/Employee');
    const User = require('../../models/User');
    
    const request = await OffboardingRequest.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Offboarding request not found' });
    }

    // Manually populate employee data from main database
    if (request.employeeId) {
      const employee = await Employee.findById(request.employeeId)
        .populate('department', 'name')
        .populate('reportingManager', 'firstName lastName email');
      request.employeeId = employee;
    }
    if (request.initiatedBy) {
      const user = await User.findById(request.initiatedBy).select('email firstName lastName');
      request.initiatedBy = user;
    }

    // Get related data
    const OffboardingTask = getTenantModel(req.tenant.connection, 'OffboardingTask', offboardingTaskSchema);
    const tasks = await OffboardingTask.find({ offboardingRequestId: id })
      .populate('assignedTo', 'email firstName lastName');

    const HandoverDetail = getTenantModel(req.tenant.connection, 'HandoverDetail', handoverDetailSchema);
    const handover = await HandoverDetail.findOne({ offboardingRequestId: id });

    const AssetClearance = getTenantModel(req.tenant.connection, 'AssetClearance', assetClearanceSchema);
    const assets = await AssetClearance.findOne({ offboardingRequestId: id });

    const FinalSettlement = getTenantModel(req.tenant.connection, 'FinalSettlement', finalSettlementSchema);
    const settlement = await FinalSettlement.findOne({ offboardingRequestId: id });

    const ExitFeedback = getTenantModel(req.tenant.connection, 'ExitFeedback', exitFeedbackSchema);
    const feedback = await ExitFeedback.findOne({ offboardingRequestId: id });

    res.status(200).json({
      success: true,
      data: {
        request,
        tasks,
        handover,
        assets,
        settlement,
        feedback
      }
    });
  } catch (error) {
    console.error('Error fetching offboarding request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Initiate new offboarding process
 */
exports.initiateOffboarding = async (req, res) => {
  try {
    const { employeeId, reason, reasonDetails, lastWorkingDay, noticePeriod, priority = 'medium' } = req.body;
    
    const offboardingData = {
      employeeId,
      clientId: req.tenant.clientId,
      reason,
      reasonDetails,
      lastWorkingDay: new Date(lastWorkingDay),
      noticePeriod,
      priority
    };

    const offboardingRequest = await offboardingWorkflow.initiateOffboarding(
      req.tenant.connection,
      offboardingData,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: 'Offboarding process initiated successfully',
      data: offboardingRequest
    });
  } catch (error) {
    console.error('Error initiating offboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve offboarding at current stage
 */
exports.approveOffboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, approved = true } = req.body;
    
    const OffboardingRequest = getTenantModel(req.tenant.connection, 'OffboardingRequest', offboardingRequestSchema);
    const request = await OffboardingRequest.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Offboarding request not found' });
    }

    // Find pending approval for current user
    const pendingApproval = request.approvals.find(
      approval => approval.approver.toString() === req.user._id.toString() && approval.status === 'pending'
    );

    if (!pendingApproval) {
      return res.status(400).json({ success: false, message: 'No pending approval found for current user' });
    }

    // Update approval
    pendingApproval.status = approved ? 'approved' : 'rejected';
    pendingApproval.comments = comments;
    pendingApproval[approved ? 'approvedAt' : 'rejectedAt'] = new Date();
    if (!approved) pendingApproval.rejectionReason = comments;

    await request.save();

    // If approved, advance to next stage
    if (approved) {
      await offboardingWorkflow.advanceToNextStage(req.tenant.connection, id, req.user._id, comments);
    }

    res.status(200).json({
      success: true,
      message: `Offboarding ${approved ? 'approved' : 'rejected'} successfully`,
      data: request
    });
  } catch (error) {
    console.error('Error approving offboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TASK MANAGEMENT ====================

/**
 * Get tasks for offboarding request
 */
exports.getOffboardingTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const { department, status, assignedTo } = req.query;
    
    const OffboardingTask = getTenantModel(req.tenant.connection, 'OffboardingTask', offboardingTaskSchema);
    
    let query = { offboardingRequestId: id };
    if (department) query.department = department;
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await OffboardingTask.find(query)
      .populate('assignedTo', 'email firstName lastName')
      .populate('completedBy', 'email firstName lastName')
      .sort({ dueDate: 1 });

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update task status
 */
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, completionNotes, checklist } = req.body;
    
    const OffboardingTask = getTenantModel(req.tenant.connection, 'OffboardingTask', offboardingTaskSchema);
    const task = await OffboardingTask.findById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Update task
    if (status) task.status = status;
    if (completionNotes) task.completionNotes = completionNotes;
    if (checklist) task.checklist = checklist;
    
    if (status === 'completed') {
      task.completedBy = req.user._id;
      task.completedAt = new Date();
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ASSET CLEARANCE ====================

/**
 * Get asset clearance details
 */
exports.getAssetClearance = async (req, res) => {
  try {
    const { id } = req.params;
    const AssetClearance = getTenantModel(req.tenant.connection, 'AssetClearance', assetClearanceSchema);
    
    const clearance = await AssetClearance.findOne({ offboardingRequestId: id })
      .populate('employeeId', 'firstName lastName email');

    res.status(200).json({ success: true, data: clearance });
  } catch (error) {
    console.error('Error fetching asset clearance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update asset return status
 */
exports.updateAssetReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { assetId, returnStatus, conditionAtReturn, notes } = req.body;
    
    const AssetClearance = getTenantModel(req.tenant.connection, 'AssetClearance', assetClearanceSchema);
    const clearance = await AssetClearance.findOne({ offboardingRequestId: id });

    if (!clearance) {
      return res.status(404).json({ success: false, message: 'Asset clearance not found' });
    }

    // Find and update asset
    const asset = clearance.physicalAssets.id(assetId);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    asset.returnStatus = returnStatus;
    asset.conditionAtReturn = conditionAtReturn;
    asset.notes = notes;
    asset.returnDate = new Date();
    asset.returnedTo = req.user._id;

    await clearance.save();

    res.status(200).json({
      success: true,
      message: 'Asset return updated successfully',
      data: clearance
    });
  } catch (error) {
    console.error('Error updating asset return:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FINAL SETTLEMENT ====================

/**
 * Get final settlement details
 */
exports.getFinalSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const FinalSettlement = getTenantModel(req.tenant.connection, 'FinalSettlement', finalSettlementSchema);
    
    const settlement = await FinalSettlement.findOne({ offboardingRequestId: id })
      .populate('employeeId', 'firstName lastName email')
      .populate('calculatedBy', 'email firstName lastName');

    res.status(200).json({ success: true, data: settlement });
  } catch (error) {
    console.error('Error fetching final settlement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Calculate final settlement
 */
exports.calculateSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const settlementData = req.body;
    
    const FinalSettlement = getTenantModel(req.tenant.connection, 'FinalSettlement', finalSettlementSchema);
    let settlement = await FinalSettlement.findOne({ offboardingRequestId: id });

    if (!settlement) {
      settlement = new FinalSettlement({
        offboardingRequestId: id,
        clientId: req.tenant.clientId,
        employeeId: settlementData.employeeId
      });
    }

    // Update settlement data
    Object.assign(settlement, settlementData);
    settlement.calculatedBy = req.user._id;
    settlement.calculatedAt = new Date();
    settlement.calculationStatus = 'calculated';

    await settlement.save();

    res.status(200).json({
      success: true,
      message: 'Settlement calculated successfully',
      data: settlement
    });
  } catch (error) {
    console.error('Error calculating settlement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EXIT FEEDBACK ====================

/**
 * Get exit feedback
 */
exports.getExitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const ExitFeedback = getTenantModel(req.tenant.connection, 'ExitFeedback', exitFeedbackSchema);
    
    const feedback = await ExitFeedback.findOne({ offboardingRequestId: id })
      .populate('employeeId', 'firstName lastName email');

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    console.error('Error fetching exit feedback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit exit feedback
 */
exports.submitExitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedbackData = req.body;
    
    const ExitFeedback = getTenantModel(req.tenant.connection, 'ExitFeedback', exitFeedbackSchema);
    let feedback = await ExitFeedback.findOne({ offboardingRequestId: id });

    if (!feedback) {
      feedback = new ExitFeedback({
        offboardingRequestId: id,
        clientId: req.tenant.clientId,
        employeeId: feedbackData.employeeId
      });
    }

    // Update feedback data
    Object.assign(feedback, feedbackData);
    feedback.completionStatus = 'completed';
    feedback.completedAt = new Date();

    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Exit feedback submitted successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Error submitting exit feedback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORTING & ANALYTICS ====================

/**
 * Get offboarding analytics
 */
exports.getOffboardingAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const OffboardingRequest = getTenantModel(req.tenant.connection, 'OffboardingRequest', offboardingRequestSchema);
    
    const matchStage = { clientId: req.tenant.clientId };
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
      if (toDate) matchStage.createdAt.$lte = new Date(toDate);
    }

    const analytics = await OffboardingRequest.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          completedRequests: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          avgProcessingTime: { $avg: '$processingDuration' },
          reasonBreakdown: {
            $push: '$reason'
          }
        }
      }
    ]);

    res.status(200).json({ success: true, data: analytics[0] || {} });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Close offboarding process
 */
exports.closeOffboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    
    const OffboardingRequest = getTenantModel(req.tenant.connection, 'OffboardingRequest', offboardingRequestSchema);
    const request = await OffboardingRequest.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Offboarding request not found' });
    }

    // Complete the offboarding process
    await offboardingWorkflow.completeOffboarding(req.tenant.connection, request);

    res.status(200).json({
      success: true,
      message: 'Offboarding process completed successfully',
      data: request
    });
  } catch (error) {
    console.error('Error closing offboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
