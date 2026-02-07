const mongoose = require('mongoose');

/**
 * Fixed SPC Project System Implementation
 * Working within tenant_696b515db6c9fd5fd51aed1c only
 */

async function implementSPCProjectSystem() {
  try {
    console.log('🚀 Implementing SPC Project System (Fixed)...');
    
    const spcTenantId = '696b515db6c9fd5fd51aed1c';
    const spcTenantDb = `tenant_${spcTenantId}`;

    // Connect to SPC tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${spcTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to SPC tenant: ${spcTenantDb}`);

    // Step 1: Create Project Assignments Collection Schema
    const projectAssignmentSchema = new mongoose.Schema({
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      role: {
        type: String,
        enum: ['manager', 'hr', 'employee'],
        required: true
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      assignedAt: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      },
      permissions: [{
        type: String,
        enum: [
          'view_project',
          'edit_project',
          'assign_team',
          'view_team',
          'manage_tasks',
          'view_reports',
          'approve_expenses'
        ]
      }]
    });

    const ProjectAssignment = mongoose.model('ProjectAssignment', projectAssignmentSchema);

    // Step 2: Create Team Assignments Collection Schema
    const teamAssignmentSchema = new mongoose.Schema({
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
      },
      managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      hrId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      relationshipType: {
        type: String,
        enum: ['lead_hr', 'support_hr', 'project_hr'],
        default: 'project_hr'
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      assignedAt: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      },
      notes: String
    });

    const TeamAssignment = mongoose.model('TeamAssignment', teamAssignmentSchema);

    console.log('✅ Created schemas for project assignments');

    // Step 3: Get existing projects and users
    const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    const projects = await Project.find({});
    const users = await User.find({});
    
    console.log(`📊 Found ${projects.length} existing projects`);
    console.log(`👥 Found ${users.length} users`);

    // Categorize users by current roles
    const roleCategories = {
      company_admin: [],
      managers: [],
      hrs: [],
      employees: []
    };

    users.forEach(user => {
      switch(user.role) {
        case 'admin':
        case 'company_admin':
          roleCategories.company_admin.push(user);
          break;
        case 'manager':
          roleCategories.managers.push(user);
          break;
        case 'hr':
        case 'hr_manager':
        case 'hr_executive':
          roleCategories.hrs.push(user);
          break;
        case 'employee':
        default:
          roleCategories.employees.push(user);
          break;
      }
    });

    console.log('\n👥 User Role Distribution:');
    console.log(`  Company Admins: ${roleCategories.company_admin.length}`);
    console.log(`  Managers: ${roleCategories.managers.length}`);
    console.log(`  HRs: ${roleCategories.hrs.length}`);
    console.log(`  Employees: ${roleCategories.employees.length}`);

    // Step 4: Create additional sample project if needed
    const adminUser = roleCategories.company_admin[0];
    if (!adminUser) {
      console.log('❌ No admin user found');
      return;
    }

    if (projects.length === 1) {
      console.log('\n🏗️ Creating additional sample project...');
      
      // Generate unique project code
      const projectCode = `PROJ${Date.now()}`;
      
      const project2 = new Project({
        name: 'HR System Implementation',
        description: 'Implement new HR management system across all departments',
        status: 'active',
        projectCode: projectCode, // Add projectCode to avoid index issue
        assignedManagers: roleCategories.managers.map(m => m._id),
        assignedHRs: roleCategories.hrs.slice(0, 3).map(h => h._id),
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-08-31'),
        priority: 'critical',
        budget: { allocated: 75000, spent: 25000 },
        createdBy: adminUser._id
      });

      await project2.save();
      projects.push(project2);
      console.log(`✅ Created project: ${project2.name} (Code: ${projectCode})`);
    }

    // Step 5: Create project assignments
    console.log('\n👥 Creating project assignments...');

    // Clear existing assignments to avoid duplicates
    await ProjectAssignment.deleteMany({});
    console.log('🧹 Cleared existing project assignments');

    // Assign managers to projects
    for (let i = 0; i < roleCategories.managers.length; i++) {
      const manager = roleCategories.managers[i];
      const projectIndex = i % projects.length;
      
      const assignment = new ProjectAssignment({
        projectId: projects[projectIndex]._id,
        userId: manager._id,
        role: 'manager',
        assignedBy: adminUser._id,
        permissions: ['view_project', 'edit_project', 'assign_team', 'view_team', 'manage_tasks', 'view_reports']
      });
      await assignment.save();
      console.log(`  ✅ Assigned manager ${manager.email} to project "${projects[projectIndex].name}"`);
    }

    // Assign HRs to projects (distribute across projects)
    for (let i = 0; i < roleCategories.hrs.length; i++) {
      const hr = roleCategories.hrs[i];
      const projectIndex = i % projects.length;
      
      const assignment = new ProjectAssignment({
        projectId: projects[projectIndex]._id,
        userId: hr._id,
        role: 'hr',
        assignedBy: adminUser._id,
        permissions: ['view_project', 'view_team', 'manage_tasks']
      });
      await assignment.save();
      console.log(`  ✅ Assigned HR ${hr.email} to project "${projects[projectIndex].name}"`);
    }

    // Step 6: Create team assignments (Manager-HR relationships)
    console.log('\n🤝 Creating team assignments...');

    // Clear existing team assignments
    await TeamAssignment.deleteMany({});
    console.log('🧹 Cleared existing team assignments');

    // Create team assignments for each project
    projects.forEach((project, projectIndex) => {
      const projectManagers = roleCategories.managers.filter(m => 
        projectIndex === 0 || m._id.toString() === roleCategories.managers[0]?._id.toString()
      );
      const projectHRs = roleCategories.hrs.filter((h, i) => i % projects.length === projectIndex);

      projectManagers.forEach(manager => {
        projectHRs.forEach((hr, hrIndex) => {
          const team = new TeamAssignment({
            projectId: project._id,
            managerId: manager._id,
            hrId: hr._id,
            relationshipType: hrIndex === 0 ? 'lead_hr' : 'support_hr',
            assignedBy: adminUser._id,
            notes: `${hrIndex === 0 ? 'Lead' : 'Support'} HR for ${project.name} project`
          });
          team.save();
          console.log(`  ✅ Team: ${manager.email} + ${hr.email} (${project.name})`);
        });
      });
    });

    // Step 7: Summary
    console.log('\n🎉 SPC PROJECT SYSTEM IMPLEMENTATION COMPLETE!');
    console.log('\n📊 Implementation Summary:');
    console.log(`✅ Projects: ${projects.length} projects in SPC tenant`);
    console.log(`✅ Project Assignments: Created for all managers and HRs`);
    console.log(`✅ Team Assignments: Created manager-HR relationships`);
    console.log(`✅ Database: ${spcTenantDb} (SPC Tenant Only)`);
    
    console.log('\n👥 Users Processed:');
    console.log(`  - Company Admins: ${roleCategories.company_admin.length}`);
    console.log(`  - Managers: ${roleCategories.managers.length} (assigned to projects)`);
    console.log(`  - HRs: ${roleCategories.hrs.length} (assigned to projects)`);
    console.log(`  - Employees: ${roleCategories.employees.length}`);

    console.log('\n🏗️ Projects Created:');
    projects.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.name} (${project.status})`);
    });

    console.log('\n🔧 Next Steps:');
    console.log('1. ✅ Database structure completed');
    console.log('2. ⏳ Update permission system to use project-based access');
    console.log('3. ⏳ Create API endpoints for project management');
    console.log('4. ⏳ Update frontend to show project-specific data');
    console.log('5. ⏳ Test manager and HR access controls');

  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the implementation
implementSPCProjectSystem();
