const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function migrateEmployeesToCollection() {
  try {
    console.log('🔄 Migrating employees from users collection to employees collection...\n');

    await mongoose.connect(TENANT_URI);
    console.log('✅ Connected to tenant database');

    // Get all employees from users collection
    const employees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`📊 Found ${employees.length} employees in users collection`);

    if (employees.length === 0) {
      console.log('⚠️  No employees found to migrate');
      await mongoose.connection.close();
      return;
    }

    // Check if employees collection already has data
    const existingEmployees = await mongoose.connection.db.collection('employees').countDocuments();
    if (existingEmployees > 0) {
      console.log(`⚠️  Employees collection already has ${existingEmployees} documents. Skipping migration.`);
      await mongoose.connection.close();
      return;
    }

    // Insert employees into employees collection
    console.log('📝 Moving employees to employees collection...');
    const result = await mongoose.connection.db.collection('employees').insertMany(employees);

    console.log(`✅ Successfully inserted ${result.insertedCount} employees into employees collection`);

    // Verify the migration
    const migratedEmployees = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log(`\n🔍 Verification:`);
    console.log(`   Users collection (employees): ${await mongoose.connection.db.collection('users').countDocuments({ role: 'employee' })}`);
    console.log(`   Employees collection: ${migratedEmployees.length}`);

    console.log('\n📋 Migrated Employees:');
    migratedEmployees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ID: ${emp._id}`);
    });

    await mongoose.connection.close();
    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

migrateEmployeesToCollection();