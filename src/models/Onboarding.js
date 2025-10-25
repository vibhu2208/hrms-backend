const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false
  },
  candidateName: {
    type: String,
    required: true
  },
  candidateEmail: {
    type: String,
    required: true
  },
  candidatePhone: {
    type: String
  },
  position: {
    type: String,
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  joiningDate: {
    type: Date
  },
  stages: [{
    type: String,
    enum: ['interview1', 'hrDiscussion', 'documentation', 'success']
  }],
  currentStage: {
    type: String,
    enum: ['interview1', 'hrDiscussion', 'documentation', 'success'],
    default: 'interview1'
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'cancelled'],
    default: 'in-progress'
  },
  documents: [{
    type: {
      type: String,
      enum: ['resume', 'offer-letter', 'id-proof', 'address-proof', 'education', 'other']
    },
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tasks: [{
    title: String,
    description: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    },
    completedAt: Date
  }],
  notes: {
    type: String
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Onboarding', onboardingSchema);
