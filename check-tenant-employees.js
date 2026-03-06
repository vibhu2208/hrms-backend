const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkTenantEmployees() {
  try {
    console.log('🔍 Checking employee distribution across databases...\n');

    // Check main database
    console.log('📊 Main Database (hrms_spc):');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully');

    const mainUsers = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👷 Employees in main DB: ${mainUsers.length}`);
    mainUsers.forEach((emp, index) => {
      console.log(`   ${index + 1}. ${emp.firstName} ${emp.lastName} - Active: ${emp.isActive} - Company: ${emp.companyId || 'none'}`);
    });

    await mongoose.connection.close();

    // Check tenant database
    console.log('\n🏢 Tenant Database (tenant_696b515db6c9fd5fd51aed1c):');
    await mongoose.connect(TENANT_URI);
    console.log('✅ Connected successfully');

    const tenantUsers = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👷 Employees in tenant DB: ${tenantUsers.length}`);
    tenantUsers.forEach((emp, index) => {
      console.log(`   ${index + 1}. ${emp.firstName} ${emp.lastName} - Active: ${emp.isActive} - Code: ${emp.employeeCode}`);
    });

    // Check onboarding records in tenant DB
    const onboardings = await mongoose.connection.db.collection('onboardings').find({}).toArray();
    console.log(`\n📋 Onboarding records in tenant DB: ${onboardings.length}`);
    onboardings.forEach((onb, index) => {
      console.log(`   ${index + 1}. ${onb.candidateName} - Status: ${onb.status} - Completed: ${onb.completedAt ? 'Yes' : 'No'}`);
    });

    await mongoose.connection.close();

    console.log('\n✅ Database check completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkTenantEmployees();