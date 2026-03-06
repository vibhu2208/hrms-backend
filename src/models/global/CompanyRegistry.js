/**
 * Company Registry Model - Stored in hrms_global database
 * Maintains list of all companies and their database references
 */

const mongoose = require('mongoose');

const companyRegistrySchema = new mongoose.Schema({
  companyCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    default: 'COMP_PENDING'
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  // Database reference
  tenantDatabaseName: {
    type: String,
    required: true,
    unique: true,
    default: function () {
      return this.companyId ? `tenant_${this.companyId}` : undefined;
    }
    // Format: tenant_{companyId}
  },
  // Company contact details
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  website: {
    type: String
  },
  // Company address
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  // Company admin details (created in tenant DB)
  companyAdmin: {
    email: {
      type: String,
      required: true
    },
    userId: {
      type: String // ID from tenant database
    },
    createdAt: Date
  },
  // Subscription details
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'basic', 'professional', 'enterprise', 'custom'],
      default: 'trial'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'expired', 'suspended', 'cancelled', 'trial'],
      default: 'trial'
    },
    maxEmployees: {
      type: Number,
      default: 50
    },
    maxAdmins: {
      type: Number,
      default: 2
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    }
  },
  // Enabled modules for this company
  enabledModules: [{
    type: String,
    enum: [
      'hr',
      'payroll',
      'timesheet',
      'attendance',
      'recruitment',
      'performance',
      'assets',
      'compliance',
      'projects',
      'leave_management'
    ]
  }],
  // Company status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  },
  databaseStatus: {
    type: String,
    enum: ['provisioning', 'active', 'suspended', 'deleted'],
    default: 'provisioning'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Branding reference
  themeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyTheme'
  },
  // Metadata
  onboardedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'onboardedByModel'
  },
  onboardedByModel: {
    type: String,
    enum: ['SuperAdmin', 'SubSuperAdmin']
  },
  onboardedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: Date,
  notes: String,
  // Usage statistics
  usage: {
    totalEmployees: {
      type: Number,
      default: 0
    },
    totalAdmins: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0 // in MB
    },
    lastSyncedAt: Date
  }
}, {
  timestamps: true
});

// Generate required identifiers before validation
companyRegistrySchema.pre('validate', async function(next) {
  try {
    // Generate companyId if not set
    if (!this.companyId) {
      this.companyId = new mongoose.Types.ObjectId().toString();
    }

    // Generate tenant database name
    if (!this.tenantDatabaseName) {
      this.tenantDatabaseName = `tenant_${this.companyId}`;
    }

    // Generate company code if not set (or still placeholder)
    // Note: Use companyId-derived code to avoid collisions under retries/concurrency.
    if (!this.companyCode || this.companyCode === 'COMP_PENDING') {
      const suffix = String(this.companyId).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
      this.companyCode = `COMP${suffix.padStart(8, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Indexes for faster queries
companyRegistrySchema.index({ companyName: 1 });
companyRegistrySchema.index({ email: 1 });
companyRegistrySchema.index({ companyId: 1 });
companyRegistrySchema.index({ status: 1 });
companyRegistrySchema.index({ 'subscription.status': 1 });

module.exports = companyRegistrySchema;
