const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkFinalState() {
  try {
    console.log('🔍 Checking final data state after cleanup...\n');

    await mongoose.connect(TENANT_URI);

    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
    const users = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    const offboardings = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();

    console.log(`👥 Employees: ${employees.length}`);
    console.log(`👤 Employee users: ${users.length}`);
    console.log(`📋 Offboarding records: ${offboardings.length}`);

    if (employees.length > 0) {
      console.log('\n--- Remaining Employees ---');
      employees.forEach((emp, index) => {
        console.log(`${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.email}) - Active: ${emp.isActive}, Status: ${emp.status}`);
      });
    }

    if (offboardings.length > 0) {
      console.log('\n--- Offboarding Records ---');
      offboardings.forEach((off, index) => {
        console.log(`${index + 1}. Employee ID: ${off.employeeId} - Status: ${off.status}`);
      });
    }

    console.log('\n✅ Data cleanup completed successfully!');
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFinalState();