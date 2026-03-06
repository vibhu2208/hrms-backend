const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to main database first
async function createSPCManager() {
  try {
    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms-spc', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to main MongoDB database');

    // Get the SPC company/tenant info
    const Company = require('../src/models/Company');
    const spcCompany = await Company.findOne({ name: 'SPC Management' });
    
    if (!spcCompany) {
      console.log('❌ SPC Management company not found');
      console.log('Available companies:');
      const companies = await Company.find({});
      companies.forEach(company => {
        console.log(`- ${company.name} (${company._id})`);
      });
      return;
    }

    console.log(`✅ Found SPC company: ${spcCompany.name} (${spcCompany._id})`);
    console.log(`🏢 Tenant DB: tenant_${spcCompany._id}`);

    // Connect to tenant database
    const tenantDbName = `tenant_${spcCompany._id}`;
    await mongoose.disconnect();
    await mongoose.connect(`mongodb://localhost:27017/${tenantDbName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🔗 Connected to tenant database: ${tenantDbName}`);

    // Import models for tenant database
    const User = require('../src/models/User');
    const Employee = require('../src/models/Employee');

    // Check if manager already exists
    const existingManager = await User.findOne({ email: 'manager@spchrms.com' });
    if (existingManager) {
      console.log('✅ Manager user already exists in SPC tenant!');
      console.log('📧 Email: manager@spchrms.com');
      console.log('🔑 Password: manager123');
      console.log('👤 Role: manager');
      console.log('🌐 Login at: http://localhost:3000/login');
      console.log('🎯 After login, you will be redirected to: /manager/dashboard');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('manager123', salt);

    // Create manager user
    const manager = new User({
      email: 'manager@spchrms.com',
      password: hashedPassword,
      role: 'manager',
      firstName: 'John',
      lastName: 'Manager',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false
    });

    await manager.save();

    // Create corresponding employee record
    const employee = new Employee({
      firstName: 'John',
      lastName: 'Manager',
      email: 'manager@spchrms.com',
      employeeCode: 'MGR001',
      designation: 'Manager',
      department: null, // Will be set when departments are created
      isActive: true,
      reportingManager: null, // Manager doesn't report to anyone
      salary: {
        basic: 80000,
        encrypted: false
      }
    });

    await employee.save();

    // Link employee to user
    manager.employeeId = employee._id;
    await manager.save();

    console.log('✅ Manager user created successfully in SPC tenant!');
    console.log('📧 Email: manager@spchrms.com');
    console.log('🔑 Password: manager123');
    console.log('👤 Role: manager');
    console.log('🆔 Employee ID:', employee._id);
    console.log('🆔 User ID:', manager._id);
    console.log('🌐 Login at: http://localhost:3000/login');
    console.log('🎯 After login, you will be redirected to: /manager/dashboard');

  } catch (error) {
    console.error('❌ Error creating SPC manager:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

createSPCManager();
