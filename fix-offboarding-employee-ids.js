const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function fixOffboardingEmployeeIds() {
  try {
    console.log('🔧 Fixing offboarding employee IDs...\n');

    await mongoose.connect(TENANT_URI);

    // Get all offboarding requests
    const offboardings = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();
    console.log(`📋 Found ${offboardings.length} offboarding records`);

    let fixedCount = 0;

    for (const offboarding of offboardings) {
      const employeeId = offboarding.employeeId;

      // Check if employee exists in employees collection
      const employee = await mongoose.connection.db.collection('employees').findOne({ _id: employeeId });

      if (!employee) {
        // Employee not found in employees collection, check users collection
        const user = await mongoose.connection.db.collection('users').findOne({ _id: employeeId });

        if (user && user.role === 'employee') {
          // Find matching employee by email
          const matchingEmployee = await mongoose.connection.db.collection('employees').findOne({ email: user.email });

          if (matchingEmployee) {
            // Update the offboarding record with correct employee ID
            await mongoose.connection.db.collection('offboardingrequests').updateOne(
              { _id: offboarding._id },
              { $set: { employeeId: matchingEmployee._id } }
            );

            console.log(`✅ Fixed offboarding ${offboarding._id}: ${user.firstName} -> ${matchingEmployee.firstName} ${matchingEmployee.lastName}`);
            fixedCount++;
          } else {
            console.log(`⚠️  No matching employee found for user ${user.firstName} (${user.email})`);
          }
        } else {
          console.log(`⚠️  Employee ID ${employeeId} not found in users collection or not an employee`);
        }
      } else {
        console.log(`✅ Offboarding ${offboarding._id} already has correct employee ID`);
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} offboarding records`);

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixOffboardingEmployeeIds();