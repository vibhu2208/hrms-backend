const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkOnboardingToEmployeeFlow() {
  try {
    console.log('🔍 Checking Onboarding to Employee Flow...\n');

    await mongoose.connect(TENANT_URI);

    // Check onboarding records
    const onboardings = await mongoose.connection.db.collection('onboardings').find({}).toArray();
    console.log('📋 Total onboardings:', onboardings.length);

    const completedOnboardings = onboardings.filter(o => o.status === 'completed');
    console.log('✅ Completed onboardings:', completedOnboardings.length);

    const inProgressOnboardings = onboardings.filter(o => o.status === 'in-progress');
    console.log('🔄 In-progress onboardings:', inProgressOnboardings.length);

    // Check employees
    const employees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log('👷 Total employees:', employees.length);

    console.log('\n📊 Onboarding Status Summary:');
    onboardings.forEach((onboarding, i) => {
      console.log(`   ${i + 1}. ${onboarding.candidateName} - Status: ${onboarding.status} - Has Employee ID: ${!!onboarding.candidateId}`);
    });

    console.log('\n👥 Employee List:');
    employees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName} - Code: ${emp.employeeCode} - Active: ${emp.isActive}`);
    });

    // Check for any onboarding without corresponding employee
    const orphanedOnboardings = completedOnboardings.filter(onboarding => !onboarding.candidateId);
    if (orphanedOnboardings.length > 0) {
      console.log('\n⚠️  Completed onboardings without employee records:');
      orphanedOnboardings.forEach(onboarding => {
        console.log(`   - ${onboarding.candidateName} (${onboarding.candidateEmail})`);
      });
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOnboardingToEmployeeFlow();