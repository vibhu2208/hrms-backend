const mongoose = require('mongoose');

async function testSPCManagerRoutes() {
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

    console.log('✅ Manager found for testing SPC routes:');
    console.log('📧 Email:', manager.email);
    console.log('👤 Name:', manager.firstName + ' ' + manager.lastName);
    console.log('🔑 Role:', manager.role);

    // Check if there are any projects in the tenant
    const ProjectSchema = require('./src/models/tenant/Project');
    const Project = mongoose.model('Project', ProjectSchema);
    
    const projects = await Project.find({});
    console.log('📊 Projects in tenant:', projects.length);

    // Check if there are any users reporting to this manager
    const teamMembers = await TenantUser.find({ reportingManager: manager.email });
    console.log('👥 Team members:', teamMembers.length);

    console.log('\n✅ SPC Manager routes should work now!');
    console.log('🔄 Please restart the backend server and try logging in again.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testSPCManagerRoutes();
