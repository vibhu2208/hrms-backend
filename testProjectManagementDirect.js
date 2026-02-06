/**
 * Test Project Management Database Directly
 */

const mongoose = require('mongoose');

async function testProjectManagementDirect() {
  try {
    console.log('🧪 Testing Project Management Database Directly...');
    
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    
    // Connect directly to tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to tenant database');
    
    // Test Projects collection
    console.log('\n📋 Testing Projects collection...');
    const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    const projects = await Project.find({});
    
    console.log(`✅ Found ${projects.length} projects:`);
    projects.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.name} (${project.status})`);
    });
    
    // Test ProjectAssignments collection
    console.log('\n👥 Testing ProjectAssignments collection...');
    const ProjectAssignment = mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
    const assignments = await ProjectAssignment.find({});
    
    console.log(`✅ Found ${assignments.length} assignments:`);
    assignments.forEach((assignment, index) => {
      console.log(`  ${index + 1}. User: ${assignment.userId} → Project: ${assignment.projectId} (${assignment.role})`);
    });
    
    // Test Users collection
    console.log('\n👤 Testing Users collection...');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await User.find({});
    
    console.log(`✅ Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.role})`);
    });
    
    // Test getUserProjects function directly
    console.log('\n🔍 Testing getUserProjects function...');
    const { getUserProjects } = require('./src/config/spcProjectPermissions');
    
    const adminUserId = '696bfa999239d1cecdf311a7'; // Admin user ID
    console.log(`🔍 Getting projects for admin user: ${adminUserId}`);
    
    const userProjects = await getUserProjects(adminUserId, mongoose.connection);
    console.log(`✅ Admin user projects: ${userProjects.length}`);
    
    userProjects.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.name} (${project.status})`);
    });
    
    // Create mock dashboard data
    console.log('\n📊 Creating mock dashboard data...');
    const dashboardData = {
      projects: userProjects.map(project => ({
        id: project._id,
        name: project.name,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        description: project.description
      })),
      teamMembers: [],
      stats: {
        totalProjects: userProjects.length,
        activeProjects: userProjects.filter(p => p.status === 'active').length,
        teamMembers: 0
      }
    };
    
    console.log('✅ Dashboard data created successfully:');
    console.log(JSON.stringify(dashboardData, null, 2));
    
    await mongoose.disconnect();
    console.log('\n🎉 Project Management Database Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('timeout')) {
      console.log('\n🔧 Timeout Solutions:');
      console.log('1. Check internet connection');
      console.log('2. Try using VPN');
      console.log('3. Check MongoDB Atlas status');
    }
  }
}

testProjectManagementDirect();
