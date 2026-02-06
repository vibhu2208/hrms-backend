const mongoose = require('mongoose');

/**
 * SPC Project System Implementation
 * Working within tenant_696b515db6c9fd5fd51aed1c only
 */

async function implementSPCProjectSystem() {
  try {
    console.log('🚀 Implementing SPC Project System...');
    
    const spcTenantId = '696b515db6c9fd5fd51aed1c';
    const spcTenantDb = `tenant_${spcTenantId}`;

    // Connect to SPC tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${spcTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to SPC tenant: ${spcTenantDb}`);

    // Step 1: Create Projects Collection Schema
    const projectSchema = new mongoose.Schema({
      name: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        required: false
      },
      status: {
        type: String,
        enum: ['active', 'completed', 'on-hold', 'cancelled'],
        default: 'active'
      },
      assignedManagers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      assignedHRs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      assignedEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      startDate: {
        type: Date,
        default: Date.now
      },
      endDate: {
        type: Date
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      budget: {
        allocated: Number,
        spent: Number
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    });

    const Project = mongoose.model('Project', projectSchema);

    // Step 2: Create Project Assignments Collection Schema
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

    // Step 3: Create Team Assignments Collection Schema
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

    console.log('✅ Created schemas for project system');

    // Step 4: Check current users and identify roles
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await User.find({});
    
    console.log(`📊 Found ${users.length} users in SPC tenant`);
    
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

    // Step 5: Create sample projects for demonstration
    const adminUser = roleCategories.company_admin[0];
    if (!adminUser) {
      console.log('❌ No admin user found to create projects');
      return;
    }

    console.log(`\n🏗️ Creating sample projects as admin: ${adminUser.email}`);

    // Sample Project 1: Website Redesign
    const project1 = new Project({
      name: 'Company Website Redesign',
      description: 'Complete redesign of company website with modern UI/UX',
      status: 'active',
      assignedManagers: roleCategories.managers.slice(0, 2).map(m => m._id),
      assignedHRs: roleCategories.hrs.slice(0, 2).map(h => h._id),
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-30'),
      priority: 'high',
      budget: { allocated: 50000, spent: 15000 },
      createdBy: adminUser._id
    });

    await project1.save();
    console.log(`✅ Created project: ${project1.name}`);

    // Sample Project 2: HR System Implementation
    const project2 = new Project({
      name: 'HR System Implementation',
      description: 'Implement new HR management system across all departments',
      status: 'active',
      assignedManagers: [roleCategories.managers[2]?._id].filter(Boolean),
      assignedHRs: roleCategories.hrs.slice(2, 4).map(h => h._id),
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-08-31'),
      priority: 'critical',
      budget: { allocated: 75000, spent: 25000 },
      createdBy: adminUser._id
    });

    await project2.save();
    console.log(`✅ Created project: ${project2.name}`);

    // Step 6: Create project assignments
    console.log('\n👥 Creating project assignments...');

    // Assign managers to projects
    for (let i = 0; i < Math.min(3, roleCategories.managers.length); i++) {
      const manager = roleCategories.managers[i];
      const assignment = new ProjectAssignment({
        projectId: i < 2 ? project1._id : project2._id,
        userId: manager._id,
        role: 'manager',
        assignedBy: adminUser._id,
        permissions: ['view_project', 'edit_project', 'assign_team', 'view_team', 'manage_tasks', 'view_reports']
      });
      await assignment.save();
      console.log(`  ✅ Assigned manager ${manager.email} to project`);
    }

    // Assign HRs to projects
    for (let i = 0; i < Math.min(4, roleCategories.hrs.length); i++) {
      const hr = roleCategories.hrs[i];
      const assignment = new ProjectAssignment({
        projectId: i < 2 ? project1._id : project2._id,
        userId: hr._id,
        role: 'hr',
        assignedBy: adminUser._id,
        permissions: ['view_project', 'view_team', 'manage_tasks']
      });
      await assignment.save();
      console.log(`  ✅ Assigned HR ${hr.email} to project`);
    }

    // Step 7: Create team assignments (Manager-HR relationships)
    console.log('\n🤝 Creating team assignments...');

    // Team assignments for Project 1
    if (roleCategories.managers[0] && roleCategories.hrs[0]) {
      const team1 = new TeamAssignment({
        projectId: project1._id,
        managerId: roleCategories.managers[0]._id,
        hrId: roleCategories.hrs[0]._id,
        relationshipType: 'lead_hr',
        assignedBy: adminUser._id,
        notes: 'Lead HR for Website Redesign project'
      });
      await team1.save();
      console.log(`  ✅ Team: ${roleCategories.managers[0].email} + ${roleCategories.hrs[0].email}`);
    }

    if (roleCategories.managers[1] && roleCategories.hrs[1]) {
      const team2 = new TeamAssignment({
        projectId: project1._id,
        managerId: roleCategories.managers[1]._id,
        hrId: roleCategories.hrs[1]._id,
        relationshipType: 'support_hr',
        assignedBy: adminUser._id,
        notes: 'Support HR for Website Redesign project'
      });
      await team2.save();
      console.log(`  ✅ Team: ${roleCategories.managers[1].email} + ${roleCategories.hrs[1].email}`);
    }

    // Step 8: Summary
    console.log('\n🎉 SPC PROJECT SYSTEM IMPLEMENTATION COMPLETE!');
    console.log('\n📊 Implementation Summary:');
    console.log(`✅ Projects Collection: Created with 2 sample projects`);
    console.log(`✅ Project Assignments: Created for managers and HRs`);
    console.log(`✅ Team Assignments: Created manager-HR relationships`);
    console.log(`✅ Database: ${spcTenantDb} (SPC Tenant Only)`);
    
    console.log('\n👥 Users Processed:');
    console.log(`  - Company Admins: ${roleCategories.company_admin.length}`);
    console.log(`  - Managers: ${roleCategories.managers.length}`);
    console.log(`  - HRs: ${roleCategories.hrs.length}`);
    console.log(`  - Employees: ${roleCategories.employees.length}`);

    console.log('\n🔧 Next Steps:');
    console.log('1. Update permission system to use project-based access');
    console.log('2. Create API endpoints for project management');
    console.log('3. Update frontend to show project-specific data');
    console.log('4. Test manager and HR access controls');

  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the implementation
implementSPCProjectSystem();
