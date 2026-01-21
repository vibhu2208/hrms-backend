const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test/inaccurate employee data...\n');

    await mongoose.connect(TENANT_URI);

    // Check if any offboarding records reference these employees
    const offboardings = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();
    console.log(`📋 Found ${offboardings.length} offboarding records`);

    // Get employee IDs that are referenced in offboardings
    const referencedEmployeeIds = new Set(offboardings.map(o => o.employeeId.toString()));

    // Get all employees
    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log(`👥 Found ${employees.length} employees`);

    let removedCount = 0;
    let keptCount = 0;

    for (const employee of employees) {
      const isReferenced = referencedEmployeeIds.has(employee._id.toString());
      const hasExampleEmail = employee.email && employee.email.includes('example.com');

      if (hasExampleEmail && !isReferenced) {
        // Remove test data that's not referenced
        await mongoose.connection.db.collection('employees').deleteOne({ _id: employee._id });
        console.log(`🗑️  Removed test employee: ${employee.firstName} ${employee.lastName} (${employee.email})`);
        removedCount++;
      } else if (isReferenced) {
        console.log(`⚠️  Kept employee (referenced in offboarding): ${employee.firstName} ${employee.lastName}`);
        keptCount++;
      } else {
        console.log(`✅ Kept employee (valid data): ${employee.firstName} ${employee.lastName}`);
        keptCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Removed: ${removedCount} test employees`);
    console.log(`   Kept: ${keptCount} employees`);

    // Check final employee count
    const finalEmployees = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log(`   Final employee count: ${finalEmployees.length}`);

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupTestData();