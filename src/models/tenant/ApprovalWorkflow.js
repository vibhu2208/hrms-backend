/**
 * Approval Workflow Model - Stored in tenant database
 * Defines multi-level approval workflows for different entities
 */

const mongoose = require('mongoose');

const approvalStepV2Schema = new mongoose.Schema(
  {
    order: { type: Number, required: true, min: 1 },
    name: { type: String, trim: true },
    role: { type: String, enum: ['employee', 'hr', 'manager', 'admin'], required: true },
    mode: { type: String, enum: ['sequential', 'parallel', 'any_one'], default: 'sequential' },
    permissions: {
      canReject: { type: Boolean, default: true },
      canSendBack: { type: Boolean, default: true },
      canDelegate: { type: Boolean, default: true },
      canAddComments: { type: Boolean, default: true }
    },
    sla: {
      timeLimitMinutes: { type: Number, default: 1440 }, // 24h
      autoApproveAfterMinutes: { type: Number } // optional
    },
    escalation: {
      enabled: { type: Boolean, default: true },
      escalateToRole: { type: String, enum: ['employee', 'hr', 'manager', 'admin'] },
      escalateAfterMinutes: { type: Number, default: 1440 }
    },
    notifications: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      emailTemplateId: { type: String }
    },
    conditional: {
      skipIf: [
        {
          field: { type: String, trim: true },
          operator: { type: String, trim: true },
          value: { type: mongoose.Schema.Types.Mixed }
        }
      ],
      routeRules: [
        {
          when: {
            field: { type: String, trim: true },
            operator: { type: String, trim: true },
            value: { type: mongoose.Schema.Types.Mixed }
          },
          toRole: { type: String, enum: ['hr', 'manager', 'admin'] }
        }
      ]
    }
  },
  { _id: false }
);

const auditTrailEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['CREATED', 'UPDATED', 'DUPLICATED', 'ARCHIVED', 'IMPORTED', 'ROLLED_BACK', 'VALIDATED'],
      required: true
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByEmail: { type: String, lowercase: true, trim: true },
    timestamp: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const approvalWorkflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workflow name is required'],
    trim: true
  },
  workflowName: {
    type: String,
    trim: true
  },
  requesterRole: {
    type: String,
    enum: ['employee', 'hr', 'manager', 'admin'],
    default: 'employee'
  },
  requestType: {
    type: String,
    required: [true, 'Request type is required'],
    enum: ['leave', 'attendance', 'expense', 'payroll', 'asset', 'document', 'offboarding', 'onboarding_approval', 'roster_change', 'profile_update', 'attendance_regularization', 'project', 'other'],
    index: true
  },
  entityType: {
    type: String,
    enum: ['leave', 'roster_change', 'profile_update', 'attendance_regularization', 'expense', 'project', 'other']
  },
  description: {
    type: String,
    trim: true
  },
  /**
   * New enterprise fields (v2)
   */
  appliesTo: {
    type: String,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft',
    index: true
  },
  effectiveDate: {
    type: Date
  },
  autoArchiveAfterDays: {
    type: Number,
    min: 0
  },
  versionMajor: {
    type: Number,
    default: 1,
    min: 1
  },
  versionMinor: {
    type: Number,
    default: 0,
    min: 0
  },
  steps: {
    type: [approvalStepV2Schema],
    default: undefined
  },
  validation: {
    isValid: { type: Boolean, default: true, index: true },
    errors: { type: [mongoose.Schema.Types.Mixed], default: [] },
    warnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
    updatedAt: { type: Date }
  },
  auditTrail: {
    type: [auditTrailEntrySchema],
    default: []
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  priority: {
    type: Number,
    default: 0
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  approvalSteps: [{
    level: {
      type: Number,
      required: true,
      min: 1
    },
    approverType: {
      type: String,
      enum: ['manager', 'reporting_manager', 'department_head', 'hr', 'finance', 'ceo', 'company_admin', 'admin', 'specific_user', 'role_based', 'custom'],
      required: true
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approverRole: {
      type: String
    },
    approverEmail: {
      type: String,
      lowercase: true
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    canDelegate: {
      type: Boolean,
      default: true
    },
    slaHours: {
      type: Number,
      default: 24
    },
    slaMinutes: {
      type: Number,
      default: 1440
    },
    escalationHours: {
      type: Number,
      default: 36
    }
  }],
  levels: [{
    level: Number,
    approverType: String,
    approverId: mongoose.Schema.Types.ObjectId,
    approverRole: String,
    approverEmail: String,
    isRequired: Boolean,
    canDelegate: Boolean,
    slaMinutes: Number
  }],
  slaMinutes: {
    type: Number,
    default: 2880 // 48 hours total default
  },
  escalationRules: {
    enabled: {
      type: Boolean,
      default: true
    },
    escalationAfterMinutes: {
      type: Number,
      default: 1440 // Escalate after 24 hours
    },
    escalateTo: {
      type: String,
      enum: ['next_level', 'hr', 'admin', 'specific_user'],
      default: 'next_level'
    },
    escalateToEmail: {
      type: String,
      lowercase: true
    },
    autoApproveAfterMinutes: {
      type: Number // Auto-approve if no response after X minutes (optional)
    }
  },
  conditions: [{
    field: {
      type: String,
      required: true
    },
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'in', 'not_in', 'contains', 'not_contains'],
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  }],
  legacyConditions: {
    leaveType: [String],
    amountRange: {
      min: Number,
      max: Number
    },
    department: [mongoose.Schema.Types.ObjectId],
    designation: [String],
    duration: {
      min: Number,
      max: Number
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
approvalWorkflowSchema.index({ entityType: 1, isActive: 1 });
approvalWorkflowSchema.index({ isDefault: 1, entityType: 1 });
approvalWorkflowSchema.index({ status: 1, 'validation.isValid': 1 });

// Virtual for UI-friendly version label (e.g. v2.3)
approvalWorkflowSchema.virtual('versionLabel').get(function () {
  const major = this.versionMajor || 1;
  const minor = this.versionMinor || 0;
  return `v${major}.${minor}`;
});

module.exports = approvalWorkflowSchema;


