require('dotenv').config();
const mongoose = require('mongoose');

const clientId = process.argv[2];

if (!clientId) {
  console.log('❌ Please provide client ID as argument');
  console.log('Usage: node listTenantJobs.js <CLIENT_ID>');
  process.exit(1);
}

const listJobs = async () => {
  let tenantConnection;
  try {
    const dbName = `hrms_tenant_${clientId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    console.log(`🔗 Connecting to tenant database: ${dbName}\n`);
    
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to tenant MongoDB\n');

    const jobPostingSchema = new mongoose.Schema({
      title: String,
      department: mongoose.Schema.Types.ObjectId,
      location: String,
      employmentType: String,
      status: String,
      applications: Number
    }, { timestamps: true });

    const TenantJobPosting = tenantConnection.model('JobPosting', jobPostingSchema);

    const jobs = await TenantJobPosting.find().populate('department');
    
    if (jobs.length > 0) {
      console.log(`📊 Jobs in tenant database (${jobs.length} found):\n`);
      jobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.title}`);
        console.log(`   ID: ${job._id}`);
        console.log(`   Location: ${job.location || 'N/A'}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Applications: ${job.applications || 0}\n`);
      });
    } else {
      console.log('❌ No jobs found in tenant database');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
};

listJobs();
