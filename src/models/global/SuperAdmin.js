/**
 * Super Admin Model - Stored in hrms_global database
 * Only ONE super admin exists in the entire system
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminSchema = new mongoose.Schema({
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
    required: true,
    minlength: 6,
    select: false
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
  phone: {
    type: String
  },
  profilePicture: {
    type: String
  },
  role: {
    type: String,
    default: 'superadmin',
    immutable: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  // Account lockout fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastFailedLogin: {
    type: Date
  },
  // Password reset fields
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  // Refresh token management
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isRevoked: {
      type: Boolean,
      default: false
    },
    deviceInfo: {
      userAgent: String,
      ip: String
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
superAdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
superAdminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual to check if account is locked
superAdminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to handle failed login
superAdminSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1, lastFailedLogin: new Date() }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 }, $set: { lastFailedLogin: new Date() } };
  
  // Lock account after 5 failed attempts for 30 minutes
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      ...updates.$set,
      lockUntil: Date.now() + 30 * 60 * 1000 // 30 minutes
    };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts on successful login
superAdminSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1, lastFailedLogin: 1 }
  });
};

// Method to add refresh token
superAdminSchema.methods.addRefreshToken = async function(token, expiresAt, deviceInfo = {}) {
  // Remove expired tokens
  await this.removeExpiredTokens();
  
  // Add new refresh token
  this.refreshTokens.push({
    token,
    expiresAt,
    deviceInfo
  });
  
  return this.save();
};

// Method to remove expired tokens
superAdminSchema.methods.removeExpiredTokens = async function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(rt => rt.expiresAt > now);
  return this.save();
};

// Method to revoke refresh token
superAdminSchema.methods.revokeRefreshToken = async function(token) {
  const refreshToken = this.refreshTokens.find(rt => rt.token === token);
  if (refreshToken) {
    refreshToken.isRevoked = true;
  }
  return this.save();
};

// Method to revoke all refresh tokens
superAdminSchema.methods.revokeAllRefreshTokens = async function() {
  this.refreshTokens.forEach(rt => {
    rt.isRevoked = true;
  });
  return this.save();
};

// Method to find valid refresh token
superAdminSchema.methods.findValidRefreshToken = async function(token) {
  await this.removeExpiredTokens();
  return this.refreshTokens.find(rt => 
    rt.token === token && 
    !rt.isRevoked && 
    rt.expiresAt > new Date()
  );
};

module.exports = superAdminSchema;
