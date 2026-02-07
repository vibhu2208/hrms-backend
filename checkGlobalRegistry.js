const mongoose = require('mongoose');

async function checkGlobalRegistry() {
  try {
    // Connect to global database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_global?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to global MongoDB database');

    // Define CompanyRegistry schema
    const companyRegistrySchema = new mongoose.Schema({}, { strict: false });
    const CompanyRegistry = mongoose.model('CompanyRegistry', companyRegistrySchema, 'companyregistries');

    // Find the specific tenant
    const tenantId = '697127c3db7be8a51c1e6b7f';
    const tenantDbName = `tenant_${tenantId}`;
    
    console.log(`🔍 Searching for tenant database: ${tenantDbName}`);
    
    const registry = await CompanyRegistry.findOne({ tenantDatabaseName: tenantDbName });
    
    if (registry) {
      console.log(`\n📋 Found company registry entry:`);
      console.log(`  Company Name: ${registry.companyName}`);
      console.log(`  Company Code: ${registry.companyCode}`);
      console.log(`  Company ID: ${registry.companyId}`);
      console.log(`  Database: ${registry.tenantDatabaseName}`);
      console.log(`  Email: ${registry.email}`);
      console.log(`  Phone: ${registry.phone}`);
      console.log(`  Status: ${registry.status}`);
      console.log(`  Database Status: ${registry.databaseStatus}`);
      console.log(`  Subscription: ${registry.subscription?.plan || 'N/A'} (${registry.subscription?.status || 'N/A'})`);
      console.log(`  Onboarded At: ${registry.onboardedAt}`);
      console.log(`  Created At: ${registry.createdAt}`);
      console.log(`  Updated At: ${registry.updatedAt}`);
      
      if (registry.companyAdmin) {
        console.log(`  Company Admin: ${registry.companyAdmin.email} (User ID: ${registry.companyAdmin.userId})`);
      }
      
      if (registry.enabledModules && registry.enabledModules.length > 0) {
        console.log(`  Enabled Modules: ${registry.enabledModules.join(', ')}`);
      }
    } else {
      console.log(`\n❌ No registry entry found for ${tenantDbName}`);
      
      // Show all registries to help debug
      console.log(`\n📋 All company registries:`);
      const allRegistries = await CompanyRegistry.find({}).select('companyName companyId tenantDatabaseName status');
      allRegistries.forEach(reg => {
        console.log(`  - ${reg.companyName} (${reg.companyId}) -> ${reg.tenantDatabaseName} [${reg.status}]`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

checkGlobalRegistry();
