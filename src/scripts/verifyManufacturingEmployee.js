/**
 * Verify Manufacturing Co Employee
 * Displays the employee and user credentials
 * 
 * Run: node src/scripts/verifyManufacturingEmployee.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Client = require('../models/Client');
const Department = require('../models/Department');

const verifyEmployee = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'john.doe@manufacturingco.com';

    // Find employee
    const employee = await Employee.findOne({ email }).populate('department');
    
    if (!employee) {
      console.log('❌ Employee not found!');
      process.exit(1);
    }

    // Find user
    const user = await User.findOne({ email }).populate('clientId');
    
    if (!user) {
      console.log('❌ User account not found!');
      process.exit(1);
    }

    // Display information
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ EMPLOYEE FOUND - LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('🏢 Company Details:');
    console.log(`   Company: ${user.clientId.companyName}`);
    console.log(`   Client Code: ${user.clientId.clientCode}`);
    console.log(`   Industry: ${user.clientId.industry}\n`);
    
    console.log('📊 Employee Details:');
    console.log(`   Employee Code: ${employee.employeeCode}`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Email: ${employee.email}`);
    console.log(`   Phone: ${employee.phone}`);
    console.log(`   Designation: ${employee.designation}`);
    console.log(`   Department: ${employee.department.name}`);
    console.log(`   Status: ${employee.status}\n`);

    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Email: ${email}`);
    console.log(`   Password: Employee@2025`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Company: ${user.clientId.companyName}`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🚀 Login URL: http://localhost:5173/login\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

verifyEmployee();
