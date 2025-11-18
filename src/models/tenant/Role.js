const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true
  },
  slug: {
    type: String,
    required: [true, 'Role slug is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  scope: {
    type: String,
    enum: ['self', 'team', 'department', 'tenant'],
    default: 'self',
    required: true
  },
  parentRoleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemRole: {
    type: Boolean,
    default: false // True for predefined roles like admin, hr
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for tenant-specific role uniqueness
roleSchema.index({ clientId: 1, slug: 1 }, { unique: true });

// Pre-save middleware to generate slug from name
roleSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);
