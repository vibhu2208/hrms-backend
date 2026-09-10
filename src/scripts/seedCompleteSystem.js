/**
 * Complete System Seeder
 * Seeds: 1 Super Admin, 1 Company, 1 Company Admin, 1 HR, 1 Manager
 * 
 * Run: node src/scripts/seedCompleteSystem.js
 */

require('dotenv').config();
require('../utils/scriptSafety').assertSafeToMutate({ requireAllowFlag: true, allowFlag: 'ALLOW_SEED', label: 'seedCompleteSystem' });
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
    email: 'admin@100acress.com',
    password: 'Admin@2025',
    role: 'Company Admin'
  },
  hr: {
    email: 'hr@100acress.com',
    password: 'HR@2025',
    role: 'HR User'
  },
  manager: {
    email: 'manager@100acress.com',
    password: 'Manager@2025',
    role: 'Manager'
  }
};

const seedCompleteSystem = async () => {
  try {
    console.log('\n🚀 Starting Complete System Seeding...\n');
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
    console.log('🏢 STEP 3: Creating Company (100acress)...');
    
    // Clear existing companies
    await CompanyRegistry.deleteMany({});
    
    // Generate company ID
    const companyId = new mongoose.Types.ObjectId().toString();
    
    const company = new CompanyRegistry({
      companyCode: 'COMP00001',
      companyId: companyId,
      companyName: '100acress',
      email: 'contact@100acress.com',
      phone: '+91-9876543210',
      website: 'https://100acress.com',
      tenantDatabaseName: `tenant_${companyId}`,
      companyAdmin: {
        email: credentials.companyAdmin.email
      },
      address: {
        street: '123 Business Park',
        city: 'Noida',
        state: 'Uttar Pradesh',
        zipCode: '201301',
        country: 'India'
      },
      subscription: {
        plan: 'professional',
        status: 'active',
        maxEmployees: 500,
        maxAdmins: 5,
        billingCycle: 'yearly'
      },
      enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance', 'assets'],
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
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        accent: '#10b981',
        background: '#0f172a',
        text: '#f1f5f9',
        cardBackground: '#1e293b'
      },
      loginPage: {
        welcomeMessage: 'Welcome to 100acress',
        subtitle: 'Sign in to your account',
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
      firstName: 'Company',
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
    // DISPLAY ALL CREDENTIALS
    // ============================================
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎉 COMPLETE SYSTEM SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 SYSTEM OVERVIEW:');
    console.log('───────────────────────────────────────────────────────');
    console.log(`✓ Super Admin: 1`);
    console.log(`✓ Companies: 1`);
    console.log(`✓ Company Admins: 1`);
    console.log(`✓ HR Users: 1`);
    console.log(`✓ Managers: 1`);
    console.log(`✓ Total Users: 5\n`);

    console.log('🏢 COMPANY DETAILS:');
    console.log('───────────────────────────────────────────────────────');
    console.log(`Company Name: ${company.companyName}`);
    console.log(`Company Code: ${company.companyCode}`);
    console.log(`Company ID: ${company.companyId}`);
    console.log(`Database: ${company.tenantDatabaseName}`);
    console.log(`Status: ${company.status}`);
    console.log(`Subscription: ${company.subscription.plan} (${company.subscription.status})`);
    console.log(`Enabled Modules: ${company.enabledModules.join(', ')}\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('1️⃣  SUPER ADMIN (Global System Access)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.superAdmin.email}`);
    console.log(`   Password: ${credentials.superAdmin.password}`);
    console.log(`   Role:     ${credentials.superAdmin.role}`);
    console.log(`   Access:   Super Admin Dashboard`);
    console.log(`   Login:    http://localhost:5173/login/super-admin\n`);

    console.log('2️⃣  COMPANY ADMIN (100acress - Full Company Access)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.companyAdmin.email}`);
    console.log(`   Password: ${credentials.companyAdmin.password}`);
    console.log(`   Role:     ${credentials.companyAdmin.role}`);
    console.log(`   Company:  ${company.companyName}`);
    console.log(`   Access:   Full company management`);
    console.log(`   Login:    http://localhost:5173/login/company\n`);

    console.log('3️⃣  HR USER (100acress - HR Management)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.hr.email}`);
    console.log(`   Password: ${credentials.hr.password}`);
    console.log(`   Role:     ${credentials.hr.role}`);
    console.log(`   Company:  ${company.companyName}`);
    console.log(`   Access:   Employee, Recruitment, Attendance, Leaves`);
    console.log(`   Login:    http://localhost:5173/login/company\n`);

    console.log('4️⃣  MANAGER (100acress - Team Management)');
    console.log('───────────────────────────────────────────────────────');
    console.log(`   Email:    ${credentials.manager.email}`);
    console.log(`   Password: ${credentials.manager.password}`);
    console.log(`   Role:     ${credentials.manager.role}`);
    console.log(`   Company:  ${company.companyName}`);
    console.log(`   Access:   Team reports, Leave approvals, Attendance`);
    console.log(`   Login:    http://localhost:5173/login/company\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 QUICK REFERENCE TABLE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('┌─────────────────┬──────────────────────────┬──────────────────┬────────────────┐');
    console.log('│ Role            │ Email                    │ Password         │ Database       │');
    console.log('├─────────────────┼──────────────────────────┼──────────────────┼────────────────┤');
    console.log('│ Super Admin     │ superadmin@hrms.com      │ SuperAdmin@2025  │ hrms_global    │');
    console.log('│ Company Admin   │ admin@100acress.com      │ Admin@2025       │ tenant_...     │');
    console.log('│ HR User         │ hr@100acress.com         │ HR@2025          │ tenant_...     │');
    console.log('│ Manager         │ manager@100acress.com    │ Manager@2025     │ tenant_...     │');
    console.log('└─────────────────┴──────────────────────────┴──────────────────┴────────────────┘\n');

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

    console.log('4. Test Company Login:');
    console.log('   → Go to: http://localhost:5173/login');
    console.log('   → Click: "Company Login"');
    console.log('   → Search: "100acress"');
    console.log('   → Use any of the company user credentials above\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  IMPORTANT NOTES');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('• Super Admin has access to ALL companies and global settings');
    console.log('• Company Admin can create HR, Managers, and Employees');
    console.log('• HR can manage employees and recruitment');
    console.log('• Manager can only manage assigned team members');
    console.log('• All passwords are temporary - change them after first login');
    console.log('• Data is completely isolated between companies\n');

    console.log('✅ Seeding completed successfully!\n');

    // Close connections
    await tenantConnection.close();
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error seeding system:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedCompleteSystem();
