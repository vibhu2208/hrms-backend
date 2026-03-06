const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkOnboardingDetails() {
  try {
    console.log('🔍 Checking onboarding details in tenant database...\n');

    await mongoose.connect(TENANT_URI);
    console.log('✅ Connected successfully');

    // Get completed onboardings
    const completedOnboardings = await mongoose.connection.db.collection('onboardings').find({
      status: 'completed'
    }).toArray();

    console.log(`📋 Completed onboardings: ${completedOnboardings.length}\n`);

    for (const onboarding of completedOnboardings) {
      console.log(`👤 ${onboarding.candidateName} (${onboarding.candidateEmail})`);
      console.log(`   Status: ${onboarding.status}`);
      console.log(`   Completed At: ${onboarding.completedAt || 'Not set'}`);
      console.log(`   Candidate ID: ${onboarding.candidateId || 'Not set'}`);
      console.log(`   Position: ${onboarding.position || 'Not set'}`);
      console.log(`   Department: ${onboarding.department || 'Not set'}`);

      if (onboarding.candidateId) {
        // Check if employee exists
        const employee = await mongoose.connection.db.collection('users').findOne({
          _id: new mongoose.Types.ObjectId(onboarding.candidateId)
        });
        if (employee) {
          console.log(`   ✅ Employee record found: ${employee.firstName} ${employee.lastName}`);
          console.log(`   Employee Code: ${employee.employeeCode || 'Not generated'}`);
          console.log(`   Is Active: ${employee.isActive}`);
        } else {
          console.log(`   ❌ Employee record not found for candidateId: ${onboarding.candidateId}`);
        }
      } else {
        console.log(`   ⚠️ No candidateId - employee may not have been created`);
      }

      console.log('   ---');
    }

    // Check all employees
    console.log('\n👷 All employees in tenant database:');
    const allEmployees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    allEmployees.forEach((emp, index) => {
      console.log(`   ${index + 1}. ${emp.firstName} ${emp.lastName} - Code: ${emp.employeeCode || 'none'} - Active: ${emp.isActive}`);
    });

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkOnboardingDetails();