/**
 * Tenant Employee Model - Dedicated collection for employees in each tenant database
 * This is separate from the general users collection for better data organization
 */

const mongoose = require('mongoose');

const tenantEmployeeSchema = new mongoose.Schema({
  // Personal Information
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
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String
  },
  profilePicture: {
    type: String
  },

  // Employment Information
  employeeCode: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values but unique non-null values
  },
  joiningDate: {
    type: Date,
    required: true
  },
  designation: {
    type: String,
    required: true,
    trim: true
  },
  
  // Employment Type
  employmentType: {
    type: String,
    enum: ['full-time', 'contract-fixed-deliverable', 'contract-rate-based', 'contract-hourly-based'],
    default: 'full-time',
    required: true
  },
  
  // Contract Reference (for contract employees)
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  hasActiveContract: {
    type: Boolean,
    default: false
  },

  // Department and Manager
  department: {
    type: String,
    trim: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  reportingManager: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Salary Information
  salary: {
    currency: {
      type: String,
      enum: ['USD', 'INR', 'AED'],
      default: 'INR'
    },
    basic: {
      type: Number,
      default: 0
    },
    hra: {
      type: Number,
      default: 0
    },
    allowances: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },

  // Status and Lifecycle
  status: {
    type: String,
    enum: ['active', 'on-leave', 'terminated', 'suspended', 'probation'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFirstLogin: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: true
  },

  // Termination (for offboarding)
  terminatedAt: {
    type: Date
  },
  terminationReason: {
    type: String
  },
  isExEmployee: {
    type: Boolean,
    default: false
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for performance
tenantEmployeeSchema.index({ email: 1 });
tenantEmployeeSchema.index({ employeeCode: 1 });
tenantEmployeeSchema.index({ department: 1 });
tenantEmployeeSchema.index({ isActive: 1 });
tenantEmployeeSchema.index({ isExEmployee: 1 });
tenantEmployeeSchema.index({ joiningDate: -1 });
tenantEmployeeSchema.index({ employmentType: 1 });
tenantEmployeeSchema.index({ hasActiveContract: 1 });

// Virtual for full name
tenantEmployeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Instance method to get employee summary
tenantEmployeeSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: `${this.firstName} ${this.lastName}`,
    email: this.email,
    employeeCode: this.employeeCode,
    designation: this.designation,
    department: this.department,
    isActive: this.isActive,
    joiningDate: this.joiningDate
  };
};

module.exports = tenantEmployeeSchema;