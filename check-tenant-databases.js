const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net';
const BASE_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net';

async function checkTenantDatabases() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    const globalConn = await mongoose.createConnection(`${BASE_URI}/hrms_spc?retryWrites=true&w=majority`);
    console.log('✅ Connected to global database');

    // Get all databases
    const adminDb = globalConn.db.admin();
    const databases = await adminDb.listDatabases();
    console.log('\n📋 Available databases:');
    databases.databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Check for tenant databases (those starting with 'tenant_')
    const tenantDatabases = databases.databases.filter(db => db.name.startsWith('tenant_'));

    if (tenantDatabases.length === 0) {
      console.log('\n⚠️  No tenant databases found.');
    } else {
      console.log(`\n🏢 Found ${tenantDatabases.length} tenant database(s):`);

      for (const tenantDb of tenantDatabases) {
        console.log(`\n🔍 Checking tenant database: ${tenantDb.name}`);
        const tenantConn = await mongoose.createConnection(`${BASE_URI}/${tenantDb.name}?retryWrites=true&w=majority`);

        try {
          const collections = await tenantConn.db.listCollections().toArray();
          const collectionNames = collections.map(c => c.name);

          console.log(`  📋 Collections: ${collectionNames.length} found`);

          // Check for offboarding-related collections
          const offboardingCollections = collectionNames.filter(name =>
            name.includes('offboard') || name.includes('exit') || name.includes('clearance') ||
            name.includes('settlement') || name.includes('feedback') || name.includes('handover')
          );

          if (offboardingCollections.length > 0) {
            console.log(`  🎯 Offboarding-related collections: ${offboardingCollections.join(', ')}`);

            // Check each offboarding collection for data
            for (const collectionName of offboardingCollections) {
              try {
                const count = await tenantConn.db.collection(collectionName).countDocuments({});
                if (count > 0) {
                  console.log(`    📊 ${collectionName}: ${count} records`);

                  // Show sample data for small collections
                  if (count <= 5) {
                    const records = await tenantConn.db.collection(collectionName).find({}).limit(3).toArray();
                    console.log(`    📋 Sample data:`);
                    records.forEach((record, index) => {
                      console.log(`      ${index + 1}. ID: ${record._id}`);
                      if (record.status) console.log(`         Status: ${record.status}`);
                      if (record.currentStage) console.log(`         Stage: ${record.currentStage}`);
                      if (record.employeeId) console.log(`         Employee: ${record.employeeId}`);
                      if (record.lastWorkingDay) console.log(`         Last Working Day: ${record.lastWorkingDay}`);
                      console.log('');
                    });
                  }
                } else {
                  console.log(`    📊 ${collectionName}: 0 records`);
                }
              } catch (error) {
                console.log(`    ❌ Error checking ${collectionName}: ${error.message}`);
              }
            }
          } else {
            console.log(`  ❌ No offboarding collections found`);
          }

        } catch (error) {
          console.log(`  ❌ Error checking collections: ${error.message}`);
        }

        await tenantConn.close();
      }
    }

    // Check main database for any tenant references
    console.log(`\n🔍 Checking main database for tenant/client references...`);
    try {
      const clients = await globalConn.db.collection('clients').find({}).toArray();
      console.log(`📊 Clients found: ${clients.length}`);
      if (clients.length > 0) {
        clients.forEach((client, index) => {
          console.log(`  ${index + 1}. ${client.name || client.companyName} (ID: ${client._id})`);
        });
      }
    } catch (error) {
      console.log(`❌ Error checking clients: ${error.message}`);
    }

    await globalConn.close();
    console.log('\n🔌 All connections closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTenantDatabases();