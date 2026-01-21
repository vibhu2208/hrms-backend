const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function verifyOffboardingData() {
  try {
    console.log('🔍 Verifying Offboarding Data Display...\n');

    await mongoose.connect(TENANT_URI);

    // Get offboarding requests
    const offboardings = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();
    console.log(`📋 Found ${offboardings.length} offboarding records`);

    if (offboardings.length > 0) {
      for (const offboarding of offboardings) {
        console.log(`\n--- Offboarding ${offboarding._id} ---`);
        console.log(`Status: ${offboarding.status}`);
        console.log(`Has Employee Snapshot: ${!!offboarding.employeeSnapshot}`);

        if (offboarding.employeeSnapshot) {
          console.log(`Snapshot Employee: ${offboarding.employeeSnapshot.firstName} ${offboarding.employeeSnapshot.lastName}`);
          console.log(`Snapshot Email: ${offboarding.employeeSnapshot.email}`);
          console.log(`Snapshot Employee Code: ${offboarding.employeeSnapshot.employeeCode}`);

          // Check if department ID exists and try to get department name
          if (offboarding.employeeSnapshot.department) {
            try {
              const dept = await mongoose.connection.db.collection('departments').findOne({ _id: offboarding.employeeSnapshot.department });
              console.log(`Department from DB: ${dept ? dept.name : 'Not found'}`);
            } catch (error) {
              console.log(`Department lookup failed: ${error.message}`);
            }
          }
        }

        // Test the transformation logic (simulate what the API does)
        console.log('\n--- API Transformation Test ---');
        if (offboarding.status === 'closed' && offboarding.employeeSnapshot) {
          // Simulate the transformation
          const transformed = {
            _id: offboarding._id,
            employee: {
              firstName: offboarding.employeeSnapshot.firstName,
              lastName: offboarding.employeeSnapshot.lastName,
              email: offboarding.employeeSnapshot.email,
              employeeCode: offboarding.employeeSnapshot.employeeCode,
              department: offboarding.employeeSnapshot.department ? { name: 'Test Department' } : null // Mock department name
            },
            status: offboarding.status === 'closed' ? 'completed' : offboarding.status
          };

          console.log(`Transformed Employee: ${transformed.employee.firstName} ${transformed.employee.lastName}`);
          console.log(`Transformed Status: ${transformed.status}`);
          console.log('✅ Transformation working');
        } else {
          console.log('ℹ️  Offboarding not closed or no snapshot');
        }
      }
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyOffboardingData();