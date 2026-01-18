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
           'offer-rejected', 'sent-to-onboarding', 'joined', 'rejected'],
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
  
  // Onboarding Connection
  onboardingRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Onboarding'
  },
  
  sentToOnboardingAt: Date,
  
  sentToOnboardingBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
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
  // Duplicate Detection Fields
  isDuplicate: {
    type: Boolean,
    default: false
  },
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate'
  },
  // Flexible Workflow Fields
  canSkipStages: {
    type: Boolean,
    default: true
  },
  workflowHistory: [{
    fromStage: String,
    toStage: String,
    skippedStages: [String],
    movedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Cross-Application History Fields
  masterCandidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate'
  },
  applicationHistory: [{
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobPosting'
    },
    jobTitle: String,
    appliedDate: {
      type: Date,
      default: Date.now
    },
    stage: String,
    status: String,
    outcome: {
      type: String,
      enum: ['hired', 'rejected', 'withdrawn', 'ongoing', null],
      default: null
    },
    interviews: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview'
    }],
    onboardingRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Onboarding'
    },
    offboardingRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offboarding'
    }
  }],
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

// Indexes for duplicate detection
candidateSchema.index({ email: 1 });
candidateSchema.index({ phone: 1 });
candidateSchema.index({ email: 1, phone: 1 });
candidateSchema.index({ isDuplicate: 1 });
candidateSchema.index({ duplicateOf: 1 });

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return null;
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
};

// Pre-save hook to check for duplicates (non-blocking, just flag)
candidateSchema.pre('save', async function(next) {
  // Generate candidate code if not present
  if (!this.candidateCode) {
    const count = await mongoose.model('Candidate').countDocuments();
    this.candidateCode = `CAN${String(count + 1).padStart(5, '0')}`;
  }

  // Check for duplicates only if this is a new document and not already marked as duplicate
  if (this.isNew && !this.isDuplicate) {
    const Candidate = mongoose.model('Candidate');
    const normalizedPhone = normalizePhone(this.phone);
    const normalizedEmail = this.email?.toLowerCase().trim();

    // Check for existing candidate by email OR phone
    const duplicateQuery = {
      _id: { $ne: this._id },
      $or: []
    };

    if (normalizedEmail) {
      duplicateQuery.$or.push({ email: normalizedEmail });
    }

    if (normalizedPhone) {
      duplicateQuery.$or.push({ phone: normalizedPhone });
      // Also check alternatePhone
      duplicateQuery.$or.push({ alternatePhone: normalizedPhone });
    }

    if (duplicateQuery.$or.length > 0) {
      const duplicate = await Candidate.findOne(duplicateQuery);
      if (duplicate) {
        // Flag as duplicate but don't block save (non-blocking)
        this.isDuplicate = true;
        this.duplicateOf = duplicate._id;
      }
    }
  }

  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
