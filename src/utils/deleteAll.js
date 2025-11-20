require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';

const deleteAll = async () => {
  let tenantConnection;
  try {
    const dbName = `tenant_${tenantId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected\n');

    const candidateSchema = new mongoose.Schema({}, { strict: false });
    const TenantCandidate = tenantConnection.model('Candidate', candidateSchema);

    // Delete ALL candidates
    const deleteResult = await TenantCandidate.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} candidates`);

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

deleteAll();
