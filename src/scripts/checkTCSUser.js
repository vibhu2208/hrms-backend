/**
 * Check TCS User in Database
 * Verify user exists and check their status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');

const checkUser = async () => {
  try {
    console.log('\n🔍 Checking TCS User in Database...\n');
    
    // Connect to global DB
    const globalConn = await connectGlobalDB();
    
    // Get company registry
    const CompanyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConn.model('CompanyRegistry', CompanyRegistrySchema);
    
    // Find TCS company
    const company = await CompanyRegistry.findOne({ companyName: 'TCS' });
    
    if (!company) {
      console.log('❌ TCS company not found');
      process.exit(1);
    }
    
    console.log('✅ TCS Company Found:');
    console.log(`   Company ID: ${company.companyId}`);
    console.log(`   Company Code: ${company.companyCode}`);
    console.log(`   Database: ${company.tenantDatabaseName}`);
    console.log(`   Status: ${company.status}`);
    console.log(`   DB Status: ${company.databaseStatus}\n`);
    
    // Connect to tenant DB
    const tenantConn = await getTenantConnection(company.companyId);
    const TenantUser = tenantConn.model('User', TenantUserSchema);
    
    // Find admin user
    const adminUser = await TenantUser.findOne({ email: 'admin@tcs.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      await tenantConn.close();
      await globalConn.close();
      process.exit(1);
    }
    
    console.log('✅ Admin User Found:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   First Name: ${adminUser.firstName}`);
    console.log(`   Last Name: ${adminUser.lastName}`);
    console.log(`   Is Active: ${adminUser.isActive}`);
    console.log(`   Is First Login: ${adminUser.isFirstLogin}`);
    console.log(`   Must Change Password: ${adminUser.mustChangePassword}`);
    console.log(`   Auth Provider: ${adminUser.authProvider}`);
    console.log(`   Created At: ${adminUser.createdAt}`);
    console.log(`   Updated At: ${adminUser.updatedAt}\n`);
    
    // Check all users
    const allUsers = await TenantUser.find({});
    console.log(`📊 Total Users in TCS Database: ${allUsers.length}\n`);
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.role}) - Active: ${user.isActive}`);
    });
    
    console.log('\n✅ Check complete!\n');
    
    await tenantConn.close();
    await globalConn.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkUser();
