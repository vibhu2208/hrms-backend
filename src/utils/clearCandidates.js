require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';
const jobId = '691e363f75f473d1b479cd6e';

const clearCandidates = async () => {
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

    // Delete ALL candidates (both with jobId and appliedFor fields)
    // Try jobId as both string and ObjectId
    const deleteResult1 = await TenantCandidate.deleteMany({ 
      $or: [
        { jobId: jobId },
        { jobId: new mongoose.Types.ObjectId(jobId) }
      ]
    });
    console.log(`🗑️  Deleted ${deleteResult1.deletedCount} candidates with jobId field`);
    
    // Try appliedFor as both string and ObjectId
    const deleteResult2 = await TenantCandidate.deleteMany({ 
      $or: [
        { appliedFor: jobId },
        { appliedFor: new mongoose.Types.ObjectId(jobId) }
      ]
    });
    console.log(`🗑️  Deleted ${deleteResult2.deletedCount} candidates with appliedFor field`);

    console.log('\n✅ Cleanup completed!');
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

clearCandidates();
