/**
 * Verify TTS Users and Test Login
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');

async function verifyUsers() {
  try {
    console.log('🔍 Verifying TTS Users...\n');

    // Connect to TTS tenant database
    const tenantConnection = await getTenantConnection('tenant_696823363d45cbf69fd4b689');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Test credentials - using actual users from database
    const testCredentials = [
      { email: 'riya.reddy.manager@tts.com', password: 'Manager@123', role: 'Manager' },
      { email: 'sneha.patel.emp1@tts.com', password: 'Employee@123', role: 'Employee' },
      { email: 'shreya.pillai.hr1@tts.com', password: 'HR@123', role: 'HR' }
    ];

    console.log('📊 Testing Login Credentials:\n');

    for (const cred of testCredentials) {
      console.log(`\n🔐 Testing: ${cred.email}`);
      console.log(`   Role: ${cred.role}`);
      
      // Find user
      const user = await TenantUser.findOne({ email: cred.email }).select('+password');
      
      if (!user) {
        console.log('   ❌ User NOT FOUND in database');
        continue;
      }

      console.log(`   ✅ User found: ${user.firstName} ${user.lastName}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🆔 Employee Code: ${user.employeeCode}`);
      console.log(`   👤 Role: ${user.role}`);
      console.log(`   🟢 Active: ${user.isActive}`);
      console.log(`   🔑 Password hash exists: ${!!user.password}`);

      // Test password
      if (user.password) {
        const isValid = await bcrypt.compare(cred.password, user.password);
        console.log(`   🔓 Password "${cred.password}" is: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
        
        if (isValid) {
          console.log(`   🎉 LOGIN SHOULD WORK!`);
        }
      } else {
        console.log('   ❌ No password hash found');
      }
    }

    // Count all users
    console.log('\n\n📊 User Statistics:');
    const managers = await TenantUser.countDocuments({ role: 'manager' });
    const employees = await TenantUser.countDocuments({ role: 'employee' });
    const hr = await TenantUser.countDocuments({ role: 'hr' });
    
    console.log(`   Managers: ${managers}`);
    console.log(`   Employees: ${employees}`);
    console.log(`   HR: ${hr}`);
    console.log(`   Total: ${managers + employees + hr}`);

    // Show all users
    console.log('\n\n👥 All Users:');
    const allUsers = await TenantUser.find({ role: { $in: ['manager', 'employee', 'hr'] } })
      .select('firstName lastName email employeeCode role department')
      .sort({ role: 1, employeeCode: 1 });

    allUsers.forEach(u => {
      console.log(`   ${u.role.toUpperCase().padEnd(10)} | ${u.email.padEnd(40)} | Code: ${u.employeeCode || 'N/A'}`);
    });

    await tenantConnection.close();

    console.log('\n\n✅ Verification Complete!');
    console.log('\n📝 To Login:');
    console.log('   1. Go to frontend login page');
    console.log('   2. Select company: TTS');
    console.log('   3. Use any email from above with corresponding password');
    console.log('   4. Managers: Manager@123');
    console.log('   5. Employees: Employee@123');
    console.log('   6. HR: HR@123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyUsers();
