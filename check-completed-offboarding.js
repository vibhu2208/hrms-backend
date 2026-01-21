const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';

async function checkCompletedOffboarding() {
  try {
    console.log('🔗 Connecting to hrms_spc database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully');

    console.log('\n📋 OFFBOARDING DATA STORAGE IN HRMS-SPC');
    console.log('═══════════════════════════════════════');

    // Check main offboarding collections
    console.log('\n🏠 MAIN DATABASE COLLECTIONS:');

    const mainCollections = [
      'offboardings',
      'offboardingrequests',
      'exitprocesses'
    ];

    for (const collectionName of mainCollections) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments({});
        console.log(`📊 ${collectionName}: ${count} records`);

        if (count > 0) {
          const records = await mongoose.connection.db.collection(collectionName).find({}).limit(5).toArray();
          console.log(`   📋 Sample records:`);

          records.forEach((record, index) => {
            console.log(`     ${index + 1}. ID: ${record._id}`);
            console.log(`        Status: ${record.status || 'N/A'}`);
            console.log(`        Stage: ${record.currentStage || record.stage || 'N/A'}`);
            if (record.employee) console.log(`        Employee: ${record.employee}`);
            if (record.employeeId) console.log(`        Employee ID: ${record.employeeId}`);
            if (record.lastWorkingDate) console.log(`        Last Working: ${record.lastWorkingDate}`);
            if (record.lastWorkingDay) console.log(`        Last Working: ${record.lastWorkingDay}`);
            if (record.completedAt) console.log(`        Completed: ${record.completedAt}`);
            console.log('');
          });
        }
      } catch (error) {
        console.log(`📊 ${collectionName}: Collection not found or error`);
      }
    }

    // Check related collections
    console.log('\n🔗 RELATED OFFBOARDING COLLECTIONS:');

    const relatedCollections = [
      'offboardingtasks',
      'assetclearances',
      'finalsettlements',
      'exitfeedbacks',
      'handoverdetails'
    ];

    for (const collectionName of relatedCollections) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments({});
        console.log(`📊 ${collectionName}: ${count} records`);

        if (count > 0) {
          const records = await mongoose.connection.db.collection(collectionName).find({}).limit(3).toArray();
          console.log(`   📋 Sample records:`);

          records.forEach((record, index) => {
            console.log(`     ${index + 1}. ID: ${record._id}`);
            if (record.offboardingRequestId) console.log(`        Offboarding Request: ${record.offboardingRequestId}`);
            if (record.employeeId) console.log(`        Employee: ${record.employeeId}`);
            if (record.status) console.log(`        Status: ${record.status}`);
            console.log('');
          });
        }
      } catch (error) {
        console.log(`📊 ${collectionName}: Collection not found`);
      }
    }

    // Check employees collection for any offboarding status
    console.log('\n👥 EMPLOYEE RECORDS:');
    try {
      const employees = await mongoose.connection.db.collection('employees').find({}).limit(10).toArray();
      console.log(`📊 employees: ${employees.length} records total`);

      // Check if any employees have offboarding-related fields
      const employeesWithOffboarding = employees.filter(emp =>
        emp.status === 'offboarded' ||
        emp.offboardingStatus ||
        emp.lastWorkingDate ||
        emp.exitDate
      );

      if (employeesWithOffboarding.length > 0) {
        console.log(`   🎯 Employees with offboarding data: ${employeesWithOffboarding.length}`);
        employeesWithOffboarding.forEach((emp, index) => {
          console.log(`     ${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.email})`);
          console.log(`        Status: ${emp.status}`);
          if (emp.lastWorkingDate) console.log(`        Last Working: ${emp.lastWorkingDate}`);
          if (emp.exitDate) console.log(`        Exit Date: ${emp.exitDate}`);
          console.log('');
        });
      } else {
        console.log('   ❌ No employees found with offboarding status');
      }
    } catch (error) {
      console.log('❌ Error checking employees collection');
    }

    // Check for any documents or audit logs related to offboarding
    console.log('\n📄 DOCUMENTS & AUDIT LOGS:');
    const docCollections = ['documents', 'auditlogs', 'superadminauditlogs'];

    for (const collectionName of docCollections) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments({});
        console.log(`📊 ${collectionName}: ${count} records`);

        // Check for offboarding-related documents
        if (count > 0) {
          const offboardingDocs = await mongoose.connection.db.collection(collectionName)
            .find({
              $or: [
                { type: { $regex: /offboard|exit/i } },
                { category: { $regex: /offboard|exit/i } },
                { description: { $regex: /offboard|exit/i } },
                { action: { $regex: /offboard|exit/i } }
              ]
            })
            .limit(3)
            .toArray();

          if (offboardingDocs.length > 0) {
            console.log(`   🎯 Found ${offboardingDocs.length} offboarding-related ${collectionName}`);
            offboardingDocs.forEach((doc, index) => {
              console.log(`     ${index + 1}. ${doc.name || doc.description || doc.action}`);
              console.log(`        Date: ${doc.createdAt || doc.timestamp}`);
              console.log('');
            });
          }
        }
      } catch (error) {
        console.log(`📊 ${collectionName}: Collection not found`);
      }
    }

    console.log('\n📍 SUMMARY:');
    console.log('═══════════════════════════════════════');
    console.log('OFFBOARDING DATA STORAGE LOCATIONS:');
    console.log('');
    console.log('1. 📊 MAIN COLLECTIONS:');
    console.log('   - offboardings (primary offboarding records)');
    console.log('   - offboardingrequests (advanced workflow requests)');
    console.log('   - exitprocesses (legacy exit process records)');
    console.log('');
    console.log('2. 🔗 SUPPORTING COLLECTIONS:');
    console.log('   - offboardingtasks (checklist items)');
    console.log('   - assetclearances (asset return records)');
    console.log('   - finalsettlements (payment & settlement data)');
    console.log('   - exitfeedbacks (exit interview responses)');
    console.log('   - handoverdetails (knowledge transfer docs)');
    console.log('');
    console.log('3. 👥 EMPLOYEE RECORDS:');
    console.log('   - employees collection (may contain offboarding status)');
    console.log('');
    console.log('4. 📄 DOCUMENT STORAGE:');
    console.log('   - documents collection (experience letters, relieving letters)');
    console.log('   - auditlogs (offboarding activity tracking)');
    console.log('');
    console.log('5. 🏢 TENANT-SPECIFIC STORAGE:');
    console.log('   - Each client has separate database: tenant_{clientId}');
    console.log('   - Same collection structure but isolated per tenant');

    console.log('\n🔌 Connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkCompletedOffboarding();