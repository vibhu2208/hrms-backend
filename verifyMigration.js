const mongoose = require('mongoose');

async function verifyMigration() {
  try {
    console.log('🔍 Verifying migration results...');
    
    const mainTenantId = '696b515db6c9fd5fd51aed1c';
    const recruitmentTenantId = '697127c3db7be8a51c1e6b7f';
    const mainTenantDb = `tenant_${mainTenantId}`;
    const recruitmentTenantDb = `tenant_${recruitmentTenantId}`;

    // Check main tenant
    console.log(`\n📊 Main Tenant (${mainTenantDb}):`);
    const mainConnection = await mongoose.createConnection(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${mainTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    try {
      const User = mainConnection.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const users = await User.find({}).select('email role firstName lastName isActive');
      console.log(`👥 Users: ${users.length}`);
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
      });

      const Candidate = mainConnection.model('Candidate', new mongoose.Schema({}, { strict: false }), 'candidates');
      const candidates = await Candidate.find({}).select('firstName lastName email status');
      console.log(`\n🎯 Candidates: ${candidates.length}`);
      candidates.slice(0, 10).forEach(candidate => {
        console.log(`  - ${candidate.firstName} ${candidate.lastName} (${candidate.email}) - ${candidate.status || 'N/A'}`);
      });
      if (candidates.length > 10) {
        console.log(`  ... and ${candidates.length - 10} more`);
      }

      const JobPosting = mainConnection.model('JobPosting', new mongoose.Schema({}, { strict: false }), 'jobpostings');
      const jobPostings = await JobPosting.find({}).select('title status');
      console.log(`\n💼 Job Postings: ${jobPostings.length}`);
      jobPostings.forEach(job => {
        console.log(`  - ${job.title || job.jobTitle} (${job.status || 'N/A'})`);
      });

    } catch (err) {
      console.error(`Error checking main tenant: ${err.message}`);
    }

    await mainConnection.close();

    // Check recruitment tenant (should be empty or minimal)
    console.log(`\n📊 Recruitment Tenant (${recruitmentTenantDb}):`);
    const recruitmentConnection = await mongoose.createConnection(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${recruitmentTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    try {
      const collections = await recruitmentConnection.db.listCollections().toArray();
      console.log(`📁 Collections remaining: ${collections.length}`);
      collections.forEach(collection => {
        console.log(`  - ${collection.name}`);
      });

      const User = recruitmentConnection.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const users = await User.find({});
      console.log(`👥 Users remaining: ${users.length}`);

      const Candidate = recruitmentConnection.model('Candidate', new mongoose.Schema({}, { strict: false }), 'candidates');
      const candidates = await Candidate.find({});
      console.log(`🎯 Candidates remaining: ${candidates.length}`);

    } catch (err) {
      console.error(`Error checking recruitment tenant: ${err.message}`);
    }

    await recruitmentConnection.close();

    // Check global registry
    console.log(`\n📋 Global Registry:`);
    const globalConnection = await mongoose.createConnection(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_global?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    try {
      const CompanyRegistry = globalConnection.model('CompanyRegistry', new mongoose.Schema({}, { strict: false }), 'companyregistries');
      const registries = await CompanyRegistry.find({});
      console.log(`Company registries: ${registries.length}`);
      registries.forEach(reg => {
        console.log(`  - ${reg.companyName} -> ${reg.tenantDatabaseName} [${reg.status}]`);
      });
    } catch (err) {
      console.error(`Error checking global registry: ${err.message}`);
    }

    await globalConnection.close();

    console.log('\n✅ Migration verification completed!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

verifyMigration();
