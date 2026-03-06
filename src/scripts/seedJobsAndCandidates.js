#!/usr/bin/env node
/**
 * Seed Job Postings with Candidates for a Tenant Company
 *
 * Usage:
 *   node src/scripts/seedJobsAndCandidates.js [--companyCode=TTS] [--jobs=3] [--minCandidates=10] [--maxCandidates=15]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
const CompanyRegistrySchema = require('../models/global/CompanyRegistry');
const JobPostingModel = require('../models/JobPosting');
const CandidateModel = require('../models/Candidate');
const DepartmentModel = require('../models/Department');

const DEFAULT_COMPANY_CODE = 'TTS';
const DEFAULT_JOB_COUNT = 3;
const DEFAULT_MIN_CANDIDATES = 10;
const DEFAULT_MAX_CANDIDATES = 15;

const DepartmentSchema = DepartmentModel?.schema;
const JobPostingSchema = JobPostingModel?.schema;
const CandidateSchema = CandidateModel?.schema;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    const [rawKey, rawValue] = arg.split('=');
    if (!rawKey) continue;
    const key = rawKey.replace(/^--/, '');
    const value = rawValue ?? true;
    options[key] = value;
  }

  return options;
}

function ensureTenantModel(connection, name, schema) {
  if (connection.models[name]) {
    return connection.models[name];
  }

  if (!schema) {
    throw new Error(`Schema not provided for tenant model ${name}`);
  }

  return connection.model(name, schema);
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureDepartments(Department) {
  const existing = await Department.find({}).limit(3);
  if (existing.length >= 3) {
    return existing;
  }

  const templates = [
    { name: 'Engineering', code: 'ENG', description: 'Product and platform engineering team' },
    { name: 'Human Resources', code: 'HR', description: 'People operations and talent management' },
    { name: 'Sales & Marketing', code: 'S&M', description: 'Business growth and client relationships' },
    { name: 'Finance', code: 'FIN', description: 'Financial planning and compliance' },
    { name: 'Operations', code: 'OPS', description: 'Day-to-day business operations' }
  ];

  const inserted = [];
  for (const template of templates) {
    if (inserted.length + existing.length >= 3) break;
    let department = await Department.findOne({ code: template.code });
    if (!department) {
      department = await Department.create(template);
      console.log(`   ✅ Created department: ${template.name}`);
    }
    inserted.push(department);
  }

  const combined = [...existing, ...inserted];
  return combined.slice(0, 3);
}

function buildJobTemplates() {
  return [
    {
      title: 'Senior Full Stack Developer',
      location: 'Bengaluru, India',
      employmentType: 'full-time',
      experience: { min: 4, max: 8 },
      salary: { min: 1500000, max: 2400000, currency: 'INR' },
      description: 'Lead development of scalable web applications, mentor engineers, and collaborate with cross-functional teams.',
      requirements: [
        '4+ years of experience with Node.js and React',
        'Strong understanding of microservices and REST APIs',
        'Experience with SQL/NoSQL databases'
      ],
      responsibilities: [
        'Design, develop, and maintain backend services',
        'Collaborate with product and design teams',
        'Review code and mentor junior developers'
      ],
      skills: ['Node.js', 'React', 'Microservices', 'MongoDB', 'AWS']
    },
    {
      title: 'HR Business Partner',
      location: 'Mumbai, India',
      employmentType: 'full-time',
      experience: { min: 3, max: 6 },
      salary: { min: 800000, max: 1200000, currency: 'INR' },
      description: 'Drive people initiatives, manage employee lifecycle, and partner with leadership to build a high-performing culture.',
      requirements: [
        '3+ years experience in HR business partnering',
        'Strong knowledge of labor laws and HR best practices',
        'Excellent communication and stakeholder management'
      ],
      responsibilities: [
        'Support business leaders on workforce planning',
        'Drive performance management and engagement programs',
        'Handle employee relations and talent development'
      ],
      skills: ['Employee Engagement', 'HR Policies', 'Talent Management', 'Analytics']
    },
    {
      title: 'Financial Analyst',
      location: 'Remote (India)',
      employmentType: 'full-time',
      experience: { min: 2, max: 5 },
      salary: { min: 900000, max: 1400000, currency: 'INR' },
      description: 'Analyze financial data, build models, and provide insights to support strategic decisions.',
      requirements: [
        '2+ years in financial planning & analysis',
        'Advanced Excel and financial modelling skills',
        'Experience with budgeting and forecasting'
      ],
      responsibilities: [
        'Prepare monthly and quarterly financial reports',
        'Support annual budgeting and forecasting cycles',
        'Partner with business units for cost analysis'
      ],
      skills: ['Financial Modeling', 'Excel', 'Power BI', 'Budgeting']
    },
    {
      title: 'Marketing Specialist',
      location: 'Hyderabad, India',
      employmentType: 'full-time',
      experience: { min: 2, max: 4 },
      salary: { min: 700000, max: 1100000, currency: 'INR' },
      description: 'Plan and execute integrated marketing campaigns to drive lead generation and brand awareness.',
      requirements: [
        '2+ years in B2B marketing',
        'Hands-on experience with digital marketing tools',
        'Strong storytelling and analytical skills'
      ],
      responsibilities: [
        'Own campaign planning and execution',
        'Collaborate with sales to enable demand generation',
        'Track and optimize marketing performance metrics'
      ],
      skills: ['Digital Marketing', 'SEO', 'Content Marketing', 'HubSpot']
    }
  ];
}

function buildCandidateData(job, candidateIndexOffset = 0) {
  const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Arjun', 'Pooja', 'Rohan', 'Neha', 'Karan', 'Divya', 'Aditya', 'Riya', 'Sanjay', 'Kavya', 'Nikhil', 'Shreya', 'Varun', 'Meera'];
  const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Joshi', 'Mehta', 'Rao', 'Desai', 'Nair', 'Iyer', 'Pillai', 'Agarwal', 'Bansal', 'Chopra', 'Malhotra', 'Kapoor', 'Bhatia'];
  const colleges = ['IIT Delhi', 'IIT Bombay', 'BITS Pilani', 'NIT Trichy', 'IIIT Hyderabad', 'VIT Vellore', 'SRM University', 'Manipal Institute', 'Delhi University', 'Mumbai University'];
  const degrees = [
    'B.Tech in Computer Science',
    'B.E in Information Technology',
    'MBA in Human Resources',
    'MBA in Finance',
    'B.Com (Hons)',
    'BBA in Marketing'
  ];
  const sources = ['job-portal', 'referral', 'linkedin', 'naukri'];
  const stages = ['applied', 'screening', 'interview-scheduled', 'shortlisted'];

  return (index) => {
    const firstName = firstNames[(candidateIndexOffset + index) % firstNames.length];
    const lastName = lastNames[(candidateIndexOffset + index) % lastNames.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Date.now().toString().slice(-4)}${index}@example.com`;
    const experienceYears = randomInt(0, Math.max(job.experience?.min ?? 0, 3));
    const passingYear = 2020 + randomInt(0, 4);

    return {
      candidateCode: `CAN${Date.now()}${candidateIndexOffset + index}${Math.floor(Math.random() * 1000)}`,
      firstName,
      lastName,
      email,
      phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      appliedFor: job._id,
      source: randomItem(sources),
      experience: {
        years: experienceYears,
        months: randomInt(0, 11)
      },
      currentCompany: experienceYears > 0 ? randomItem(['Innotech Labs', 'CodeCraft', 'FutureWorks', 'Alpha Solutions']) : undefined,
      currentDesignation: experienceYears > 0 ? randomItem(['Developer', 'Analyst', 'HR Associate', 'Marketing Executive']) : undefined,
      currentCTC: experienceYears > 0 ? randomInt(300000, 900000) : undefined,
      expectedCTC: randomInt(400000, 1200000),
      noticePeriod: experienceYears > 0 ? randomItem([0, 15, 30, 60]) : 0,
      skills: job.skills || ['Communication'],
      education: [
        {
          degree: randomItem(degrees),
          institution: randomItem(colleges),
          passingYear,
          percentage: randomInt(65, 92)
        }
      ],
      resume: {
        url: `resumes/${firstName}_${lastName}_${Date.now()}.pdf`,
        filename: `${firstName}_${lastName}.pdf`,
        originalName: `${firstName}_${lastName}.pdf`,
        uploadedAt: new Date()
      },
      stage: randomItem(stages),
      appliedDate: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000),
      status: 'active'
    };
  };
}

async function seedJobsAndCandidates() {
  const options = parseArgs();
  const companyCode = options.companyCode || DEFAULT_COMPANY_CODE;
  const jobsToCreate = parseInt(options.jobs ?? DEFAULT_JOB_COUNT, 10) || DEFAULT_JOB_COUNT;
  const minCandidates = parseInt(options.minCandidates ?? DEFAULT_MIN_CANDIDATES, 10) || DEFAULT_MIN_CANDIDATES;
  const maxCandidates = parseInt(options.maxCandidates ?? DEFAULT_MAX_CANDIDATES, 10) || DEFAULT_MAX_CANDIDATES;

  if (minCandidates <= 0 || maxCandidates < minCandidates) {
    throw new Error('Invalid candidate range. Ensure 0 < minCandidates <= maxCandidates.');
  }

  console.log('🌱 Seeding job postings and candidates');
  console.log(`   Company Code: ${companyCode}`);
  console.log(`   Jobs to create: ${jobsToCreate}`);
  console.log(`   Candidates per job: ${minCandidates}-${maxCandidates}`);

  let globalConnection;
  let tenantConnection;

  try {
    globalConnection = await connectGlobalDB();
    if (!globalConnection) {
      throw new Error('Failed to establish global DB connection');
    }

    const CompanyRegistry = globalConnection.model('CompanyRegistry', CompanyRegistrySchema);

    const company = await CompanyRegistry.findOne({
      $or: [
        { companyCode },
        { companyCode: `${companyCode}-001` },
        { companyName: new RegExp(companyCode, 'i') }
      ]
    });

    if (!company) {
      throw new Error(`Company not found for code/name: ${companyCode}`);
    }

    console.log(`✅ Found company: ${company.companyName}`);
    console.log(`   Tenant DB: ${company.tenantDatabaseName}`);

    tenantConnection = await getTenantConnection(company.tenantDatabaseName || company.companyId || company._id);

    const Department = ensureTenantModel(tenantConnection, 'Department', DepartmentSchema);
    const JobPosting = ensureTenantModel(tenantConnection, 'JobPosting', JobPostingSchema);
    const Candidate = ensureTenantModel(tenantConnection, 'Candidate', CandidateSchema);

    const departments = await ensureDepartments(Department);
    if (!departments.length) {
      throw new Error('Unable to seed jobs because no departments are available.');
    }

    const jobTemplates = buildJobTemplates();
    const results = [];

    for (let i = 0; i < jobsToCreate; i++) {
      const template = jobTemplates[i % jobTemplates.length];
      const department = departments[i % departments.length];

      const jobPayload = {
        ...template,
        department: department._id,
        status: 'active',
        postedDate: new Date(),
        openings: randomInt(1, 3),
        applications: 0
      };

      const job = await JobPosting.create(jobPayload);
      console.log(`\n📄 Created job: ${job.title} (${job._id})`);

      const candidateCount = randomInt(minCandidates, maxCandidates);
      const candidateBuilder = buildCandidateData(job, i * 100);
      const candidates = [];

      for (let idx = 0; idx < candidateCount; idx++) {
        candidates.push(candidateBuilder(idx));
      }

      const insertedCandidates = await Candidate.insertMany(candidates);
      await JobPosting.findByIdAndUpdate(job._id, { applications: insertedCandidates.length });

      console.log(`   👥 Seeded ${insertedCandidates.length} candidates`);
      results.push({ job, candidates: insertedCandidates });
    }

    console.log('\n✅ Seeding completed successfully');
    results.forEach(({ job, candidates }, index) => {
      console.log(`\n${index + 1}. ${job.title}`);
      console.log(`   Department: ${departments[index % departments.length].name}`);
      console.log(`   Location: ${job.location}`);
      console.log(`   Candidates: ${candidates.length}`);
      console.log(`   Applicants sample: ${candidates.slice(0, 3).map(c => `${c.firstName} ${c.lastName}`).join(', ')}`);
    });

  } finally {
    if (tenantConnection) {
      await tenantConnection.close().catch(() => {});
    }
    if (globalConnection) {
      await globalConnection.close().catch(() => {});
    }
    await mongoose.disconnect().catch(() => {});
  }
}

seedJobsAndCandidates()
  .then(() => {
    console.log('\n🌟 Job & candidate seeding finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Job & candidate seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  });
