const mongoose = require('mongoose');

async function checkSpecificTenant() {
  try {
    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to main MongoDB database');

    // Check if this specific tenant exists by directly connecting to it
    const tenantId = '697127c3db7be8a51c1e6b7f';
    const tenantDbName = `tenant_${tenantId}`;
    
    console.log(`🔍 Checking tenant database: ${tenantDbName}`);
    
    // Try to connect to the specific tenant database
    await mongoose.disconnect();
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Successfully connected to tenant database: ${tenantDbName}`);

    // Get all collections in this tenant database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📁 Found ${collections.length} collections:`);
    
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });

    // Check for users in this tenant
    if (collections.find(c => c.name === 'users')) {
      const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const users = await User.find({}).select('email role firstName lastName isActive createdAt');
      
      console.log(`\n👥 Found ${users.length} users in this tenant:`);
      users.forEach(user => {
        console.log(`  📧 ${user.email} (${user.role}) - ${user.firstName} ${user.lastName} - ${user.isActive ? 'Active' : 'Inactive'} - Created: ${user.createdAt}`);
      });
    }

    // Check for employees in this tenant
    if (collections.find(c => c.name === 'employees')) {
      const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
      const employees = await Employee.find({}).select('firstName lastName email employeeCode isActive createdAt');
      
      console.log(`\n💼 Found ${employees.length} employees in this tenant:`);
      employees.forEach(employee => {
        console.log(`  👤 ${employee.firstName} ${employee.lastName} (${employee.email}) - ${employee.employeeCode} - ${employee.isActive ? 'Active' : 'Inactive'} - Created: ${employee.createdAt}`);
      });
    }

    // Check if this tenant is referenced in the main database
    await mongoose.disconnect();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Check in Company collection
    try {
      const Company = require('./src/models/Company');
      const company = await Company.findOne({ databaseName: tenantDbName });
      
      if (company) {
        console.log(`\n🏢 Found company reference in main database:`);
        console.log(`  Name: ${company.companyName}`);
        console.log(`  Email: ${company.email}`);
        console.log(`  Database: ${company.databaseName}`);
        console.log(`  Status: ${company.status}`);
        console.log(`  Created: ${company.createdAt}`);
      } else {
        console.log(`\n❌ No company reference found for this tenant in main database`);
      }
    } catch (err) {
      console.log(`\n⚠️ Could not check Company collection: ${err.message}`);
    }

    // Check in CompanyRegistry collection (global database)
    try {
      await mongoose.disconnect();
      await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_global?retryWrites=true&w=majority`, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      const CompanyRegistry = require('./src/models/global/CompanyRegistry');
      const registry = await CompanyRegistry.findOne({ tenantDatabaseName: tenantDbName });
      
      if (registry) {
        console.log(`\n📋 Found company registry entry in global database:`);
        console.log(`  Company Name: ${registry.companyName}`);
        console.log(`  Company ID: ${registry.companyId}`);
        console.log(`  Database: ${registry.tenantDatabaseName}`);
        console.log(`  Status: ${registry.status}`);
        console.log(`  Subscription: ${registry.subscription.status}`);
        console.log(`  Created: ${registry.onboardedAt}`);
      } else {
        console.log(`\n❌ No registry entry found for this tenant in global database`);
      }
    } catch (err) {
      console.log(`\n⚠️ Could not check CompanyRegistry collection: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

checkSpecificTenant();
