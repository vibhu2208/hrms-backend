const mongoose = require('mongoose');

async function createManagerCorrect() {
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

    // Delete existing manager if exists
    const existingManager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' });
    if (existingManager) {
      console.log('🗑️ Deleting existing manager...');
      await TenantUser.deleteOne({ email: 'vibhu2208@gmail.com' });
    }

    // Create fresh manager user with plain password (schema will hash it automatically)
    const newManager = new TenantUser({
      email: 'vibhu2208@gmail.com',
      password: 'manager123', // Plain password - schema will hash it
      role: 'manager',
      firstName: 'Vibhu',
      lastName: 'Manager',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false,
      companyId: tenantId
    });

    await newManager.save();

    console.log('✅ Manager created successfully!');
    console.log('📧 Email: vibhu2208@gmail.com');
    console.log('🔑 Password: manager123');
    console.log('👤 Role: manager');
    console.log('🆔 User ID:', newManager._id);

    // Verify the manager was saved correctly - include password field in query
    const verifyManager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' }).select('+password');
    console.log('🔍 Verification - Manager found:', !!verifyManager);
    console.log('🔍 Verification - Has password field:', !!verifyManager.password);
    console.log('🔍 Verification - Password length:', verifyManager.password ? verifyManager.password.length : 0);
    
    if (verifyManager.password) {
      // Test password using the model's comparePassword method
      const isMatch = await verifyManager.comparePassword('manager123');
      console.log('🔍 Verification - Password match test:', isMatch);
      
      // Also test with direct bcrypt compare
      const bcrypt = require('bcryptjs');
      const directMatch = await bcrypt.compare('manager123', verifyManager.password);
      console.log('🔍 Verification - Direct bcrypt test:', directMatch);
    }

    console.log('\n🌐 Login at: http://localhost:5173/login');
    console.log('🎯 After login, you will be redirected to: /manager/dashboard');

  } catch (error) {
    console.error('❌ Error creating manager:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

createManagerCorrect();
