const { getTenantModel } = require('../utils/tenantModels');
const { 
  sendInterviewNotification,
  sendApplicationReceivedEmail,
  sendShortlistedEmail,
  sendInterviewCompletedEmail,
  sendOfferExtendedEmail,
  sendRejectionEmail
} = require('../services/emailService');

exports.getCandidates = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const { stage, status, source, search } = req.query;
    let query = {};

    if (stage) query.stage = stage;
    if (status) query.status = status;
    if (source) query.source = source;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { candidateCode: { $regex: search, $options: 'i' } }
      ];
    }

    const candidates = await Candidate.find(query)
      .populate('appliedFor', 'title department')
      .populate('referredBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: candidates.length, data: candidates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCandidate = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const candidate = await Candidate.findById(req.params.id)
      .populate('appliedFor')
      .populate('referredBy')
      .populate('interviews.interviewer', 'firstName lastName');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    res.status(200).json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCandidate = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const candidate = await Candidate.create(req.body);
    
    // Send application received email
    if (candidate.email) {
      await candidate.populate('appliedFor', 'title');
      
      sendApplicationReceivedEmail({
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateEmail: candidate.email,
        position: candidate.appliedFor?.title || 'Position',
        companyName: req.body.companyName || 'Our Company'
      }).catch(err => console.error('Failed to send application email:', err.message));
    }
    
    res.status(201).json({ success: true, message: 'Candidate created successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCandidate = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    res.status(200).json({ success: true, message: 'Candidate updated successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStage = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { stage } = req.body;
    const candidate = await Candidate.findById(req.params.id).populate('appliedFor');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const previousStage = candidate.stage;
    candidate.stage = stage;
    await candidate.save();

    // Send emails based on stage change
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const position = candidate.appliedFor?.title || 'Position';
    const companyName = req.body.companyName || 'Our Company';

    // Send shortlisted email
    if (stage === 'shortlisted' && previousStage !== 'shortlisted') {
      sendShortlistedEmail({
        candidateName,
        candidateEmail: candidate.email,
        position,
        companyName
      }).catch(err => console.error('Failed to send shortlisted email:', err.message));
    }

    // Send offer extended email
    if (stage === 'offer-extended' && previousStage !== 'offer-extended') {
      sendOfferExtendedEmail({
        candidateName,
        candidateEmail: candidate.email,
        position,
        joiningDate: candidate.offerDetails?.joiningDate,
        companyName
      }).catch(err => console.error('Failed to send offer email:', err.message));
    }

    // Send rejection email
    if (stage === 'rejected' && previousStage !== 'rejected') {
      sendRejectionEmail({
        candidateName,
        candidateEmail: candidate.email,
        position,
        companyName
      }).catch(err => console.error('Failed to send rejection email:', err.message));
    }

    // Automatically create onboarding when candidate is shortlisted
    if (stage === 'shortlisted' && previousStage !== 'shortlisted') {
      // Check if already in onboarding
      const existingOnboarding = await Onboarding.findOne({ candidateEmail: candidate.email });
      
      if (!existingOnboarding) {
        try {
          // Create onboarding record
          await Onboarding.create({
            candidateName: `${candidate.firstName} ${candidate.lastName}`,
            candidateEmail: candidate.email,
            candidatePhone: candidate.phone,
            position: candidate.appliedFor?.title || candidate.currentDesignation || 'Position',
            department: candidate.appliedFor?.department,
            joiningDate: candidate.offerDetails?.joiningDate,
            stages: ['interview1', 'hrDiscussion', 'documentation', 'success'],
            currentStage: 'interview1',
            status: 'in-progress',
            notes: `Auto-created from recruitment. Applied for: ${candidate.appliedFor?.title || 'N/A'}`
          });
        } catch (onboardingError) { }
      }
    }

    res.status(200).json({ success: true, message: 'Stage updated successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const { interviewType, round, scheduledDate, scheduledTime, meetingLink, meetingPlatform, interviewer } = req.body;
    const candidate = await Candidate.findById(req.params.id)
      .populate('appliedFor', 'title')
      .populate('interviews.interviewer', 'firstName lastName');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Validation: Email must be sent before scheduling interview
    if (!candidate.notifications?.interviewEmail?.sent) {
      return res.status(400).json({ 
        success: false, 
        message: 'Interview notification email must be sent before scheduling an interview' 
      });
    }

    const interviewData = {
      interviewType: interviewType || 'Technical',
      round,
      scheduledDate,
      scheduledTime,
      meetingLink,
      meetingPlatform: meetingPlatform || 'Google Meet',
      interviewer: Array.isArray(interviewer) ? interviewer : [interviewer],
      status: 'scheduled'
    };

    candidate.interviews.push(interviewData);
    candidate.stage = 'interview-scheduled';
    
    // Add to timeline
    candidate.timeline.push({
      action: 'Interview Scheduled',
      description: `${interviewType || 'Technical'} interview scheduled for ${new Date(scheduledDate).toLocaleDateString()}`,
      performedBy: req.user?._id,
      metadata: { interviewType, round, scheduledDate }
    });

    await candidate.save();

    // Send interview notification email automatically
    const newInterview = candidate.interviews[candidate.interviews.length - 1];
    const companyName = req.body.companyName || 'TechThrive System';
    
    try {
      await sendInterviewNotification({
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateEmail: candidate.email,
        interviewType: interviewType || 'Technical',
        interviewDate: scheduledDate,
        interviewTime: scheduledTime,
        meetingLink: meetingLink,
        meetingPlatform: meetingPlatform || 'Google Meet',
        interviewerName: null, // Will be populated if interviewer data available
        position: candidate.appliedFor?.title || 'Position',
        companyName: companyName
      });
      
      // Update notification tracking
      candidate.timeline.push({
        action: 'Interview Email Sent',
        description: `Interview notification email sent for ${interviewType || 'Technical'} interview`,
        performedBy: req.user?._id,
        metadata: { 
          interviewId: newInterview._id,
          emailSent: true
        }
      });
      
      await candidate.save();
    } catch (emailError) {
      console.error('Failed to send interview notification email:', emailError);
      // Don't fail the interview scheduling if email fails
    }

    res.status(200).json({ success: true, message: 'Interview scheduled successfully and notification sent', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.convertToEmployee = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const Employee = getTenantModel(req.tenant.connection, 'Employee');
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (candidate.stage !== 'joined') {
      return res.status(400).json({ success: false, message: 'Candidate has not joined yet' });
    }

    // Create employee from candidate data
    const employeeData = {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      designation: candidate.offerDetails.offeredDesignation,
      joiningDate: candidate.offerDetails.joiningDate,
      education: candidate.education,
      salary: {
        total: candidate.offerDetails.offeredCTC
      }
    };

    const employee = await Employee.create(employeeData);

    // Update candidate status
    candidate.status = 'hired';
    await candidate.save();

    res.status(201).json({ 
      success: true, 
      message: 'Candidate converted to employee successfully', 
      data: employee 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moveToOnboarding = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const CandidateDocumentUploadToken = getTenantModel(req.tenant.connection, 'CandidateDocumentUploadToken');
    const candidate = await Candidate.findById(req.params.id).populate('appliedFor');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Validate required fields
    if (!candidate.appliedFor || !candidate.appliedFor._id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Candidate must have an associated job posting to move to onboarding' 
      });
    }

    if (!candidate.appliedFor.department) {
      return res.status(400).json({ 
        success: false, 
        message: 'Job posting must have an associated department' 
      });
    }

    // Check if candidate is shortlisted or offer-accepted
    if (!['shortlisted', 'offer-accepted', 'offer-extended', 'active'].includes(candidate.stage)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only shortlisted or offer-accepted candidates can be moved to onboarding' 
      });
    }

    // Check if already in onboarding - if exists and not completed, update it instead
    let existingOnboarding = await Onboarding.findOne({ candidateEmail: candidate.email });
    let onboarding;
    
    if (existingOnboarding) {
      // If onboarding exists but is not completed, update it
      if (existingOnboarding.status === 'completed') {
        return res.status(400).json({ 
          success: false, 
          message: 'Candidate has already completed onboarding' 
        });
      }
      
      // Update existing onboarding record
      console.log(`♻️ Updating existing onboarding record for ${candidate.email}`);
      existingOnboarding.applicationId = candidate._id;
      existingOnboarding.jobId = candidate.appliedFor._id;
      existingOnboarding.candidateName = `${candidate.firstName} ${candidate.lastName}`;
      existingOnboarding.candidatePhone = candidate.phone;
      existingOnboarding.position = candidate.appliedFor.title || 'Position';
      existingOnboarding.department = candidate.appliedFor.department;
      existingOnboarding.joiningDate = candidate.offerDetails?.joiningDate || req.body.joiningDate;
      existingOnboarding.status = 'preboarding';
      existingOnboarding.createdBy = req.user._id;
      existingOnboarding.assignedHR = req.user._id;
      
      // Add audit trail entry
      if (!existingOnboarding.auditTrail) existingOnboarding.auditTrail = [];
      existingOnboarding.auditTrail.push({
        action: 'reinitialized',
        description: 'Onboarding record reinitialized from recruitment',
        performedBy: req.user._id,
        previousStatus: existingOnboarding.status,
        newStatus: 'preboarding',
        metadata: { notes: 'Re-moved from recruitment' },
        timestamp: new Date()
      });
      
      await existingOnboarding.save();
      onboarding = existingOnboarding;
    } else {
      // Create new onboarding record with correct schema fields
      onboarding = await Onboarding.create({
      applicationId: candidate._id,
      jobId: candidate.appliedFor._id,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      candidateEmail: candidate.email,
      candidatePhone: candidate.phone,
      position: candidate.appliedFor.title || 'Position',
      department: candidate.appliedFor.department,
      joiningDate: candidate.offerDetails?.joiningDate || req.body.joiningDate,
      status: 'preboarding',
      createdBy: req.user._id,
      assignedHR: req.user._id,
      requiredDocuments: [
        { type: 'aadhar', isRequired: true },
        { type: 'pan', isRequired: true },
        { type: 'bank_details', isRequired: true },
        { type: 'address_proof', isRequired: true },
        { type: 'education_certificates', isRequired: true },
        { type: 'photo', isRequired: true }
      ],
      auditTrail: [{
        action: 'moved_to_onboarding',
        description: 'Candidate moved to onboarding from recruitment',
        performedBy: req.user._id,
        previousStatus: candidate.stage,
        newStatus: 'preboarding',
        metadata: { notes: `Moved from recruitment. Applied for: ${candidate.appliedFor?.title || 'N/A'}` },
        timestamp: new Date()
      }],
      sla: {
        expectedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    }

    // Auto-generate document upload token
    const { sendOfferLetterWithDocumentLink } = require('../services/emailService');
    let uploadUrl = null;
    
    if (CandidateDocumentUploadToken) {
      try {
        const token = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const uploadToken = await CandidateDocumentUploadToken.create({
          onboardingId: onboarding._id,
          candidateId: onboarding.onboardingId,
          candidateName: onboarding.candidateName,
          candidateEmail: onboarding.candidateEmail,
          position: onboarding.position,
          token,
          expiresAt,
          generatedBy: req.user._id
        });

        const tenantId = req.tenant.companyId || req.tenant.clientId;
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        uploadUrl = `${frontendBaseUrl}/public/upload-documents/${token}?tenantId=${tenantId}`;
        console.log(`✅ Upload token generated for ${onboarding.candidateName}: ${uploadUrl}`);

        // Send offer letter with document upload link
        await sendOfferLetterWithDocumentLink({
          candidateName: onboarding.candidateName,
          candidateEmail: onboarding.candidateEmail,
          position: onboarding.position,
          joiningDate: onboarding.joiningDate,
          uploadUrl,
          companyName: req.tenant?.companyName || 'Our Company'
        });
        console.log(`📧 Offer letter with document link sent to ${onboarding.candidateEmail}`);
      } catch (tokenError) {
        console.error('Error generating upload token:', tokenError);
      }
    }

    // Update candidate stage
    candidate.stage = 'sent-to-onboarding';
    candidate.onboardingRecord = onboarding._id;
    candidate.sentToOnboardingAt = new Date();
    candidate.sentToOnboardingBy = req.user._id;
    await candidate.save();

    res.status(201).json({ 
      success: true, 
      message: 'Candidate moved to onboarding successfully', 
      data: onboarding,
      uploadUrl 
    });
  } catch (error) {
    console.error('Error moving candidate to onboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCandidate = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    res.status(200).json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update interview feedback
exports.updateInterviewFeedback = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const { candidateId, interviewId } = req.params;
    const { feedback, rating, decision, notes, status } = req.body;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const interview = candidate.interviews.id(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    // Update interview details
    if (feedback !== undefined) interview.feedback = feedback;
    if (rating !== undefined) interview.rating = rating;
    if (decision !== undefined) interview.decision = decision;
    if (notes !== undefined) interview.notes = notes;
    if (status !== undefined) {
      interview.status = status;
      if (status === 'completed') {
        interview.completedAt = new Date();
        candidate.stage = 'interview-completed';
        
        // Send interview completed email
        await candidate.populate('appliedFor', 'title');
        sendInterviewCompletedEmail({
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          candidateEmail: candidate.email,
          interviewType: interview.interviewType || 'Interview',
          position: candidate.appliedFor?.title || 'Position',
          companyName: req.body.companyName || 'Our Company'
        }).catch(err => console.error('Failed to send interview completed email:', err.message));
      }
    }

    // Add to timeline
    candidate.timeline.push({
      action: 'Interview Feedback Added',
      description: `Feedback submitted for ${interview.interviewType} interview - Decision: ${decision || 'Pending'}`,
      performedBy: req.user?._id,
      metadata: { interviewId, rating, decision }
    });

    await candidate.save();
    res.status(200).json({ success: true, message: 'Interview feedback updated successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send notification (Email/Call)
exports.sendNotification = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const { id } = req.params;
    const { type, notes } = req.body; // type: 'interviewEmail', 'interviewCall', 'offerEmail', 'rejectionEmail'

    const candidate = await Candidate.findById(id).populate('appliedFor', 'title');
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (!candidate.notifications) {
      candidate.notifications = {};
    }

    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const position = candidate.appliedFor?.title || 'Position';
    const companyName = req.body.companyName || 'TechThrive System';

    // Update notification status
    if (type === 'interviewEmail') {
      // Send shortlisted email
      try {
        await sendShortlistedEmail({
          candidateName,
          candidateEmail: candidate.email,
          position,
          companyName
        });
        
        candidate.notifications.interviewEmail = {
          sent: true,
          sentAt: new Date(),
          sentBy: req.user?._id
        };
        candidate.timeline.push({
          action: 'Shortlisted Email Sent',
          description: 'Shortlisted notification email sent to candidate',
          performedBy: req.user?._id
        });
      } catch (emailError) {
        console.error('Failed to send shortlisted email:', emailError);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to send email notification',
          error: emailError.message 
        });
      }
    } else if (type === 'interviewCall') {
      candidate.notifications.interviewCall = {
        completed: true,
        completedAt: new Date(),
        completedBy: req.user?._id,
        notes: notes || ''
      };
      candidate.timeline.push({
        action: 'Interview Call Completed',
        description: 'Interview notification call completed',
        performedBy: req.user?._id,
        metadata: { notes }
      });
    } else if (type === 'offerEmail') {
      candidate.notifications.offerEmail = {
        sent: true,
        sentAt: new Date(),
        sentBy: req.user?._id
      };
      candidate.timeline.push({
        action: 'Offer Email Sent',
        description: 'Offer letter sent to candidate',
        performedBy: req.user?._id
      });
    } else if (type === 'rejectionEmail') {
      candidate.notifications.rejectionEmail = {
        sent: true,
        sentAt: new Date(),
        sentBy: req.user?._id
      };
      candidate.timeline.push({
        action: 'Rejection Email Sent',
        description: 'Rejection notification sent to candidate',
        performedBy: req.user?._id
      });
    }

    await candidate.save();
    res.status(200).json({ success: true, message: 'Notification sent successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update HR Call
exports.updateHRCall = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const Onboarding = getTenantModel(req.tenant.connection, 'Onboarding');
    const { id } = req.params;
    const { status, scheduledDate, completedDate, summary, decision } = req.body;

    console.log(`📞 updateHRCall called for candidate ${id}`);
    console.log(`   Status: ${status}, Decision: ${decision}`);
    console.log(`   Request body:`, req.body);

    const candidate = await Candidate.findById(id).populate('appliedFor', 'title department');
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Validation: At least one interview must be completed with feedback before HR call
    const hasCompletedInterview = candidate.interviews?.some(
      interview => interview.status === 'completed' && interview.feedback && interview.rating
    );
    
    if (!hasCompletedInterview && status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one interview must be completed with feedback before conducting HR call' 
      });
    }

    if (!candidate.hrCall) {
      candidate.hrCall = {};
    }

    // Update HR call details
    if (status !== undefined) candidate.hrCall.status = status;
    if (scheduledDate !== undefined) candidate.hrCall.scheduledDate = scheduledDate;
    if (completedDate !== undefined) candidate.hrCall.completedDate = completedDate;
    if (summary !== undefined) candidate.hrCall.summary = summary;
    if (decision !== undefined) candidate.hrCall.decision = decision;
    candidate.hrCall.conductedBy = req.user?._id;

    // Add to timeline
    let timelineDesc = 'HR call updated';
    if (status === 'completed') {
      timelineDesc = `HR call completed - Decision: ${decision || 'Pending'}`;
    } else if (status === 'scheduled') {
      timelineDesc = `HR call scheduled for ${new Date(scheduledDate).toLocaleDateString()}`;
    }

    candidate.timeline.push({
      action: 'HR Call Updated',
      description: timelineDesc,
      performedBy: req.user?._id,
      metadata: { status, decision }
    });

    // Handle decision outcomes and send emails
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const position = candidate.appliedFor?.title || 'Position';
    const companyName = req.body.companyName || 'TechThrive System';

    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : status;
    const normalizedDecision = typeof decision === 'string' ? decision.trim().toLowerCase() : decision;

    const onboardingDecisionTriggers = ['selected', 'move-to-onboarding'];

    console.log(`🔍 Checking automatic onboarding condition:`);
    console.log(`   status === 'completed': ${normalizedStatus === 'completed'} (actual: '${normalizedStatus}')`);
    console.log(`   decision triggers onboarding: ${onboardingDecisionTriggers.includes(normalizedDecision)} (actual: '${normalizedDecision}')`);
    console.log(`   Both conditions: ${normalizedStatus === 'completed' && onboardingDecisionTriggers.includes(normalizedDecision)}`);

    // Automatically move to onboarding when HR call is completed with a final positive decision
    if (normalizedStatus === 'completed' && onboardingDecisionTriggers.includes(normalizedDecision)) {
      console.log(`🎯 HR call completed with 'selected' decision for ${candidateName}`);
      console.log(`   Candidate ID: ${candidate._id}`);
      console.log(`   Applied For: ${candidate.appliedFor?._id}`);
      console.log(`   Department: ${candidate.appliedFor?.department}`);
      
      candidate.stage = 'sent-to-onboarding';
      
      // Send offer extended email
      try {
        await sendOfferExtendedEmail({
          candidateName,
          candidateEmail: candidate.email,
          position,
          joiningDate: candidate.offerDetails?.joiningDate,
          companyName
        });
        
        candidate.timeline.push({
          action: 'Offer Email Sent',
          description: 'Offer letter email sent to candidate after HR call completion',
          performedBy: req.user?._id
        });
      } catch (emailError) {
        console.error('Failed to send offer email:', emailError);
      }
      
      // Automatically create onboarding record
      console.log(`🔍 Checking for existing onboarding record for ${candidate.email}...`);
      const existingOnboarding = await Onboarding.findOne({ 
        $or: [
          { candidateEmail: candidate.email },
          { applicationId: candidate._id }
        ]
      });
      
      if (existingOnboarding) {
        console.log(`♻️ Existing onboarding found (${existingOnboarding._id}). Updating/linking it...`);
        try {
          if (existingOnboarding.status !== 'completed') {
            existingOnboarding.applicationId = candidate._id;
            existingOnboarding.jobId = candidate.appliedFor?._id;
            existingOnboarding.candidateName = `${candidate.firstName} ${candidate.lastName}`;
            existingOnboarding.candidateEmail = candidate.email;
            existingOnboarding.candidatePhone = candidate.phone;
            existingOnboarding.position = candidate.appliedFor?.title || candidate.currentDesignation || 'Position';
            existingOnboarding.department = candidate.appliedFor?.department;
            existingOnboarding.status = 'preboarding';
            await existingOnboarding.save();
          }

          candidate.onboardingRecord = existingOnboarding._id;
          candidate.sentToOnboardingAt = candidate.sentToOnboardingAt || new Date();
          candidate.sentToOnboardingBy = candidate.sentToOnboardingBy || req.user?._id;
        } catch (updateExistingError) {
          console.error('❌ Failed to update/link existing onboarding:', updateExistingError.message);
        }
      } else {
        console.log(`✅ No existing onboarding found. Creating new onboarding record...`);
        try {
          // Validate required fields before creating onboarding
          if (!candidate.appliedFor || !candidate.appliedFor._id) {
            console.error('❌ Cannot create onboarding: Missing job posting');
            console.error('   Candidate appliedFor:', candidate.appliedFor);
            throw new Error('Job posting is required for onboarding');
          }
          
          if (!candidate.appliedFor.department) {
            console.error('❌ Cannot create onboarding: Missing department');
            console.error('   Job posting department:', candidate.appliedFor.department);
            throw new Error('Department is required for onboarding');
          }
          
          console.log(`✅ Validation passed. Creating onboarding with:`);
          console.log(`   ApplicationId: ${candidate._id}`);
          console.log(`   JobId: ${candidate.appliedFor._id}`);
          console.log(`   Department: ${candidate.appliedFor.department}`);
          
          const onboardingData = {
            applicationId: candidate._id,
            jobId: candidate.appliedFor._id,
            candidateName: `${candidate.firstName} ${candidate.lastName}`,
            candidateEmail: candidate.email,
            candidatePhone: candidate.phone,
            position: candidate.appliedFor.title || 'Position',
            department: candidate.appliedFor.department,
            status: 'preboarding',
            createdBy: req.user?._id,
            assignedHR: req.user?._id,
            requiredDocuments: [
              { type: 'aadhar', isRequired: true },
              { type: 'pan', isRequired: true },
              { type: 'bank_details', isRequired: true },
              { type: 'address_proof', isRequired: true },
              { type: 'education_certificates', isRequired: true },
              { type: 'photo', isRequired: true }
            ],
            auditTrail: [{
              action: 'auto_created',
              description: 'Automatically created from HR call completion',
              performedBy: req.user?._id,
              previousStatus: candidate.stage,
              newStatus: 'preboarding',
              metadata: { notes: `Auto-created from HR call completion. Decision: Selected` },
              timestamp: new Date()
            }],
            sla: {
              expectedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          };
          
          const onboarding = await Onboarding.create(onboardingData);
          console.log(`✅ Onboarding record created: ${onboarding._id}`);
          
          // Auto-generate document upload token
          const CandidateDocumentUploadToken = getTenantModel(req.tenant.connection, 'CandidateDocumentUploadToken');
          const { sendOfferLetterWithDocumentLink } = require('../services/emailService');
          
          if (CandidateDocumentUploadToken) {
            try {
              const token = require('crypto').randomBytes(32).toString('hex');
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);

              await CandidateDocumentUploadToken.create({
                onboardingId: onboarding._id,
                candidateId: onboarding.onboardingId,
                candidateName: onboarding.candidateName,
                candidateEmail: onboarding.candidateEmail,
                position: onboarding.position,
                token,
                expiresAt,
                generatedBy: req.user?._id
              });

              const tenantId = req.tenant.companyId || req.tenant.clientId;
              const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
              const uploadUrl = `${frontendBaseUrl}/public/upload-documents/${token}?tenantId=${tenantId}`;
              console.log(`✅ Upload token generated: ${uploadUrl}`);

              // Send offer letter with document upload link
              await sendOfferLetterWithDocumentLink({
                candidateName: onboarding.candidateName,
                candidateEmail: onboarding.candidateEmail,
                position: onboarding.position,
                joiningDate: onboarding.joiningDate,
                uploadUrl,
                companyName: req.tenant?.companyName || companyName
              });
              console.log(`📧 Offer letter with document link sent to ${onboarding.candidateEmail}`);
            } catch (tokenError) {
              console.error('Error generating upload token:', tokenError);
            }
          }
          
          // Link onboarding record to candidate
          candidate.onboardingRecord = onboarding._id;
          candidate.sentToOnboardingAt = new Date();
          candidate.sentToOnboardingBy = req.user?._id;
          
          // Add to timeline
          candidate.timeline.push({
            action: 'Automatically Moved to Onboarding',
            description: `Candidate automatically moved to onboarding after HR call completion with 'selected' decision`,
            performedBy: req.user?._id,
            metadata: { onboardingId: onboarding._id, onboardingStatus: 'preboarding' }
          });
          
          console.log(`✅ Candidate ${candidate.candidateCode} automatically moved to onboarding (ID: ${onboarding.onboardingId})`);
        } catch (onboardingError) {
          console.error('❌ Failed to create onboarding:', onboardingError.message);
          // Don't fail the HR call update if onboarding creation fails
        }
      }
    } else if (normalizedDecision === 'move-to-onboarding') {
      // Legacy support for manual move-to-onboarding decision
      candidate.stage = 'sent-to-onboarding';
      
      try {
        await sendOfferExtendedEmail({
          candidateName,
          candidateEmail: candidate.email,
          position,
          joiningDate: candidate.offerDetails?.joiningDate,
          companyName
        });
        
        candidate.timeline.push({
          action: 'Offer Email Sent',
          description: 'Offer letter email sent to candidate',
          performedBy: req.user?._id
        });
      } catch (emailError) {
        console.error('Failed to send offer email:', emailError);
      }
    } else if (normalizedDecision === 'reject') {
      candidate.stage = 'rejected';
      candidate.status = 'rejected';
      
      // Send rejection email
      try {
        await sendRejectionEmail({
          candidateName,
          candidateEmail: candidate.email,
          position,
          companyName
        });
        
        candidate.timeline.push({
          action: 'Rejection Email Sent',
          description: 'Rejection notification sent to candidate',
          performedBy: req.user?._id
        });
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }
    }

    await candidate.save();
    res.status(200).json({ success: true, message: 'HR call updated successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get candidate timeline
exports.getCandidateTimeline = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const candidate = await Candidate.findById(req.params.id)
      .populate('timeline.performedBy', 'firstName lastName')
      .populate('interviews.interviewer', 'firstName lastName');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    res.status(200).json({ 
      success: true, 
      data: {
        timeline: candidate.timeline,
        interviews: candidate.interviews,
        notifications: candidate.notifications,
        hrCall: candidate.hrCall,
        stage: candidate.stage,
        status: candidate.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send interview notification email to candidate
 * @route POST /api/candidates/:id/send-interview-email
 * @access Private (HR/Admin)
 */
exports.sendInterviewEmail = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const { id } = req.params;
    const { interviewId, companyName } = req.body;

    // Find candidate and populate job details
    const candidate = await Candidate.findById(id)
      .populate('appliedFor', 'title')
      .populate('interviews.interviewer', 'firstName lastName');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Find the specific interview
    const interview = candidate.interviews.id(interviewId);
    
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check if interview is scheduled
    if (interview.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Interview must be in scheduled status to send notification'
      });
    }

    // Prepare interviewer name
    const interviewerName = interview.interviewer && interview.interviewer.length > 0
      ? interview.interviewer.map(i => `${i.firstName} ${i.lastName}`).join(', ')
      : null;

    // Send email
    try {
      const emailResult = await sendInterviewNotification({
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateEmail: candidate.email,
        interviewType: interview.interviewType || 'Interview',
        interviewDate: interview.scheduledDate,
        interviewTime: interview.scheduledTime,
        meetingLink: interview.meetingLink,
        meetingPlatform: interview.meetingPlatform,
        interviewerName: interviewerName,
        position: candidate.appliedFor?.title || 'Position',
        companyName: companyName || 'Our Company'
      });

      // Update notification status
      if (!candidate.notifications) {
        candidate.notifications = {};
      }
      if (!candidate.notifications.interviewEmail) {
        candidate.notifications.interviewEmail = {};
      }
      
      candidate.notifications.interviewEmail.sent = true;
      candidate.notifications.interviewEmail.sentAt = new Date();
      candidate.notifications.interviewEmail.sentBy = req.user?._id;

      // Add to timeline
      candidate.timeline.push({
        action: 'Interview Email Sent',
        description: `Interview notification email sent for ${interview.interviewType} interview`,
        performedBy: req.user?._id,
        metadata: { 
          interviewId: interview._id,
          emailSent: true,
          messageId: emailResult.messageId
        }
      });

      await candidate.save();

      res.status(200).json({
        success: true,
        message: 'Interview notification email sent successfully',
        data: {
          emailSent: true,
          recipient: candidate.email,
          messageId: emailResult.messageId,
          interview: {
            type: interview.interviewType,
            date: interview.scheduledDate,
            time: interview.scheduledTime
          }
        }
      });

    } catch (emailError) {
      console.error('Failed to send interview email:', emailError);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send interview notification email',
        error: emailError.message
      });
    }

  } catch (error) {
    console.error('Error in sendInterviewEmail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process interview email request',
      error: error.message
    });
  }
};
