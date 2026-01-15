const { connectGlobalDB } = require('../config/database.config');
require('dotenv').config();

async function listCompanies() {
  try {
    const globalConnection = await connectGlobalDB();
    console.log('✅ Connected to Global Database\n');

    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);
    
    const companies = await CompanyRegistry.find({}, {
      companyId: 1,
      companyCode: 1,
      companyName: 1,
      tenantDatabaseName: 1,
      status: 1
    }).sort({ createdAt: -1 });

    console.log(`📋 Found ${companies.length} companies:\n`);
    
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.companyName}`);
      console.log(`   Company ID: ${company.companyId}`);
      console.log(`   Company Code: ${company.companyCode}`);
      console.log(`   Database: ${company.tenantDatabaseName}`);
      console.log(`   Status: ${company.status}`);
      console.log('');
    });

    if (companies.length > 0) {
      console.log('💡 To seed permissions for a company, run:');
      console.log(`   node src/scripts/seedPermissionsForTenant.js ${companies[0].companyId}`);
    }

    await globalConnection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listCompanies();
