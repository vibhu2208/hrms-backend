const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkEmployeeMigration() {
  try {
    console.log('🔍 Checking Employee Migration Status...\n');

    // Check main database
    console.log('📊 Main Database (hrms_spc):');
    await mongoose.connect(MONGODB_URI);

    const mainEmployees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👷 Employees in main DB: ${mainEmployees.length}`);
    mainEmployees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName} - ${emp.employeeCode || 'No Code'}`);
    });

    await mongoose.connection.close();

    // Check tenant database
    console.log('\n🏢 Tenant Database (tenant_696b515db6c9fd5fd51aed1c):');
    await mongoose.connect(TENANT_URI);

    const tenantEmployees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👷 Employees in tenant DB: ${tenantEmployees.length}`);
    tenantEmployees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.firstName} ${emp.lastName} - ${emp.employeeCode || 'No Code'}`);
    });

    // Check onboardings in tenant
    const completedOnboardings = await mongoose.connection.db.collection('onboardings').find({ status: 'completed' }).toArray();
    console.log(`\n📋 Completed onboardings in tenant: ${completedOnboardings.length}`);

    // Check for mismatches
    const onboardingsWithEmployees = completedOnboardings.filter(o => o.candidateId);
    const onboardingsWithoutEmployees = completedOnboardings.filter(o => !o.candidateId);

    console.log(`✅ Onboardings with employee records: ${onboardingsWithEmployees.length}`);
    console.log(`⚠️  Onboardings without employee records: ${onboardingsWithoutEmployees.length}`);

    if (onboardingsWithoutEmployees.length > 0) {
      console.log('\n📝 Onboardings needing employee creation:');
      onboardingsWithoutEmployees.forEach((onb, i) => {
        console.log(`   ${i + 1}. ${onb.candidateName} (${onb.candidateEmail})`);
      });
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEmployeeMigration();