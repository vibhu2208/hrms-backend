const mongoose = require('mongoose');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const { getTenantConnection, connectGlobalDB } = require('../config/database.config');
require('dotenv').config();

const permissions = [
  // Employee Management
  { name: 'Create Employee', code: 'EMPLOYEE_CREATE', module: 'employees', action: 'create', description: 'Create new employee records', scope: 'all' },
  { name: 'View Employee', code: 'EMPLOYEE_READ', module: 'employees', action: 'read', description: 'View employee information', scope: 'own' },
  { name: 'Update Employee', code: 'EMPLOYEE_UPDATE', module: 'employees', action: 'update', description: 'Update employee records', scope: 'own' },
  { name: 'Delete Employee', code: 'EMPLOYEE_DELETE', module: 'employees', action: 'delete', description: 'Delete employee records', scope: 'all' },
  
  // Leave Management
  { name: 'Apply Leave', code: 'LEAVE_CREATE', module: 'leave', action: 'create', description: 'Apply for leave', scope: 'own' },
  { name: 'View Leave', code: 'LEAVE_READ', module: 'leave', action: 'read', description: 'View leave requests', scope: 'own' },
  { name: 'Approve Leave', code: 'LEAVE_APPROVE', module: 'leave', action: 'approve', description: 'Approve leave requests', scope: 'team' },
  { name: 'Manage Leave', code: 'LEAVE_MANAGE', module: 'leave', action: 'manage', description: 'Full leave management', scope: 'all' },
  
  // Attendance Management
  { name: 'Mark Attendance', code: 'ATTENDANCE_CREATE', module: 'attendance', action: 'create', description: 'Mark attendance', scope: 'own' },
  { name: 'View Attendance', code: 'ATTENDANCE_READ', module: 'attendance', action: 'read', description: 'View attendance records', scope: 'own' },
  { name: 'Update Attendance', code: 'ATTENDANCE_UPDATE', module: 'attendance', action: 'update', description: 'Update attendance records', scope: 'team' },
  { name: 'Approve Attendance', code: 'ATTENDANCE_APPROVE', module: 'attendance', action: 'approve', description: 'Approve attendance regularization', scope: 'team' },
  
  // Payroll Management
  { name: 'View Payroll', code: 'PAYROLL_READ', module: 'payroll', action: 'read', description: 'View payroll information', scope: 'own' },
  { name: 'Process Payroll', code: 'PAYROLL_CREATE', module: 'payroll', action: 'create', description: 'Process payroll', scope: 'all' },
  { name: 'Approve Payroll', code: 'PAYROLL_APPROVE', module: 'payroll', action: 'approve', description: 'Approve payroll', scope: 'all' },
  { name: 'Export Payroll', code: 'PAYROLL_EXPORT', module: 'payroll', action: 'export', description: 'Export payroll data', scope: 'all' },
  
  // Recruitment
  { name: 'Create Job Posting', code: 'RECRUITMENT_CREATE', module: 'recruitment', action: 'create', description: 'Create job postings', scope: 'all' },
  { name: 'View Candidates', code: 'RECRUITMENT_READ', module: 'recruitment', action: 'read', description: 'View candidate applications', scope: 'department' },
  { name: 'Manage Recruitment', code: 'RECRUITMENT_MANAGE', module: 'recruitment', action: 'manage', description: 'Full recruitment management', scope: 'all' },
  
  // Performance Management
  { name: 'View Performance', code: 'PERFORMANCE_READ', module: 'performance', action: 'read', description: 'View performance reviews', scope: 'own' },
  { name: 'Conduct Review', code: 'PERFORMANCE_CREATE', module: 'performance', action: 'create', description: 'Conduct performance reviews', scope: 'team' },
  { name: 'Manage Performance', code: 'PERFORMANCE_MANAGE', module: 'performance', action: 'manage', description: 'Full performance management', scope: 'all' },
  
  // Reports
  { name: 'View Reports', code: 'REPORTS_READ', module: 'reports', action: 'read', description: 'View reports', scope: 'department' },
  { name: 'Export Reports', code: 'REPORTS_EXPORT', module: 'reports', action: 'export', description: 'Export reports', scope: 'all' },
  
  // Settings
  { name: 'Manage Settings', code: 'SETTINGS_MANAGE', module: 'settings', action: 'manage', description: 'Manage system settings', scope: 'all' },
  
  // User Management
  { name: 'Create User', code: 'USER_CREATE', module: 'users', action: 'create', description: 'Create new users', scope: 'all' },
  { name: 'View User', code: 'USER_READ', module: 'users', action: 'read', description: 'View user information', scope: 'department' },
  { name: 'Update User', code: 'USER_UPDATE', module: 'users', action: 'update', description: 'Update user records', scope: 'all' },
  { name: 'Delete User', code: 'USER_DELETE', module: 'users', action: 'delete', description: 'Delete users', scope: 'all' },
  
  // Approvals
  { name: 'Process Approvals', code: 'APPROVAL_PROCESS', module: 'approvals', action: 'approve', description: 'Process approval requests', scope: 'team' },
  
  // Assets
  { name: 'View Assets', code: 'ASSETS_READ', module: 'assets', action: 'read', description: 'View asset information', scope: 'own' },
  { name: 'Manage Assets', code: 'ASSETS_MANAGE', module: 'assets', action: 'manage', description: 'Manage company assets', scope: 'all' },
  
  // Documents
  { name: 'View Documents', code: 'DOCUMENTS_READ', module: 'documents', action: 'read', description: 'View documents', scope: 'own' },
  { name: 'Upload Documents', code: 'DOCUMENTS_CREATE', module: 'documents', action: 'create', description: 'Upload documents', scope: 'own' },
  { name: 'Manage Documents', code: 'DOCUMENTS_MANAGE', module: 'documents', action: 'manage', description: 'Manage all documents', scope: 'all' },
  
  // Offboarding
  { name: 'Initiate Offboarding', code: 'OFFBOARDING_CREATE', module: 'offboarding', action: 'create', description: 'Initiate offboarding process', scope: 'all' },
  { name: 'Manage Offboarding', code: 'OFFBOARDING_MANAGE', module: 'offboarding', action: 'manage', description: 'Manage offboarding process', scope: 'all' },
  
  // Compliance
  { name: 'View Compliance', code: 'COMPLIANCE_READ', module: 'compliance', action: 'read', description: 'View compliance reports', scope: 'all' },
  { name: 'Manage Compliance', code: 'COMPLIANCE_MANAGE', module: 'compliance', action: 'manage', description: 'Manage compliance', scope: 'all' }
];

async function seedPermissionsForTenant(companyId) {
  try {
    // Connect to global database
    const globalConnection = await connectGlobalDB();
    console.log('Connected to Global MongoDB');

    // Get company details using the global connection
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);
    const company = await CompanyRegistry.findOne({ companyId });
    
    if (!company) {
      console.error(`Company with ID ${companyId} not found`);
      process.exit(1);
    }

    console.log(`\n📋 Seeding permissions for: ${company.companyName}`);
    console.log(`Database: ${company.tenantDatabaseName}`);

    // Get tenant connection
    const tenantConnection = await getTenantConnection(companyId);
    console.log('Connected to Tenant Database');

    // Create Permission and Role models in tenant DB
    const TenantPermission = tenantConnection.model('Permission', Permission.schema);
    const TenantRole = tenantConnection.model('Role', Role.schema);

    // Clear existing permissions and roles in tenant DB
    await TenantPermission.deleteMany({});
    console.log('Cleared existing permissions in tenant DB');
    
    await TenantRole.deleteMany({});
    console.log('Cleared existing roles in tenant DB');

    // Insert permissions
    const createdPermissions = await TenantPermission.insertMany(permissions);
    console.log(`✅ Created ${createdPermissions.length} permissions`);

    // Create permission map
    const permissionMap = {};
    createdPermissions.forEach(perm => {
      permissionMap[perm.code] = perm._id;
    });

    // Define roles with permissions
    const roles = [
      {
        name: 'Employee',
        code: 'EMPLOYEE',
        description: 'Standard employee with basic access',
        level: 1,
        isSystemRole: true,
        permissions: [
          { permissionId: permissionMap['EMPLOYEE_READ'], scope: 'own' },
          { permissionId: permissionMap['LEAVE_CREATE'], scope: 'own' },
          { permissionId: permissionMap['LEAVE_READ'], scope: 'own' },
          { permissionId: permissionMap['ATTENDANCE_CREATE'], scope: 'own' },
          { permissionId: permissionMap['ATTENDANCE_READ'], scope: 'own' },
          { permissionId: permissionMap['PAYROLL_READ'], scope: 'own' },
          { permissionId: permissionMap['PERFORMANCE_READ'], scope: 'own' },
          { permissionId: permissionMap['ASSETS_READ'], scope: 'own' },
          { permissionId: permissionMap['DOCUMENTS_READ'], scope: 'own' },
          { permissionId: permissionMap['DOCUMENTS_CREATE'], scope: 'own' }
        ]
      },
      {
        name: 'Manager',
        code: 'MANAGER',
        description: 'Team manager with team-level access',
        level: 2,
        isSystemRole: true,
        permissions: [
          { permissionId: permissionMap['EMPLOYEE_READ'], scope: 'team' },
          { permissionId: permissionMap['EMPLOYEE_UPDATE'], scope: 'team' },
          { permissionId: permissionMap['LEAVE_READ'], scope: 'team' },
          { permissionId: permissionMap['LEAVE_APPROVE'], scope: 'team' },
          { permissionId: permissionMap['ATTENDANCE_READ'], scope: 'team' },
          { permissionId: permissionMap['ATTENDANCE_UPDATE'], scope: 'team' },
          { permissionId: permissionMap['ATTENDANCE_APPROVE'], scope: 'team' },
          { permissionId: permissionMap['PERFORMANCE_READ'], scope: 'team' },
          { permissionId: permissionMap['PERFORMANCE_CREATE'], scope: 'team' },
          { permissionId: permissionMap['REPORTS_READ'], scope: 'team' },
          { permissionId: permissionMap['APPROVAL_PROCESS'], scope: 'team' }
        ]
      },
      {
        name: 'HR',
        code: 'HR',
        description: 'HR personnel with department-level access',
        level: 3,
        isSystemRole: true,
        permissions: [
          { permissionId: permissionMap['EMPLOYEE_CREATE'], scope: 'all' },
          { permissionId: permissionMap['EMPLOYEE_READ'], scope: 'all' },
          { permissionId: permissionMap['EMPLOYEE_UPDATE'], scope: 'all' },
          { permissionId: permissionMap['LEAVE_READ'], scope: 'all' },
          { permissionId: permissionMap['LEAVE_MANAGE'], scope: 'all' },
          { permissionId: permissionMap['ATTENDANCE_READ'], scope: 'all' },
          { permissionId: permissionMap['ATTENDANCE_UPDATE'], scope: 'all' },
          { permissionId: permissionMap['ATTENDANCE_APPROVE'], scope: 'all' },
          { permissionId: permissionMap['RECRUITMENT_CREATE'], scope: 'all' },
          { permissionId: permissionMap['RECRUITMENT_READ'], scope: 'all' },
          { permissionId: permissionMap['RECRUITMENT_MANAGE'], scope: 'all' },
          { permissionId: permissionMap['PERFORMANCE_READ'], scope: 'all' },
          { permissionId: permissionMap['PERFORMANCE_MANAGE'], scope: 'all' },
          { permissionId: permissionMap['REPORTS_READ'], scope: 'all' },
          { permissionId: permissionMap['REPORTS_EXPORT'], scope: 'all' },
          { permissionId: permissionMap['USER_CREATE'], scope: 'all' },
          { permissionId: permissionMap['USER_READ'], scope: 'all' },
          { permissionId: permissionMap['ASSETS_MANAGE'], scope: 'all' },
          { permissionId: permissionMap['DOCUMENTS_MANAGE'], scope: 'all' },
          { permissionId: permissionMap['OFFBOARDING_CREATE'], scope: 'all' },
          { permissionId: permissionMap['OFFBOARDING_MANAGE'], scope: 'all' }
        ]
      },
      {
        name: 'Company Admin',
        code: 'COMPANY_ADMIN',
        description: 'Company administrator with full access',
        level: 4,
        isSystemRole: true,
        permissions: createdPermissions.map(perm => ({
          permissionId: perm._id,
          scope: 'all'
        }))
      }
    ];

    // Insert roles
    const createdRoles = await TenantRole.insertMany(roles);
    console.log(`✅ Created ${createdRoles.length} roles`);

    // Update existing users with roleId based on their current role
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const roleMapping = {
      'employee': createdRoles.find(r => r.code === 'EMPLOYEE')._id,
      'manager': createdRoles.find(r => r.code === 'MANAGER')._id,
      'hr': createdRoles.find(r => r.code === 'HR')._id,
      'company_admin': createdRoles.find(r => r.code === 'COMPANY_ADMIN')._id
    };

    console.log('\n📝 Updating existing users with roleId...');
    for (const [roleName, roleId] of Object.entries(roleMapping)) {
      const result = await TenantUser.updateMany(
        { role: roleName, roleId: { $exists: false } },
        { $set: { roleId: roleId, customPermissions: [] } }
      );
      console.log(`  - Updated ${result.modifiedCount} users with role '${roleName}'`);
    }

    console.log('\n=== Seed Summary ===');
    console.log(`Company: ${company.companyName}`);
    console.log(`Permissions: ${createdPermissions.length}`);
    console.log(`Roles: ${createdRoles.length}`);
    console.log('\nRoles created:');
    createdRoles.forEach(role => {
      console.log(`  - ${role.name} (${role.code}): ${role.permissions.length} permissions`);
    });

    await globalConnection.close();
    await tenantConnection.close();
    console.log('\n✅ Database connections closed');
    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding permissions and roles:', error);
    process.exit(1);
  }
}

// Get companyId from command line or use default
const companyId = process.argv[2] || 'COMP00001';
console.log(`\n🚀 Starting seed for company: ${companyId}\n`);

seedPermissionsForTenant(companyId);
