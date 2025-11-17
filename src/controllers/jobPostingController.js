const { getTenantModel } = require('../utils/tenantModels');

exports.getJobPostings = async (req, res) => {
  try {
    // Get tenant-specific models
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    
    const { status, department } = req.query;
    let query = {};

    if (status) query.status = status;
    if (department) query.department = department;

    const jobs = await JobPosting.find(query)
      .populate('department', 'name code')
      .populate('postedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobPosting = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const job = await JobPosting.findById(req.params.id)
      .populate('department')
      .populate('postedBy');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createJobPosting = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    req.body.postedBy = req.user.employeeId;
    const job = await JobPosting.create(req.body);
    res.status(201).json({ success: true, message: 'Job posting created successfully', data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateJobPosting = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const job = await JobPosting.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }
    res.status(200).json({ success: true, message: 'Job posting updated successfully', data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.publishJobPosting = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const job = await JobPosting.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    job.status = 'active';
    job.postedDate = Date.now();
    await job.save();

    res.status(200).json({ success: true, message: 'Job posting published successfully', data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.closeJobPosting = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const job = await JobPosting.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    job.status = 'closed';
    await job.save();

    res.status(200).json({ success: true, message: 'Job posting closed successfully', data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const { status } = req.body;
    
    if (!['draft', 'active', 'closed', 'on-hold', 'archived'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be one of: draft, active, closed, on-hold, archived' 
      });
    }

    const job = await JobPosting.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    job.status = status;
    
    // Set postedDate when status changes to active
    if (status === 'active' && !job.postedDate) {
      job.postedDate = Date.now();
    }
    
    await job.save();

    res.status(200).json({ 
      success: true, 
      message: `Job status updated to ${status} successfully`, 
      data: job 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteJobPosting = async (req, res) => {
  try {
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const job = await JobPosting.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }
    res.status(200).json({ success: true, message: 'Job posting deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobApplicants = async (req, res) => {
  try {
    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const { id } = req.params;
    const { stage, status, search } = req.query;

    // Verify job posting exists
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const job = await JobPosting.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    // Build query for candidates
    let query = { appliedFor: id };
    
    if (stage) query.stage = stage;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { candidateCode: { $regex: search, $options: 'i' } }
      ];
    }

    const applicants = await Candidate.find(query)
      .populate('referredBy', 'firstName lastName')
      .populate('interviews.interviewer', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      count: applicants.length, 
      job: {
        id: job._id,
        title: job.title,
        department: job.department,
        status: job.status
      },
      data: applicants 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
