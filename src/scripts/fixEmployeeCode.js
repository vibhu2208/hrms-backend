/**
 * Fix Employee Code for Manufacturing Co Employee
 * Updates the employee code to a proper format
 * 
 * Run: node src/scripts/fixEmployeeCode.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const fixEmployeeCode = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'john.doe@manufacturingco.com';

    // Find employee
    const employee = await Employee.findOne({ email });
    
    if (!employee) {
      console.log('❌ Employee not found!');
      process.exit(1);
    }

    console.log(`Current Employee Code: ${employee.employeeCode}`);

    // Count all employees to generate proper code
    const employeeCount = await Employee.countDocuments();
    const newEmployeeCode = `EMP${String(employeeCount).padStart(5, '0')}`;

    // Update employee code
    employee.employeeCode = newEmployeeCode;
    await employee.save();

    console.log(`✅ Updated Employee Code: ${newEmployeeCode}\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ EMPLOYEE CODE FIXED');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📊 Employee Details:');
    console.log(`   Employee Code: ${employee.employeeCode}`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Email: ${employee.email}\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixEmployeeCode();
