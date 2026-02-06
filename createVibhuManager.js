const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createVibhuManager() {
  try {
    // Connect to main database first to get SPC company
    await mongoose.connect('mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to main MongoDB database');

    // Get the SPC company info
    const Company = require('./src/models/Company');
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
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🔗 Connected to tenant database: ${tenantDbName}`);

    // Import models for tenant database
    const TenantUserSchema = require('./src/models/tenant/TenantUser');
    const TenantUser = mongoose.model('User', TenantUserSchema);

    // Check if manager already exists
    const existingManager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' });
    if (existingManager) {
      console.log('✅ Manager user already exists in SPC tenant!');
      console.log('📧 Email: vibhu2208@gmail.com');
      console.log('🆔 User ID:', existingManager._id);
      console.log('👤 Name:', existingManager.firstName + ' ' + existingManager.lastName);
      console.log('🔑 Role:', existingManager.role);
      console.log('✅ Status:', existingManager.isActive ? 'Active' : 'Inactive');
      console.log('🌐 Login at: http://localhost:5173/login');
      console.log('🎯 After login, you will be redirected to: /manager/dashboard');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('manager123', salt);

    // Create manager user
    const manager = new TenantUser({
      email: 'vibhu2208@gmail.com',
      password: hashedPassword,
      role: 'manager',
      firstName: 'Vibhu',
      lastName: 'Manager',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false,
      companyId: spcCompany._id
    });

    await manager.save();

    console.log('✅ Manager user created successfully in SPC tenant!');
    console.log('📧 Email: vibhu2208@gmail.com');
    console.log('🔑 Password: manager123');
    console.log('👤 Role: manager');
    console.log('🆔 User ID:', manager._id);
    console.log('🌐 Login at: http://localhost:5173/login');
    console.log('🎯 After login, you will be redirected to: /manager/dashboard');

  } catch (error) {
    console.error('❌ Error creating Vibhu manager:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

createVibhuManager();
