const mongoose = require('mongoose');

/**
 * Test SPC System Status
 * Check database and user setup
 */

async function testSPCSystemStatus() {
  try {
    console.log('🔍 Testing SPC System Status...');
    
    const spcTenantId = '696b515db6c9fd5fd51aed1c';
    const spcTenantDb = `tenant_${spcTenantId}`;

    // Connect to SPC tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${spcTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to SPC tenant: ${spcTenantDb}`);

    // Check users
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await User.find({});
    
    console.log(`\n👥 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
    });

    // Check admin user specifically
    const adminUser = users.find(u => u.role === 'company_admin' || u.role === 'admin');
    if (adminUser) {
      console.log(`\n✅ Admin user found: ${adminUser.email}`);
      console.log(`  Role: ${adminUser.role}`);
      console.log(`  ID: ${adminUser._id}`);
    } else {
      console.log('\n❌ No admin user found');
    }

    // Check projects
    const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    const projects = await Project.find({});
    
    console.log(`\n🏗️ Found ${projects.length} projects:`);
    projects.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.name} (${project.status})`);
    });

    // Check project assignments
    const ProjectAssignment = mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
    const assignments = await ProjectAssignment.find({});
    
    console.log(`\n📋 Found ${assignments.length} project assignments:`);
    assignments.forEach((assignment, index) => {
      console.log(`  ${index + 1}. User: ${assignment.userId} (${assignment.role}) → Project: ${assignment.projectId}`);
    });

    // Check team assignments
    const TeamAssignment = mongoose.model('TeamAssignment', new mongoose.Schema({}, { strict: false }), 'teamassignments');
    const teamAssignments = await TeamAssignment.find({});
    
    console.log(`\n🤝 Found ${teamAssignments.length} team assignments:`);
    teamAssignments.forEach((assignment, index) => {
      console.log(`  ${index + 1}. Manager: ${assignment.managerId} + HR: ${assignment.hrId} (${assignment.relationshipType})`);
    });

    console.log('\n🎉 SPC System Status Check Complete!');
    console.log('\n📊 System Summary:');
    console.log(`✅ Database: ${spcTenantDb} - Connected`);
    console.log(`✅ Users: ${users.length} - Configured`);
    console.log(`✅ Projects: ${projects.length} - Created`);
    console.log(`✅ Assignments: ${assignments.length} - Set up`);
    console.log(`✅ Teams: ${teamAssignments.length} - Formed`);

    if (adminUser) {
      console.log('\n🔑 Admin Login Credentials:');
      console.log(`  Email: ${adminUser.email}`);
      console.log(`  Password: (Check your records or use password reset)`);
      console.log(`  Role: ${adminUser.role}`);
    }

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  }
}

testSPCSystemStatus();
