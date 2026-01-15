const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
require('dotenv').config();

async function checkTenantAdmin(companyName) {
  try {
    // Connect to global database
    const globalConnection = await connectGlobalDB();
    console.log('✅ Connected to Global Database\n');

    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);
    
    // Find the company
    const company = await CompanyRegistry.findOne({ companyName });
    
    if (!company) {
      console.error(`❌ Company "${companyName}" not found`);
      process.exit(1);
    }

    console.log(`📋 Company Found:`);
    console.log(`   Name: ${company.companyName}`);
    console.log(`   Code: ${company.companyCode}`);
    console.log(`   Company ID: ${company.companyId}`);
    console.log(`   Database: ${company.tenantDatabaseName}`);
    console.log(`   Admin Email: ${company.companyAdmin?.email || 'Not set'}\n`);

    // Connect to tenant database
    const tenantConnection = await getTenantConnection(company.companyId);
    console.log(`✅ Connected to Tenant Database: ${company.tenantDatabaseName}\n`);

    // Check for users in tenant database
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const users = await TenantUser.find({}).select('email firstName lastName role isActive');
    
    console.log(`👥 Users in ${companyName} tenant database: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('❌ No users found in tenant database');
      console.log('\n💡 The admin user was NOT created in the tenant database.');
      console.log('   This is why login is failing.\n');
    } else {
      console.log('Users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
        console.log('');
      });
    }

    await globalConnection.close();
    await tenantConnection.close();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const companyName = process.argv[2] || 'TTS';
console.log(`\n🔍 Checking admin user for company: ${companyName}\n`);

checkTenantAdmin(companyName);
