require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';
const jobId = '691e363f75f473d1b479cd6e';

const testAPI = async () => {
  let tenantConnection;
  try {
    const dbName = `hrms_tenant_${tenantId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    console.log(`🔗 Connecting to tenant database: ${dbName}\n`);
    
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to tenant MongoDB\n');

    const candidateSchema = new mongoose.Schema({}, { strict: false });
    const TenantCandidate = tenantConnection.model('Candidate', candidateSchema);

    // Query exactly like the API does
    const query = { appliedFor: jobId };
    console.log(`🔍 Querying with: appliedFor = "${jobId}"\n`);
    
    const applicants = await TenantCandidate.find(query).sort({ createdAt: -1 });
    
    // Also try with ObjectId
    const queryWithObjectId = { appliedFor: new mongoose.Types.ObjectId(jobId) };
    const applicantsWithObjectId = await TenantCandidate.find(queryWithObjectId).sort({ createdAt: -1 });
    
    console.log(`📊 String query found: ${applicants.length} applicants`);
    console.log(`📊 ObjectId query found: ${applicantsWithObjectId.length} applicants\n`);
    
    const results = applicantsWithObjectId.length > 0 ? applicantsWithObjectId : applicants;
    
    if (results.length > 0) {
      console.log('First 3 applicants:');
      results.slice(0, 3).forEach((a, i) => {
        console.log(`\n${i + 1}. ${a.firstName} ${a.lastName}`);
        console.log(`   Email: ${a.email}`);
        console.log(`   Phone: ${a.phone}`);
        console.log(`   Status: ${a.status}`);
        console.log(`   Applied For: ${a.appliedFor}`);
        console.log(`   Applied For Type: ${typeof a.appliedFor}`);
      });
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

testAPI();
