const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeCode: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['', 'male', 'female', 'other'],
    required: false
  },
  bloodGroup: {
    type: String,
    enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: false
  },
  maritalStatus: {
    type: String,
    enum: ['', 'single', 'married', 'divorced', 'widowed'],
    required: false
  },
  alternatePhone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  permanentAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  correspondenceAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false
  },
  designation: {
    type: String,
    required: true
  },
  joiningDate: {
    type: Date,
    required: true
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'intern'],
    default: 'full-time'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'terminated', 'on-leave'],
    default: 'active'
  },
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  salary: {
    basic: Number,
    hra: Number,
    allowances: Number,
    deductions: Number,
    total: Number
  },
  bankDetails: {
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    accountHolderName: String,
    branch: String
  },
  idDetails: {
    aadhaar: String,
    pan: String,
    passport: {
      number: String,
      issueDate: Date,
      expiryDate: Date
    },
    drivingLicense: String
  },
  education: [{
    degree: String,
    specialization: String,
    institution: String,
    passingYear: Number,
    percentage: Number,
    documentUrl: String,
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date
  }],
  experience: [{
    company: String,
    designation: String,
    startDate: Date,
    endDate: Date,
    duration: String,
    responsibilities: String
  }],
  currentProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  currentClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
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
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  profileImage: {
    type: String
  }
}, {
  timestamps: true
});

// Generate employee code before saving
employeeSchema.pre('save', async function(next) {
  if (!this.employeeCode) {
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeCode = `EMP${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

const Employee = mongoose.model('Employee', employeeSchema);
Employee.schema = employeeSchema;
module.exports = Employee;
