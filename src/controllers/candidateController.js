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
    const { round, scheduledDate, interviewer } = req.body;
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    candidate.interviews.push({
      round,
      scheduledDate,
      interviewer,
      status: 'scheduled'
    });

    candidate.stage = 'interview-scheduled';
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
