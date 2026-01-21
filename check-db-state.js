const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';

async function checkDatabaseState() {
  try {
    console.log('🔗 Connecting to hrms_spc database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully');

    // Check what collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Collections found:', collections.map(c => c.name));

    // Check users collection
    if (collections.find(c => c.name === 'users')) {
      const users = await mongoose.connection.db.collection('users').find({}).toArray();
      console.log('👥 Existing users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.role} - Active: ${user.isActive}`);
        console.log(`   ID: ${user._id}`);
        console.log('');
      });
    }

    // Check offboardings collection
    if (collections.find(c => c.name === 'offboardings')) {
      const offboardings = await mongoose.connection.db.collection('offboardings').find({}).toArray();
      console.log(`📋 Offboarding records: ${offboardings.length}`);
      if (offboardings.length > 0) {
        offboardings.forEach((off, index) => {
          console.log(`${index + 1}. Employee: ${off.employee} - Status: ${off.status}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
}

checkDatabaseState();