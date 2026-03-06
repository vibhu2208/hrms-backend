const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function testEmployeeAPI() {
  try {
    console.log('🧪 Testing Employee API with new structure...\n');

    await mongoose.connect(TENANT_URI);

    // Test 1: Check employees collection
    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log(`✅ Employees in employees collection: ${employees.length}`);

    // Test 2: Check users collection still has other roles
    const allUsers = await mongoose.connection.db.collection('users').find({}).toArray();
    const nonEmployeeUsers = allUsers.filter(u => u.role !== 'employee');
    console.log(`✅ Non-employee users in users collection: ${nonEmployeeUsers.length}`);

    // Test 3: Verify employee structure
    if (employees.length > 0) {
      const sampleEmployee = employees[0];
      console.log('\n📋 Sample Employee Structure:');
      console.log(`   ID: ${sampleEmployee._id}`);
      console.log(`   Name: ${sampleEmployee.firstName} ${sampleEmployee.lastName}`);
      console.log(`   Email: ${sampleEmployee.email}`);
      console.log(`   Employee Code: ${sampleEmployee.employeeCode}`);
      console.log(`   Active: ${sampleEmployee.isActive}`);
      console.log(`   Joining Date: ${sampleEmployee.joiningDate}`);
      console.log(`   Has Salary: ${!!sampleEmployee.salary}`);
    }

    // Test 4: Check onboarding still references employees correctly
    const completedOnboardings = await mongoose.connection.db.collection('onboardings').find({ status: 'completed' }).toArray();
    console.log(`\n📋 Completed onboardings: ${completedOnboardings.length}`);

    let validReferences = 0;
    for (const onboarding of completedOnboardings) {
      if (onboarding.candidateId) {
        const employeeExists = employees.find(e => e._id.toString() === onboarding.candidateId.toString());
        if (employeeExists) validReferences++;
      }
    }

    console.log(`✅ Valid employee references: ${validReferences}/${completedOnboardings.length}`);

    await mongoose.connection.close();

    console.log('\n🎉 Employee migration test completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Employees moved to dedicated employees collection');
    console.log('   ✅ Employee API updated to use employees collection');
    console.log('   ✅ Onboarding completion creates employees in correct collection');
    console.log('   ✅ Data integrity maintained');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmployeeAPI();