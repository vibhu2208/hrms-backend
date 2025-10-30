const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema({
  // Core References
  onboardingId: {
    type: String,
    unique: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee' // Will be populated when employee record is created
  },
  
  // Candidate Information (cached for quick access)
  candidateName: {
    type: String,
    required: true
  },
  candidateEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  candidatePhone: {
    type: String,
    required: true
  },
  
  // Job Information (cached)
  position: {
    type: String,
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  
  // Onboarding Status - State Machine
  status: {
    type: String,
    enum: [
      'preboarding',           // Initial state after send to onboarding
      'offer_sent',            // Offer letter sent to candidate
      'offer_accepted',        // Candidate accepted offer
      'docs_pending',          // Waiting for document submission
      'docs_verified',         // All documents verified
      'ready_for_joining',     // Join date set, teams notified
      'completed',             // Onboarding completed, moved to employees
      'rejected'               // Onboarding rejected/cancelled
    ],
    default: 'preboarding'
  },
  
  // Offer Management
  offer: {
    templateVersion: String,
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfferTemplate'
    },
    offeredDesignation: String,
    offeredCTC: Number,
    salary: {
      basic: Number,
      hra: Number,
      allowances: Number,
      total: Number
    },
    benefits: [String],
    startDate: Date,
    offerLetterUrl: String,
    sentAt: Date,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    expiryDate: Date, // 24-hour deadline
    remindersSent: [{
      sentAt: Date,
      type: {
        type: String,
        enum: ['24h_reminder', '12h_reminder', '2h_reminder']
      }
    }]
  },
  
  // Document Management
  documents: [{
    type: {
      type: String,
      enum: [
        'resume', 'offer_letter_signed', 'aadhar', 'pan', 'bank_details', 
        'passport', 'education_certificates', 'experience_letters', 
        'address_proof', 'photo', 'other'
      ],
      required: true
    },
    name: String,
    originalName: String,
    url: String,
    size: Number,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: String,
      enum: ['candidate', 'hr'],
      default: 'candidate'
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    verifiedAt: Date,
    verificationNotes: String,
    rejectionReason: String,
    isRequired: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'verified', 'rejected'],
      default: 'pending'
    }
  }],
  
  // Required Documents Checklist
  requiredDocuments: [{
    type: {
      type: String,
      enum: [
        'aadhar', 'pan', 'bank_details', 'passport', 'education_certificates', 
        'experience_letters', 'address_proof', 'photo'
      ]
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    submitted: {
      type: Boolean,
      default: false
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  
  // Joining Details
  joiningDate: Date,
  actualJoiningDate: Date,
  
  // IT & Facilities Notifications
  notifications: {
    itNotified: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      acknowledged: { type: Boolean, default: false },
      acknowledgedAt: Date,
      acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    },
    facilitiesNotified: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      acknowledged: { type: Boolean, default: false },
      acknowledgedAt: Date,
      acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    },
    hrNotified: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    }
  },
  
  // Provisioning Status
  provisioning: {
    emailAccount: {
      status: {
        type: String,
        enum: ['pending', 'created', 'failed'],
        default: 'pending'
      },
      email: String,
      createdAt: Date,
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    },
    systemAccess: [{
      system: String,
      status: {
        type: String,
        enum: ['pending', 'granted', 'failed'],
        default: 'pending'
      },
      grantedAt: Date,
      grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    }],
    equipment: [{
      item: String,
      status: {
        type: String,
        enum: ['pending', 'allocated', 'delivered'],
        default: 'pending'
      },
      allocatedAt: Date,
      deliveredAt: Date,
      serialNumber: String
    }],
    workspace: {
      allocated: { type: Boolean, default: false },
      location: String,
      deskNumber: String,
      allocatedAt: Date,
      allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    }
  },
  
  // Tasks & Checklist
  tasks: [{
    title: String,
    description: String,
    category: {
      type: String,
      enum: ['hr', 'it', 'facilities', 'manager', 'other'],
      default: 'hr'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    dueDate: Date,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    notes: String
  }],
  
  // Audit Trail
  auditTrail: [{
    action: {
      type: String,
      required: true
    },
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    previousStatus: String,
    newStatus: String,
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  
  // Process Management
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  assignedHR: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Completion Details
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Additional Information
  notes: String,
  internalNotes: String, // HR-only notes
  candidateNotes: String, // Notes visible to candidate
  
  // SLA & Deadlines
  sla: {
    expectedCompletionDate: Date,
    actualCompletionDate: Date,
    isOverdue: {
      type: Boolean,
      default: false
    },
    overdueBy: Number // days
  },
  
  // Integration Data
  externalIds: {
    ticketingSystem: String,
    hrSystem: String,
    itSystem: String
  }
}, {
  timestamps: true
});

// Generate onboarding ID
onboardingSchema.pre('save', async function(next) {
  if (!this.onboardingId) {
    const count = await mongoose.model('Onboarding').countDocuments();
    this.onboardingId = `ONB${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Index for better query performance
onboardingSchema.index({ status: 1, createdAt: -1 });
onboardingSchema.index({ applicationId: 1 });
onboardingSchema.index({ candidateEmail: 1 });
onboardingSchema.index({ 'offer.expiryDate': 1 });

module.exports = mongoose.model('Onboarding', onboardingSchema);
