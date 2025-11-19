/**
 * Seed Super Admin in hrms_global database
 * Run ONCE to create the main super admin
 * 
 * Run: node src/scripts/seedSuperAdmin.js
 */

require('dotenv').config();
const { connectGlobalDB } = require('../config/database.config');
const { getSuperAdmin } = require('../models/global');

const seedSuperAdmin = async () => {
  try {
    console.log('🔄 Connecting to Global Database (hrms_global)...');
    await connectGlobalDB();
    console.log('✅ Connected to Global Database\n');

    const SuperAdmin = await getSuperAdmin();

    // Check if super admin already exists
    const existingSuperAdmin = await SuperAdmin.findOne();
    
    if (existingSuperAdmin) {
      console.log('⚠️  Super Admin already exists!');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.firstName} ${existingSuperAdmin.lastName}`);
      console.log('\n💡 Only ONE super admin should exist in the system.');
      console.log('   If you need to reset the password, use a password reset script.\n');
      process.exit(0);
    }

    // Create super admin
    const superAdminData = {
      email: 'superadmin@hrms.com',
      password: 'SuperAdmin@2025',
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1-555-0000',
      role: 'superadmin',
      isActive: true
    };

    const superAdmin = await SuperAdmin.create(superAdminData);
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📊 Super Admin Details:');
    console.log(`   Name: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Phone: ${superAdmin.phone}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Status: ${superAdmin.isActive ? 'Active' : 'Inactive'}\n`);

    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Email: ${superAdminData.email}`);
    console.log(`   Password: ${superAdminData.password}`);
    console.log(`   Role: Super Admin`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Change this password immediately after first login');
    console.log('   2. Enable two-factor authentication');
    console.log('   3. Keep these credentials extremely secure');
    console.log('   4. Only ONE super admin should exist');
    console.log('   5. Create Sub Super Admins for delegated tasks\n');

    console.log('🚀 Next Steps:');
    console.log('   1. Go to: http://localhost:5173/login');
    console.log('   2. Click "Super Admin Login"');
    console.log('   3. Login with the credentials above');
    console.log('   4. Start onboarding companies!\n');

    console.log('✅ Super Admin seeding completed!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding super admin:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedSuperAdmin();
