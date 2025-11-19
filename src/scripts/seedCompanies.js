/**
 * Seed Companies for Multi-Tenant Login
 * Creates sample companies in the Company collection
 * 
 * Run: node src/scripts/seedCompanies.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');

const companies = [
  {
    companyCode: 'COMP00001',
    companyName: 'Manufacturing Co',
    email: 'admin@manufacturingco.com',
    phone: '+1-555-0401',
    address: {
      street: '321 Industrial Way',
      city: 'Detroit',
      state: 'MI',
      zipCode: '48201',
      country: 'USA'
    },
    databaseName: 'hrms_manufacturing_co',
    databaseStatus: 'active',
    adminUser: {
      email: 'admin@manufacturingco.com',
      createdAt: new Date()
    },
    subscription: {
      plan: 'professional',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
      status: 'active',
      maxEmployees: 500,
      maxAdmins: 5
    },
    enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance'],
    status: 'active',
    isActive: true
  },
  {
    companyCode: 'COMP00002',
    companyName: 'TechCorp Solutions',
    email: 'admin@techcorp.com',
    phone: '+1-555-0101',
    address: {
      street: '123 Tech Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA'
    },
    databaseName: 'hrms_techcorp_solutions',
    databaseStatus: 'active',
    adminUser: {
      email: 'admin@techcorp.com',
      createdAt: new Date()
    },
    subscription: {
      plan: 'enterprise',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
      status: 'active',
      maxEmployees: 1000,
      maxAdmins: 10
    },
    enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance', 'assets', 'compliance'],
    status: 'active',
    isActive: true
  },
  {
    companyCode: 'COMP00003',
    companyName: 'Green Energy Ltd',
    email: 'contact@greenenergy.com',
    phone: '+1-555-0201',
    address: {
      street: '456 Renewable Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '73301',
      country: 'USA'
    },
    databaseName: 'hrms_green_energy_ltd',
    databaseStatus: 'active',
    adminUser: {
      email: 'admin@greenenergy.com',
      createdAt: new Date()
    },
    subscription: {
      plan: 'professional',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
      status: 'active',
      maxEmployees: 200,
      maxAdmins: 3
    },
    enabledModules: ['hr', 'payroll', 'attendance', 'timesheet'],
    status: 'active',
    isActive: true
  },
  {
    companyCode: 'COMP00004',
    companyName: 'Healthcare Plus',
    email: 'info@healthcareplus.com',
    phone: '+1-555-0301',
    address: {
      street: '789 Medical Center Blvd',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA'
    },
    databaseName: 'hrms_healthcare_plus',
    databaseStatus: 'active',
    adminUser: {
      email: 'admin@healthcareplus.com',
      createdAt: new Date()
    },
    subscription: {
      plan: 'enterprise',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
      status: 'active',
      maxEmployees: 800,
      maxAdmins: 8
    },
    enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance', 'compliance'],
    status: 'active',
    isActive: true
  },
  {
    companyCode: 'COMP00005',
    companyName: 'StartupHub Inc',
    email: 'team@startuphub.com',
    phone: '+1-555-0501',
    address: {
      street: '555 Innovation Drive',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA'
    },
    databaseName: 'hrms_startuphub_inc',
    databaseStatus: 'active',
    adminUser: {
      email: 'admin@startuphub.com',
      createdAt: new Date()
    },
    subscription: {
      plan: 'basic',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
      status: 'active',
      maxEmployees: 50,
      maxAdmins: 2
    },
    enabledModules: ['hr', 'attendance'],
    status: 'active',
    isActive: true
  }
];

const seedCompanies = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing companies
    console.log('🗑️  Clearing existing companies...');
    await Company.deleteMany({});
    console.log('✅ Cleared existing companies\n');

    // Insert new companies
    console.log('📝 Creating companies...');
    const insertedCompanies = await Company.insertMany(companies);
    console.log(`✅ Successfully seeded ${insertedCompanies.length} companies\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 COMPANIES SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 Company List:');
    insertedCompanies.forEach((company, index) => {
      console.log(`\n${index + 1}. ${company.companyName}`);
      console.log(`   Company Code: ${company.companyCode}`);
      console.log(`   Database: ${company.databaseName}`);
      console.log(`   Email: ${company.email}`);
      console.log(`   Plan: ${company.subscription.plan}`);
      console.log(`   Status: ${company.status}`);
      console.log(`   Modules: ${company.enabledModules.join(', ')}`);
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 Next Steps:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. Start your frontend: npm run dev');
    console.log('2. Navigate to: http://localhost:5173/login');
    console.log('3. Select "Company Login"');
    console.log('4. Choose a company from the list');
    console.log('5. Login with company credentials\n');

    console.log('💡 Note: You need to create users for each company separately');
    console.log('   Use the employee seeding scripts for each company\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding companies:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedCompanies();
