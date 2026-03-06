const mongoose = require('mongoose');

const tenantAttendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    employeeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    date: {
      type: Date,
      required: true
    },
    checkIn: {
      type: Date
    },
    checkOut: {
      type: Date
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend', 'late', 'early-departure'],
      default: 'present'
    },
    location: {
      type: String,
      enum: ['office', 'remote', 'field', 'client-site'],
      default: 'office'
    },
    ipAddress: {
      type: String
    },
    networkName: {
      type: String
    },
    deviceInfo: {
      type: String
    },
    locationLat: {
      type: Number
    },
    locationLong: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

tenantAttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = tenantAttendanceSchema;
