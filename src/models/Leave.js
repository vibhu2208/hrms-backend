const mongoose = require('mongoose');

// Helper function to calculate business days (excluding weekends)
const calculateBusinessDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Validate that end date is not before start date
  if (end < start) {
    return 0; // Invalid date range
  }
  
  let businessDays = 0;
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    // Count Monday (1) to Friday (5) as business days
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return businessDays;
};

// Helper function to calculate total days (including weekends)
const calculateTotalDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Validate that end date is not before start date
  if (end < start) {
    return 0; // Invalid date range
  }
  
  const timeDiff = end.getTime() - start.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
  return daysDiff;
};

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid', 'compensatory'],
    required: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(value) {
        return value <= this.endDate;
      },
      message: 'Start date cannot be after end date'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value >= this.startDate;
      },
      message: 'End date cannot be before start date'
    }
  },
  numberOfDays: {
    type: Number,
    required: true,
    min: [0.5, 'Number of days must be at least 0.5'],
    validate: {
      validator: function(value) {
        // Auto-calculate numberOfDays if not provided or invalid
        if (!value || value <= 0) {
          this.numberOfDays = this.halfDay ? 0.5 : calculateBusinessDays(this.startDate, this.endDate);
        }
        return this.numberOfDays > 0;
      },
      message: 'Invalid number of days calculated'
    }
  },
  halfDay: {
    type: Boolean,
    default: false
  },
  halfDayPeriod: {
    type: String,
    enum: ['first-half', 'second-half'],
    required: function() { return this.halfDay; }
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  documents: [{
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  handoverNotes: {
    type: String
  },
  emergencyContact: {
    name: String,
    phone: String
  },
  isUrgent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save middleware to validate and calculate numberOfDays
leaveSchema.pre('save', function(next) {
  // Ensure dates are valid
  if (!this.startDate || !this.endDate) {
    return next(new Error('Both start date and end date are required'));
  }
  
  // Validate date range
  if (this.endDate < this.startDate) {
    return next(new Error('End date cannot be before start date'));
  }
  
  // Auto-calculate numberOfDays if not provided or needs recalculation
  if (this.halfDay) {
    this.numberOfDays = 0.5;
  } else {
    // Use business days calculation (excluding weekends)
    this.numberOfDays = calculateBusinessDays(this.startDate, this.endDate);
  }
  
  // Ensure numberOfDays is positive
  if (this.numberOfDays <= 0) {
    return next(new Error('Number of days must be greater than 0'));
  }
  
  next();
});

// Pre-update middleware to validate and calculate numberOfDays
leaveSchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
  const update = this.getUpdate();
  
  if (update.startDate || update.endDate) {
    // Get the current document to merge with updates
    this.model.findOne(this.getQuery()).then(doc => {
      if (!doc) {
        return next(new Error('Leave record not found'));
      }
      
      const startDate = new Date(update.startDate || doc.startDate);
      const endDate = new Date(update.endDate || doc.endDate);
      
      // Validate date range
      if (endDate < startDate) {
        return next(new Error('End date cannot be before start date'));
      }
      
      // Auto-calculate numberOfDays
      if (update.halfDay !== undefined) {
        update.numberOfDays = update.halfDay ? 0.5 : calculateBusinessDays(startDate, endDate);
      } else {
        update.numberOfDays = doc.halfDay ? 0.5 : calculateBusinessDays(startDate, endDate);
      }
      
      // Ensure numberOfDays is positive
      if (update.numberOfDays <= 0) {
        return next(new Error('Number of days must be greater than 0'));
      }
      
      next();
    }).catch(err => next(err));
    return;
  }
  
  next();
});

// Static method to validate leave dates
leaveSchema.statics.validateLeaveDates = function(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Clear time part for accurate date comparison
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  if (end < start) {
    throw new Error('End date cannot be before start date');
  }
  
  return {
    isValid: true,
    businessDays: calculateBusinessDays(start, end),
    totalDays: calculateTotalDays(start, end)
  };
};

module.exports = mongoose.model('Leave', leaveSchema);
