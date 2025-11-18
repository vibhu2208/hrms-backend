const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const tenantUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  roleName: {
    type: String,
    required: true // Denormalized for quick access
  },
  roleSlug: {
    type: String,
    required: true // Denormalized for quick access
  },
  permissions: [{
    type: String
  }],
  scope: {
    type: String,
    enum: ['self', 'team', 'department', 'tenant'],
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
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
    default: false
  },
  lastLogin: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  profilePicture: {
    type: String
  },
  themePreference: {
    type: String,
    enum: ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red', 'teal', 'grey', 'custom'],
    default: 'dark'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenantUser',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenantUser'
  }
}, {
  timestamps: true
});

// Compound index for tenant-specific user uniqueness
tenantUserSchema.index({ clientId: 1, email: 1 }, { unique: true });

// Hash password before saving
tenantUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  // Set password changed timestamp
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
tenantUserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
tenantUserSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
tenantUserSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
tenantUserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

module.exports = mongoose.model('TenantUser', tenantUserSchema);
