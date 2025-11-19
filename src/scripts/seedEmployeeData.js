const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');

/**
 * Seed script to populate database with sample employee data
 * Run this script to create sample data for the modern HRMS dashboard
 */

const seedData = async () => {
  try {
    console.log('🌱 Starting database seed...');

    // Create departments
    const departments = await Department.insertMany([
      { name: 'Technology', description: 'Software Development Team' },
      { name: 'Human Resources', description: 'HR Team' },
      { name: 'Finance', description: 'Finance Team' },
      { name: 'Marketing', description: 'Marketing Team' },
      { name: 'Sales', description: 'Sales Team' }
    ]);
    console.log('✅ Departments created');

    // Create employees
    const employees = [];
    const firstNames = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Amanda', 'James', 'Lisa', 'William', 'Jennifer', 'Richard', 'Michelle', 'Thomas'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
    const designations = ['Software Engineer', 'Senior Software Engineer', 'Team Lead', 'Project Manager', 'HR Manager', 'Finance Manager', 'Marketing Manager', 'Sales Manager'];

    for (let i = 0; i < 25; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      const designation = designations[Math.floor(Math.random() * designations.length)];
      
      // Random date of birth (25-45 years old)
      const age = 25 + Math.floor(Math.random() * 20);
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - age);
      dateOfBirth.setMonth(Math.floor(Math.random() * 12));
      dateOfBirth.setDate(Math.floor(Math.random() * 28) + 1);

      // Random joining date (within last 5 years)
      const joiningDate = new Date();
      joiningDate.setFullYear(joiningDate.getFullYear() - Math.floor(Math.random() * 5));
      joiningDate.setMonth(Math.floor(Math.random() * 12));
      joiningDate.setDate(Math.floor(Math.random() * 28) + 1);

      employees.push({
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
        phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        dateOfBirth,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        department: department._id,
        designation,
        joiningDate,
        employmentType: 'full-time',
        status: 'active',
        salary: {
          basic: 50000 + Math.floor(Math.random() * 50000),
          hra: 10000,
          allowances: 5000,
          total: 65000 + Math.floor(Math.random() * 50000)
        }
      });
    }

    const createdEmployees = await Employee.insertMany(employees);
    console.log('✅ Employees created');

    // Assign reporting managers
    for (let i = 0; i < createdEmployees.length; i++) {
      if (i > 0 && Math.random() > 0.3) {
        const managerIndex = Math.floor(Math.random() * Math.min(i, 5));
        createdEmployees[i].reportingManager = createdEmployees[managerIndex]._id;
        await createdEmployees[i].save();
      }
    }
    console.log('✅ Reporting managers assigned');

    // Create holidays
    const currentYear = new Date().getFullYear();
    const holidays = [
      { name: 'New Year', date: new Date(currentYear, 0, 1), type: 'public', isActive: true },
      { name: 'Republic Day', date: new Date(currentYear, 0, 26), type: 'public', isActive: true },
      { name: 'Holi', date: new Date(currentYear, 2, 25), type: 'public', isActive: true },
      { name: 'Good Friday', date: new Date(currentYear, 3, 7), type: 'public', isActive: true },
      { name: 'Independence Day', date: new Date(currentYear, 7, 15), type: 'public', isActive: true },
      { name: 'Gandhi Jayanti', date: new Date(currentYear, 9, 2), type: 'public', isActive: true },
      { name: 'Diwali', date: new Date(currentYear, 10, 12), type: 'public', isActive: true },
      { name: 'Christmas', date: new Date(currentYear, 11, 25), type: 'public', isActive: true },
      { name: 'Company Foundation Day', date: new Date(currentYear, 5, 15), type: 'optional', isActive: true }
    ];

    await Holiday.insertMany(holidays);
    console.log('✅ Holidays created');

    // Create leave balances for each employee
    const leaveTypes = [
      { type: 'Personal Leave', total: 12 },
      { type: 'Sick Leave', total: 7 },
      { type: 'Comp Offs', total: 5 },
      { type: 'Floater Leave', total: 2 },
      { type: 'Marriage Leave', total: 3 },
      { type: 'Maternity Leave', total: 90 },
      { type: 'Unpaid Leave', total: 0 }
    ];

    for (const employee of createdEmployees) {
      for (const leaveType of leaveTypes) {
        const consumed = Math.floor(Math.random() * Math.min(3, leaveType.total));
        await LeaveBalance.create({
          employee: employee._id,
          leaveType: leaveType.type,
          year: currentYear,
          total: leaveType.total,
          consumed: consumed,
          available: leaveType.total - consumed
        });
      }
    }
    console.log('✅ Leave balances created');

    // Create some leave applications
    const leaveStatuses = ['approved', 'pending', 'rejected'];
    for (let i = 0; i < 20; i++) {
      const employee = createdEmployees[Math.floor(Math.random() * createdEmployees.length)];
      const leaveType = leaveTypes[Math.floor(Math.random() * (leaveTypes.length - 1))]; // Exclude unpaid leave
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60) - 30); // Random date within ±30 days
      
      const numberOfDays = Math.floor(Math.random() * 3) + 1;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + numberOfDays - 1);

      const status = leaveStatuses[Math.floor(Math.random() * leaveStatuses.length)];
      const approver = createdEmployees[Math.floor(Math.random() * 5)]; // Random approver from first 5 employees

      await Leave.create({
        employee: employee._id,
        leaveType: leaveType.type,
        startDate,
        endDate,
        numberOfDays,
        reason: 'Personal work',
        status,
        approvedBy: status === 'approved' ? approver._id : null,
        approvedOn: status === 'approved' ? new Date() : null
      });
    }
    console.log('✅ Leave applications created');

    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${departments.length} departments`);
    console.log(`   - ${createdEmployees.length} employees`);
    console.log(`   - ${holidays.length} holidays`);
    console.log(`   - ${createdEmployees.length * leaveTypes.length} leave balances`);
    console.log(`   - 20 leave applications`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

// Run seed if this file is executed directly
if (require.main === module) {
  const dbConfig = require('../config/database.config');
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('📦 Connected to MongoDB');
    return seedData();
  })
  .then(() => {
    console.log('✨ Seed completed, closing connection...');
    return mongoose.connection.close();
  })
  .then(() => {
    console.log('👋 Connection closed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });
}

module.exports = seedData;
