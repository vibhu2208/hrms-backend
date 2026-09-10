/**
 * Seed SPC Management Company with Test Users
 * Creates SPC Management company and test users for demo purposes
 * 
 * Run: node src/scripts/seedSPCCompany.js
 */

require('dotenv').config();
require('../utils/scriptSafety').assertSafeToMutate({ requireAllowFlag: true, allowFlag: 'ALLOW_SEED', label: 'seedSPCCompany' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to SPC database
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';

// Define schemas inline for seeding
const companySchema = new mongoose.Schema({
  companyCode: String,
  companyName: String,
  email: String,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  databaseName: String,
  databaseStatus: String,
  adminUser: {
    email: String,
    userId: mongoose.Schema.Types.ObjectId,
    createdAt: Date
  },
  subscription: {
    plan: String,
    startDate: Date,
    endDate: Date,
    status: String,
    maxEmployees: Number,
    maxAdmins: Number
  },
  enabledModules: [String],
  status: String,
  isActive: Boolean
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  authProvider: { type: String, default: 'local' },
  role: String,
  clientId: mongoose.Schema.Types.ObjectId,
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  isFirstLogin: { type: Boolean, default: true },
  themePreference: { type: String, default: 'dark' }
}, { timestamps: true });

const seedSPCCompany = async () => {
  try {
    console.log('🔄 Connecting to SPC MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to SPC Database\n');

    // Get or create models
    const Company = mongoose.models.Company || mongoose.model('Company', companySchema);
    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Clear existing SPC data
    console.log('🗑️  Clearing existing SPC company and users...');
    await Company.deleteMany({ companyName: 'SPC Management' });
    await User.deleteMany({ email: { $regex: '@spc.com$' } });
    console.log('✅ Cleared existing SPC data\n');

    // Create SPC Management company
    console.log('📝 Creating SPC Management company...');
    const spcCompany = await Company.create({
      companyCode: 'SPC00001',
      companyName: 'SPC Management',
      email: 'admin@spc.com',
      phone: '+1-555-9999',
      address: {
        street: '100 SPC Plaza',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      },
      databaseName: 'hrms_spc',
      databaseStatus: 'active',
      adminUser: {
        email: 'admin@spc.com',
        createdAt: new Date()
      },
      subscription: {
        plan: 'enterprise',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'active',
        maxEmployees: 1000,
        maxAdmins: 20
      },
      enabledModules: ['hr', 'payroll', 'timesheet', 'attendance', 'recruitment', 'performance', 'assets', 'compliance'],
      status: 'active',
      isActive: true
    });
    console.log('✅ SPC Management company created\n');

    // Create test users
    console.log('📝 Creating test users...');
    
    const testUsers = [
      {
        email: 'admin@spc.com',
        password: 'admin123',
        role: 'admin',
        clientId: spcCompany._id
      },
      {
        email: 'hr@spc.com',
        password: 'hr123',
        role: 'hr',
        clientId: spcCompany._id
      },
      {
        email: 'hr.manager@spc.com',
        password: 'hrmanager123',
        role: 'hr',
        clientId: spcCompany._id
      },
      {
        email: 'recruiter@spc.com',
        password: 'recruiter123',
        role: 'hr',
        clientId: spcCompany._id
      }
    ];

    // Hash passwords and create users
    const createdUsers = [];
    for (const userData of testUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        authProvider: 'local',
        isActive: true,
        isFirstLogin: false,
        themePreference: 'dark'
      });
      
      createdUsers.push({ ...userData, userId: user._id });
    }

    console.log('✅ Test users created\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SPC MANAGEMENT SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 Company Details:');
    console.log(`   Company Name: ${spcCompany.companyName}`);
    console.log(`   Company Code: ${spcCompany.companyCode}`);
    console.log(`   Database: ${spcCompany.databaseName}`);
    console.log(`   Email: ${spcCompany.email}`);
    console.log(`   Plan: ${spcCompany.subscription.plan}`);
    console.log(`   Status: ${spcCompany.status}\n`);

    console.log('👥 Test User Credentials:');
    console.log('═══════════════════════════════════════════════════════');
    testUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.role.toUpperCase()} USER`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role: ${user.role}`);
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 Next Steps:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. Start your SPC frontend: cd hrms-spc/hrms-spc && npm run dev');
    console.log('2. Navigate to: http://localhost:5173');
    console.log('3. Click "Access SPC Portal"');
    console.log('4. Login with any of the credentials above\n');

    console.log('💡 Recommended: Use admin@spc.com / admin123 for full access\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding SPC company:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedSPCCompany();
