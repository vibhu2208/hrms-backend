require('dotenv').config();
const mongoose = require('mongoose');

const clientId = process.argv[2] || null;
const jobId = process.argv[3] || '691e363f75f473d1b479cd6e';

const checkDatabase = async () => {
  let mainConnection;
  let tenantConnection;
  
  try {
    // Connect to main database
    console.log('🔗 Connecting to main database...\n');
    mainConnection = await mongoose.createConnection(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to main MongoDB\n');

    // Check main database for job
    const mainJobSchema = new mongoose.Schema({}, { strict: false });
    const MainJobPosting = mainConnection.model('JobPosting', mainJobSchema, 'jobpostings');
    
    const mainJob = await MainJobPosting.findById(jobId);
    if (mainJob) {
      console.log(`✅ Job found in MAIN database:`);
      console.log(`   ID: ${mainJob._id}`);
      console.log(`   Title: ${mainJob.title}`);
      console.log(`   Department: ${mainJob.department}`);
      console.log(`   Status: ${mainJob.status}\n`);
    } else {
      console.log(`❌ Job ${jobId} not found in main database\n`);
    }

    // List all jobs in main database
    const mainJobs = await MainJobPosting.find().limit(10);
    if (mainJobs.length > 0) {
      console.log(`📊 Jobs in main database (showing ${mainJobs.length}):\n`);
      mainJobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.title || 'Untitled'}`);
        console.log(`   ID: ${job._id}`);
        console.log(`   Status: ${job.status || 'N/A'}\n`);
      });
    }

    // If tenant ID provided, check tenant database
    if (clientId) {
      const dbName = `hrms_tenant_${clientId}`;
      const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
      
      console.log(`\n🔗 Connecting to tenant database: ${dbName}...\n`);
      
      tenantConnection = await mongoose.createConnection(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      console.log('✅ Connected to tenant MongoDB\n');

      const tenantJobSchema = new mongoose.Schema({}, { strict: false });
      const TenantJobPosting = tenantConnection.model('JobPosting', tenantJobSchema, 'jobpostings');
      
      const tenantJob = await TenantJobPosting.findById(jobId);
      if (tenantJob) {
        console.log(`✅ Job found in TENANT database:`);
        console.log(`   ID: ${tenantJob._id}`);
        console.log(`   Title: ${tenantJob.title}`);
        console.log(`   Department: ${tenantJob.department}\n`);
      } else {
        console.log(`❌ Job ${jobId} not found in tenant database\n`);
      }

      // List all jobs in tenant database
      const tenantJobs = await TenantJobPosting.find().limit(10);
      if (tenantJobs.length > 0) {
        console.log(`📊 Jobs in tenant database (showing ${tenantJobs.length}):\n`);
        tenantJobs.forEach((job, index) => {
          console.log(`${index + 1}. ${job.title || 'Untitled'}`);
          console.log(`   ID: ${job._id}`);
          console.log(`   Status: ${job.status || 'N/A'}\n`);
        });
      } else {
        console.log('❌ No jobs found in tenant database');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (mainConnection) await mainConnection.close();
    if (tenantConnection) await tenantConnection.close();
  }
};

checkDatabase();
