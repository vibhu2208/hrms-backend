const mongoose = require('mongoose');

async function testManagerAuth() {
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
    const manager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' }).select('+password');
    
    if (!manager) {
      console.log('❌ Manager not found');
      return;
    }

    console.log('✅ Manager found:');
    console.log('📧 Email:', manager.email);
    console.log('👤 Name:', manager.firstName + ' ' + manager.lastName);
    console.log('🔑 Role:', manager.role);
    console.log('✅ Status:', manager.isActive ? 'Active' : 'Inactive');
    console.log('🆔 User ID:', manager._id);
    console.log('🏢 Company ID:', manager.companyId);

    // Test password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare('manager123', manager.password);
    console.log('🔐 Password test:', isMatch ? '✅ Correct' : '❌ Incorrect');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testManagerAuth();
