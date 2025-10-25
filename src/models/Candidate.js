const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  candidateCode: {
    type: String,
    unique: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  alternatePhone: String,
  currentLocation: String,
  preferredLocation: [String],
  source: {
    type: String,
    enum: ['internal', 'linkedin', 'naukri', 'referral', 'job-portal', 'walk-in', 'other'],
    default: 'other'
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  appliedFor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  experience: {
    years: Number,
    months: Number
  },
  currentCompany: String,
  currentDesignation: String,
  currentCTC: Number,
  expectedCTC: Number,
  noticePeriod: Number,
  skills: [String],
  education: [{
    degree: String,
    specialization: String,
    institution: String,
    passingYear: Number,
    percentage: Number
  }],
  resume: {
    url: String,
    uploadedAt: Date
  },
  stage: {
    type: String,
    enum: ['applied', 'screening', 'shortlisted', 'interview-scheduled', 
           'interview-completed', 'offer-extended', 'offer-accepted', 
           'offer-rejected', 'joined', 'rejected'],
    default: 'applied'
  },
  interviews: [{
    round: String,
    scheduledDate: Date,
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    feedback: String,
    rating: Number,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show']
    }
  }],
  offerDetails: {
    offeredCTC: Number,
    offeredDesignation: String,
    joiningDate: Date,
    offerLetterUrl: String,
    offerExtendedDate: Date,
    offerAcceptedDate: Date
  },
  rejectionReason: String,
  notes: String,
  status: {
    type: String,
    enum: ['active', 'hired', 'rejected', 'withdrawn'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // AI Analysis Fields
  aiAnalysis: {
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    analysisDate: Date,
    skillsMatch: {
      matched: [String],
      missing: [String],
      additional: [String],
      matchPercentage: Number
    },
    experienceMatch: {
      isMatch: Boolean,
      candidateYears: Number,
      requiredYears: String,
      score: Number
    },
    keyHighlights: [String],
    weaknesses: [String],
    overallFit: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor', null],
      default: null
    },
    resumeInsights: {
      totalExperience: String,
      keySkills: [String],
      education: [String],
      certifications: [String],
      projects: [String]
    },
    semanticScore: Number, // Embedding similarity score
    isAnalyzed: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Generate candidate code
candidateSchema.pre('save', async function(next) {
  if (!this.candidateCode) {
    const count = await mongoose.model('Candidate').countDocuments();
    this.candidateCode = `CAN${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
