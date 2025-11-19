/**
 * Seed One Employee for Manufacturing Co
 * Creates one employee with user account for Manufacturing Co company
 * 
 * Run: node src/scripts/seedManufacturingEmployee.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Department = require('../models/Department');
const Client = require('../models/Client');

const seedManufacturingEmployee = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Manufacturing Co client
    console.log('🔍 Looking for Manufacturing Co client...');
    const manufacturingClient = await Client.findOne({ 
      $or: [
        { clientCode: 'MFG001' },
        { companyName: /manufacturing/i }
      ]
    });

    if (!manufacturingClient) {
      console.log('❌ Manufacturing Co client not found!');
      console.log('💡 Please run the client seeder first:');
      console.log('   node src/scripts/seedClients.js');
      process.exit(1);
    }

    console.log(`✅ Found client: ${manufacturingClient.companyName} (${manufacturingClient.clientCode})\n`);

    // Employee credentials
    const email = 'john.doe@manufacturingco.com';
    const plainPassword = 'Employee@2025';

    // Check if employee already exists
    console.log('🔍 Checking if employee exists...');
    const existingEmployee = await Employee.findOne({ email });
    
    if (existingEmployee) {
      console.log(`⚠️  Employee with email ${email} already exists!`);
      console.log(`   Employee Code: ${existingEmployee.employeeCode}`);
      console.log(`   Name: ${existingEmployee.firstName} ${existingEmployee.lastName}\n`);
      
      // Check if user account exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log('ℹ️  User account already exists');
        console.log(`   Email: ${email}`);
        console.log(`   Role: ${existingUser.role}`);
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('🔐 EXISTING LOGIN CREDENTIALS:');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${plainPassword}`);
        console.log(`   Company: ${manufacturingClient.companyName}`);
        console.log('═══════════════════════════════════════════════════════\n');
      }
      
      process.exit(0);
    }

    // Get or create a department for this client
    console.log('📁 Setting up department...');
    let department = await Department.findOne({ 
      code: 'PROD'
    });
    
    if (!department) {
      console.log('📁 Creating Production department...');
      department = await Department.create({
        name: 'Production',
        code: 'PROD',
        description: 'Production and Manufacturing Department',
        head: null,
        isActive: true
      });
      console.log('✅ Department created\n');
    } else {
      console.log(`✅ Using existing department: ${department.name}\n`);
    }

    // Generate Employee Code
    const lastEmployee = await Employee.findOne().sort({ createdAt: -1 });
    let employeeCode = 'EMP00001';
    
    if (lastEmployee && lastEmployee.employeeCode) {
      const match = lastEmployee.employeeCode.match(/\d+/);
      if (match) {
        const lastNumber = parseInt(match[0]);
        const newNumber = lastNumber + 1;
        employeeCode = `EMP${String(newNumber).padStart(5, '0')}`;
      }
    }

    console.log('📝 Creating employee...');
    console.log(`   Generated Employee Code: ${employeeCode}\n`);

    // Create Employee
    const employeeData = {
      employeeCode,
      firstName: 'John',
      lastName: 'Doe',
      email: email,
      phone: '+1-555-1234',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'male',
      bloodGroup: 'O+',
      maritalStatus: 'single',
      address: {
        street: '789 Worker Lane',
        city: 'Detroit',
        state: 'Michigan',
        zipCode: '48201',
        country: 'USA'
      },
      department: department._id,
      designation: 'Production Supervisor',
      joiningDate: new Date('2024-01-15'),
      employmentType: 'full-time',
      reportingManager: null,
      salary: {
        basic: 45000,
        hra: 18000,
        allowances: 7000,
        deductions: 3000,
        total: 67000
      },
      bankDetails: {
        accountNumber: '9876543210',
        bankName: 'Chase Bank',
        ifscCode: 'CHAS0001234',
        accountHolderName: 'John Doe',
        branch: 'Detroit Main'
      },
      education: [
        {
          degree: 'Bachelor of Engineering',
          specialization: 'Mechanical Engineering',
          institution: 'University of Michigan',
          passingYear: 2012,
          percentage: 78
        }
      ],
      experience: {
        years: 12,
        months: 0
      },
      emergencyContact: {
        name: 'Jane Doe',
        relationship: 'sister',
        phone: '+1-555-5678'
      },
      status: 'active',
      isActive: true
    };

    const employee = await Employee.create(employeeData);
    console.log('✅ Employee created successfully!\n');

    // Create User Account
    console.log('👤 Creating user account...');
    
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    const userData = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      password: hashedPassword,
      role: 'employee',
      clientId: manufacturingClient._id,
      employeeId: employee._id,
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: false
    };

    const user = await User.create(userData);
    console.log('✅ User account created successfully!\n');

    // Display credentials
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 EMPLOYEE ACCOUNT CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('🏢 Company Details:');
    console.log(`   Company: ${manufacturingClient.companyName}`);
    console.log(`   Client Code: ${manufacturingClient.clientCode}`);
    console.log(`   Industry: ${manufacturingClient.industry}\n`);
    
    console.log('📊 Employee Details:');
    console.log(`   Employee Code: ${employee.employeeCode}`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Email: ${employee.email}`);
    console.log(`   Phone: ${employee.phone}`);
    console.log(`   Designation: ${employee.designation}`);
    console.log(`   Department: ${department.name}`);
    console.log(`   Joining Date: ${employee.joiningDate.toLocaleDateString()}`);
    console.log(`   Salary: $${employee.salary.total.toLocaleString()}/month\n`);

    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${plainPassword}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Company: ${manufacturingClient.companyName}`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   1. Keep these credentials secure');
    console.log('   2. Do not share the password');
    console.log('   3. This employee is assigned to Manufacturing Co\n');

    console.log('🚀 Next Steps:');
    console.log('   1. Go to: http://localhost:5173/login');
    console.log('   2. Login with the credentials above');
    console.log('   3. Start using the HRMS application!\n');

    console.log('✅ Seeding completed!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding employee:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run the script
seedManufacturingEmployee();
