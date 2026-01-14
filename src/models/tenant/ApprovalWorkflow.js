/**
 * Approval Workflow Model - Stored in tenant database
 * Defines multi-level approval workflows for different entities
 */

const mongoose = require('mongoose');

const approvalWorkflowSchema = new mongoose.Schema({
  workflowName: {
    type: String,
    required: [true, 'Workflow name is required'],
    trim: true
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    enum: ['leave', 'roster_change', 'profile_update', 'attendance_regularization', 'expense', 'other'],
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  levels: [{
    level: {
      type: Number,
      required: true,
      min: 1
    },
    approverType: {
      type: String,
      enum: ['reporting_manager', 'department_head', 'hr', 'admin', 'specific_user', 'role_based'],
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
    slaMinutes: {
      type: Number,
      default: 1440 // 24 hours default
    }
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
  conditions: {
    leaveType: [String],
    amountRange: {
      min: Number,
      max: Number
    },
    department: [mongoose.Schema.Types.ObjectId],
    designation: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
approvalWorkflowSchema.index({ entityType: 1, isActive: 1 });
approvalWorkflowSchema.index({ isDefault: 1, entityType: 1 });

module.exports = approvalWorkflowSchema;


