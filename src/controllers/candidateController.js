const Candidate = require('../models/Candidate');
const Employee = require('../models/Employee');

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
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    candidate.stage = stage;
    await candidate.save();

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
