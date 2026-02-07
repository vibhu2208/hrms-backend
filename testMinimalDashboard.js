/**
 * Test Minimal Dashboard with Direct Database Connection
 */

const mongoose = require('mongoose');

async function testMinimalDashboard() {
  try {
    console.log('🧪 Testing Minimal Dashboard...');
    
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    
    // Connect directly to tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to tenant database');
    
    // Get projects directly
    const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    const projects = await Project.find({});
    
    console.log(`✅ Found ${projects.length} projects`);
    
    // Get project assignments
    const ProjectAssignment = mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
    const assignments = await ProjectAssignment.find({});
    
    console.log(`✅ Found ${assignments.length} assignments`);
    
    // Create mock dashboard data
    const dashboardData = {
      projects: projects.map(p => ({
        id: p._id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        startDate: p.startDate,
        endDate: p.endDate
      })),
      teamMembers: [],
      stats: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        teamMembers: 0
      }
    };
    
    console.log('✅ Dashboard data created successfully');
    console.log('📊 Dashboard Data:');
    console.log(JSON.stringify(dashboardData, null, 2));
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMinimalDashboard();
