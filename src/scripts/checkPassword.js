/**
 * Check Password Hash in Database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');

const checkPassword = async () => {
  try {
    console.log('\n🔍 Checking Password Hash...\n');
    
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
    
    console.log(`✅ Found company: ${company.companyName} (${company.companyId})\n`);
    
    // Connect to tenant DB
    const tenantConn = await getTenantConnection(company.companyId);
    const TenantUser = tenantConn.model('User', TenantUserSchema);
    
    // Find admin user WITH password field
    const adminUser = await TenantUser.findOne({ email: 'admin@tcs.com' }).select('+password');
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      await tenantConn.close();
      await globalConn.close();
      process.exit(1);
    }
    
    console.log('✅ Admin User Found:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Is Active: ${adminUser.isActive}`);
    console.log(`   Password Hash: ${adminUser.password ? adminUser.password.substring(0, 20) + '...' : 'NOT SET'}`);
    console.log(`   Password Length: ${adminUser.password ? adminUser.password.length : 0}\n`);
    
    // Test password comparison
    const testPassword = 'TCSAdmin@2025';
    console.log(`🔐 Testing password: "${testPassword}"`);
    
    if (!adminUser.password) {
      console.log('❌ Password is not set in database!');
    } else {
      const isMatch = await bcrypt.compare(testPassword, adminUser.password);
      console.log(`   Password Match: ${isMatch ? '✅ YES' : '❌ NO'}\n`);
      
      if (!isMatch) {
        console.log('🔍 Trying to manually hash and compare...');
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(testPassword, salt);
        console.log(`   New Hash: ${newHash.substring(0, 20)}...`);
        console.log(`   Stored Hash: ${adminUser.password.substring(0, 20)}...`);
        
        // Check if password is stored as plain text (shouldn't be!)
        if (adminUser.password === testPassword) {
          console.log('⚠️  WARNING: Password is stored as PLAIN TEXT!');
        }
      }
    }
    
    await tenantConn.close();
    await globalConn.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkPassword();
