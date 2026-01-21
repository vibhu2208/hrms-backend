const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function testOffboardingMoveEmployee() {
  try {
    console.log('🧪 Testing Offboarding Employee Movement...\n');

    await mongoose.connect(TENANT_URI);

    // Check current employees
    const employeesBefore = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log(`👥 Employees before offboarding: ${employeesBefore.length}`);

    // Check current offboarding records
    const offboardingsBefore = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();
    console.log(`📋 Offboarding records before: ${offboardingsBefore.length}`);

    if (offboardingsBefore.length > 0) {
      const closedOffboarding = offboardingsBefore.find(o => o.status === 'closed');
      if (closedOffboarding) {
        console.log(`✅ Found closed offboarding record with ID: ${closedOffboarding._id}`);
        console.log(`   Employee snapshot exists: ${!!closedOffboarding.employeeSnapshot}`);
        console.log(`   Employee ID in snapshot: ${closedOffboarding.employeeSnapshot?._id || 'N/A'}`);

        // Check if the employee still exists in employees collection
        const employeeExists = await mongoose.connection.db.collection('employees').findOne({ _id: closedOffboarding.employeeSnapshot?._id });
        console.log(`   Employee still in employees collection: ${!!employeeExists}`);

        if (!employeeExists && closedOffboarding.employeeSnapshot) {
          console.log('✅ SUCCESS: Employee has been moved from employees collection to offboarding snapshot');
        } else if (employeeExists) {
          console.log('⚠️  WARNING: Employee still exists in employees collection despite completed offboarding');
        } else {
          console.log('❌ ERROR: Employee data not found in either location');
        }
      } else {
        console.log('ℹ️  No closed offboarding records found');

        // Check if there are any active offboardings we can test with
        const activeOffboarding = offboardingsBefore.find(o => o.status !== 'closed');
        if (activeOffboarding) {
          console.log(`🔄 Found active offboarding record: ${activeOffboarding._id} (${activeOffboarding.status})`);
          console.log('   You can test the complete offboarding process with this record');
        }
      }
    }

    await mongoose.connection.close();

    console.log('\n🎉 Offboarding employee movement test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testOffboardingMoveEmployee();