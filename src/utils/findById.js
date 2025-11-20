require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';
const searchId = '691ea970f0672852d1b8c56b';

console.log('🔍 Searching for candidate with _id:', searchId);
console.log('📍 URL: localhost:5173/candidates/691ea970f0672852d1b8c56b/timeline\n');

const findById = async () => {
  let tenantConnection;
  let mainConnection;
  
  try {
    // Connect to main database
    console.log('🔗 Connecting to main database...\n');
    mainConnection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to main MongoDB\n');

    // Connect to tenant database
    const dbName = `tenant_${tenantId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    console.log(`🔗 Connecting to tenant database: ${dbName}...\n`);
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to tenant MongoDB\n');

    // Define a flexible schema
    const flexibleSchema = new mongoose.Schema({}, { strict: false });

    // Collections to search in both databases
    const collections = [
      'candidates',
      'jobpostings',
      'employees',
      'departments',
      'offertemplates',
      'users',
      'companies',
      'leaves',
      'attendance',
      'projects'
    ];

    console.log(`🔍 Searching for _id: ${searchId}\n`);
    console.log('=' .repeat(60));

    // Search in main database
    console.log('\n📊 MAIN DATABASE:');
    console.log('-'.repeat(60));
    
    for (const collectionName of collections) {
      try {
        const Model = mongoose.model(collectionName, flexibleSchema, collectionName);
        const doc = await Model.findById(searchId);
        
        if (doc) {
          console.log(`\n✅ FOUND in collection: ${collectionName}`);
          console.log(JSON.stringify(doc, null, 2));
          console.log('\n' + '='.repeat(60));
        }
      } catch (error) {
        // Collection might not exist, skip
      }
    }

    // Search in tenant database
    console.log('\n📊 TENANT DATABASE:');
    console.log('-'.repeat(60));
    
    for (const collectionName of collections) {
      try {
        const TenantModel = tenantConnection.model(collectionName, flexibleSchema, collectionName);
        const doc = await TenantModel.findById(searchId);
        
        if (doc) {
          console.log(`\n✅ FOUND in collection: ${collectionName}`);
          console.log(JSON.stringify(doc, null, 2));
          console.log('\n' + '='.repeat(60));
        }
      } catch (error) {
        // Collection might not exist, skip
      }
    }

    console.log('\n✅ Search completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
    if (mainConnection) {
      await mongoose.disconnect();
    }
  }
};

findById();
