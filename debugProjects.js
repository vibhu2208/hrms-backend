const mongoose = require('mongoose');
const { getTenantConnection } = require('./src/config/database.config');

async function debugProjects() {
  try {
    console.log('🔍 Debugging projects and assignments...');
    
    const connection = await getTenantConnection('696b515db6c9fd5fd51aed1c');
    
    // Check projects collection
    const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    const projects = await Project.find({});
    console.log('\n📊 Projects collection:', projects.length, 'documents');
    
    projects.forEach((project, index) => {
      console.log(`\nProject ${index + 1}:`);
      console.log('  ID:', project._id);
      console.log('  Name:', project.name);
      console.log('  Status:', project.status);
      console.log('  CreatedBy:', project.createdBy);
      console.log('  AssignedManagers:', project.assignedManagers);
      console.log('  AssignedHRs:', project.assignedHRs);
    });
    
    // Check projectassignments collection
    try {
      const ProjectAssignment = connection.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
      const assignments = await ProjectAssignment.find({});
      console.log('\n📊 ProjectAssignments collection:', assignments.length, 'documents');
      
      assignments.forEach((assignment, index) => {
        console.log(`\nAssignment ${index + 1}:`);
        console.log('  UserID:', assignment.userId);
        console.log('  ProjectID:', assignment.projectId);
        console.log('  IsActive:', assignment.isActive);
      });
    } catch (error) {
      console.log('\n⚠️ ProjectAssignments collection not found');
    }
    
    // Check users collection to see user roles
    const User = connection.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await User.find({}).select('email role firstName lastName');
    console.log('\n📊 Users collection:', users.length, 'documents');
    
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log('  ID:', user._id);
      console.log('  Email:', user.email);
      console.log('  Role:', user.role);
      console.log('  Name:', user.firstName, user.lastName);
    });
    
    await connection.close();
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugProjects();
