const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTenantAdmin(companyName, adminEmail, password = 'password123') {
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

    console.log(`📋 Creating admin for: ${company.companyName}`);
    console.log(`   Database: ${company.tenantDatabaseName}`);
    console.log(`   Admin Email: ${adminEmail}\n`);

    // Connect to tenant database
    const tenantConnection = await getTenantConnection(company.companyId);
    
    // Create admin user in tenant database
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Check if user already exists
    const existingUser = await TenantUser.findOne({ email: adminEmail });
    if (existingUser) {
      console.log('⚠️  Admin user already exists!');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      process.exit(0);
    }

    // Create new admin user
    const adminUser = await TenantUser.create({
      email: adminEmail,
      password: password, // Will be hashed by pre-save hook
      authProvider: 'local',
      firstName: 'Admin',
      lastName: 'User',
      role: 'company_admin',
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: true
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📧 Login Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log('\n💡 User must change password on first login\n');

    // Update CompanyRegistry with admin userId
    await CompanyRegistry.findByIdAndUpdate(company._id, {
      'companyAdmin.userId': adminUser._id.toString(),
      'companyAdmin.createdAt': new Date()
    });

    console.log('✅ CompanyRegistry updated with admin user ID');

    await globalConnection.close();
    await tenantConnection.close();
    console.log('\n✅ Database connections closed');
    console.log('🎉 Setup complete! Admin can now log in.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

const companyName = process.argv[2] || 'TTS';
const adminEmail = process.argv[3] || 'admin@tts.com';
const password = process.argv[4] || 'password123';

console.log(`\n🚀 Creating admin user for ${companyName}\n`);
createTenantAdmin(companyName, adminEmail, password);
