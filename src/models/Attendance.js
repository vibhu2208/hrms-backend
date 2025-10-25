const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
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
    enum: ['present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend'],
    default: 'present'
  },
  workHours: {
    type: Number,
    default: 0
  },
  overtime: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  },
  location: {
    type: String,
    enum: ['office', 'remote', 'field'],
    default: 'office'
  }
}, {
  timestamps: true
});

// Create compound index for employee and date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
