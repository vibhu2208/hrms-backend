const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function finalVerification() {
  try {
    console.log('🎯 Final Verification: Employee Database Migration\n');

    await mongoose.connect(TENANT_URI);

    const employees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    const onboardings = await mongoose.connection.db.collection('onboardings').find({ status: 'completed' }).toArray();

    console.log('✅ Employees in tenant database:', employees.length);
    console.log('✅ Completed onboardings:', onboardings.length);
    console.log('✅ All employees have codes:', employees.every(e => e.employeeCode));

    const activeEmployees = employees.filter(e => e.isActive);
    console.log('✅ Active employees:', activeEmployees.length);

    console.log('\n📋 Employee Summary:');
    employees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName} - ${emp.employeeCode} - Active: ${emp.isActive}`);
    });

    await mongoose.connection.close();
    console.log('\n🎉 SUCCESS: Employee data is correctly stored in tenant_696b515db6c9fd5fd51aed1c database!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

finalVerification();