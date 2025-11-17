const Candidate = require('../models/Candidate');
const JobPosting = require('../models/JobPosting');
const aiService = require('../services/aiService');
const resumeParser = require('../utils/resumeParser');
const { getTenantModel } = require('../utils/tenantModels');

/**
 * Analyze a single candidate for a job posting
 */
exports.analyzeSingleCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { jobId } = req.body;

    // Fetch candidate and job posting
    const candidate = await Candidate.findById(candidateId);
    const jobPosting = await JobPosting.findById(jobId || candidate.appliedFor);

    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Candidate not found' 
      });
    }

    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job posting not found' 
      });
    }

    // Enhance candidate data with resume parsing if available
    let enhancedCandidate = candidate;
    if (candidate.resume?.url) {
      try {
        enhancedCandidate = await resumeParser.enhanceCandidateWithResume(candidate.toObject());
      } catch (error) {
        console.warn('Resume parsing failed, continuing with existing data:', error.message);
      }
    }

    // Perform AI analysis
    const analysis = await aiService.analyzeCandidate(enhancedCandidate, jobPosting);

    // Update candidate with analysis results
    candidate.aiAnalysis = analysis;
    await candidate.save();

    res.status(200).json({
      success: true,
      message: 'Candidate analyzed successfully',
      data: {
        candidateId: candidate._id,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        analysis: candidate.aiAnalysis
      }
    });
  } catch (error) {
    console.error('Error analyzing candidate:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to analyze candidate',
      error: error.message 
    });
  }
};

/**
 * Analyze all candidates for a specific job posting
 */
exports.analyzeJobCandidates = async (req, res) => {
  try {
    const TenantCandidate = getTenantModel(req.tenant.connection, 'Candidate');
    const TenantJobPosting = getTenantModel(req.tenant.connection, 'JobPosting');
    const { jobId } = req.params;
    const { forceReanalyze = false } = req.query;

    // Fetch job posting
    const jobPosting = await TenantJobPosting.findById(jobId);
    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job posting not found' 
      });
    }

    // Fetch all candidates for this job
    let query = { appliedFor: jobId, status: 'active' };
    
    // Only analyze candidates that haven't been analyzed yet (unless force reanalyze)
    if (!forceReanalyze) {
      query['aiAnalysis.isAnalyzed'] = { $ne: true };
    }

    const candidates = await TenantCandidate.find(query);

    if (candidates.length === 0) {
      return res.status(200).json({
        success: true,
        message: forceReanalyze 
          ? 'No candidates found for this job' 
          : 'All candidates already analyzed',
        data: {
          analyzed: 0,
          total: 0
        }
      });
    }

    // Analyze candidates in batch
    const results = await aiService.analyzeCandidatesBatch(candidates, jobPosting, {
      concurrency: 3
    });

    // Update candidates with analysis results
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const result = results[i];
      
      if (result.status === 'fulfilled') {
        try {
          candidates[i].aiAnalysis = result.value;
          await candidates[i].save();
          successCount++;
        } catch (error) {
          console.error(`Failed to save analysis for candidate ${candidates[i]._id}:`, error);
          failureCount++;
        }
      } else {
        console.error(`Analysis failed for candidate ${candidates[i]._id}:`, result.reason);
        failureCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Analysis completed: ${successCount} successful, ${failureCount} failed`,
      data: {
        analyzed: successCount,
        failed: failureCount,
        total: candidates.length
      }
    });
  } catch (error) {
    console.error('Error analyzing job candidates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to analyze candidates',
      error: error.message 
    });
  }
};

/**
 * Get ranked candidates for a job posting
 */
exports.getRankedCandidates = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { 
      minScore = 0, 
      limit = 50,
      stage,
      status = 'active'
    } = req.query;

    // Build query
    let query = { 
      appliedFor: jobId,
      status,
      'aiAnalysis.isAnalyzed': true,
      'aiAnalysis.matchScore': { $gte: parseInt(minScore) }
    };

    if (stage) {
      query.stage = stage;
    }

    // Fetch and sort candidates by match score
    const candidates = await Candidate.find(query)
      .select('firstName lastName email phone skills experience currentCompany currentDesignation aiAnalysis stage status createdAt resume')
      .sort({ 'aiAnalysis.matchScore': -1 })
      .limit(parseInt(limit));

    // Get job details
    const jobPosting = await JobPosting.findById(jobId)
      .select('title department location skills experience');

    res.status(200).json({
      success: true,
      count: candidates.length,
      job: jobPosting,
      data: candidates
    });
  } catch (error) {
    console.error('Error fetching ranked candidates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch ranked candidates',
      error: error.message 
    });
  }
};

/**
 * Get AI insights for a specific candidate
 */
exports.getCandidateInsights = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const candidate = await Candidate.findById(candidateId)
      .populate('appliedFor', 'title skills experience requirements')
      .select('firstName lastName email aiAnalysis skills experience');

    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Candidate not found' 
      });
    }

    if (!candidate.aiAnalysis?.isAnalyzed) {
      return res.status(404).json({ 
        success: false, 
        message: 'Candidate has not been analyzed yet' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        candidate: {
          id: candidate._id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          skills: candidate.skills,
          experience: candidate.experience
        },
        jobPosting: candidate.appliedFor,
        insights: candidate.aiAnalysis
      }
    });
  } catch (error) {
    console.error('Error fetching candidate insights:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch candidate insights',
      error: error.message 
    });
  }
};

/**
 * Get analysis statistics for a job posting
 */
exports.getAnalysisStats = async (req, res) => {
  try {
    const { jobId } = req.params;

    const stats = await Candidate.aggregate([
      { $match: { appliedFor: jobId, 'aiAnalysis.isAnalyzed': true } },
      {
        $group: {
          _id: null,
          totalAnalyzed: { $sum: 1 },
          averageScore: { $avg: '$aiAnalysis.matchScore' },
          excellentFit: {
            $sum: { $cond: [{ $eq: ['$aiAnalysis.overallFit', 'excellent'] }, 1, 0] }
          },
          goodFit: {
            $sum: { $cond: [{ $eq: ['$aiAnalysis.overallFit', 'good'] }, 1, 0] }
          },
          averageFit: {
            $sum: { $cond: [{ $eq: ['$aiAnalysis.overallFit', 'average'] }, 1, 0] }
          },
          poorFit: {
            $sum: { $cond: [{ $eq: ['$aiAnalysis.overallFit', 'poor'] }, 1, 0] }
          },
          topScore: { $max: '$aiAnalysis.matchScore' },
          lowestScore: { $min: '$aiAnalysis.matchScore' }
        }
      }
    ]);

    const totalCandidates = await Candidate.countDocuments({ appliedFor: jobId });

    res.status(200).json({
      success: true,
      data: {
        totalCandidates,
        analyzed: stats[0]?.totalAnalyzed || 0,
        notAnalyzed: totalCandidates - (stats[0]?.totalAnalyzed || 0),
        averageScore: Math.round(stats[0]?.averageScore || 0),
        topScore: stats[0]?.topScore || 0,
        lowestScore: stats[0]?.lowestScore || 0,
        fitDistribution: {
          excellent: stats[0]?.excellentFit || 0,
          good: stats[0]?.goodFit || 0,
          average: stats[0]?.averageFit || 0,
          poor: stats[0]?.poorFit || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching analysis stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analysis statistics',
      error: error.message 
    });
  }
};

/**
 * Parse resume and extract information
 */
exports.parseResume = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Candidate not found' 
      });
    }

    if (!candidate.resume?.url) {
      return res.status(400).json({ 
        success: false, 
        message: 'No resume found for this candidate' 
      });
    }

    const resumeData = await resumeParser.parseResume(candidate.resume.url);

    res.status(200).json({
      success: true,
      message: 'Resume parsed successfully',
      data: resumeData
    });
  } catch (error) {
    console.error('Error parsing resume:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to parse resume',
      error: error.message 
    });
  }
};

/**
 * Clear AI analysis for candidates (useful for testing)
 */
exports.clearAnalysis = async (req, res) => {
  try {
    const { jobId } = req.params;

    const result = await Candidate.updateMany(
      { appliedFor: jobId },
      { 
        $unset: { aiAnalysis: "" }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Analysis cleared successfully',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error clearing analysis:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear analysis',
      error: error.message 
    });
  }
};

module.exports = exports;
