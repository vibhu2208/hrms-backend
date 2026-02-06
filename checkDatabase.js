const mongoose = require('mongoose');
const { getTenantConnection } = require('./src/config/database.config');

async function checkDatabase() {
  try {
    console.log('🔍 Checking database collections...');
    
    const connection = await getTenantConnection('696b515db6c9fd5fd51aed1c');
    
    // List all collections
    const collections = await connection.db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));
    
    // Check if projectassignments exists
    const projectAssignmentsExists = collections.some(c => c.name === 'projectassignments');
    const teamAssignmentsExists = collections.some(c => c.name === 'teamassignments');
    const projectsExists = collections.some(c => c.name === 'projects');
    
    console.log('\n🔍 Collection Status:');
    console.log('  projects:', projectsExists ? '✅' : '❌');
    console.log('  projectassignments:', projectAssignmentsExists ? '✅' : '❌');
    console.log('  teamassignments:', teamAssignmentsExists ? '✅' : '❌');
    
    // Check documents in projects collection
    if (projectsExists) {
      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
      const projectCount = await Project.countDocuments();
      console.log('\n📊 Projects collection:', projectCount, 'documents');
      
      if (projectCount > 0) {
        const sampleProject = await Project.findOne();
        console.log('📝 Sample project structure:', Object.keys(sampleProject.toObject()));
      }
    }
    
    // Check documents in projectassignments collection
    if (projectAssignmentsExists) {
      const ProjectAssignment = connection.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
      const assignmentCount = await ProjectAssignment.countDocuments();
      console.log('\n📊 ProjectAssignments collection:', assignmentCount, 'documents');
    }
    
    await connection.close();
    
  } catch (error) {
    console.error('❌ Database check error:', error);
  }
}

checkDatabase();
