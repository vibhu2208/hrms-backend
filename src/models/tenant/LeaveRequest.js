/**
 * Leave Request Model - Stored in tenant database
 */

const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  employeeName: {
    type: String,
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Personal Leave', 'Sick Leave', 'Casual Leave', 'Comp Offs', 'Floater Leave', 'Marriage Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  numberOfDays: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  // Manager who needs to approve
  reportingManager: {
    type: String,
    lowercase: true
  },
  // Approval details
  approvedBy: {
    type: String
  },
  approvedByEmail: {
    type: String,
    lowercase: true
  },
  approvedOn: {
    type: Date
  },
  approvalComments: {
    type: String
  },
  // Rejection details
  rejectedBy: {
    type: String
  },
  rejectedByEmail: {
    type: String,
    lowercase: true
  },
  rejectedOn: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  // Cancellation
  cancelledOn: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  appliedOn: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
leaveRequestSchema.index({ employeeEmail: 1, status: 1 });
leaveRequestSchema.index({ reportingManager: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });

module.exports = leaveRequestSchema;
