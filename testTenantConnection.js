/**
 * Test Tenant Connection Function
 */

const { getTenantConnection } = require('./src/config/database.config');

async function testTenantConnection() {
  try {
    console.log('🧪 Testing Tenant Connection Function...');
    
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    
    console.log(`🔍 Testing connection to: ${tenantDbName}`);
    
    // Test the getTenantConnection function
    const connection = await getTenantConnection(tenantDbName);
    
    console.log('✅ Connection established');
    
    // Test creating a model
    const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    const projects = await Project.find({});
    
    console.log(`✅ Found ${projects.length} projects`);
    
    // Test project assignments
    const ProjectAssignment = connection.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
    const assignments = await ProjectAssignment.find({});
    
    console.log(`✅ Found ${assignments.length} assignments`);
    
    // Test getUserProjects function
    const { getUserProjects } = require('./src/config/spcProjectPermissions');
    
    // Use a mock userId
    const mockUserId = '696bfa999239d1cecdf311a7'; // Admin user ID
    console.log(`🔍 Testing getUserProjects for user: ${mockUserId}`);
    
    const userProjects = await getUserProjects(mockUserId, connection);
    console.log(`✅ User projects: ${userProjects.length}`);
    
    await connection.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testTenantConnection();
