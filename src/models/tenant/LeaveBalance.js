/**
 * Leave Balance Model - Stored in tenant database
 * Tracks leave balances for each employee
 */

const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
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
  year: {
    type: Number,
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Personal Leave', 'Sick Leave', 'Casual Leave', 'Comp Offs', 'Floater Leave', 'Marriage Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave']
  },
  total: {
    type: Number,
    required: true,
    default: 0
  },
  consumed: {
    type: Number,
    default: 0
  },
  available: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate available before saving
leaveBalanceSchema.pre('save', function(next) {
  this.available = this.total - this.consumed;
  next();
});

// Index for faster queries
leaveBalanceSchema.index({ employeeEmail: 1, year: 1, leaveType: 1 }, { unique: true });

module.exports = leaveBalanceSchema;
