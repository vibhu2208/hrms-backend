const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Reset Admin Password
 * Sets a known password for the admin user
 */

async function resetAdminPassword() {
  try {
    console.log('🔧 Resetting Admin Password...');
    
    const spcTenantId = '696b515db6c9fd5fd51aed1c';
    const spcTenantDb = `tenant_${spcTenantId}`;

    // Connect to SPC tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${spcTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to SPC tenant: ${spcTenantDb}`);

    // Get admin user
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const adminUser = await User.findOne({ email: 'admin@company.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log(`✅ Found admin user: ${adminUser.email}`);

    // Set new password
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await User.updateOne(
      { email: 'admin@company.com' },
      { password: hashedPassword }
    );

    console.log('✅ Admin password reset successfully');
    console.log(`📋 New Login Credentials:`);
    console.log(`   Email: admin@company.com`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Role: ${adminUser.role}`);

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Password reset failed:', error.message);
  }
}

resetAdminPassword();
