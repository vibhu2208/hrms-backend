const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';

async function checkOffboardingData() {
  try {
    console.log('🔗 Connecting to hrms_spc database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully');

    // Check main offboardings collection
    console.log('\n📋 Checking main offboardings collection...');
    const offboardings = await mongoose.connection.db.collection('offboardings').find({}).toArray();
    console.log(`📊 Main offboardings records: ${offboardings.length}`);

    if (offboardings.length > 0) {
      console.log('\n--- Main Offboardings Data ---');
      offboardings.forEach((off, index) => {
        console.log(`${index + 1}. Employee ID: ${off.employee}`);
        console.log(`   Status: ${off.status}`);
        console.log(`   Stage: ${off.currentStage}`);
        console.log(`   Last Working Date: ${off.lastWorkingDate}`);
        console.log(`   Resignation Type: ${off.resignationType}`);
        console.log(`   Reason: ${off.reason}`);
        console.log(`   Created: ${off.createdAt}`);
        console.log('');
      });
    }

    // Check tenant-specific offboardingrequests collection
    console.log('📋 Checking tenant offboardingrequests collection...');
    const offboardingRequests = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();
    console.log(`📊 Tenant offboardingrequests records: ${offboardingRequests.length}`);

    if (offboardingRequests.length > 0) {
      console.log('\n--- Tenant Offboarding Requests Data ---');
      offboardingRequests.forEach((off, index) => {
        console.log(`${index + 1}. Employee ID: ${off.employeeId}`);
        console.log(`   Status: ${off.status}`);
        console.log(`   Current Stage: ${off.currentStage}`);
        console.log(`   Last Working Date: ${off.lastWorkingDay}`);
        console.log(`   Reason: ${off.reason}`);
        console.log(`   Reason Details: ${off.reasonDetails}`);
        console.log(`   Priority: ${off.priority}`);
        console.log(`   Created: ${off.createdAt}`);
        console.log(`   Completion: ${off.completionPercentage}%`);
        console.log('');
      });
    }

    // Check related collections
    console.log('📋 Checking related offboarding collections...');

    const collectionsToCheck = [
      'offboardingtasks',
      'assetclearances',
      'finalsettlements',
      'exitfeedbacks',
      'handoverdetails'
    ];

    for (const collectionName of collectionsToCheck) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments({});
        console.log(`📊 ${collectionName}: ${count} records`);
      } catch (error) {
        console.log(`📊 ${collectionName}: Collection not found or error`);
      }
    }

    // If no data found, check for sample/demo data
    const totalRecords = offboardings.length + offboardingRequests.length;
    if (totalRecords === 0) {
      console.log('\n⚠️  No offboarding data found in main collections.');
      console.log('🔍 Checking for any offboarding-related data in other collections...');

      // Check if there are any records in exitprocesses (might be old naming)
      const exitProcesses = await mongoose.connection.db.collection('exitprocesses').find({}).toArray();
      console.log(`📊 exitprocesses records: ${exitProcesses.length}`);

      if (exitProcesses.length > 0) {
        console.log('\n--- Exit Processes Data ---');
        exitProcesses.forEach((ep, index) => {
          console.log(`${index + 1}. ${JSON.stringify(ep, null, 2)}`);
        });
      }
    }

    console.log('\n🔌 Connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkOffboardingData();