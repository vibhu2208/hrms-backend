const mongoose = require('mongoose');

async function checkSecondTenant() {
  try {
    const tenantId = '696b515db6c9fd5fd51aed1c';
    const tenantDbName = `tenant_${tenantId}`;
    
    console.log(`🔍 Checking tenant database: ${tenantDbName}`);
    
    // First check global registry for this tenant
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_global?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to global MongoDB database');

    const companyRegistrySchema = new mongoose.Schema({}, { strict: false });
    const CompanyRegistry = mongoose.model('CompanyRegistry', companyRegistrySchema, 'companyregistries');

    const registry = await CompanyRegistry.findOne({ tenantDatabaseName: tenantDbName });
    
    if (registry) {
      console.log(`\n📋 Found company registry entry:`);
      console.log(`  Company Name: ${registry.companyName}`);
      console.log(`  Company Code: ${registry.companyCode}`);
      console.log(`  Company ID: ${registry.companyId}`);
      console.log(`  Database: ${registry.tenantDatabaseName}`);
      console.log(`  Email: ${registry.email}`);
      console.log(`  Phone: ${registry.phone}`);
      console.log(`  Status: ${registry.status}`);
      console.log(`  Database Status: ${registry.databaseStatus}`);
      console.log(`  Subscription: ${registry.subscription?.plan || 'N/A'} (${registry.subscription?.status || 'N/A'})`);
      console.log(`  Onboarded At: ${registry.onboardedAt}`);
      console.log(`  Created At: ${registry.createdAt}`);
      
      if (registry.companyAdmin) {
        console.log(`  Company Admin: ${registry.companyAdmin.email} (User ID: ${registry.companyAdmin.userId})`);
      }
      
      if (registry.enabledModules && registry.enabledModules.length > 0) {
        console.log(`  Enabled Modules: ${registry.enabledModules.join(', ')}`);
      }
    }

    await mongoose.disconnect();

    // Now connect to the tenant database to check its contents
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`\n✅ Connected to tenant database: ${tenantDbName}`);

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📁 Found ${collections.length} collections:`);
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });

    // Check users
    if (collections.find(c => c.name === 'users')) {
      const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const users = await User.find({}).select('email role firstName lastName isActive createdAt');
      
      console.log(`\n👥 Found ${users.length} users in this tenant:`);
      users.forEach(user => {
        console.log(`  📧 ${user.email} (${user.role}) - ${user.firstName} ${user.lastName} - ${user.isActive ? 'Active' : 'Inactive'} - Created: ${user.createdAt}`);
      });
    }

    // Check employees
    if (collections.find(c => c.name === 'employees')) {
      const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
      const employees = await Employee.find({}).select('firstName lastName email employeeCode isActive createdAt');
      
      console.log(`\n💼 Found ${employees.length} employees in this tenant:`);
      employees.forEach(employee => {
        console.log(`  👤 ${employee.firstName} ${employee.lastName} (${employee.email}) - ${employee.employeeCode} - ${employee.isActive ? 'Active' : 'Inactive'} - Created: ${employee.createdAt}`);
      });
    }

    // Check other important collections
    const importantCollections = ['departments', 'contracts', 'payroll', 'attendance', 'leave_requests'];
    
    for (const colName of importantCollections) {
      if (collections.find(c => c.name === colName)) {
        try {
          const Model = mongoose.model(colName.charAt(0).toUpperCase() + colName.slice(1, -1), new mongoose.Schema({}, { strict: false }), colName);
          const count = await Model.countDocuments();
          console.log(`\n📊 ${colName}: ${count} records`);
        } catch (err) {
          console.log(`\n⚠️ Could not count ${colName}: ${err.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

checkSecondTenant();
