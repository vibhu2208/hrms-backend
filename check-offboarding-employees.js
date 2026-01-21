const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkOffboardingEmployeeIds() {
  try {
    console.log('🔍 Checking offboarding employee IDs...\n');

    await mongoose.connect(TENANT_URI);

    // Check offboarding requests
    const offboardings = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();
    console.log(`📋 Total offboarding requests: ${offboardings.length}`);

    if (offboardings.length > 0) {
      console.log('\n--- Offboarding Employee IDs ---');
      for (const off of offboardings) {
        console.log(`Offboarding ID: ${off._id}`);
        console.log(`Employee ID: ${off.employeeId}`);

        // Check if employee exists in employees collection
        const employee = await mongoose.connection.db.collection('employees').findOne({ _id: off.employeeId });
        console.log(`Employee exists in employees collection: ${!!employee}`);

        if (employee) {
          console.log(`Employee name: ${employee.firstName} ${employee.lastName}`);
        } else {
          // Check if employee exists in users collection
          const user = await mongoose.connection.db.collection('users').findOne({ _id: off.employeeId });
          console.log(`Employee exists in users collection: ${!!user}`);
          if (user) {
            console.log(`User name: ${user.firstName || user.name} (role: ${user.role})`);
          }
        }
        console.log('---');
      }
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOffboardingEmployeeIds();