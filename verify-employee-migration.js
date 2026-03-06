const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function verifyEmployeeMigration() {
  try {
    console.log('🎯 Final Verification: Employee Migration to Tenant Database\n');

    await mongoose.connect(TENANT_URI);

    // Check all employees in tenant database
    const employees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`✅ Total employees in tenant database: ${employees.length}`);

    // Verify employee structure
    console.log('\n📋 Employee Details:');
    employees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName}`);
      console.log(`      - Employee Code: ${emp.employeeCode}`);
      console.log(`      - Email: ${emp.email}`);
      console.log(`      - Active: ${emp.isActive}`);
      console.log(`      - Database: tenant_696b515db6c9fd5fd51aed1c`);
    });

    // Check completed onboardings
    const completedOnboardings = await mongoose.connection.db.collection('onboardings').find({ status: 'completed' }).toArray();
    console.log(`\n📊 Completed onboardings: ${completedOnboardings.length}`);

    // Verify onboarding to employee mapping
    let successfulConversions = 0;
    let failedConversions = 0;

    for (const onboarding of completedOnboardings) {
      if (onboarding.candidateId) {
        const employee = employees.find(e => e._id.toString() === onboarding.candidateId.toString());
        if (employee) {
          successfulConversions++;
          console.log(`✅ ${onboarding.candidateName} → Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
        } else {
          failedConversions++;
          console.log(`❌ ${onboarding.candidateName} - Employee ID exists but employee not found`);
        }
      } else {
        failedConversions++;
        console.log(`❌ ${onboarding.candidateName} - No employee record created`);
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   ✅ Successful conversions: ${successfulConversions}`);
    console.log(`   ❌ Failed conversions: ${failedConversions}`);
    console.log(`   📍 Target database: tenant_696b515db6c9fd5fd51aed1c`);

    if (failedConversions === 0) {
      console.log('\n🎉 SUCCESS: All completed onboardings have been successfully converted to employees!');
    } else {
      console.log(`\n⚠️  WARNING: ${failedConversions} onboardings still need employee creation.`);
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyEmployeeMigration();