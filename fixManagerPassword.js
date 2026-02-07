const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function fixManagerPassword() {
  try {
    // Connect to the correct tenant database
    const tenantId = '696b515db6c9fd5fd51aed1c';
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_${tenantId}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🔗 Connected to tenant database: tenant_${tenantId}`);

    // Import models for tenant database
    const TenantUserSchema = require('./src/models/tenant/TenantUser');
    const TenantUser = mongoose.model('User', TenantUserSchema);

    // Find the manager
    const manager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' });
    
    if (!manager) {
      console.log('❌ Manager not found. Creating new manager...');
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('manager123', salt);

      // Create manager user
      const newManager = new TenantUser({
        email: 'vibhu2208@gmail.com',
        password: hashedPassword,
        role: 'manager',
        firstName: 'Vibhu',
        lastName: 'Manager',
        isActive: true,
        isFirstLogin: false,
        mustChangePassword: false,
        companyId: tenantId
      });

      await newManager.save();

      console.log('✅ Manager user created successfully!');
      console.log('📧 Email: vibhu2208@gmail.com');
      console.log('🔑 Password: manager123');
      console.log('👤 Role: manager');
      console.log('🆔 User ID:', newManager._id);
    } else {
      console.log('✅ Manager found. Updating password...');
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('manager123', salt);

      // Update password
      manager.password = hashedPassword;
      manager.isActive = true;
      await manager.save();

      console.log('✅ Manager password updated successfully!');
      console.log('📧 Email: vibhu2208@gmail.com');
      console.log('🔑 New Password: manager123');
      console.log('👤 Role: manager');
      console.log('🆔 User ID:', manager._id);
    }

    console.log('🌐 Login at: http://localhost:5173/login');
    console.log('🎯 After login, you will be redirected to: /manager/dashboard');

  } catch (error) {
    console.error('❌ Error fixing manager password:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

fixManagerPassword();
