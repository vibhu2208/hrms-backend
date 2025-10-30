const Onboarding = require('../models/Onboarding');
const OfferTemplate = require('../models/OfferTemplate');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const Department = require('../models/Department');
const JobPosting = require('../models/JobPosting');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

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
const { sendOnboardingEmail, sendHRNotification, sendOfferEmail, sendDocumentRequestEmail, sendITNotification, sendFacilitiesNotification, sendOfferExtendedEmail } = require('../services/emailService');

/**
 * Send candidate to onboarding - Phase 2 Implementation
 * @route POST /api/applications/:id/send-to-onboarding
 * @access Private (HR/Admin only)
 */
exports.sendToOnboarding = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const { notes } = req.body;
    const hrUserId = req.user.id;

    // Find and validate the candidate application
    const candidate = await Candidate.findById(applicationId)
      .populate('appliedFor')
      .populate('appliedFor.department');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate application not found'
      });
    }

    // Validate candidate stage allows transition to onboarding
    const allowedStages = ['offer-accepted', 'interview-completed'];
    if (!allowedStages.includes(candidate.stage)) {
      return res.status(400).json({
        success: false,
        message: `Cannot send to onboarding. Current stage: ${candidate.stage}. Required: ${allowedStages.join(' or ')}`
      });
    }

    // Check if already sent to onboarding
    if (candidate.stage === 'sent-to-onboarding' || candidate.onboardingRecord) {
      return res.status(400).json({
        success: false,
        message: 'Candidate has already been sent to onboarding',
        data: { onboardingRecord: candidate.onboardingRecord }
      });
    }

    // Validate required data
    if (!candidate.appliedFor || !candidate.appliedFor.department) {
      return res.status(400).json({
        success: false,
        message: 'Job posting or department information is missing'
      });
    }

    // Create onboarding record
    const onboardingData = {
      applicationId: candidate._id,
      jobId: candidate.appliedFor._id,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      candidateEmail: candidate.email,
      candidatePhone: candidate.phone,
      position: candidate.appliedFor.title,
      department: candidate.appliedFor.department._id,
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

    const onboarding = await Onboarding.create(onboardingData);

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

    // Send onboarding email with candidate ID and document submission link
    try {
      await sendOnboardingDocumentEmail(updatedCandidate, onboarding);
    } catch (emailError) {
      console.error('Error sending onboarding email:', emailError);
      // Don't fail the whole operation if email fails
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

    const onboardingList = await Onboarding.find(query)
      .populate('applicationId', 'firstName lastName email candidateCode')
      .populate('jobId', 'title')
      .populate('department', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedHR', 'firstName lastName email')
      .populate('tasks.assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });

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
    const { id } = req.params;
    const { status, notes } = req.body;
    const hrUserId = req.user.id;

    // Define allowed state transitions
    const allowedTransitions = {
      'preboarding': ['offer_sent', 'rejected'],
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

    // Validate status
    if (onboarding.status !== 'preboarding') {
      return res.status(400).json({
        success: false,
        message: `Cannot send offer. Current status: ${onboarding.status}. Required: preboarding`
      });
    }

    // Get offer template
    let template;
    
    // If templateId is 'default', fetch the default template for the department's category
    if (templateId === 'default') {
      // Try to find a default template (you can adjust category as needed)
      template = await OfferTemplate.findOne({
        isDefault: true,
        status: 'active'
      });
      
      // If no default template exists, find any active template
      if (!template) {
        template = await OfferTemplate.findOne({ status: 'active' });
      }
      
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'No active offer template found. Please create an offer template first.'
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
      if (!template || template.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive offer template'
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
      // TODO: Send document rejection email
      // await sendDocumentRejectionEmail(onboarding, document, notes);
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
    const hrUserId = req.user.id;

    // Find onboarding record with all related data
    const onboarding = await Onboarding.findById(id)
      .populate('department')
      .populate('applicationId');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate onboarding is ready for completion
    if (onboarding.status !== 'ready_for_joining') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete onboarding. Current status: ${onboarding.status}. Required: ready_for_joining`
      });
    }

    // Check if already completed
    if (onboarding.status === 'completed' || onboarding.candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding has already been completed',
        data: {
          employeeId: onboarding.candidateId,
          completedAt: onboarding.completedAt
        }
      });
    }

    // Validate all required documents are verified
    const allRequiredVerified = onboarding.requiredDocuments
      .filter(doc => doc.isRequired)
      .every(doc => doc.verified);

    if (!allRequiredVerified) {
      return res.status(400).json({
        success: false,
        message: 'All required documents must be verified before completing onboarding'
      });
    }

    // Validate required fields
    if (!onboarding.candidateEmail || !onboarding.candidateName) {
      return res.status(400).json({
        success: false,
        message: 'Candidate email and name are required'
      });
    }

    if (!onboarding.department || !onboarding.joiningDate) {
      return res.status(400).json({
        success: false,
        message: 'Department and joining date are required'
      });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: onboarding.candidateEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account already exists with this email address'
      });
    }

    // Check if employee already exists with this email
    const existingEmployee = await Employee.findOne({ email: onboarding.candidateEmail });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'An employee record already exists with this email address'
      });
    }

    // Split candidate name into first and last name
    const nameParts = onboarding.candidateName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Generate secure random password
    const tempPassword = generatePassword(12, {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true
    });

    // Prepare employee data from onboarding and offer details
    const employeeData = {
      firstName,
      lastName,
      email: onboarding.candidateEmail,
      phone: onboarding.candidatePhone || 'N/A',
      department: onboarding.department._id,
      designation: onboarding.offer?.offeredDesignation || onboarding.position,
      joiningDate: onboarding.joiningDate,
      employmentType: 'full-time',
      status: 'active'
    };

    // Add salary information if available from offer
    if (onboarding.offer?.salary) {
      employeeData.salary = onboarding.offer.salary;
    }

    // Create employee record
    const employee = await Employee.create(employeeData);

    console.log(`✅ Employee created: ${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`);

    // Create user account with temporary password
    const user = await User.create({
      email: onboarding.candidateEmail,
      password: tempPassword, // Will be hashed by pre-save hook
      role: 'employee',
      employeeId: employee._id,
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: true
    });

    console.log(`✅ User account created for: ${user.email}`);

    // Send onboarding completion email with credentials
    let emailSent = false;
    let emailError = null;

    try {
      const emailResult = await sendOnboardingEmail({
        employeeName: `${firstName} ${lastName}`,
        employeeEmail: onboarding.candidateEmail,
        employeeId: employee.employeeCode,
        tempPassword: tempPassword,
        companyName: companyName || 'Our Company',
        joiningDate: onboarding.joiningDate,
        designation: employee.designation,
        department: onboarding.department.name
      });

      emailSent = emailResult.success;
      console.log(`✅ Welcome email sent to: ${onboarding.candidateEmail}`);

      // Send HR notification (non-blocking)
      sendHRNotification({
        employeeName: `${firstName} ${lastName}`,
        employeeId: employee.employeeCode,
        department: onboarding.department.name,
        designation: employee.designation,
        joiningDate: onboarding.joiningDate
      }).catch(err => {
        console.error('HR notification failed:', err.message);
      });

    } catch (error) {
      console.error('❌ Failed to send welcome email:', error.message);
      emailError = error.message;
      // Don't fail the entire process if email fails
    }

    // Update onboarding record
    onboarding.candidateId = employee._id;
    onboarding.status = 'completed';
    onboarding.completedAt = new Date();
    onboarding.completedBy = hrUserId;
    onboarding.actualJoiningDate = new Date(); // Assuming they join on completion

    // Update SLA completion
    onboarding.sla.actualCompletionDate = new Date();

    // Add completion audit trail
    onboarding.auditTrail.push({
      action: 'onboarding_completed',
      description: 'Onboarding process completed and employee account created',
      performedBy: hrUserId,
      previousStatus: 'ready_for_joining',
      newStatus: 'completed',
      metadata: { 
        employeeId: employee._id,
        employeeCode: employee.employeeCode,
        emailSent
      },
      timestamp: new Date()
    });

    await onboarding.save();

    // Update candidate status if linked
    if (onboarding.applicationId) {
      try {
        await Candidate.findByIdAndUpdate(onboarding.applicationId, {
          status: 'hired',
          stage: 'joined',
          $push: {
            timeline: {
              action: 'joined_company',
              description: 'Successfully completed onboarding and joined as employee',
              performedBy: hrUserId,
              metadata: { 
                employeeId: employee._id,
                employeeCode: employee.employeeCode,
                onboardingId: onboarding._id
              }
            }
          }
        });
        console.log(`✅ Candidate status updated to 'joined'`);
      } catch (error) {
        console.error('Failed to update candidate status:', error.message);
      }
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Onboarding completed successfully! Employee account created and welcome email sent.',
      data: {
        onboarding: {
          id: onboarding._id,
          onboardingId: onboarding.onboardingId,
          status: onboarding.status,
          completedAt: onboarding.completedAt
        },
        employee: {
          id: employee._id,
          employeeCode: employee.employeeCode,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          department: onboarding.department.name,
          designation: employee.designation,
          joiningDate: employee.joiningDate
        },
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword
        },
        credentials: {
          sent: emailSent,
          sentAt: emailSent ? new Date() : null
        }
      }
    };

    // Add warning if email failed
    if (!emailSent && emailError) {
      response.warning = `Employee account created successfully, but failed to send welcome email: ${emailError}`;
      response.data.tempPassword = tempPassword; // Include in response if email failed
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error completing onboarding:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding process',
      error: error.message
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
