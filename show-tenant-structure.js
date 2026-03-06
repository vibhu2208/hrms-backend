const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function showTenantDatabaseStructure() {
  try {
    console.log('🔍 Database Structure: tenant_696b515db6c9fd5fd51aed1c\n');

    await mongoose.connect(TENANT_URI);

    // Get all collections in the tenant database
    const collections = await mongoose.connection.db.listCollections().toArray();

    console.log('📊 Collections in tenant_696b515db6c9fd5fd51aed1c:');
    console.log('='.repeat(50));

    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`📁 ${collection.name}: ${count} documents`);
    }

    console.log('\n👥 Employee Storage Details:');
    console.log('='.repeat(30));

    // Show employee details
    const employees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`📍 Collection: users (with role: 'employee')`);
    console.log(`👷 Total Employees: ${employees.length}`);

    if (employees.length > 0) {
      console.log('\n📋 Employee Records:');
      employees.forEach((emp, i) => {
        console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode})`);
        console.log(`      ID: ${emp._id}`);
        console.log(`      Email: ${emp.email}`);
        console.log(`      Active: ${emp.isActive}`);
      });
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

showTenantDatabaseStructure();