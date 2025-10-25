const JobPosting = require('../models/JobPosting');

exports.getJobPostings = async (req, res) => {
  try {
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
    req.body.postedBy = req.user.employeeId;
    const job = await JobPosting.create(req.body);
    res.status(201).json({ success: true, message: 'Job posting created successfully', data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateJobPosting = async (req, res) => {
  try {
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

exports.deleteJobPosting = async (req, res) => {
  try {
    const job = await JobPosting.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }
    res.status(200).json({ success: true, message: 'Job posting deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
