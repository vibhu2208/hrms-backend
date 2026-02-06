const mongoose = require('mongoose');

async function verifySPCProjectSystem() {
  try {
    console.log('🔍 Verifying SPC Project System...');
    
    const spcTenantId = '696b515db6c9fd5fd51aed1c';
    const spcTenantDb = `tenant_${spcTenantId}`;

    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${spcTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to SPC tenant: ${spcTenantDb}`);

    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📁 Collections in SPC tenant: ${collections.length}`);
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });

    // Check projects
    try {
      const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
      const projects = await Project.find({});
      console.log(`\n🏗️ Projects: ${projects.length}`);
      projects.forEach((project, index) => {
        console.log(`  ${index + 1}. ${project.name || project.projectName}`);
        console.log(`     Status: ${project.status || 'N/A'}`);
        console.log(`     Created: ${project.createdAt || 'N/A'}`);
        if (project.assignedManagers && project.assignedManagers.length > 0) {
          console.log(`     Managers: ${project.assignedManagers.length} assigned`);
        }
        if (project.assignedHRs && project.assignedHRs.length > 0) {
          console.log(`     HRs: ${project.assignedHRs.length} assigned`);
        }
      });
    } catch (err) {
      console.log(`⚠️ Error checking projects: ${err.message}`);
    }

    // Check project assignments
    try {
      const ProjectAssignment = mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
      const assignments = await ProjectAssignment.find({});
      console.log(`\n👥 Project Assignments: ${assignments.length}`);
      
      // Group by project
      const assignmentsByProject = {};
      assignments.forEach(assignment => {
        const projectId = assignment.projectId?.toString();
        if (!assignmentsByProject[projectId]) {
          assignmentsByProject[projectId] = { managers: [], hrs: [], employees: [] };
        }
        assignmentsByProject[projectId][assignment.role + 's'].push(assignment.userId);
      });

      Object.keys(assignmentsByProject).forEach(projectId => {
        const assignment = assignmentsByProject[projectId];
        console.log(`  Project ${projectId}:`);
        console.log(`    Managers: ${assignment.managers.length}`);
        console.log(`    HRs: ${assignment.hrs.length}`);
        console.log(`    Employees: ${assignment.employees.length}`);
      });
    } catch (err) {
      console.log(`⚠️ Error checking project assignments: ${err.message}`);
    }

    // Check team assignments
    try {
      const TeamAssignment = mongoose.model('TeamAssignment', new mongoose.Schema({}, { strict: false }), 'teamassignments');
      const teamAssignments = await TeamAssignment.find({});
      console.log(`\n🤝 Team Assignments: ${teamAssignments.length}`);
      
      teamAssignments.forEach((team, index) => {
        console.log(`  ${index + 1}. Manager-HR Team`);
        console.log(`     Project: ${team.projectId}`);
        console.log(`     Relationship: ${team.relationshipType || 'N/A'}`);
        console.log(`     Active: ${team.isActive || 'N/A'}`);
      });
    } catch (err) {
      console.log(`⚠️ Error checking team assignments: ${err.message}`);
    }

    // Show user access preview
    console.log('\n🔐 USER ACCESS PREVIEW:');
    try {
      const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const users = await User.find({}).select('email role firstName lastName');
      
      // Show what each user can access
      for (const user of users.slice(0, 5)) { // Show first 5 users
        console.log(`\n👤 ${user.email} (${user.role}):`);
        
        // Get their project assignments
        const ProjectAssignment = mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
        const userAssignments = await ProjectAssignment.find({ userId: user._id }).populate('projectId');
        
        if (userAssignments.length > 0) {
          console.log(`  📋 Assigned Projects: ${userAssignments.length}`);
          userAssignments.forEach(assignment => {
            console.log(`    - ${assignment.projectId?.name || 'Unknown Project'} (${assignment.role})`);
          });
        } else {
          console.log(`  📋 No project assignments`);
        }
      }
    } catch (err) {
      console.log(`⚠️ Error previewing user access: ${err.message}`);
    }

    console.log('\n✅ SPC Project System Verification Complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

verifySPCProjectSystem();
