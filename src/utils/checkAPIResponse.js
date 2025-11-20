require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';
const jobId = '691e363f75f473d1b479cd6e';

const checkAPIResponse = async () => {
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

    // Import the actual Candidate model schema
    const Candidate = require('../models/Candidate');
    const TenantCandidate = tenantConnection.model('Candidate', Candidate.schema);

    // Query exactly like the API does with proper schema (without populate for testing)
    const query = { appliedFor: jobId };
    const applicants = await TenantCandidate.find(query)
      .sort({ createdAt: -1 });
    
    console.log(`📊 Total applicants found: ${applicants.length}\n`);
    
    if (applicants.length > 0) {
      console.log('All applicants:');
      applicants.forEach((a, i) => {
        console.log(`${i + 1}. ${a.firstName} ${a.lastName} - ${a.email} - Status: ${a.status}`);
      });
      
      console.log(`\n✅ API should return ${applicants.length} candidates`);
      console.log(`📦 Estimated response size: ~${JSON.stringify(applicants).length} bytes`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
};

checkAPIResponse();
