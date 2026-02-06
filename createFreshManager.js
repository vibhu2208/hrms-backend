const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createFreshManager() {
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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('manager123', salt);

    console.log('🔍 Generated hash:', hashedPassword);
    console.log('🔍 Hash length:', hashedPassword.length);

    // Test the hash before saving
    const testResult = await bcrypt.compare('manager123', hashedPassword);
    console.log('🔍 Hash test result:', testResult);

    // Create fresh manager user
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

    console.log('✅ Fresh manager created successfully!');
    console.log('📧 Email: vibhu2208@gmail.com');
    console.log('🔑 Password: manager123');
    console.log('👤 Role: manager');
    console.log('🆔 User ID:', newManager._id);

    // Verify the manager was saved correctly
    const verifyManager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' });
    console.log('🔍 Verification - Manager found:', !!verifyManager);
    console.log('🔍 Verification - Has password field:', !!verifyManager.password);
    console.log('🔍 Verification - Password length:', verifyManager.password ? verifyManager.password.length : 0);
    
    if (verifyManager.password) {
      const isMatch = await bcrypt.compare('manager123', verifyManager.password);
      console.log('🔍 Verification - Password match test:', isMatch);
    }

    console.log('\n🌐 Login at: http://localhost:5173/login');
    console.log('🎯 After login, you will be redirected to: /manager/dashboard');

  } catch (error) {
    console.error('❌ Error creating fresh manager:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

createFreshManager();
