const Candidate = require('../models/Candidate');
const Employee = require('../models/Employee');
const Onboarding = require('../models/Onboarding');

exports.getCandidates = async (req, res) => {
  try {
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
    const candidate = await Candidate.create(req.body);
    res.status(201).json({ success: true, message: 'Candidate created successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCandidate = async (req, res) => {
  try {
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
    const { stage } = req.body;
    const candidate = await Candidate.findById(req.params.id).populate('appliedFor');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const previousStage = candidate.stage;
    candidate.stage = stage;
    await candidate.save();

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

          console.log(`✅ Onboarding created automatically for ${candidate.firstName} ${candidate.lastName}`);
        } catch (onboardingError) {
          console.error('Error creating onboarding:', onboardingError.message);
          // Don't fail the stage update if onboarding creation fails
        }
      }
    }

    res.status(200).json({ success: true, message: 'Stage updated successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    const { interviewType, round, scheduledDate, scheduledTime, meetingLink, meetingPlatform, interviewer } = req.body;
    const candidate = await Candidate.findById(req.params.id);

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

    res.status(200).json({ success: true, message: 'Interview scheduled successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.convertToEmployee = async (req, res) => {
  try {
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
    const candidate = await Candidate.findById(req.params.id).populate('appliedFor');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Check if candidate is shortlisted or offer-accepted
    if (!['shortlisted', 'offer-accepted', 'offer-extended'].includes(candidate.stage)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only shortlisted or offer-accepted candidates can be moved to onboarding' 
      });
    }

    // Check if already in onboarding
    const existingOnboarding = await Onboarding.findOne({ candidateEmail: candidate.email });
    if (existingOnboarding) {
      return res.status(400).json({ 
        success: false, 
        message: 'Candidate is already in onboarding process' 
      });
    }

    // Create onboarding record
    const onboarding = await Onboarding.create({
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      candidateEmail: candidate.email,
      candidatePhone: candidate.phone,
      position: candidate.appliedFor?.title || candidate.currentDesignation || 'Position',
      department: candidate.appliedFor?.department,
      joiningDate: candidate.offerDetails?.joiningDate || req.body.joiningDate,
      stages: ['interview1', 'hrDiscussion', 'documentation', 'success'],
      currentStage: 'interview1',
      status: 'in-progress',
      notes: `Moved from recruitment. Applied for: ${candidate.appliedFor?.title || 'N/A'}`
    });

    // Update candidate stage
    candidate.stage = 'joined';
    candidate.status = 'active';
    await candidate.save();

    res.status(201).json({ 
      success: true, 
      message: 'Candidate moved to onboarding successfully', 
      data: onboarding 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCandidate = async (req, res) => {
  try {
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
    const { id } = req.params;
    const { type, notes } = req.body; // type: 'interviewEmail', 'interviewCall', 'offerEmail', 'rejectionEmail'

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (!candidate.notifications) {
      candidate.notifications = {};
    }

    // Update notification status
    if (type === 'interviewEmail') {
      candidate.notifications.interviewEmail = {
        sent: true,
        sentAt: new Date(),
        sentBy: req.user?._id
      };
      candidate.timeline.push({
        action: 'Interview Email Sent',
        description: 'Interview notification email sent to candidate',
        performedBy: req.user?._id
      });
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
    const { id } = req.params;
    const { status, scheduledDate, completedDate, summary, decision } = req.body;

    const candidate = await Candidate.findById(id);
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

    // Handle decision outcomes
    if (decision === 'move-to-onboarding') {
      candidate.stage = 'offer-accepted';
    } else if (decision === 'reject') {
      candidate.stage = 'rejected';
      candidate.status = 'rejected';
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
