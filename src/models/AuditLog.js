const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  action: {
    type: String,
    required: true,
    enum: [
      'create', 'update', 'delete', 'login', 'logout', 'password_change',
      'role_change', 'status_change', 'module_enable', 'module_disable',
      'subscription_create', 'subscription_update', 'subscription_cancel',
      'client_create', 'client_update', 'client_suspend', 'client_activate',
      'package_create', 'package_update', 'package_delete',
      'config_update', 'data_export', 'data_import'
    ]
  },
  resource: {
    type: String,
    required: true // e.g., 'user', 'client', 'package', 'subscription'
  },
  resourceId: {
    type: String // ID of the affected resource
  },
  details: {
    type: mongoose.Schema.Types.Mixed // Store additional details about the action
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ clientId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
