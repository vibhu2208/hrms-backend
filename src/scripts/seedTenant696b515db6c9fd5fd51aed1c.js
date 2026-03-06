/**
 * Seed Script for Tenant: tenant_696b515db6c9fd5fd51aed1c
 * Creates:
 * - 1 HR user
 * - 1 Admin user
 * - 4 Job postings
 * - 10-12 candidates for each job posting
 * 
 * Run: node src/scripts/seedTenant696b515db6c9fd5fd51aed1c.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TENANT_ID = '696b515db6c9fd5fd51aed1c';
const TENANT_DB_NAME = `tenant_${TENANT_ID}`;
const BASE_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net';
const TENANT_DB_URI = `${BASE_URI}/${TENANT_DB_NAME}?retryWrites=true&w=majority`;

// Define schemas
const departmentSchema = new mongoose.Schema({
  name: String,
  code: String,
  description: String,
  head: mongoose.Schema.Types.ObjectId,
  isActive: { type: Boolean, default: true }
}, { timestamps: true, strict: false });

const tenantUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  phone: String,
  role: { type: String, enum: ['company_admin', 'hr', 'manager', 'employee'], required: true },
  employeeId: mongoose.Schema.Types.ObjectId,
  department: String,
  departmentId: mongoose.Schema.Types.ObjectId,
  designation: String,
  isActive: { type: Boolean, default: true },
  permissions: mongoose.Schema.Types.Mixed
}, { timestamps: true, strict: false });

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
}, { timestamps: true, strict: false });

const candidateSchema = new mongoose.Schema({
  candidateCode: String,
  firstName: String,
  lastName: String,
  email: { type: String, lowercase: true },
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
    metadata: mongoose.Schema.Types.Mixed,
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
  aiAnalysis: mongoose.Schema.Types.Mixed,
  applicationHistory: [{
    jobId: mongoose.Schema.Types.ObjectId,
    jobTitle: String,
    appliedDate: Date,
    stage: String,
    status: String,
    outcome: String,
    interviews: [mongoose.Schema.Types.ObjectId],
    onboardingRecord: mongoose.Schema.Types.ObjectId,
    offboardingRecord: mongoose.Schema.Types.ObjectId
  }],
  masterCandidateId: mongoose.Schema.Types.ObjectId
}, { timestamps: true, strict: false });

// Helper function to generate candidate data
const generateCandidate = (index, jobId, jobTitle, firstName, lastName, baseEmail, basePhone, stage = 'applied') => {
  const stages = ['applied', 'screening', 'shortlisted', 'interview-scheduled', 'interview-completed', 'offer-extended', 'offer-accepted', 'rejected'];
  const sources = ['linkedin', 'naukri', 'referral', 'job-portal', 'walk-in', 'other'];
  const locations = ['Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Hyderabad', 'Chennai'];
  
  const candidateStage = stage || stages[Math.floor(Math.random() * stages.length)];
  const experienceYears = Math.floor(Math.random() * 8) + 2; // 2-10 years
  const currentCTC = Math.floor(Math.random() * 500000) + 500000; // 5L - 10L
  const expectedCTC = currentCTC + Math.floor(Math.random() * 200000); // 10-20% more
  
  return {
    firstName,
    lastName,
    email: `${baseEmail}${index}@example.com`,
    phone: `${basePhone}${String(index).padStart(4, '0')}`,
    currentLocation: locations[Math.floor(Math.random() * locations.length)],
    preferredLocation: [locations[Math.floor(Math.random() * locations.length)]],
    source: sources[Math.floor(Math.random() * sources.length)],
    appliedFor: jobId,
    experience: { years: experienceYears, months: Math.floor(Math.random() * 12) },
    currentCompany: `Company ${index}`,
    currentDesignation: 'Software Engineer',
    currentCTC,
    expectedCTC,
    noticePeriod: [15, 30, 45, 60][Math.floor(Math.random() * 4)],
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS'],
    education: [{
      degree: 'Bachelor of Technology',
      specialization: 'Computer Science',
      institution: 'University',
      passingYear: 2020 - experienceYears,
      percentage: 75 + Math.floor(Math.random() * 15)
    }],
    stage: candidateStage,
    status: candidateStage === 'rejected' ? 'rejected' : 'active',
    timeline: [{
      action: 'Application Submitted',
      description: `Applied for ${jobTitle}`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
    }],
    applicationHistory: [{
      jobId,
      jobTitle,
      appliedDate: new Date(),
      stage: candidateStage,
      status: candidateStage === 'rejected' ? 'rejected' : 'active',
      outcome: null
    }]
  };
};

async function seedTenant() {
  let tenantConnection = null;
  let globalConnection = null;
  
  try {
    // First, check/update CompanyRegistry in hrms_global
    console.log('🔄 Checking CompanyRegistry...');
    const GLOBAL_DB_URI = `${BASE_URI}/hrms_global?retryWrites=true&w=majority`;
    globalConnection = await mongoose.createConnection(GLOBAL_DB_URI);
    
    const CompanyRegistrySchema = new mongoose.Schema({
      companyId: String,
      companyName: String,
      tenantDatabaseName: String,
      email: String,
      phone: String,
      status: String,
      databaseStatus: String,
      companyCode: String
    }, { strict: false, timestamps: true });
    
    const CompanyRegistry = globalConnection.model('CompanyRegistry', CompanyRegistrySchema);
    
    // Check if company exists in registry
    let companyRegistry = await CompanyRegistry.findOne({ 
      companyId: TENANT_ID,
      tenantDatabaseName: TENANT_DB_NAME
    });
    
    if (!companyRegistry) {
      console.log('📝 Creating CompanyRegistry entry...');
      companyRegistry = await CompanyRegistry.create({
        companyId: TENANT_ID,
        companyName: 'Demo Company',
        tenantDatabaseName: TENANT_DB_NAME,
        email: 'company@demo.com',
        phone: '+91-9876543210',
        status: 'active',
        databaseStatus: 'active',
        companyCode: 'DEMO001'
      });
      console.log('✅ Created CompanyRegistry entry\n');
    } else {
      // Ensure status is active
      if (companyRegistry.status !== 'active' || companyRegistry.databaseStatus !== 'active') {
        await CompanyRegistry.updateOne(
          { _id: companyRegistry._id },
          { status: 'active', databaseStatus: 'active' }
        );
        console.log('✅ Updated CompanyRegistry status to active\n');
      } else {
        console.log('✅ CompanyRegistry entry exists and is active\n');
      }
    }
    
    console.log('🔄 Connecting to tenant database...');
    console.log(`   Database: ${TENANT_DB_NAME}`);
    tenantConnection = await mongoose.createConnection(TENANT_DB_URI);
    console.log('✅ Connected to Tenant Database\n');

    // Get models
    // IMPORTANT: Model name must be 'User' (not 'TenantUser') to match login controller
    const Department = tenantConnection.model('Department', departmentSchema);
    const TenantUser = tenantConnection.model('User', tenantUserSchema);
    const JobPosting = tenantConnection.model('JobPosting', jobPostingSchema);
    const Candidate = tenantConnection.model('Candidate', candidateSchema);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    try {
      await TenantUser.deleteMany({});
      await JobPosting.deleteMany({});
      await Candidate.deleteMany({});
      console.log('✅ Cleared existing data\n');
    } catch (error) {
      console.log('⚠️  Could not clear existing data (continuing anyway):', error.message);
      console.log('');
    }

    // Create or get departments
    console.log('📝 Creating/Getting departments...');
    let departments = await Department.find({});
    
    if (departments.length === 0) {
      departments = await Department.insertMany([
        { name: 'Engineering', code: 'ENG', description: 'Software Development', isActive: true },
        { name: 'Human Resources', code: 'HR', description: 'HR and Talent Management', isActive: true },
        { name: 'Sales', code: 'SALES', description: 'Sales and Business Development', isActive: true },
        { name: 'Marketing', code: 'MKT', description: 'Marketing and Brand Management', isActive: true }
      ]);
      console.log(`✅ Created ${departments.length} departments\n`);
    } else {
      console.log(`✅ Found ${departments.length} existing departments\n`);
    }

    // Create users
    console.log('📝 Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const hrUser = await TenantUser.create({
      email: 'hr@company.com',
      password: hashedPassword,
      firstName: 'HR',
      lastName: 'Manager',
      phone: '+91-9876543210',
      role: 'hr',
      designation: 'HR Manager',
      department: 'Human Resources',
      departmentId: departments.find(d => d.code === 'HR')?._id,
      isActive: true,
      permissions: {
        canManageEmployees: true,
        canManagePayroll: false,
        canViewReports: true,
        canManageSettings: false,
        canManageRecruitment: true,
        canManageAttendance: true,
        canManageLeaves: true,
        canManageAssets: false
      }
    });

    const adminUser = await TenantUser.create({
      email: 'admin@company.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+91-9876543211',
      role: 'company_admin',
      designation: 'Company Administrator',
      isActive: true,
      permissions: {
        canManageEmployees: true,
        canManagePayroll: true,
        canViewReports: true,
        canManageSettings: true,
        canManageRecruitment: true,
        canManageAttendance: true,
        canManageLeaves: true,
        canManageAssets: true
      }
    });

    console.log(`✅ Created HR user: ${hrUser.email}`);
    console.log(`✅ Created Admin user: ${adminUser.email}\n`);

    // Create job postings
    console.log('📝 Creating job postings...');
    const jobPostings = [
      {
        title: 'Senior Full Stack Developer',
        department: departments.find(d => d.code === 'ENG')?._id || departments[0]._id,
        location: 'Mumbai',
        employmentType: 'full-time',
        experience: { min: 5, max: 8 },
        salary: { min: 1200000, max: 2000000, currency: 'INR' },
        description: 'We are looking for an experienced Full Stack Developer to join our engineering team. You will be responsible for designing and developing scalable web applications.',
        requirements: [
          '5+ years of experience in full stack development',
          'Strong proficiency in React, Node.js, and MongoDB',
          'Experience with cloud platforms (AWS/Azure)',
          'Excellent problem-solving skills'
        ],
        responsibilities: [
          'Design and develop scalable web applications',
          'Collaborate with cross-functional teams',
          'Write clean, maintainable code',
          'Mentor junior developers'
        ],
        skills: ['React', 'Node.js', 'MongoDB', 'AWS', 'Docker', 'Kubernetes'],
        openings: 3,
        status: 'active',
        postedBy: adminUser._id,
        postedDate: new Date(),
        closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        applications: 0
      },
      {
        title: 'HR Manager',
        department: departments.find(d => d.code === 'HR')?._id || departments[1]._id,
        location: 'Bangalore',
        employmentType: 'full-time',
        experience: { min: 7, max: 10 },
        salary: { min: 900000, max: 1500000, currency: 'INR' },
        description: 'Seeking an experienced HR Manager to lead our people operations and talent management initiatives.',
        requirements: [
          '7+ years of HR experience',
          'Strong knowledge of HR best practices',
          'Experience with HRMS systems',
          'Excellent communication skills'
        ],
        responsibilities: [
          'Manage end-to-end recruitment process',
          'Develop HR policies and procedures',
          'Handle employee relations',
          'Lead performance management initiatives'
        ],
        skills: ['Recruitment', 'Employee Relations', 'HRMS', 'Performance Management', 'Compliance'],
        openings: 1,
        status: 'active',
        postedBy: hrUser._id,
        postedDate: new Date(),
        closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        applications: 0
      },
      {
        title: 'Sales Executive',
        department: departments.find(d => d.code === 'SALES')?._id || departments[2]._id,
        location: 'Delhi',
        employmentType: 'full-time',
        experience: { min: 3, max: 5 },
        salary: { min: 600000, max: 1000000, currency: 'INR' },
        description: 'Join our dynamic sales team and drive business growth through effective client relationships.',
        requirements: [
          '3+ years of B2B sales experience',
          'Proven track record of meeting sales targets',
          'Strong negotiation skills',
          'CRM experience (Salesforce preferred)'
        ],
        responsibilities: [
          'Generate new business opportunities',
          'Build and maintain client relationships',
          'Achieve monthly and quarterly sales targets',
          'Prepare sales reports and forecasts'
        ],
        skills: ['B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Account Management'],
        openings: 5,
        status: 'active',
        postedBy: adminUser._id,
        postedDate: new Date(),
        closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        applications: 0
      },
      {
        title: 'Digital Marketing Specialist',
        department: departments.find(d => d.code === 'MKT')?._id || departments[3]._id,
        location: 'Pune',
        employmentType: 'full-time',
        experience: { min: 2, max: 4 },
        salary: { min: 500000, max: 800000, currency: 'INR' },
        description: 'Looking for a creative Digital Marketing Specialist to enhance our online presence and drive brand awareness.',
        requirements: [
          '2+ years of digital marketing experience',
          'Proficiency in SEO, SEM, and social media marketing',
          'Experience with Google Analytics and Ads',
          'Strong content creation skills'
        ],
        responsibilities: [
          'Develop and execute digital marketing campaigns',
          'Manage social media channels',
          'Optimize website for search engines',
          'Analyze campaign performance and ROI'
        ],
        skills: ['SEO', 'SEM', 'Social Media Marketing', 'Google Analytics', 'Content Marketing'],
        openings: 2,
        status: 'active',
        postedBy: hrUser._id,
        postedDate: new Date(),
        closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        applications: 0
      }
    ];

    const createdJobs = await JobPosting.insertMany(jobPostings);
    console.log(`✅ Created ${createdJobs.length} job postings\n`);

    // Create candidates for each job (10-12 per job)
    console.log('📝 Creating candidates...');
    const firstNames = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Amanda', 'James', 'Lisa', 'William', 'Ashley', 'Daniel', 'Michelle', 'Christopher', 'Nicole'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor'];
    
    let candidateCount = 0;
    const allCandidates = [];

    for (const job of createdJobs) {
      const candidatesForJob = [];
      const numCandidates = 10 + Math.floor(Math.random() * 3); // 10-12 candidates
      
      for (let i = 0; i < numCandidates; i++) {
        candidateCount++;
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const baseEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
        const basePhone = '98765';
        
        // Vary stages for candidates
        const stages = ['applied', 'screening', 'shortlisted', 'interview-scheduled', 'interview-completed', 'offer-extended'];
        const stage = stages[Math.floor(Math.random() * stages.length)];
        
        const candidate = generateCandidate(
          candidateCount,
          job._id,
          job.title,
          firstName,
          lastName,
          baseEmail,
          basePhone,
          stage
        );
        
        candidate.candidateCode = `CAN${String(candidateCount).padStart(5, '0')}`;
        candidatesForJob.push(candidate);
      }
      
      allCandidates.push(...candidatesForJob);
      console.log(`   Created ${candidatesForJob.length} candidates for "${job.title}"`);
    }

    const createdCandidates = await Candidate.insertMany(allCandidates);
    console.log(`✅ Created ${createdCandidates.length} total candidates\n`);

    // Update job postings with application counts
    for (const job of createdJobs) {
      const count = createdCandidates.filter(c => c.appliedFor.toString() === job._id.toString()).length;
      await JobPosting.findByIdAndUpdate(job._id, { applications: count });
    }
    console.log('✅ Updated job application counts\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 TENANT SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 Summary:');
    console.log(`   Tenant Database: ${TENANT_DB_NAME}`);
    console.log(`   HR User: ${hrUser.email} (password: password123)`);
    console.log(`   Admin User: ${adminUser.email} (password: password123)`);
    console.log(`   Departments: ${departments.length}`);
    console.log(`   Job Postings: ${createdJobs.length}`);
    console.log(`   Candidates: ${createdCandidates.length}\n`);

    console.log('💼 Job Postings Created:');
    createdJobs.forEach((job, index) => {
      const candidateCount = createdCandidates.filter(c => c.appliedFor.toString() === job._id.toString()).length;
      console.log(`   ${index + 1}. ${job.title} - ${candidateCount} candidates`);
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 Login Credentials:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('HR User:');
    console.log(`   Email: ${hrUser.email}`);
    console.log(`   Password: password123\n`);
    console.log('Admin User:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: password123\n`);

    // Close connections
    await tenantConnection.close();
    if (globalConnection) await globalConnection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding tenant:', error.message);
    console.error(error);
    
    if (tenantConnection) {
      try {
        await tenantConnection.close();
      } catch (closeError) {
        console.error('Error closing tenant connection:', closeError.message);
      }
    }
    
    if (globalConnection) {
      try {
        await globalConnection.close();
      } catch (closeError) {
        console.error('Error closing global connection:', closeError.message);
      }
    }
    
    process.exit(1);
  }
}

seedTenant();
