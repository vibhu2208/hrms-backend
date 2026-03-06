const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkOrphanedOnboardings() {
  try {
    console.log('🔍 Checking orphaned onboardings...\n');

    await mongoose.connect(TENANT_URI);

    // Get completed onboardings without employee records
    const orphanedOnboardings = await mongoose.connection.db.collection('onboardings').find({
      status: 'completed',
      $or: [
        { candidateId: { $exists: false } },
        { candidateId: null },
        { candidateId: '' }
      ]
    }).toArray();

    console.log('⚠️  Orphaned onboardings found:', orphanedOnboardings.length);

    for (const onboarding of orphanedOnboardings) {
      console.log(`\n👤 ${onboarding.candidateName} (${onboarding.candidateEmail})`);
      console.log(`   Status: ${onboarding.status}`);
      console.log('   Has required fields:');
      console.log(`   - candidateName: ${!!onboarding.candidateName}`);
      console.log(`   - candidateEmail: ${!!onboarding.candidateEmail}`);
      console.log(`   - position: ${!!onboarding.position}`);
      console.log(`   - department: ${!!onboarding.department}`);
      console.log(`   - joiningDate: ${!!onboarding.joiningDate}`);
      console.log(`   - offer: ${!!onboarding.offer}`);

      // Check if documents are verified
      if (onboarding.documents && onboarding.documents.length > 0) {
        const verifiedDocs = onboarding.documents.filter(doc => doc.status === 'verified');
        console.log(`   - documents verified: ${verifiedDocs.length}/${onboarding.documents.length}`);
      } else {
        console.log('   - documents: none required');
      }

      const canCreateEmployee = !!(onboarding.candidateName && onboarding.candidateEmail && onboarding.position && onboarding.department);
      console.log(`   Can create employee: ${canCreateEmployee}`);

      if (canCreateEmployee) {
        console.log('   ✅ This onboarding should have an employee record - will create it now...');

        // Create the missing employee record
        try {
          const employeeCreationService = require('./src/services/employeeCreationService');
          const result = await employeeCreationService.completeOnboardingAndCreateEmployee(
            onboarding._id,
            mongoose.connection // Use the current tenant connection
          );

          console.log(`   ✅ Employee created: ${result.employee.firstName} ${result.employee.lastName} (${result.employeeCode})`);
        } catch (createError) {
          console.log(`   ❌ Failed to create employee: ${createError.message}`);
        }
      }
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOrphanedOnboardings();