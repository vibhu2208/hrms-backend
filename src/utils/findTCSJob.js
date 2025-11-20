require('dotenv').config();
const mongoose = require('mongoose');
const JobPosting = require('../models/JobPosting');
const Company = require('../models/Company');

const findJobs = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if the specific job ID exists
    const specificJobId = '691e363f75f473d1b479cd6e';
    const specificJob = await JobPosting.findById(specificJobId).populate('department');
    
    if (specificJob) {
      console.log(`✅ Job ${specificJobId} found:`);
      console.log(`   Title: ${specificJob.title}`);
      console.log(`   Department: ${specificJob.department?.name || 'N/A'}`);
      console.log(`   Status: ${specificJob.status}`);
      console.log(`   Applications: ${specificJob.applications || 0}\n`);
    } else {
      console.log(`❌ Job ${specificJobId} not found\n`);
    }

    // List all jobs
    const jobs = await JobPosting.find().populate('department').limit(20);
    
    if (jobs.length > 0) {
      console.log(`📊 All Jobs (${jobs.length} found):\n`);
      jobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.title}`);
        console.log(`   ID: ${job._id}`);
        console.log(`   Department: ${job.department?.name || 'N/A'}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Applications: ${job.applications || 0}\n`);
      });
    } else {
      console.log('❌ No jobs found in database');
    }

    // List companies
    const companies = await Company.find().limit(10);
    if (companies.length > 0) {
      console.log('\n📋 Available companies:');
      companies.forEach(c => {
        console.log(`   - ${c.companyName || 'Unnamed'} (ID: ${c._id})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

findJobs();
