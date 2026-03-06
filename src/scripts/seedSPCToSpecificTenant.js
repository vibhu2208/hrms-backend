/**
 * Seed SPC Management Company and Data to Specific Tenant Database
 * Creates SPC company, users, job postings, and candidates
 * 
 * Run: node src/scripts/seedSPCToSpecificTenant.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Target tenant database
const TENANT_ID = '696b515db6c9fd5fd51aed1c';
const BASE_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net';
const SPC_DB_URI = `${BASE_URI}/hrms_spc?retryWrites=true&w=majority`;
const TENANT_DB_URI = `${BASE_URI}/tenant_${TENANT_ID}?retryWrites=true&w=majority`;

// Define schemas
const companySchema = new mongoose.Schema({
  companyCode: String,
  companyName: String,
  email: String,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  databaseName: String,
  databaseStatus: String,
  adminUser: {
    email: String,
    userId: mongoose.Schema.Types.ObjectId,
    createdAt: Date
  },
  subscription: {
    plan: String,
    startDate: Date,
    endDate: Date,
    status: String,
    maxEmployees: Number,
    maxAdmins: Number
  },
  enabledModules: [String],
  status: String,
  isActive: Boolean
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  authProvider: { type: String, default: 'local' },
  role: String,
  clientId: mongoose.Schema.Types.ObjectId,
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  isFirstLogin: { type: Boolean, default: true },
  themePreference: { type: String, default: 'dark' }
}, { timestamps: true });

const departmentSchema = new mongoose.Schema({
  name: String,
  code: String,
  description: String,
  head: mongoose.Schema.Types.ObjectId,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const jobPostingSchema = new mongoose.Schema({
  title: String,
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  location: String,
  employmentType: String,
  experience: { min: Number, max: Number },
  salary: { min: Number, max: Number, currency: String },
  description: String,
  requirements: [String],
  responsibilities: [String],
  skills: [String],
  openings: Number,
  status: String,
  postedBy: mongoose.Schema.Types.ObjectId,
  postedDate: Date,
  closingDate: Date,
  applications: { type: Number, default: 0 }
}, { timestamps: true });

const candidateSchema = new mongoose.Schema({
  candidateCode: String,
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  alternatePhone: String,
  currentLocation: String,
  preferredLocation: [String],
  source: String,
  appliedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' },
  experience: { years: Number, months: Number },
  professionalExperience: [{
    company: String,
    designation: String,
    startDate: Date,
    endDate: Date,
    currentlyWorking: Boolean,
    responsibilities: String,
    achievements: String,
    technologies: [String],
    ctc: Number,
    reasonForLeaving: String
  }],
  currentCompany: String,
  currentDesignation: String,
  currentCTC: Number,
  expectedCTC: Number,
  noticePeriod: Number,
  skills: [String],
  education: [{
    degree: String,
    specialization: String,
    institution: String,
    passingYear: Number,
    percentage: Number
  }],
  resume: {
    url: String,
    filename: String,
    originalName: String,
    uploadedAt: Date
  },
  stage: String,
  interviews: [{
    interviewType: String,
    round: String,
    scheduledDate: Date,
    scheduledTime: String,
    meetingLink: String,
    meetingPlatform: String,
    interviewer: [mongoose.Schema.Types.ObjectId],
    feedback: String,
    rating: Number,
    decision: String,
    notes: String,
    status: String,
    completedAt: Date,
    createdAt: Date
  }],
  timeline: [{
    action: String,
    description: String,
    performedBy: mongoose.Schema.Types.ObjectId,
    timestamp: Date
  }],
  offerDetails: {
    offeredCTC: Number,
    offeredDesignation: String,
    joiningDate: Date,
    offerExtendedDate: Date
  },
  rejectionReason: String,
  notes: String,
  status: String,
  isActive: { type: Boolean, default: true },
  aiAnalysis: {
    matchScore: Number,
    analysisDate: Date,
    skillsMatch: {
      matched: [String],
      missing: [String],
      additional: [String],
      matchPercentage: Number
    },
    keyHighlights: [String],
    weaknesses: [String],
    overallFit: String,
    isAnalyzed: Boolean
  }
}, { timestamps: true });

const seedSPCToTenant = async () => {
  let spcConnection = null;
  let tenantConnection = null;
  
  try {
    console.log(`🔄 Seeding SPC Management to tenant: ${TENANT_ID}\n`);
    
    // Step 1: Connect to SPC database and create/update company
    console.log('🔄 Connecting to SPC database...');
    spcConnection = await mongoose.createConnection(SPC_DB_URI);
    console.log('✅ Connected to SPC Database\n');
    
    const Company = spcConnection.model('Company', companySchema);
    
    // Delete existing SPC company and create new one with specific ID
    await Company.deleteMany({ companyName: 'SPC Management' });
    
    console.log('📝 Creating SPC Management company...');
    const spcCompany = await Company.create({
      _id: new mongoose.Types.ObjectId(TENANT_ID),
      companyCode: 'SPC00001',
      companyName: 'SPC Management',
      email: 'admin@spc.com',
      phone: '+1-555-9999',
      address: {
        street: '100 SPC Plaza',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      },
      databaseName: 'hrms_spc',
      databaseStatus: 'active',
      adminUser: {
        email: 'admin@spc.com',
        createdAt: new Date()
      },
      subscription: {
        plan: 'enterprise',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'active',
        maxEmployees: 1000,
        maxAdmins: 20
      },
      enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance', 'assets', 'compliance'],
      status: 'active',
      isActive: true
    });
    console.log(`✅ SPC Company created with ID: ${spcCompany._id}\n`);
    
    // Step 2: Connect to tenant database
    console.log(`🔄 Connecting to tenant database: tenant_${TENANT_ID}...`);
    tenantConnection = await mongoose.createConnection(TENANT_DB_URI);
    console.log('✅ Connected to Tenant Database\n');
    
    // Step 3: Create users
    console.log('📝 Creating test users...');
    const User = tenantConnection.model('User', userSchema);
    
    await User.deleteMany({ email: { $regex: '@spc.com$' } });
    
    const testUsers = [
      { email: 'admin@spc.com', password: 'admin123', role: 'admin', clientId: spcCompany._id },
      { email: 'hr@spc.com', password: 'hr123', role: 'hr', clientId: spcCompany._id },
      { email: 'hr.manager@spc.com', password: 'hrmanager123', role: 'hr', clientId: spcCompany._id },
      { email: 'recruiter@spc.com', password: 'recruiter123', role: 'hr', clientId: spcCompany._id }
    ];
    
    for (const userData of testUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      await User.create({
        ...userData,
        password: hashedPassword,
        authProvider: 'local',
        isActive: true,
        isFirstLogin: false,
        themePreference: 'dark'
      });
    }
    console.log(`✅ Created ${testUsers.length} users\n`);
    
    // Step 4: Create departments
    console.log('📝 Creating departments...');
    const Department = tenantConnection.model('Department', departmentSchema);
    await Department.deleteMany({});
    
    const departments = await Department.insertMany([
      { name: 'Engineering', code: 'ENG', description: 'Software Development and Engineering', isActive: true },
      { name: 'Human Resources', code: 'HR', description: 'HR and Talent Management', isActive: true },
      { name: 'Sales', code: 'SALES', description: 'Sales and Business Development', isActive: true },
      { name: 'Marketing', code: 'MKT', description: 'Marketing and Brand Management', isActive: true },
      { name: 'Finance', code: 'FIN', description: 'Finance and Accounting', isActive: true }
    ]);
    console.log(`✅ Created ${departments.length} departments\n`);
    
    // Step 5: Create job postings
    console.log('📝 Creating job postings...');
    const JobPosting = tenantConnection.model('JobPosting', jobPostingSchema);
    await JobPosting.deleteMany({});
    
    const jobPostings = [
      {
        title: 'Senior Full Stack Developer',
        department: departments[0]._id,
        location: 'New York, NY',
        employmentType: 'full-time',
        experience: { min: 5, max: 8 },
        salary: { min: 120000, max: 160000, currency: 'USD' },
        description: 'We are looking for an experienced Full Stack Developer to join our engineering team.',
        requirements: ['5+ years of experience in full stack development', 'Strong proficiency in React, Node.js, and MongoDB', 'Experience with cloud platforms (AWS/Azure)', 'Excellent problem-solving skills'],
        responsibilities: ['Design and develop scalable web applications', 'Collaborate with cross-functional teams', 'Write clean, maintainable code', 'Mentor junior developers'],
        skills: ['React', 'Node.js', 'MongoDB', 'AWS', 'Docker', 'Kubernetes'],
        openings: 3,
        status: 'active',
        postedDate: new Date('2024-01-15'),
        closingDate: new Date('2024-03-15'),
        applications: 0
      },
      {
        title: 'HR Manager',
        department: departments[1]._id,
        location: 'New York, NY',
        employmentType: 'full-time',
        experience: { min: 7, max: 10 },
        salary: { min: 90000, max: 120000, currency: 'USD' },
        description: 'Seeking an experienced HR Manager to lead our people operations.',
        requirements: ['7+ years of HR experience', 'Strong knowledge of HR best practices', 'Experience with HRMS systems', 'Excellent communication skills'],
        responsibilities: ['Manage end-to-end recruitment process', 'Develop HR policies and procedures', 'Handle employee relations', 'Lead performance management initiatives'],
        skills: ['Recruitment', 'Employee Relations', 'HRMS', 'Performance Management', 'Compliance'],
        openings: 1,
        status: 'active',
        postedDate: new Date('2024-01-10'),
        closingDate: new Date('2024-03-10'),
        applications: 0
      },
      {
        title: 'Sales Executive',
        department: departments[2]._id,
        location: 'Remote',
        employmentType: 'full-time',
        experience: { min: 3, max: 5 },
        salary: { min: 60000, max: 90000, currency: 'USD' },
        description: 'Join our dynamic sales team and drive business growth.',
        requirements: ['3+ years of B2B sales experience', 'Proven track record of meeting sales targets', 'Strong negotiation skills', 'CRM experience (Salesforce preferred)'],
        responsibilities: ['Generate new business opportunities', 'Build and maintain client relationships', 'Achieve monthly and quarterly sales targets', 'Prepare sales reports and forecasts'],
        skills: ['B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Account Management'],
        openings: 5,
        status: 'active',
        postedDate: new Date('2024-01-20'),
        closingDate: new Date('2024-03-20'),
        applications: 0
      },
      {
        title: 'Digital Marketing Specialist',
        department: departments[3]._id,
        location: 'New York, NY',
        employmentType: 'full-time',
        experience: { min: 2, max: 4 },
        salary: { min: 55000, max: 75000, currency: 'USD' },
        description: 'Looking for a creative Digital Marketing Specialist to enhance our online presence.',
        requirements: ['2+ years of digital marketing experience', 'Proficiency in SEO, SEM, and social media marketing', 'Experience with Google Analytics and Ads', 'Strong content creation skills'],
        responsibilities: ['Develop and execute digital marketing campaigns', 'Manage social media channels', 'Optimize website for search engines', 'Analyze campaign performance and ROI'],
        skills: ['SEO', 'SEM', 'Social Media Marketing', 'Google Analytics', 'Content Marketing'],
        openings: 2,
        status: 'active',
        postedDate: new Date('2024-01-18'),
        closingDate: new Date('2024-03-18'),
        applications: 0
      },
      {
        title: 'Financial Analyst',
        department: departments[4]._id,
        location: 'New York, NY',
        employmentType: 'full-time',
        experience: { min: 3, max: 6 },
        salary: { min: 70000, max: 95000, currency: 'USD' },
        description: 'Seeking a detail-oriented Financial Analyst to support our finance team.',
        requirements: ['3+ years of financial analysis experience', 'Strong Excel and financial modeling skills', 'CPA or CFA preferred', 'Experience with ERP systems'],
        responsibilities: ['Prepare financial reports and forecasts', 'Conduct variance analysis', 'Support budgeting and planning processes', 'Provide financial insights to management'],
        skills: ['Financial Analysis', 'Excel', 'Financial Modeling', 'SAP', 'Budgeting'],
        openings: 2,
        status: 'active',
        postedDate: new Date('2024-01-12'),
        closingDate: new Date('2024-03-12'),
        applications: 0
      }
    ];
    
    const createdJobs = await JobPosting.insertMany(jobPostings);
    console.log(`✅ Created ${createdJobs.length} job postings\n`);
    
    // Step 6: Create candidates
    console.log('📝 Creating candidates...');
    const Candidate = tenantConnection.model('Candidate', candidateSchema);
    await Candidate.deleteMany({});
    
    const candidateTemplates = [
      {
        candidateCode: 'CAN00001',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phone: '+1-555-1001',
        currentLocation: 'New York, NY',
        preferredLocation: ['New York, NY', 'Remote'],
        source: 'linkedin',
        appliedFor: createdJobs[0]._id,
        experience: { years: 6, months: 3 },
        currentCompany: 'Tech Solutions Inc',
        currentDesignation: 'Senior Developer',
        currentCTC: 130000,
        expectedCTC: 150000,
        noticePeriod: 30,
        skills: ['React', 'Node.js', 'MongoDB', 'AWS', 'Docker', 'TypeScript'],
        education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science', institution: 'MIT', passingYear: 2017, percentage: 85 }],
        stage: 'screening',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for Senior Full Stack Developer', timestamp: new Date() }],
        aiAnalysis: {
          matchScore: 92,
          analysisDate: new Date(),
          skillsMatch: { matched: ['React', 'Node.js', 'MongoDB', 'AWS', 'Docker'], missing: ['Kubernetes'], additional: ['TypeScript'], matchPercentage: 85 },
          keyHighlights: ['Strong full stack experience', 'Cloud expertise', 'Leadership potential'],
          weaknesses: ['Limited Kubernetes experience'],
          overallFit: 'excellent',
          isAnalyzed: true
        }
      },
      {
        candidateCode: 'CAN00002',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+1-555-1002',
        currentLocation: 'San Francisco, CA',
        preferredLocation: ['New York, NY', 'San Francisco, CA'],
        source: 'naukri',
        appliedFor: createdJobs[0]._id,
        experience: { years: 7, months: 0 },
        currentCompany: 'Digital Innovations',
        currentDesignation: 'Lead Developer',
        currentCTC: 145000,
        expectedCTC: 165000,
        noticePeriod: 60,
        skills: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'Kubernetes', 'GraphQL'],
        education: [{ degree: 'Master of Computer Science', specialization: 'Software Engineering', institution: 'Stanford University', passingYear: 2016, percentage: 88 }],
        stage: 'interview-scheduled',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for Senior Full Stack Developer', timestamp: new Date() }],
        interviews: [{
          interviewType: 'Technical',
          round: 'Round 1',
          scheduledDate: new Date('2024-02-15'),
          scheduledTime: '10:00 AM',
          meetingLink: 'https://meet.google.com/abc-defg-hij',
          meetingPlatform: 'Google Meet',
          status: 'scheduled',
          createdAt: new Date()
        }],
        aiAnalysis: {
          matchScore: 95,
          analysisDate: new Date(),
          skillsMatch: { matched: ['React', 'Node.js', 'AWS', 'Kubernetes'], missing: ['MongoDB'], additional: ['PostgreSQL', 'GraphQL'], matchPercentage: 90 },
          keyHighlights: ['Extensive experience', 'Strong technical skills', 'Leadership experience'],
          weaknesses: ['MongoDB experience needed'],
          overallFit: 'excellent',
          isAnalyzed: true
        }
      },
      {
        candidateCode: 'CAN00003',
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'michael.brown@email.com',
        phone: '+1-555-2001',
        currentLocation: 'New York, NY',
        preferredLocation: ['New York, NY'],
        source: 'referral',
        appliedFor: createdJobs[1]._id,
        experience: { years: 8, months: 6 },
        currentCompany: 'Global HR Solutions',
        currentDesignation: 'HR Manager',
        currentCTC: 105000,
        expectedCTC: 115000,
        noticePeriod: 45,
        skills: ['Recruitment', 'Employee Relations', 'HRMS', 'Performance Management', 'Compliance', 'Training'],
        education: [{ degree: 'MBA', specialization: 'Human Resources', institution: 'Columbia Business School', passingYear: 2015, percentage: 82 }],
        stage: 'shortlisted',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for HR Manager', timestamp: new Date() }],
        aiAnalysis: {
          matchScore: 88,
          analysisDate: new Date(),
          skillsMatch: { matched: ['Recruitment', 'Employee Relations', 'HRMS', 'Performance Management', 'Compliance'], missing: [], additional: ['Training'], matchPercentage: 100 },
          keyHighlights: ['Extensive HR experience', 'Strong leadership', 'HRMS expertise'],
          weaknesses: [],
          overallFit: 'excellent',
          isAnalyzed: true
        }
      },
      {
        candidateCode: 'CAN00004',
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@email.com',
        phone: '+1-555-3001',
        currentLocation: 'Chicago, IL',
        preferredLocation: ['Remote', 'Chicago, IL'],
        source: 'job-portal',
        appliedFor: createdJobs[2]._id,
        experience: { years: 4, months: 2 },
        currentCompany: 'SalesPro Inc',
        currentDesignation: 'Sales Executive',
        currentCTC: 75000,
        expectedCTC: 85000,
        noticePeriod: 30,
        skills: ['B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Account Management', 'Cold Calling'],
        education: [{ degree: 'Bachelor of Business Administration', specialization: 'Marketing', institution: 'University of Chicago', passingYear: 2019, percentage: 78 }],
        stage: 'applied',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for Sales Executive', timestamp: new Date() }],
        aiAnalysis: {
          matchScore: 85,
          analysisDate: new Date(),
          skillsMatch: { matched: ['B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Account Management'], missing: [], additional: ['Cold Calling'], matchPercentage: 100 },
          keyHighlights: ['Strong sales track record', 'Salesforce proficiency', 'Excellent communication'],
          weaknesses: ['Slightly less experience than ideal'],
          overallFit: 'good',
          isAnalyzed: true
        }
      },
      {
        candidateCode: 'CAN00005',
        firstName: 'David',
        lastName: 'Wilson',
        email: 'david.wilson@email.com',
        phone: '+1-555-3002',
        currentLocation: 'Boston, MA',
        preferredLocation: ['Remote'],
        source: 'linkedin',
        appliedFor: createdJobs[2]._id,
        experience: { years: 5, months: 0 },
        currentCompany: 'Enterprise Sales Corp',
        currentDesignation: 'Senior Sales Executive',
        currentCTC: 85000,
        expectedCTC: 95000,
        noticePeriod: 30,
        skills: ['B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Account Management', 'Contract Management'],
        education: [{ degree: 'Bachelor of Commerce', specialization: 'Sales & Marketing', institution: 'Boston University', passingYear: 2018, percentage: 80 }],
        stage: 'screening',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for Sales Executive', timestamp: new Date() }],
        aiAnalysis: {
          matchScore: 90,
          analysisDate: new Date(),
          skillsMatch: { matched: ['B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Account Management'], missing: [], additional: ['Contract Management'], matchPercentage: 100 },
          keyHighlights: ['Proven sales success', 'Enterprise experience', 'Strong negotiation skills'],
          weaknesses: [],
          overallFit: 'excellent',
          isAnalyzed: true
        }
      },
      {
        candidateCode: 'CAN00006',
        firstName: 'Jessica',
        lastName: 'Martinez',
        email: 'jessica.martinez@email.com',
        phone: '+1-555-4001',
        currentLocation: 'Los Angeles, CA',
        preferredLocation: ['New York, NY', 'Los Angeles, CA'],
        source: 'linkedin',
        appliedFor: createdJobs[3]._id,
        experience: { years: 3, months: 6 },
        currentCompany: 'Digital Marketing Agency',
        currentDesignation: 'Marketing Specialist',
        currentCTC: 65000,
        expectedCTC: 72000,
        noticePeriod: 30,
        skills: ['SEO', 'SEM', 'Social Media Marketing', 'Google Analytics', 'Content Marketing', 'Email Marketing'],
        education: [{ degree: 'Bachelor of Arts', specialization: 'Marketing', institution: 'UCLA', passingYear: 2020, percentage: 83 }],
        stage: 'interview-completed',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for Digital Marketing Specialist', timestamp: new Date() }],
        interviews: [{
          interviewType: 'HR',
          round: 'Round 1',
          scheduledDate: new Date('2024-02-10'),
          scheduledTime: '2:00 PM',
          meetingLink: 'https://meet.google.com/xyz-abcd-efg',
          meetingPlatform: 'Google Meet',
          status: 'completed',
          completedAt: new Date('2024-02-10'),
          feedback: 'Strong candidate with good marketing knowledge',
          rating: 4,
          decision: 'selected',
          createdAt: new Date()
        }],
        aiAnalysis: {
          matchScore: 87,
          analysisDate: new Date(),
          skillsMatch: { matched: ['SEO', 'SEM', 'Social Media Marketing', 'Google Analytics', 'Content Marketing'], missing: [], additional: ['Email Marketing'], matchPercentage: 100 },
          keyHighlights: ['Strong digital marketing skills', 'Creative mindset', 'Data-driven approach'],
          weaknesses: [],
          overallFit: 'good',
          isAnalyzed: true
        }
      },
      {
        candidateCode: 'CAN00007',
        firstName: 'Robert',
        lastName: 'Taylor',
        email: 'robert.taylor@email.com',
        phone: '+1-555-5001',
        currentLocation: 'New York, NY',
        preferredLocation: ['New York, NY'],
        source: 'naukri',
        appliedFor: createdJobs[4]._id,
        experience: { years: 4, months: 8 },
        currentCompany: 'Finance Corp',
        currentDesignation: 'Financial Analyst',
        currentCTC: 82000,
        expectedCTC: 92000,
        noticePeriod: 45,
        skills: ['Financial Analysis', 'Excel', 'Financial Modeling', 'SAP', 'Budgeting', 'Forecasting'],
        education: [{ degree: 'Bachelor of Commerce', specialization: 'Finance', institution: 'NYU Stern', passingYear: 2019, percentage: 86 }],
        stage: 'offer-extended',
        status: 'active',
        timeline: [{ action: 'Application Submitted', description: 'Applied for Financial Analyst', timestamp: new Date() }],
        offerDetails: {
          offeredCTC: 90000,
          offeredDesignation: 'Financial Analyst',
          joiningDate: new Date('2024-03-01'),
          offerExtendedDate: new Date('2024-02-12')
        },
        aiAnalysis: {
          matchScore: 91,
          analysisDate: new Date(),
          skillsMatch: { matched: ['Financial Analysis', 'Excel', 'Financial Modeling', 'SAP', 'Budgeting'], missing: [], additional: ['Forecasting'], matchPercentage: 100 },
          keyHighlights: ['Strong analytical skills', 'SAP expertise', 'Excellent academic background'],
          weaknesses: [],
          overallFit: 'excellent',
          isAnalyzed: true
        }
      }
    ];
    
    const createdCandidates = await Candidate.insertMany(candidateTemplates);
    console.log(`✅ Created ${createdCandidates.length} candidates\n`);
    
    // Update job application counts
    for (const job of createdJobs) {
      const count = createdCandidates.filter(c => c.appliedFor.equals(job._id)).length;
      await JobPosting.findByIdAndUpdate(job._id, { applications: count });
    }
    console.log('✅ Updated job application counts\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SPC DATA SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📊 Summary:');
    console.log(`   Tenant Database: tenant_${TENANT_ID}`);
    console.log(`   Company ID: ${TENANT_ID}`);
    console.log(`   Users: ${testUsers.length}`);
    console.log(`   Departments: ${departments.length}`);
    console.log(`   Job Postings: ${createdJobs.length}`);
    console.log(`   Candidates: ${createdCandidates.length}\n`);
    
    console.log('👥 Test User Credentials:');
    console.log('═══════════════════════════════════════════════════════');
    testUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.role.toUpperCase()} USER`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
    });
    
    console.log('\n💼 Job Postings:');
    createdJobs.forEach((job, index) => {
      const candidateCount = createdCandidates.filter(c => c.appliedFor.equals(job._id)).length;
      console.log(`   ${index + 1}. ${job.title} - ${candidateCount} candidates`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 Next Steps:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. Login to SPC portal: http://localhost:5173');
    console.log('2. Use credentials: admin@spc.com / admin123');
    console.log('3. Navigate to Job Desk to view postings and candidates\n');
    
    // Close connections
    if (spcConnection) await spcConnection.close();
    if (tenantConnection) await tenantConnection.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding SPC data:', error.message);
    console.error(error);
    
    // Close connections on error
    try {
      if (spcConnection) await spcConnection.close();
      if (tenantConnection) await tenantConnection.close();
    } catch (closeError) {
      console.error('Error closing connections:', closeError.message);
    }
    
    process.exit(1);
  }
};

seedSPCToTenant();
