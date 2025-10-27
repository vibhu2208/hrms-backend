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
  // Professional Experience Details
  professionalExperience: [{
    company: String,
    designation: String,
    startDate: Date,
    endDate: Date,
    currentlyWorking: {
      type: Boolean,
      default: false
    },
    responsibilities: String,
    achievements: String,
    technologies: [String],
    ctc: Number,
    reasonForLeaving: String
  }],
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
    filename: String,
    originalName: String,
    size: Number,
    mimetype: String,
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
    interviewType: {
      type: String,
      enum: ['Technical', 'HR', 'Managerial', 'Cultural Fit', 'Final Round', 'Other'],
      default: 'Technical'
    },
    round: String,
    scheduledDate: Date,
    scheduledTime: String,
    meetingLink: String,
    meetingPlatform: {
      type: String,
      enum: ['Google Meet', 'Microsoft Teams', 'Zoom', 'Phone', 'In-Person', 'Other'],
      default: 'Google Meet'
    },
    interviewer: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    feedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    decision: {
      type: String,
      enum: ['selected', 'rejected', 'on-hold', 'pending'],
      default: 'pending'
    },
    notes: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled'],
      default: 'scheduled'
    },
    completedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Notification tracking
  notifications: {
    interviewEmail: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    },
    interviewCall: {
      completed: { type: Boolean, default: false },
      completedAt: Date,
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      notes: String
    },
    offerEmail: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    },
    rejectionEmail: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    }
  },
  // HR Call tracking
  hrCall: {
    status: {
      type: String,
      enum: ['pending', 'completed', 'scheduled'],
      default: 'pending'
    },
    scheduledDate: Date,
    completedDate: Date,
    summary: String,
    decision: {
      type: String,
      enum: ['move-to-onboarding', 'reject', 'on-hold', 'pending'],
      default: 'pending'
    },
    conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
  },
  // Timeline/Activity Log
  timeline: [{
    action: {
      type: String,
      required: true
    },
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
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
