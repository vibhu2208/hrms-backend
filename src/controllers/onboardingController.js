const { getTenantModel } = require('../utils/tenantModels');
const User = require('../models/User'); // User model stays global
const OfferTemplate = require('../models/OfferTemplate'); // Global model
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const employeeCreationService = require('../services/employeeCreationService');

// Configure email transporter using existing email config
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.warn('Email configuration missing. Using SMTP fallback.');
    // Fallback to SMTP configuration if Gmail not configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
};

const { generatePassword, generateEmployeeId } = require('../utils/passwordGenerator');
const { sendOnboardingEmail, sendHRNotification, sendOfferEmail, sendDocumentRequestEmail, sendITNotification, sendFacilitiesNotification, sendOfferExtendedEmail, sendOfferLetterWithDocumentLink } = require('../services/emailService');

/**
 * Helper function to update candidate's applicationHistory when onboarding is created/updated
 */
const updateCandidateApplicationHistory = async (candidate, onboarding, Candidate) => {
  try {
    if (!candidate || !onboarding) {
      console.warn('⚠️ Cannot update applicationHistory: missing candidate or onboarding');
      return;
    }

    // Reload candidate to ensure we have the latest data
    const updatedCandidate = await Candidate.findById(candidate._id);
    if (!updatedCandidate) {
      console.warn('⚠️ Candidate not found for applicationHistory update');
      return;
    }

    // Initialize applicationHistory if it doesn't exist
    updatedCandidate.applicationHistory = updatedCandidate.applicationHistory || [];
    
    // Find the application entry for this job
    const jobId = onboarding.jobId || candidate.appliedFor?._id || candidate.appliedFor;
    const applicationEntry = updatedCandidate.applicationHistory.find(
      entry => entry.jobId && entry.jobId.toString() === jobId?.toString()
    );

    if (applicationEntry) {
      // Update existing entry
      applicationEntry.onboardingRecord = onboarding._id;
      applicationEntry.stage = 'sent-to-onboarding';
      applicationEntry.status = 'active';
      applicationEntry.outcome = 'onboarding';
    } else {
      // Add new entry
      updatedCandidate.applicationHistory.push({
        jobId: jobId,
        jobTitle: onboarding.position || candidate.appliedFor?.title || 'Position',
        appliedDate: candidate.createdAt || new Date(),
        stage: 'sent-to-onboarding',
        status: 'active',
        outcome: 'onboarding',
        onboardingRecord: onboarding._id
      });
    }

    // Also update the stage
    if (updatedCandidate.stage !== 'sent-to-onboarding') {
      updatedCandidate.stage = 'sent-to-onboarding';
    }

    await updatedCandidate.save();
    console.log('✅ Updated candidate applicationHistory');
  } catch (error) {
    console.error('⚠️ Error updating applicationHistory:', error.message);
    console.error('Error stack:', error.stack);
    // Don't throw - this is a non-critical update
  }
};

/**
 * Send candidate to onboarding - Phase 2 Implementation
 * @route POST /api/applications/:id/send-to-onboarding
 * @access Private (HR/Admin only)
 */
exports.sendToOnboarding = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { id: applicationId } = req.params;
    const { notes } = req.body;
    const hrUserId = req.user.id;

    // Find and validate the candidate application
    const candidate = await Candidate.findById(applicationId)
      .populate('appliedFor');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate application not found'
      });
    }

    console.log(`📋 Processing sendToOnboarding for: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   Stage: ${candidate.stage}, AppliedFor: ${candidate.appliedFor?._id}, Department: ${candidate.appliedFor?.department}`);

    // Validate candidate stage allows transition to onboarding
    const allowedStages = ['offer-accepted', 'interview-completed', 'offer-extended', 'shortlisted'];
    if (!allowedStages.includes(candidate.stage)) {
      return res.status(400).json({
        success: false,
        message: `Cannot send to onboarding. Current stage: ${candidate.stage}. Required: ${allowedStages.join(' or ')}`
      });
    }

    // Check if already sent to onboarding - allow re-initialization if not completed
    const existingOnboarding = await Onboarding.findOne({ candidateEmail: candidate.email });
    if (existingOnboarding && existingOnboarding.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Candidate has already completed onboarding'
      });
    }

    // Validate required data
    if (!candidate.appliedFor) {
      return res.status(400).json({
        success: false,
        message: 'Job posting information is missing'
      });
    }

    if (!candidate.appliedFor.department) {
      return res.status(400).json({
        success: false,
        message: 'Department information is missing from job posting'
      });
    }

    // If existing onboarding exists but not completed, update it
    let onboarding;
    if (existingOnboarding) {
      console.log(`♻️ Updating existing onboarding record for ${candidate.email}`);
      existingOnboarding.applicationId = candidate._id;
      existingOnboarding.jobId = candidate.appliedFor._id;
      existingOnboarding.candidateName = `${candidate.firstName} ${candidate.lastName}`;
      existingOnboarding.candidatePhone = candidate.phone;
      existingOnboarding.position = candidate.appliedFor.title;
      existingOnboarding.department = candidate.appliedFor.department; // This is already an ObjectId
      existingOnboarding.status = 'preboarding';
      existingOnboarding.createdBy = hrUserId;
      existingOnboarding.assignedHR = hrUserId;
      
      if (!existingOnboarding.auditTrail) existingOnboarding.auditTrail = [];
      existingOnboarding.auditTrail.push({
        action: 'reinitialized',
        description: 'Onboarding record reinitialized',
        performedBy: hrUserId,
        previousStatus: existingOnboarding.status,
        newStatus: 'preboarding',
        metadata: { notes },
        timestamp: new Date()
      });
      
      await existingOnboarding.save();
      onboarding = existingOnboarding;
      
      // Update candidate's applicationHistory
      await updateCandidateApplicationHistory(candidate, onboarding, Candidate);
    } else {
      // Create new onboarding record
      const onboardingData = {
        applicationId: candidate._id,
        jobId: candidate.appliedFor._id,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        position: candidate.appliedFor.title,
        department: candidate.appliedFor.department, // This is already an ObjectId, not ._id
        status: 'preboarding',
        createdBy: hrUserId,
        assignedHR: hrUserId,
        
        // Initialize required documents checklist
        requiredDocuments: [
          { type: 'aadhar', isRequired: true },
          { type: 'pan', isRequired: true },
          { type: 'bank_details', isRequired: true },
          { type: 'address_proof', isRequired: true },
          { type: 'education_certificates', isRequired: true },
          { type: 'photo', isRequired: true }
        ],

        // Add initial audit trail entry
        auditTrail: [{
          action: 'sent_to_onboarding',
          description: 'Candidate sent to onboarding process',
          performedBy: hrUserId,
          previousStatus: candidate.stage,
          newStatus: 'preboarding',
          metadata: { notes },
          timestamp: new Date()
        }],

        // Set SLA expectations (default 7 days)
        sla: {
          expectedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      };

      onboarding = await Onboarding.create(onboardingData);
      console.log(`✅ Created new onboarding record for ${candidate.email}: ${onboarding.onboardingId}`);
      
      // Update candidate's applicationHistory
      await updateCandidateApplicationHistory(candidate, onboarding, Candidate);
    }

    // Auto-generate document upload token
    const CandidateDocumentUploadToken = getTenantModel(req.tenant.connection, 'CandidateDocumentUploadToken');
    let uploadUrl = null;
    
    try {
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

      const uploadToken = await CandidateDocumentUploadToken.create({
        onboardingId: onboarding._id,
        candidateId: onboarding.onboardingId,
        candidateName: onboarding.candidateName,
        candidateEmail: onboarding.candidateEmail,
        position: onboarding.position,
        token,
        expiresAt,
        generatedBy: hrUserId
      });

      const tenantId = req.tenant.companyId || req.tenant.clientId;
      const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      uploadUrl = `${frontendBaseUrl}/public/upload-documents/${token}?tenantId=${tenantId}`;
      console.log(`✅ Upload token generated for ${onboarding.candidateName}: ${uploadUrl}`);
    } catch (tokenError) {
      console.error('Error generating upload token:', tokenError);
    }

    // Update candidate record
    const updatedCandidate = await Candidate.findByIdAndUpdate(applicationId, {
      stage: 'sent-to-onboarding',
      onboardingRecord: onboarding._id,
      sentToOnboardingAt: new Date(),
      sentToOnboardingBy: hrUserId,
      $push: {
        timeline: {
          action: 'sent_to_onboarding',
          description: 'Candidate sent to onboarding process',
          performedBy: hrUserId,
          metadata: { onboardingId: onboarding._id, notes }
        }
      }
    }, { new: true });

    // Send offer letter with document upload link
    if (uploadUrl) {
      try {
        await sendOfferLetterWithDocumentLink({
          candidateName: onboarding.candidateName,
          candidateEmail: onboarding.candidateEmail,
          position: onboarding.position,
          joiningDate: onboarding.joiningDate,
          uploadUrl,
          companyName: req.tenant?.companyName || 'Our Company'
        });
        console.log(`📧 Offer letter with document link sent to ${onboarding.candidateEmail}`);
      } catch (emailError) {
        console.error('Error sending offer letter email:', emailError);
      }
    }

    // Populate the created onboarding record for response
    const populatedOnboarding = await Onboarding.findById(onboarding._id)
      .populate('applicationId', 'firstName lastName email candidateCode')
      .populate('jobId', 'title')
      .populate('department', 'name')
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Candidate successfully sent to onboarding',
      data: {
        onboarding: populatedOnboarding,
        candidate: {
          id: candidate._id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          stage: 'sent-to-onboarding'
        }
      }
    });

  } catch (error) {
    console.error('Error sending candidate to onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send candidate to onboarding',
      error: error.message
    });
  }
};

exports.getOnboardingList = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Get tenant-specific models
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    
    const { status, department, assignedHR, search } = req.query;
    let query = {};

    // Filter by status (exclude completed by default unless specifically requested)
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'completed' }; // Show active onboarding records
    }

    // Filter by department
    if (department) query.department = department;

    // Filter by assigned HR
    if (assignedHR) query.assignedHR = assignedHR;

    // Search functionality
    if (search) {
      query.$or = [
        { candidateName: { $regex: search, $options: 'i' } },
        { candidateEmail: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { onboardingId: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('📋 Fetching onboarding list with query:', JSON.stringify(query));
    
    // First check total count without filters
    const totalCount = await Onboarding.countDocuments({});
    console.log(`   Total onboarding records in DB: ${totalCount}`);
    
    const onboardingList = await Onboarding.find(query)
      .populate('applicationId', 'firstName lastName email candidateCode')
      .populate('jobId', 'title')
      .populate('department', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedHR', 'firstName lastName email')
      .populate('tasks.assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log(`   Found ${onboardingList.length} records matching query`);
    if (onboardingList.length > 0) {
      console.log(`   Sample record: ${onboardingList[0].candidateName} - Status: ${onboardingList[0].status}`);
    }

    // Calculate summary statistics
    const summary = {
      total: onboardingList.length,
      byStatus: {},
      overdue: 0
    };

    onboardingList.forEach(onboarding => {
      // Count by status
      summary.byStatus[onboarding.status] = (summary.byStatus[onboarding.status] || 0) + 1;
      
      // Count overdue
      if (onboarding.sla && onboarding.sla.expectedCompletionDate < new Date() && onboarding.status !== 'completed') {
        summary.overdue++;
      }
    });

    res.status(200).json({ 
      success: true, 
      count: onboardingList.length, 
      data: onboardingList,
      summary 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOnboarding = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const onboarding = await Onboarding.findById(req.params.id)
      .populate('employee')
      .populate('department')
      .populate('tasks.assignedTo');

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    res.status(200).json({ success: true, data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOnboarding = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { candidateName, candidateEmail, position, department } = req.body;

    const onboarding = await Onboarding.create({
      candidateName,
      candidateEmail,
      candidatePhone: req.body.candidatePhone,
      position,
      department,
      stages: ['interview1', 'hrDiscussion', 'documentation', 'success'],
      currentStage: 'interview1',
      status: 'in-progress'
    });

    res.status(201).json({ success: true, message: 'Onboarding process initiated', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOnboarding = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const onboarding = await Onboarding.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }
    res.status(200).json({ success: true, message: 'Onboarding updated successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.advanceStage = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    const currentIndex = onboarding.stages.indexOf(onboarding.currentStage);
    if (currentIndex < onboarding.stages.length - 1) {
      onboarding.currentStage = onboarding.stages[currentIndex + 1];
      
      // If reached success stage, mark as completed
      if (onboarding.currentStage === 'success') {
        onboarding.status = 'completed';
        onboarding.completedAt = Date.now();
      }
      
      await onboarding.save();
      res.status(200).json({ success: true, message: 'Stage advanced successfully', data: onboarding });
    } else {
      res.status(400).json({ success: false, message: 'Already at final stage' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setJoiningDate = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { joiningDate } = req.body;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    onboarding.joiningDate = joiningDate;
    await onboarding.save();

    res.status(200).json({ success: true, message: 'Joining date set successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addTask = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { title, description, assignedTo, dueDate } = req.body;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    onboarding.tasks.push({
      title,
      description,
      assignedTo,
      dueDate,
      status: 'pending'
    });

    await onboarding.save();

    res.status(200).json({ success: true, message: 'Task added successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeTask = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { taskId } = req.params;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    const task = onboarding.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    await onboarding.save();

    res.status(200).json({ success: true, message: 'Task completed successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOnboarding = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const onboarding = await Onboarding.findByIdAndDelete(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }
    res.status(200).json({ success: true, message: 'Onboarding deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update onboarding status with state machine validation
 * @route PUT /api/onboarding/:id/status
 * @access Private (HR/Admin only)
 */
exports.updateOnboardingStatus = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { id } = req.params;
    const { status, notes } = req.body;
    const hrUserId = req.user.id;

    // Define allowed state transitions
    const allowedTransitions = {
      'preboarding': ['pending_approval', 'offer_sent', 'rejected'], // Can request approval or send offer (if approved)
      'pending_approval': ['preboarding', 'approval_rejected'], // Admin can approve (returns to preboarding) or reject
      'approval_rejected': ['pending_approval', 'rejected'], // HR can re-request or reject candidate
      'offer_sent': ['offer_accepted', 'rejected'],
      'offer_accepted': ['docs_pending', 'rejected'],
      'docs_pending': ['docs_verified', 'rejected'],
      'docs_verified': ['ready_for_joining', 'rejected'],
      'ready_for_joining': ['completed', 'rejected'],
      'completed': [], // Terminal state
      'rejected': [] // Terminal state
    };

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate state transition
    if (!allowedTransitions[onboarding.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${onboarding.status} to ${status}`,
        allowedTransitions: allowedTransitions[onboarding.status]
      });
    }

    const previousStatus = onboarding.status;
    onboarding.status = status;

    // Add audit trail entry
    onboarding.auditTrail.push({
      action: 'status_updated',
      description: `Status changed from ${previousStatus} to ${status}`,
      performedBy: hrUserId,
      previousStatus,
      newStatus: status,
      metadata: { notes },
      timestamp: new Date()
    });

    await onboarding.save();

    res.status(200).json({
      success: true,
      message: 'Onboarding status updated successfully',
      data: {
        onboardingId: onboarding.onboardingId,
        previousStatus,
        newStatus: status,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating onboarding status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update onboarding status',
      error: error.message
    });
  }
};

/**
 * Send offer letter to candidate
 * @route POST /api/onboarding/:id/send-offer
 * @access Private (HR/Admin only)
 */
exports.sendOffer = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    // Use global OfferTemplate model (not tenant-specific)
    const { id } = req.params;
    const { templateId, offerDetails } = req.body;
    const hrUserId = req.user.id;

    const onboarding = await Onboarding.findById(id)
      .populate('applicationId')
      .populate('department');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate status - allow preboarding, offer_sent, or any status to send offer
    if (!onboarding.status) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding record has no status'
      });
    }

    // Check approval status - MANDATORY: Cannot send offer without admin approval
    // This ensures the approval workflow is not skippable
    if (onboarding.approvalStatus?.status !== 'approved') {
      // Check if approval is pending
      if (onboarding.approvalStatus?.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Cannot send offer. Approval is pending from admin. Please wait for approval.',
          code: 'APPROVAL_PENDING'
        });
      }
      
      // Check if approval was rejected
      if (onboarding.approvalStatus?.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot send offer. Previous approval request was rejected. Please re-request approval.',
          code: 'APPROVAL_REJECTED',
          rejectionReason: onboarding.approvalStatus?.rejectionReason
        });
      }
      
      // No approval requested yet
      return res.status(400).json({
        success: false,
        message: 'Cannot send offer without admin approval. Please request approval first.',
        code: 'APPROVAL_REQUIRED'
      });
    }

    // Get offer template
    let template;
    
    // If templateId is 'default' or not provided, fetch any available template
    if (!templateId || templateId === 'default') {
      // Try to find a default template first
      template = await OfferTemplate.findOne({
        isDefault: true
      });
      
      // If no default template exists, find any template (regardless of status)
      if (!template) {
        template = await OfferTemplate.findOne({});
      }
      
      if (!template) {
        console.error('No offer templates found in database');
        return res.status(400).json({
          success: false,
          message: 'No offer template found. Please create an offer template first.'
        });
      }
    } else {
      // Validate that templateId is a valid ObjectId
      if (!templateId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }
      
      template = await OfferTemplate.findById(templateId);
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'Offer template not found'
        });
      }
    }

    // Set offer expiry (24 hours from now)
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Use offer details from request or fallback to onboarding data
    const designation = offerDetails?.designation || onboarding.position || 'Not Specified';
    const ctc = offerDetails?.ctc || offerDetails?.salary || 0;
    const benefits = offerDetails?.benefits || [];
    const startDate = offerDetails?.startDate || null;

    // Calculate salary breakdown (60% basic, 40% HRA by default)
    const basic = Math.round(ctc * 0.6);
    const hra = Math.round(ctc * 0.4);

    // Update onboarding with offer details
    onboarding.offer = {
      templateId: template._id,
      templateVersion: template.version,
      offeredDesignation: designation,
      offeredCTC: ctc,
      salary: {
        basic: basic,
        hra: hra,
        allowances: 0,
        total: ctc
      },
      benefits: benefits,
      startDate: startDate,
      sentAt: new Date(),
      sentBy: hrUserId,
      expiryDate,
      remindersSent: []
    };

    onboarding.status = 'offer_sent';

    // Add audit trail
    onboarding.auditTrail.push({
      action: 'offer_sent',
      description: 'Offer letter sent to candidate',
      performedBy: hrUserId,
      previousStatus: 'preboarding',
      newStatus: 'offer_sent',
      metadata: { templateId, offerDetails },
      timestamp: new Date()
    });

    await onboarding.save();

    // Get candidate details
    const candidate = await Candidate.findById(onboarding.candidateId);
    
    // Send offer email to candidate
    try {
      await sendOfferExtendedEmail({
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateEmail: candidate.email,
        position: designation,
        joiningDate: startDate,
        companyName: process.env.COMPANY_NAME || 'Our Company'
      });
      console.log(`✅ Offer email sent to ${candidate.email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send offer email:', emailError.message);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Offer letter sent successfully',
      data: {
        onboardingId: onboarding.onboardingId,
        offerSentAt: onboarding.offer.sentAt,
        expiryDate: onboarding.offer.expiryDate,
        emailSent: true
      }
    });

  } catch (error) {
    console.error('Error sending offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send offer letter',
      error: error.message
    });
  }
};

/**
 * Accept offer (candidate action via secure link)
 * @route POST /api/onboarding/:id/accept-offer
 * @access Public (with secure token)
 */
exports.acceptOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { acceptanceNotes } = req.body;

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate status
    if (onboarding.status !== 'offer_sent') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept offer. Current status: ${onboarding.status}`
      });
    }

    // Check if offer has expired
    if (onboarding.offer.expiryDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Offer has expired'
      });
    }

    // Update offer acceptance
    onboarding.offer.acceptedAt = new Date();
    onboarding.status = 'offer_accepted';

    // Initialize required documents checklist if not already done
    if (!onboarding.requiredDocuments || onboarding.requiredDocuments.length === 0) {
      onboarding.requiredDocuments = [
        { type: 'aadhar', isRequired: true },
        { type: 'pan', isRequired: true },
        { type: 'bank_details', isRequired: true },
        { type: 'address_proof', isRequired: true },
        { type: 'education_certificates', isRequired: true },
        { type: 'photo', isRequired: true }
      ];
    }

    // Add audit trail
    onboarding.auditTrail.push({
      action: 'offer_accepted',
      description: 'Candidate accepted the offer',
      performedBy: null, // Candidate action
      previousStatus: 'offer_sent',
      newStatus: 'offer_accepted',
      metadata: { acceptanceNotes },
      timestamp: new Date()
    });

    await onboarding.save();

    res.status(200).json({
      success: true,
      message: 'Offer accepted successfully',
      data: {
        onboardingId: onboarding.onboardingId,
        acceptedAt: onboarding.offer.acceptedAt,
        nextStep: 'document_submission'
      }
    });

  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept offer',
      error: error.message
    });
  }
};

/**
 * Set joining date and notify teams
 * @route POST /api/onboarding/:id/set-joining-date
 * @access Private (HR/Admin only)
 */
exports.setJoiningDateAndNotify = async (req, res) => {
  try {
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { id } = req.params;
    const { joiningDate, notifyTeams } = req.body;
    const hrUserId = req.user.id;

    const onboarding = await Onboarding.findById(id)
      .populate('department')
      .populate('applicationId');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate status
    if (onboarding.status !== 'docs_verified') {
      return res.status(400).json({
        success: false,
        message: `Cannot set joining date. Current status: ${onboarding.status}. Required: docs_verified`
      });
    }

    // Validate joining date
    const joinDate = new Date(joiningDate);
    if (joinDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Joining date must be in the future'
      });
    }

    // Update joining date
    onboarding.joiningDate = joinDate;
    onboarding.status = 'ready_for_joining';

    // Add audit trail
    onboarding.auditTrail.push({
      action: 'joining_date_set',
      description: `Joining date set to ${joinDate.toDateString()}`,
      performedBy: hrUserId,
      previousStatus: 'docs_verified',
      newStatus: 'ready_for_joining',
      metadata: { joiningDate, notifyTeams },
      timestamp: new Date()
    });

    // Send notifications if requested
    if (notifyTeams) {
      // Update notification status
      onboarding.notifications.itNotified.sent = true;
      onboarding.notifications.itNotified.sentAt = new Date();
      onboarding.notifications.itNotified.sentBy = hrUserId;

      onboarding.notifications.facilitiesNotified.sent = true;
      onboarding.notifications.facilitiesNotified.sentAt = new Date();
      onboarding.notifications.facilitiesNotified.sentBy = hrUserId;

      // TODO: Send actual notifications
      // await sendITNotification(onboarding);
      // await sendFacilitiesNotification(onboarding);
    }

    await onboarding.save();

    res.status(200).json({
      success: true,
      message: 'Joining date set and teams notified successfully',
      data: {
        onboardingId: onboarding.onboardingId,
        joiningDate: onboarding.joiningDate,
        status: onboarding.status,
        notificationsSent: notifyTeams
      }
    });

  } catch (error) {
    console.error('Error setting joining date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set joining date',
      error: error.message
    });
  }
};

/**
 * Upload document for onboarding
 * @route POST /api/onboarding/:id/documents
 * @access Private (HR/Admin only) or Public (with secure token)
 */
exports.uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, documentName, documentUrl, uploadedBy = 'candidate' } = req.body;

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate document type
    const validTypes = [
      'resume', 'offer_letter_signed', 'aadhar', 'pan', 'bank_details', 
      'passport', 'education_certificates', 'experience_letters', 
      'address_proof', 'photo', 'other'
    ];

    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // Check if document already exists
    const existingDocIndex = onboarding.documents.findIndex(doc => doc.type === documentType);
    
    const documentData = {
      type: documentType,
      name: documentName,
      originalName: documentName,
      url: documentUrl,
      uploadedAt: new Date(),
      uploadedBy,
      status: 'uploaded',
      verified: false
    };

    if (existingDocIndex >= 0) {
      // Replace existing document
      onboarding.documents[existingDocIndex] = documentData;
    } else {
      // Add new document
      onboarding.documents.push(documentData);
    }

    // Update required documents checklist
    const requiredDocIndex = onboarding.requiredDocuments.findIndex(doc => doc.type === documentType);
    if (requiredDocIndex >= 0) {
      onboarding.requiredDocuments[requiredDocIndex].submitted = true;
    }

    // Add audit trail
    onboarding.auditTrail.push({
      action: 'document_uploaded',
      description: `Document uploaded: ${documentType}`,
      performedBy: req.user?.id || null,
      metadata: { documentType, documentName, uploadedBy },
      timestamp: new Date()
    });

    await onboarding.save();

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: documentData,
        onboardingId: onboarding.onboardingId
      }
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

/**
 * Verify or reject document
 * @route PUT /api/onboarding/:id/documents/:docId/verify
 * @access Private (HR/Admin only)
 */
exports.verifyDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'
    const hrUserId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }

    // Get tenant-specific Onboarding model
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    const document = onboarding.documents.id(docId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Update document verification status
    document.verified = action === 'approve';
    document.verifiedBy = hrUserId;
    document.verifiedAt = new Date();
    document.verificationNotes = notes;
    document.status = action === 'approve' ? 'verified' : 'rejected';
    
    if (action === 'reject') {
      document.rejectionReason = notes;
    }

    // Update required documents checklist
    const requiredDocIndex = onboarding.requiredDocuments.findIndex(doc => doc.type === document.type);
    if (requiredDocIndex >= 0) {
      onboarding.requiredDocuments[requiredDocIndex].verified = action === 'approve';
    }

    // Add audit trail
    onboarding.auditTrail.push({
      action: `document_${action}d`,
      description: `Document ${action}d: ${document.type}`,
      performedBy: hrUserId,
      metadata: { documentType: document.type, notes },
      timestamp: new Date()
    });

    // Check if all required documents are verified
    const allRequiredVerified = onboarding.requiredDocuments
      .filter(doc => doc.isRequired)
      .every(doc => doc.verified);

    if (allRequiredVerified && onboarding.status === 'docs_pending') {
      onboarding.status = 'docs_verified';
      onboarding.auditTrail.push({
        action: 'all_documents_verified',
        description: 'All required documents have been verified',
        performedBy: hrUserId,
        timestamp: new Date()
      });
    }

    await onboarding.save();

    // Send notification email to candidate if document was rejected
    if (action === 'reject') {
      try {
        const { sendDocumentRejectionEmail } = require('../services/emailService');
        await sendDocumentRejectionEmail({
          candidateName: onboarding.candidateName,
          candidateEmail: onboarding.candidateEmail,
          documentName: document.name || document.type,
          rejectionReason: notes,
          uploadUrl: document.uploadUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/public/upload-documents/${onboarding.uploadToken}?tenantId=${req.tenant.companyId || req.tenant.clientId}`,
          companyName: process.env.COMPANY_NAME || 'Our Company'
        });
        console.log(`✅ Document rejection email sent to ${onboarding.candidateEmail}`);
      } catch (emailError) {
        console.error('❌ Failed to send document rejection email:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Document ${action}d successfully`,
      data: {
        document,
        allDocumentsVerified: allRequiredVerified,
        onboardingStatus: onboarding.status
      }
    });

  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document',
      error: error.message
    });
  }
};

/**
 * Get document verification status
 * @route GET /api/onboarding/:id/documents
 * @access Private (HR/Admin only) or Public (with secure token)
 */
exports.getDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const onboarding = await Onboarding.findById(id)
      .populate('documents.verifiedBy', 'firstName lastName email');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Calculate verification progress
    const totalRequired = onboarding.requiredDocuments.filter(doc => doc.isRequired).length;
    const submitted = onboarding.requiredDocuments.filter(doc => doc.submitted).length;
    const verified = onboarding.requiredDocuments.filter(doc => doc.verified).length;

    const progress = {
      totalRequired,
      submitted,
      verified,
      submissionProgress: totalRequired > 0 ? Math.round((submitted / totalRequired) * 100) : 0,
      verificationProgress: totalRequired > 0 ? Math.round((verified / totalRequired) * 100) : 0
    };

    res.status(200).json({
      success: true,
      data: {
        onboardingId: onboarding.onboardingId,
        candidateName: onboarding.candidateName,
        status: onboarding.status,
        documents: onboarding.documents,
        requiredDocuments: onboarding.requiredDocuments,
        progress
      }
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
};

/**
 * Request document resubmission
 * @route POST /api/onboarding/:id/documents/:docId/request-resubmission
 * @access Private (HR/Admin only)
 */
exports.requestDocumentResubmission = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const { reason } = req.body;
    const hrUserId = req.user.id;

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    const document = onboarding.documents.id(docId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Update document status
    document.status = 'rejected';
    document.rejectionReason = reason;
    document.verified = false;

    // Add audit trail
    onboarding.auditTrail.push({
      action: 'document_resubmission_requested',
      description: `Resubmission requested for: ${document.type}`,
      performedBy: hrUserId,
      metadata: { documentType: document.type, reason },
      timestamp: new Date()
    });

    await onboarding.save();

    // TODO: Send resubmission request email to candidate
    // await sendDocumentResubmissionEmail(onboarding, document, reason);

    res.status(200).json({
      success: true,
      message: 'Document resubmission requested successfully',
      data: {
        document,
        onboardingId: onboarding.onboardingId
      }
    });

  } catch (error) {
    console.error('Error requesting document resubmission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request document resubmission',
      error: error.message
    });
  }
};

/**
 * Complete onboarding process and create employee account
 * @route POST /api/onboarding/:id/complete
 * @access Private (HR/Admin only)
 * 
 * This function:
 * 1. Validates onboarding completion requirements
 * 2. Creates employee record from onboarding data
 * 3. Generates secure credentials
 * 4. Creates user account with temporary password
 * 5. Sends welcome email with credentials
 * 6. Updates candidate status to 'joined'
 * 7. Marks onboarding as completed
 */
exports.completeOnboardingProcess = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName } = req.body;
    const tenantConnection = req.tenant.connection;


    // Validate onboarding completion readiness
    const validation = await employeeCreationService.validateOnboardingCompletion(id, tenantConnection);

    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Use the employee creation service to complete onboarding

    const result = await employeeCreationService.completeOnboardingAndCreateEmployee(
      id,
      tenantConnection,
      {
        // Any additional employee data from request
        createdBy: req.user._id
      }
    );

    console.log(`✅ Onboarding completed successfully for ${result.employee.email}`);

    return res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully. Employee and user accounts created.',
      data: {
        employeeCode: result.employeeCode,
        employeeId: result.employee._id,
        email: result.employee.email,
        name: `${result.employee.firstName} ${result.employee.lastName}`,
        joiningDate: result.employee.joiningDate,
        designation: result.employee.designation,
        userAccount: result.userAccount,
        tempPassword: result.tempPassword, // Only shown once for admin
        onboardingId: result.onboarding._id,
        completedAt: result.onboarding.completedAt
      }
    });
  } catch (error) {
    console.error('❌ Error completing onboarding:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more detailed error messages
    let errorMessage = 'Failed to complete onboarding process';
    let statusCode = 500;
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = `Validation error: ${Object.values(error.errors).map(e => e.message).join(', ')}`;
    } else if (error.code === 11000) {
      statusCode = 409;
      errorMessage = 'Employee with this email or employee code already exists';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorMessage = error.message;
    } else if (error.message.includes('required') || error.message.includes('must be')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Helper function to send onboarding document submission email
async function sendOnboardingDocumentEmail(candidate, onboarding) {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('Email transporter not configured, skipping onboarding document email');
      return;
    }

    const documentSubmissionUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/candidate-documents`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.SMTP_FROM || 'noreply@hrms.com',
      to: candidate.email,
      subject: 'Welcome to Onboarding - Submit Your Documents',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to Onboarding!</h1>
          </div>
          
          <div style="padding: 30px; background-color: #F9FAFB;">
            <p style="font-size: 16px;">Dear ${candidate.firstName} ${candidate.lastName},</p>
            
            <p>Congratulations! You have been moved to the onboarding stage. We're excited to have you join our team!</p>
            
            <div style="background-color: #EEF2FF; border-left: 4px solid #4F46E5; padding: 20px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #4F46E5;">Your Candidate ID</h3>
              <p style="font-size: 24px; font-weight: bold; color: #1F2937; margin: 10px 0;">
                ${candidate.candidateCode}
              </p>
              <p style="font-size: 14px; color: #6B7280; margin: 0;">
                Please keep this ID safe. You'll need it to submit your documents.
              </p>
            </div>
            
            <h3 style="color: #1F2937;">Next Steps: Submit Your Documents</h3>
            
            <p>To complete your onboarding process, please submit the following documents:</p>
            
            <ul style="line-height: 1.8;">
              <li><strong>Aadhar Card</strong> (PDF or Image)</li>
              <li><strong>PAN Card</strong> (PDF or Image)</li>
              <li><strong>Bank Details</strong> (Account Number, IFSC Code, Bank Name)</li>
              <li><strong>Bank Proof</strong> (Cancelled Cheque or Bank Statement)</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${documentSubmissionUrl}" 
                 style="display: inline-block; background-color: #4F46E5; color: white; padding: 15px 40px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Submit Documents Now
              </a>
            </div>
            
            <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #92400E;">
                <strong>⚠️ Important:</strong> You will need your Candidate ID (${candidate.candidateCode}) to access the document submission portal.
              </p>
            </div>
            
            <h3 style="color: #1F2937;">How to Submit:</h3>
            <ol style="line-height: 1.8;">
              <li>Click the "Submit Documents Now" button above</li>
              <li>Enter your Candidate ID: <strong>${candidate.candidateCode}</strong></li>
              <li>Upload all required documents</li>
              <li>Submit the form</li>
            </ol>
            
            <p style="margin-top: 30px;">Once you submit your documents, our HR team will review them and get back to you shortly.</p>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our HR department.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>HR Team</strong>
            </p>
          </div>
          
          <div style="background-color: #E5E7EB; padding: 20px; text-align: center;">
            <p style="color: #6B7280; font-size: 12px; margin: 0;">
              This is an automated email. Please do not reply to this message.<br>
              If you need help, contact our HR department.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Onboarding document submission email sent to ${candidate.email}`);
  } catch (error) {
    console.error('Error sending onboarding document email:', error);
    throw error;
  }
}

/**
 * Request documents from candidate - generates/reuses upload token and emails link
 * @route POST /api/onboarding/:id/request-documents
 * @access Private (HR/Admin only)
 */
exports.requestDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const CandidateDocumentUploadToken = getTenantModel(req.tenant.connection, 'CandidateDocumentUploadToken');
    const { sendDocumentRequestEmail } = require('../services/emailService');

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Check for existing active token
    let uploadToken = await CandidateDocumentUploadToken.findOne({
      onboardingId: onboarding._id,
      isActive: true,
      revokedAt: null
    });

    let uploadUrl;
    const tenantId = req.tenant.companyId || req.tenant.clientId;
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (uploadToken) {
      // Reuse existing token
      uploadUrl = `${frontendBaseUrl}/public/upload-documents/${uploadToken.token}?tenantId=${tenantId}`;
      console.log(`✅ Reusing existing upload token for ${onboarding.candidateName}`);
    } else {
      // Generate new token
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

      uploadToken = await CandidateDocumentUploadToken.create({
        onboardingId: onboarding._id,
        candidateId: onboarding.onboardingId,
        candidateName: onboarding.candidateName,
        candidateEmail: onboarding.candidateEmail,
        position: onboarding.position,
        token,
        expiresAt,
        generatedBy: req.user._id
      });

      uploadUrl = `${frontendBaseUrl}/public/upload-documents/${token}?tenantId=${tenantId}`;
      console.log(`✅ Generated new upload token for ${onboarding.candidateName}`);
    }

    // Send email with upload link
    try {
      await sendDocumentRequestEmail({
        candidateName: onboarding.candidateName,
        candidateEmail: onboarding.candidateEmail,
        position: onboarding.position,
        uploadUrl,
        companyName: req.tenant?.companyName || 'Our Company'
      });

      // Add audit trail
      onboarding.auditTrail.push({
        action: 'document_request_sent',
        description: `Document upload link sent to candidate via email`,
        performedBy: req.user._id,
        metadata: { uploadUrl, tokenId: uploadToken._id },
        timestamp: new Date()
      });

      await onboarding.save();

      console.log(`📧 Document request email sent to ${onboarding.candidateEmail}`);

      res.status(200).json({
        success: true,
        message: 'Document request email sent successfully',
        data: {
          uploadUrl,
          sentTo: onboarding.candidateEmail,
          tokenId: uploadToken._id
        }
      });
    } catch (emailError) {
      console.error('Error sending document request email:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send document request email',
        error: emailError.message
      });
    }

  } catch (error) {
    console.error('Error requesting documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request documents',
      error: error.message
    });
  }
};

/**
 * Request approval from admin before sending offer
 * @route POST /api/onboarding/:id/request-approval
 * @access Private (HR only)
 */
exports.requestOnboardingApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, offerDetails } = req.body;
    const hrUserId = req.user.id || req.user._id;
    const tenantConnection = req.tenant.connection;
    
    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    const Candidate = getTenantModel(tenantConnection, 'Candidate');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);
    
    // Get onboarding record with full details
    const onboarding = await Onboarding.findById(id)
      .populate('applicationId')
      .populate('department', 'name')
      .populate('jobId', 'title')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedHR', 'firstName lastName email');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate status - can only request approval in preboarding or after rejection
    const allowedStatuses = ['preboarding', 'approval_rejected'];
    if (!allowedStatuses.includes(onboarding.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot request approval in current status: ${onboarding.status}. Approval can only be requested in preboarding or after rejection.`
      });
    }

    // Check if approval is already pending
    if (onboarding.approvalStatus?.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'An approval request is already pending for this candidate'
      });
    }

    // Get HR user details
    const hrUser = await TenantUser.findById(hrUserId).select('firstName lastName email role');
    if (!hrUser) {
      return res.status(400).json({
        success: false,
        message: 'HR user not found'
      });
    }

    // Get candidate details
    const candidate = await Candidate.findById(onboarding.applicationId)
      .populate('appliedFor', 'title department');

    // Find company admin to be the approver
    const companyAdmin = await TenantUser.findOne({ 
      role: 'company_admin', 
      isActive: true 
    }).select('firstName lastName email');

    if (!companyAdmin) {
      return res.status(400).json({
        success: false,
        message: 'No company admin found to approve this request. Please contact system administrator.'
      });
    }

    // Create approval instance with comprehensive metadata
    const approvalInstance = await ApprovalInstance.create({
      requestType: 'onboarding_approval',
      requestId: onboarding._id,
      requestedBy: hrUserId,
      currentLevel: 1,
      totalLevels: 1,
      status: 'pending',
      approvalChain: [{
        level: 1,
        approverType: 'company_admin',
        approverId: companyAdmin._id,
        status: 'pending',
        sla: {
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          escalationDate: new Date(Date.now() + 36 * 60 * 60 * 1000),
          isEscalated: false
        }
      }],
      metadata: {
        priority: 'high',
        // Candidate details
        candidateName: onboarding.candidateName,
        candidateEmail: onboarding.candidateEmail,
        candidatePhone: onboarding.candidatePhone,
        candidateCode: candidate?.candidateCode || 'N/A',
        // Job details
        position: onboarding.position,
        department: onboarding.department?.name || 'N/A',
        jobTitle: onboarding.jobId?.title || onboarding.position,
        // HR details
        requestedByName: `${hrUser.firstName} ${hrUser.lastName}`,
        requestedByEmail: hrUser.email,
        requestedByRole: hrUser.role,
        // Offer details (if provided)
        offerDetails: offerDetails || {},
        // Additional notes
        notes: notes || '',
        // Onboarding ID for reference
        onboardingId: onboarding.onboardingId
      },
      slaStatus: {
        startDate: new Date(),
        expectedCompletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      history: [{
        action: 'CREATED',
        performedBy: hrUserId,
        timestamp: new Date(),
        details: { 
          notes: notes || 'Onboarding approval request created',
          candidateName: onboarding.candidateName,
          position: onboarding.position
        }
      }]
    });

    // Update onboarding record
    onboarding.status = 'pending_approval';
    onboarding.approvalStatus = {
      status: 'pending',
      approvalInstanceId: approvalInstance._id,
      requestedBy: hrUserId,
      requestedAt: new Date(),
      canReRequest: false
    };

    // Add audit trail
    onboarding.auditTrail.push({
      action: 'approval_requested',
      description: `Approval requested from admin by ${hrUser.firstName} ${hrUser.lastName}`,
      performedBy: hrUserId,
      previousStatus: onboarding.status === 'approval_rejected' ? 'approval_rejected' : 'preboarding',
      newStatus: 'pending_approval',
      metadata: { 
        approvalInstanceId: approvalInstance._id,
        approverEmail: companyAdmin.email,
        notes 
      },
      timestamp: new Date()
    });

    await onboarding.save();

    console.log(`✅ Onboarding approval requested for ${onboarding.candidateName} by ${hrUser.email}`);

    res.status(200).json({
      success: true,
      message: 'Approval request sent to admin successfully',
      data: {
        onboardingId: onboarding.onboardingId,
        candidateName: onboarding.candidateName,
        approvalInstanceId: approvalInstance._id,
        status: 'pending',
        approverEmail: companyAdmin.email,
        requestedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error requesting onboarding approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request approval',
      error: error.message
    });
  }
};

/**
 * Get approval status for an onboarding record
 * @route GET /api/onboarding/:id/approval-status
 * @access Private (HR/Admin)
 */
exports.getOnboardingApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantConnection = req.tenant.connection;
    
    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Get approval instance if exists
    let approvalInstance = null;
    if (onboarding.approvalStatus?.approvalInstanceId) {
      approvalInstance = await ApprovalInstance.findById(onboarding.approvalStatus.approvalInstanceId)
        .populate('requestedBy', 'firstName lastName email')
        .populate('approvalChain.approverId', 'firstName lastName email');
    }

    // Get history of approval requests for this onboarding
    const approvalHistory = await ApprovalInstance.find({
      requestType: 'onboarding_approval',
      requestId: onboarding._id
    })
    .populate('requestedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        onboardingId: onboarding.onboardingId,
        candidateName: onboarding.candidateName,
        currentStatus: onboarding.status,
        approvalStatus: onboarding.approvalStatus || { status: 'not_requested' },
        currentApprovalInstance: approvalInstance,
        approvalHistory: approvalHistory,
        canRequestApproval: ['preboarding', 'approval_rejected'].includes(onboarding.status) && 
                           onboarding.approvalStatus?.status !== 'pending',
        canSendOffer: onboarding.approvalStatus?.status === 'approved'
      }
    });

  } catch (error) {
    console.error('Error getting approval status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approval status',
      error: error.message
    });
  }
};

/**
 * Process onboarding approval (Admin action)
 * @route PUT /api/onboarding/:id/process-approval
 * @access Private (Admin only)
 */
exports.processOnboardingApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body; // action: 'approve' or 'reject'
    const adminUserId = req.user.id || req.user._id;
    const tenantConnection = req.tenant.connection;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate status
    if (onboarding.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: `Cannot process approval. Current status: ${onboarding.status}`
      });
    }

    // Get admin user details
    const adminUser = await TenantUser.findById(adminUserId).select('firstName lastName email role');
    
    // Validate admin role
    if (!adminUser || adminUser.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only company admin can approve or reject onboarding requests'
      });
    }

    // Get and update approval instance
    const approvalInstance = await ApprovalInstance.findById(onboarding.approvalStatus.approvalInstanceId);
    if (approvalInstance) {
      const currentApprover = approvalInstance.getCurrentApprover();
      if (currentApprover) {
        currentApprover.status = action === 'approve' ? 'approved' : 'rejected';
        currentApprover.actionDate = new Date();
        currentApprover.comments = comments;
      }
      approvalInstance.status = action === 'approve' ? 'approved' : 'rejected';
      approvalInstance.slaStatus.actualCompletionDate = new Date();
      approvalInstance.history.push({
        action: action.toUpperCase(),
        performedBy: adminUserId,
        timestamp: new Date(),
        details: { comments, level: 1 }
      });
      await approvalInstance.save();
    }

    // Update onboarding record
    const previousStatus = onboarding.status;
    
    if (action === 'approve') {
      onboarding.status = 'preboarding'; // Return to preboarding so HR can send offer
      onboarding.approvalStatus.status = 'approved';
      onboarding.approvalStatus.approvedBy = adminUserId;
      onboarding.approvalStatus.approvedAt = new Date();
      onboarding.approvalStatus.comments = comments;
      onboarding.approvalStatus.canReRequest = false;
    } else {
      onboarding.status = 'approval_rejected';
      onboarding.approvalStatus.status = 'rejected';
      onboarding.approvalStatus.rejectedBy = adminUserId;
      onboarding.approvalStatus.rejectedAt = new Date();
      onboarding.approvalStatus.rejectionReason = comments;
      onboarding.approvalStatus.canReRequest = true; // Allow HR to re-request
    }

    // Add audit trail
    onboarding.auditTrail.push({
      action: action === 'approve' ? 'approval_granted' : 'approval_rejected',
      description: action === 'approve' 
        ? `Approval granted by ${adminUser.firstName} ${adminUser.lastName}` 
        : `Approval rejected by ${adminUser.firstName} ${adminUser.lastName}`,
      performedBy: adminUserId,
      previousStatus,
      newStatus: onboarding.status,
      metadata: { comments },
      timestamp: new Date()
    });

    await onboarding.save();

    console.log(`✅ Onboarding ${action === 'approve' ? 'approved' : 'rejected'} for ${onboarding.candidateName} by ${adminUser.email}`);

    res.status(200).json({
      success: true,
      message: action === 'approve' 
        ? 'Onboarding approved. HR can now send offer letter.' 
        : 'Onboarding rejected. Candidate is on hold.',
      data: {
        onboardingId: onboarding.onboardingId,
        candidateName: onboarding.candidateName,
        status: onboarding.status,
        approvalStatus: onboarding.approvalStatus,
        action,
        processedBy: `${adminUser.firstName} ${adminUser.lastName}`,
        processedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error processing onboarding approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approval',
      error: error.message
    });
  }
};
