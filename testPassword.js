const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testPassword() {
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
      console.log('❌ Manager not found');
      return;
    }

    console.log('✅ Manager found:');
    console.log('📧 Email:', manager.email);
    console.log('🆔 User ID:', manager._id);
    console.log('🔑 Role:', manager.role);
    console.log('✅ Status:', manager.isActive ? 'Active' : 'Inactive');
    console.log('🔐 Has password field:', !!manager.password);
    console.log('🔐 Password hash length:', manager.password ? manager.password.length : 0);

    // Test password comparison
    const testPassword = 'manager123';
    console.log('\n🔍 Testing password comparison:');
    console.log('🔍 Test password:', testPassword);
    
    if (manager.password) {
      // Test with bcrypt.compare
      const isMatch = await bcrypt.compare(testPassword, manager.password);
      console.log('🔍 bcrypt.compare result:', isMatch);
      
      // Test manual hash and compare
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(testPassword, salt);
      console.log('🔍 New hash:', newHash);
      console.log('🔍 New hash length:', newHash.length);
      
      const isNewHashMatch = await bcrypt.compare(testPassword, newHash);
      console.log('🔍 New hash comparison result:', isNewHashMatch);
      
      // Update password with new hash
      console.log('\n🔄 Updating password with new hash...');
      manager.password = newHash;
      await manager.save();
      console.log('✅ Password updated successfully!');
    }

  } catch (error) {
    console.error('❌ Error testing password:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

testPassword();
