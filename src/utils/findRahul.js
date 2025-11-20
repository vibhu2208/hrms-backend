require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';
const jobId = '691e363f75f473d1b479cd6e';

const findRahul = async () => {
  let tenantConnection;
  try {
    const dbName = `hrms_tenant_${tenantId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected\n');

    const candidateSchema = new mongoose.Schema({}, { strict: false });
    const TenantCandidate = tenantConnection.model('Candidate', candidateSchema);

    // Find Rahul with the exact email from screenshot
    const rahul = await TenantCandidate.findOne({ email: 'rahul.sharma@gmail.com' });
    
    if (rahul) {
      console.log('Found Rahul Sharma with email rahul.sharma@gmail.com:');
      console.log(`   appliedFor: ${rahul.appliedFor}`);
      console.log(`   jobId: ${rahul.jobId}`);
      console.log(`   candidateCode: ${rahul.candidateCode}`);
      console.log(`   status: ${rahul.status}`);
      console.log(`   stage: ${rahul.stage}`);
      console.log(`   currentCompany: ${rahul.currentCompany}`);
    } else {
      console.log('No candidate found with email rahul.sharma@gmail.com');
    }

    // Count all candidates
    const total = await TenantCandidate.countDocuments();
    console.log(`\n📊 Total candidates in database: ${total}`);
    
    // Count by appliedFor
    const forThisJob = await TenantCandidate.countDocuments({ appliedFor: jobId });
    const forThisJobObjectId = await TenantCandidate.countDocuments({ 
      appliedFor: new mongoose.Types.ObjectId(jobId) 
    });
    
    console.log(`   For job ${jobId} (string): ${forThisJob}`);
    console.log(`   For job ${jobId} (ObjectId): ${forThisJobObjectId}`);

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

findRahul();
