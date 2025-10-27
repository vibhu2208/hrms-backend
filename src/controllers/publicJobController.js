const JobPosting = require('../models/JobPosting');
const Candidate = require('../models/Candidate');
const { getFileUrl } = require('../middlewares/fileUpload');

// @desc    Get all active public job postings
// @route   GET /api/public/jobs
// @access  Public
exports.getPublicJobs = async (req, res) => {
  try {
    const { department, location, employmentType } = req.query;
    
    // Build query for active jobs only
    let query = { status: 'active' };
    
    if (department) query.department = department;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (employmentType) query.employmentType = employmentType;

    const jobs = await JobPosting.find(query)
      .populate('department', 'name')
      .select('-postedBy -applications -__v')
      .sort({ postedDate: -1 });

    res.status(200).json({ 
      success: true, 
      count: jobs.length, 
      data: jobs 
    });
  } catch (error) {
    console.error('Get public jobs error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job postings' 
    });
  }
};

// @desc    Get single public job posting
// @route   GET /api/public/jobs/:id
// @access  Public
exports.getPublicJob = async (req, res) => {
  try {
    const job = await JobPosting.findOne({ 
      _id: req.params.id, 
      status: 'active' 
    })
      .populate('department', 'name')
      .select('-postedBy -__v');

    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job posting not found or no longer active' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: job 
    });
  } catch (error) {
    console.error('Get public job error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job posting' 
    });
  }
};

// @desc    Submit job application
// @route   POST /api/public/jobs/:id/apply
// @access  Public
exports.submitApplication = async (req, res) => {
  try {
    const jobId = req.params.id;

    // Verify job exists and is active
    console.log('Looking for job with ID:', jobId);
    const job = await JobPosting.findById(jobId);
    console.log('Job found:', job ? { id: job._id, title: job.title, status: job.status } : 'No job found');
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job posting not found' 
      });
    }
    
    if (job.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: `Job posting is ${job.status}, not accepting applications` 
      });
    }

    // Check if candidate already applied for this job
    const existingApplication = await Candidate.findOne({
      email: req.body.email.toLowerCase(),
      appliedFor: jobId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this position'
      });
    }

    // Handle resume file if uploaded
    let resumeData = {};
    if (req.file) {
      resumeData = {
        url: getFileUrl(req.file.filename, 'resume'),
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date()
      };
    }

    // Check if we have the required fields
    if (!req.body.firstName || !req.body.lastName || !req.body.email || !req.body.phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: firstName, lastName, email, phone'
      });
    }

    // Parse JSON fields from FormData
    const parseJsonField = (field) => {
      try {
        if (!field || field === 'undefined' || field === 'null') return [];
        return JSON.parse(field);
      } catch (error) {
        console.error('JSON parse error for field:', field, error);
        return [];
      }
    };

    console.log('Processing application for job:', jobId);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body values sample:', {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      preferredLocation: req.body.preferredLocation,
      skills: req.body.skills
    });
    console.log('Has file:', !!req.file);

    // Create candidate application with only the required fields first
    const candidateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email?.toLowerCase(),
      phone: req.body.phone,
      alternatePhone: req.body.alternatePhone || '',
      currentLocation: req.body.currentLocation || '',
      appliedFor: jobId,
      source: req.body.source || 'job-portal',
      stage: 'applied',
      status: 'active',
      resume: resumeData,
      // Parse JSON fields safely
      preferredLocation: parseJsonField(req.body.preferredLocation),
      skills: parseJsonField(req.body.skills),
      education: parseJsonField(req.body.education),
      professionalExperience: parseJsonField(req.body.professionalExperience),
      // Handle experience object
      experience: {
        years: parseInt(req.body['experience[years]']) || 0,
        months: parseInt(req.body['experience[months]']) || 0
      },
      // Optional fields
      currentCompany: req.body.currentCompany || '',
      currentDesignation: req.body.currentDesignation || '',
      currentCTC: req.body.currentCTC ? parseFloat(req.body.currentCTC) : undefined,
      expectedCTC: req.body.expectedCTC ? parseFloat(req.body.expectedCTC) : undefined,
      noticePeriod: req.body.noticePeriod ? parseInt(req.body.noticePeriod) : undefined,
      timeline: [{
        action: 'Application Submitted',
        description: `Applied for ${job.title}`,
        timestamp: new Date()
      }]
    };

    console.log('Candidate data prepared:', {
      firstName: candidateData.firstName,
      lastName: candidateData.lastName,
      email: candidateData.email,
      appliedFor: candidateData.appliedFor
    });

    const candidate = await Candidate.create(candidateData);

    // Increment application count on job posting
    await JobPosting.findByIdAndUpdate(jobId, {
      $inc: { applications: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully! We will review your application and get back to you soon.',
      data: {
        candidateCode: candidate.candidateCode,
        appliedFor: job.title,
        email: candidate.email
      }
    });
  } catch (error) {
    console.error('Submit application error:', error);
    console.error('Request body:', req.body);
    console.error('Request file:', req.file);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      console.error('Validation errors:', messages);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    // Handle cast errors (invalid ObjectId)
    if (error.name === 'CastError') {
      console.error('Cast error:', error.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format'
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit application. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get job statistics for public display
// @route   GET /api/public/jobs/stats
// @access  Public
exports.getJobStats = async (req, res) => {
  try {
    const totalJobs = await JobPosting.countDocuments({ status: 'active' });
    
    const departmentStats = await JobPosting.aggregate([
      { $match: { status: 'active' } },
      { 
        $group: { 
          _id: '$department', 
          count: { $sum: 1 } 
        } 
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $project: {
          department: { $arrayElemAt: ['$departmentInfo.name', 0] },
          count: 1
        }
      }
    ]);

    const locationStats = await JobPosting.aggregate([
      { $match: { status: 'active' } },
      { 
        $group: { 
          _id: '$location', 
          count: { $sum: 1 } 
        } 
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalJobs,
        byDepartment: departmentStats,
        byLocation: locationStats
      }
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job statistics' 
    });
  }
};

module.exports = exports;
