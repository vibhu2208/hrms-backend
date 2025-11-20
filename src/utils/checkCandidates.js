require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';

const checkCandidates = async () => {
  let tenantConnection;
  try {
    const dbName = `tenant_${tenantId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    console.log(`🔗 Connecting to tenant database: ${dbName}\n`);
    
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to tenant MongoDB\n');

    const candidateSchema = new mongoose.Schema({}, { strict: false });
    const TenantCandidate = tenantConnection.model('Candidate', candidateSchema);

    // Get all candidates
    const candidates = await TenantCandidate.find().limit(5);
    
    console.log(`📊 Total candidates: ${await TenantCandidate.countDocuments()}\n`);
    
    if (candidates.length > 0) {
      console.log('First 5 candidates:\n');
      candidates.forEach((c, i) => {
        console.log(`${i + 1}. ${c.firstName} ${c.lastName}`);
        console.log(`   candidateCode: ${c.candidateCode}`);
        console.log(`   jobId: ${c.jobId}`);
        console.log(`   appliedFor: ${c.appliedFor}`);
        console.log(`   _id: ${c._id}\n`);
      });
    } else {
      console.log('No candidates found in database');
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

checkCandidates();
