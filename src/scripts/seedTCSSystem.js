/**
 * Complete TCS System Seeder
 * Seeds: 1 Super Admin, 1 Company (TCS), 1 Company Admin, 1 HR, 1 Manager, 1 Employee
 * 
 * Run: node src/scripts/seedTCSSystem.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectGlobalDB, getTenantConnection, initializeTenantDatabase } = require('../config/database.config');
const { getSuperAdmin, getCompanyRegistry, getCompanyTheme } = require('../models/global');
const TenantUserSchema = require('../models/tenant/TenantUser');

const credentials = {
  superAdmin: {
    email: 'superadmin@hrms.com',
    password: 'SuperAdmin@2025',
    role: 'Super Admin'
  },
  companyAdmin: {
    email: 'admin@tcs.com',
    password: 'TCSAdmin@2025',
    role: 'Company Admin'
  },
  hr: {
    email: 'hr@tcs.com',
    password: 'TCSHR@2025',
    role: 'HR User'
  },
  manager: {
    email: 'manager@tcs.com',
    password: 'TCSManager@2025',
    role: 'Manager'
  },
  employee: {
    email: 'employee@tcs.com',
    password: 'TCSEmployee@2025',
    employeeId: 'TCS001',
    role: 'Employee'
  }
};

const seedTCSSystem = async () => {
  try {
    console.log('\n🚀 Starting TCS System Seeding...\n');
    console.log('═══════════════════════════════════════════════════════');
    
    // ============================================
    // STEP 1: Connect to Global Database
    // ============================================
    console.log('\n📡 STEP 1: Connecting to Global Database (hrms_global)...');
    const globalConn = await connectGlobalDB();
    console.log('✅ Connected to Global Database\n');

    // ============================================
    // STEP 2: Seed Super Admin
    // ============================================
    console.log('👤 STEP 2: Creating Super Admin...');
    
    // Import schemas directly
    const SuperAdminSchema = require('../models/global/SuperAdmin');
    const CompanyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyThemeSchema = require('../models/global/CompanyTheme');
    
    // Create models from global connection
    const SuperAdmin = globalConn.model('SuperAdmin', SuperAdminSchema);
    const CompanyRegistry = globalConn.model('CompanyRegistry', CompanyRegistrySchema);
    const CompanyTheme = globalConn.model('CompanyTheme', CompanyThemeSchema);
    
    // Clear existing super admin
    await SuperAdmin.deleteMany({});
    
    const superAdmin = await SuperAdmin.create({
      email: credentials.superAdmin.email,
      password: credentials.superAdmin.password,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1-555-0000',
      role: 'superadmin',
      isActive: true
    });
    
    console.log(`✅ Super Admin Created: ${superAdmin.email}\n`);

    // ============================================
    // STEP 3: Create Company in Global Database
    // ============================================
    console.log('🏢 STEP 3: Creating Company (TCS)...');
    
    // Clear existing companies
    await CompanyRegistry.deleteMany({});
    
    // Generate company ID
    const companyId = new mongoose.Types.ObjectId().toString();
    
    const company = new CompanyRegistry({
      companyCode: 'TCS00001',
      companyId: companyId,
      companyName: 'TCS',
      email: 'contact@tcs.com',
      phone: '+91-22-6778-9595',
      website: 'https://www.tcs.com',
      tenantDatabaseName: `tenant_${companyId}`,
      companyAdmin: {
        email: credentials.companyAdmin.email
      },
      address: {
        street: 'TCS House, Raveline Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        country: 'India'
      },
      subscription: {
        plan: 'enterprise',
        status: 'active',
        maxEmployees: 10000,
        maxAdmins: 50,
        billingCycle: 'yearly'
      },
      enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance', 'assets', 'compliance', 'projects', 'leave_management'],
      status: 'active',
      databaseStatus: 'provisioning',
      onboardedBy: superAdmin._id,
      onboardedByModel: 'SuperAdmin'
    });
    
    await company.save();
    console.log(`✅ Company Created: ${company.companyName} (${company.companyCode})`);
    console.log(`   Company ID: ${company.companyId}`);
    console.log(`   Tenant DB: ${company.tenantDatabaseName}\n`);

    // ============================================
    // STEP 4: Create Company Theme
    // ============================================
    console.log('🎨 STEP 4: Creating Company Theme...');
    
    const theme = new CompanyTheme({
      companyId: company.companyId,
      colors: {
        primary: '#0066cc',
        secondary: '#003d7a',
        accent: '#00a3e0',
        background: '#ffffff',
        text: '#333333',
        cardBackground: '#f5f5f5'
      },
      loginPage: {
        welcomeMessage: 'Welcome to TCS',
        subtitle: 'Tata Consultancy Services - Sign in to your account',
        showCompanyName: true,
        showLogo: true,
        showBackgroundImage: true
      }
    });
    
    await theme.save();
    company.themeId = theme._id;
    await company.save();
    console.log(`✅ Company Theme Created\n`);

    // ============================================
    // STEP 5: Initialize Tenant Database
    // ============================================
    console.log('🗄️  STEP 5: Initializing Tenant Database...');
    const tenantConnection = await initializeTenantDatabase(company.companyId);
    console.log(`✅ Tenant Database Initialized: ${company.tenantDatabaseName}\n`);

    // ============================================
    // STEP 6: Create Company Admin
    // ============================================
    console.log('👔 STEP 6: Creating Company Admin...');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const companyAdmin = new TenantUser({
      email: credentials.companyAdmin.email,
      password: credentials.companyAdmin.password,
      firstName: 'TCS',
      lastName: 'Admin',
      phone: '+91-9876543211',
      role: 'company_admin',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false
    });
    
    await companyAdmin.save();
    console.log(`✅ Company Admin Created: ${companyAdmin.email}\n`);
    
    // Update company with admin userId
    company.companyAdmin.userId = companyAdmin._id.toString();
    company.companyAdmin.createdAt = new Date();
    company.databaseStatus = 'active';
    await company.save();

    // ============================================
    // STEP 7: Create HR User
    // ============================================
    console.log('👥 STEP 7: Creating HR User...');
    const hrUser = new TenantUser({
      email: credentials.hr.email,
      password: credentials.hr.password,
      firstName: 'HR',
      lastName: 'Manager',
      phone: '+91-9876543212',
      role: 'hr',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false,
      createdBy: companyAdmin._id
    });
    
    await hrUser.save();
    console.log(`✅ HR User Created: ${hrUser.email}\n`);

    // ============================================
    // STEP 8: Create Manager User
    // ============================================
    console.log('📊 STEP 8: Creating Manager User...');
    const managerUser = new TenantUser({
      email: credentials.manager.email,
      password: credentials.manager.password,
      firstName: 'Team',
      lastName: 'Manager',
      phone: '+91-9876543213',
      role: 'manager',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false,
      createdBy: companyAdmin._id
    });
    
    await managerUser.save();
    console.log(`✅ Manager User Created: ${managerUser.email}\n`);

    // ============================================
    // STEP 9: Create Employee User
    // ============================================
    console.log('💼 STEP 9: Creating Employee User...');
    const employeeUser = new TenantUser({
      email: credentials.employee.email,
      password: credentials.employee.password,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+91-9876543214',
      role: 'employee',
      department: 'Engineering',
      designation: 'Software Engineer',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false,
      createdBy: hrUser._id
    });
    
    await employeeUser.save();
    console.log(`✅ Employee User Created: ${employeeUser.email}\n`);

    // ============================================
    // STEP 10: Create 10 Team Members under Manager
    // ============================================
    console.log('👥 STEP 10: Creating 10 Team Members...');
    
    const teamMembers = [
      { firstName: 'Rahul', lastName: 'Sharma', email: 'rahul.sharma@tcs.com', designation: 'Senior Developer', department: 'Engineering' },
      { firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@tcs.com', designation: 'Frontend Developer', department: 'Engineering' },
      { firstName: 'Amit', lastName: 'Kumar', email: 'amit.kumar@tcs.com', designation: 'Backend Developer', department: 'Engineering' },
      { firstName: 'Sneha', lastName: 'Reddy', email: 'sneha.reddy@tcs.com', designation: 'UI/UX Designer', department: 'Design' },
      { firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@tcs.com', designation: 'QA Engineer', department: 'Quality' },
      { firstName: 'Anjali', lastName: 'Mehta', email: 'anjali.mehta@tcs.com', designation: 'DevOps Engineer', department: 'Engineering' },
      { firstName: 'Rohan', lastName: 'Gupta', email: 'rohan.gupta@tcs.com', designation: 'Full Stack Developer', department: 'Engineering' },
      { firstName: 'Kavya', lastName: 'Iyer', email: 'kavya.iyer@tcs.com', designation: 'Business Analyst', department: 'Business' },
      { firstName: 'Arjun', lastName: 'Nair', email: 'arjun.nair@tcs.com', designation: 'Data Analyst', department: 'Analytics' },
      { firstName: 'Pooja', lastName: 'Desai', email: 'pooja.desai@tcs.com', designation: 'Product Manager', department: 'Product' }
    ];

    for (let i = 0; i < teamMembers.length; i++) {
      const member = teamMembers[i];
      const teamMember = new TenantUser({
        email: member.email,
        password: 'Employee@2025', // Default password for all team members
        firstName: member.firstName,
        lastName: member.lastName,
        phone: `+91-98765432${15 + i}`,
        role: 'employee',
        department: member.department,
        designation: member.designation,
        reportingManager: managerUser.email, // Reporting to manager@tcs.com
        isActive: true,
        isFirstLogin: false,
        mustChangePassword: false,
        createdBy: managerUser._id
      });
      
      await teamMember.save();
      console.log(`   ✅ ${member.firstName} ${member.lastName} (${member.email})`);
    }
    
    console.log(`\n✅ Created ${teamMembers.length} team members under ${managerUser.email}\n`);

    // ============================================
    // DISPLAY ALL CREDENTIALS
    // ============================================
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎉 TCS SYSTEM SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 SYSTEM OVERVIEW:');
    console.log('───────────────────────────────────────────────────────');
    console.log(`✓ Super Admin: 1`);
    console.log(`✓ Companies: 1 (TCS)`);
    console.log(`✓ Company Admins: 1`);
    console.log(`✓ HR Users: 1`);
    console.log(`✓ Managers: 1`);
    console.log(`✓ Employees: 11 (1 + 10 team members)`);
    console.log(`✓ Total Users: 16\n`);

    console.log('🏢 COMPANY DETAILS:');
    console.log('───────────────────────────────────────────────────────');
    console.log(`Company Name: ${company.companyName}`);
    console.log(`Company Code: ${company.companyCode}`);
    console.log(`Company ID: ${company.companyId}`);
    console.log(`Database: ${company.tenantDatabaseName}`);
    console.log(`Status: ${company.status}`);
    console.log(`Subscription: ${company.subscription.plan} (${company.subscription.status})`);
    console.log(`Max Employees: ${company.subscription.maxEmployees}`);
    console.log(`Enabled Modules: ${company.enabledModules.join(', ')}\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('1️⃣  SUPER ADMIN (Global System Access)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.superAdmin.email}`);
    console.log(`   Password: ${credentials.superAdmin.password}`);
    console.log(`   Role:     ${credentials.superAdmin.role}`);
    console.log(`   Access:   Super Admin Dashboard - All Companies`);
    console.log(`   Login:    http://localhost:5173/login/super-admin\n`);

    console.log('2️⃣  COMPANY ADMIN (TCS - Full Company Access)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.companyAdmin.email}`);
    console.log(`   Password: ${credentials.companyAdmin.password}`);
    console.log(`   Role:     ${credentials.companyAdmin.role}`);
    console.log(`   Company:  ${company.companyName}`);
    console.log(`   Access:   Full company management, all modules`);
    console.log(`   Login:    http://localhost:5173/login/company\n`);

    console.log('3️⃣  HR USER (TCS - HR Management)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.hr.email}`);
    console.log(`   Password: ${credentials.hr.password}`);
    console.log(`   Role:     ${credentials.hr.role}`);
    console.log(`   Company:  ${company.companyName}`);
    console.log(`   Access:   Employee, Recruitment, Attendance, Leaves`);
    console.log(`   Login:    http://localhost:5173/login/company\n`);

    console.log('4️⃣  MANAGER (TCS - Team Management)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.manager.email}`);
    console.log(`   Password: ${credentials.manager.password}`);
    console.log(`   Role:     ${credentials.manager.role}`);
    console.log(`   Company:  ${company.companyName}`);
    console.log(`   Access:   Team reports, Leave approvals, Attendance`);
    console.log(`   Login:    http://localhost:5173/login/company\n`);

    console.log('5️⃣  EMPLOYEE (TCS - Self Service)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:       ${credentials.employee.email}`);
    console.log(`   Password:    ${credentials.employee.password}`);
    console.log(`   Role:        ${credentials.employee.role}`);
    console.log(`   Company:     ${company.companyName}`);
    console.log(`   Department:  Engineering`);
    console.log(`   Designation: Software Engineer`);
    console.log(`   Access:      Self-service portal, attendance, leaves`);
    console.log(`   Login:       http://localhost:5173/login/company\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 QUICK REFERENCE TABLE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('┌──────────────────┬─────────────────────────┬───────────────────┐');
    console.log('│ Role             │ Email                   │ Password          │');
    console.log('├──────────────────┼─────────────────────────┼───────────────────┤');
    console.log('│ Super Admin      │ superadmin@hrms.com     │ SuperAdmin@2025   │');
    console.log('│ Company Admin    │ admin@tcs.com           │ TCSAdmin@2025     │');
    console.log('│ HR User          │ hr@tcs.com              │ TCSHR@2025        │');
    console.log('│ Manager          │ manager@tcs.com         │ TCSManager@2025   │');
    console.log('│ Employee         │ employee@tcs.com        │ TCSEmployee@2025  │');
    console.log('└──────────────────┴─────────────────────────┴───────────────────┘\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 NEXT STEPS');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('1. Start Backend Server:');
    console.log('   cd hrms-backend');
    console.log('   npm run dev\n');

    console.log('2. Start Frontend Server:');
    console.log('   cd hrms-frontend');
    console.log('   npm run dev\n');

    console.log('3. Test Super Admin Login:');
    console.log('   → Go to: http://localhost:5173/login');
    console.log('   → Click: "Super Admin Login"');
    console.log('   → Use: superadmin@hrms.com / SuperAdmin@2025\n');

    console.log('4. Test Company Login (TCS):');
    console.log('   → Go to: http://localhost:5173/login');
    console.log('   → Click: "Company Login"');
    console.log('   → Search: "TCS"');
    console.log('   → Use any of the TCS user credentials above\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  IMPORTANT NOTES');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('• Super Admin has access to ALL companies and global settings');
    console.log('• Company Admin can create HR, Managers, and Employees');
    console.log('• HR can manage employees, recruitment, and attendance');
    console.log('• Manager can manage assigned team members and approve leaves');
    console.log('• Employee can view own data, apply leaves, mark attendance');
    console.log('• All passwords are temporary - change them after first login');
    console.log('• Data is completely isolated between companies (multi-tenant)\n');

    console.log('✅ TCS System seeding completed successfully!\n');

    // Close connections
    await tenantConnection.close();
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error seeding TCS system:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedTCSSystem();
