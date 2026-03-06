/**
 * Move users from wrong database to correct database
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function moveUsers() {
  try {
    console.log('🔄 Moving users from wrong database to correct database...\n');

    const baseUri = process.env.MONGODB_URI.split('?')[0];
    const queryParams = process.env.MONGODB_URI.split('?')[1];
    const uriWithoutDb = baseUri.replace(/\/[^/]*$/, '');

    // Connect to wrong database (where users currently are)
    const wrongDbName = 'tenant_tenant_696823363d45cbf69fd4b689';
    const wrongUri = `${uriWithoutDb}/${wrongDbName}?${queryParams}`;
    const wrongConn = await mongoose.createConnection(wrongUri).asPromise();
    console.log(`✅ Connected to source: ${wrongDbName}`);

    // Connect to correct database (where users should be)
    const correctDbName = 'tenant_696823363d45cbf69fd4b689';
    const correctUri = `${uriWithoutDb}/${correctDbName}?${queryParams}`;
    const correctConn = await mongoose.createConnection(correctUri).asPromise();
    console.log(`✅ Connected to destination: ${correctDbName}\n`);

    // Get users from wrong database
    const wrongUsers = wrongConn.db.collection('users');
    const users = await wrongUsers.find({ role: { $in: ['manager', 'employee', 'hr'] } }).toArray();
    
    console.log(`📊 Found ${users.length} users to move\n`);

    if (users.length === 0) {
      console.log('⚠️  No users to move');
      await wrongConn.close();
      await correctConn.close();
      process.exit(0);
    }

    // Insert users into correct database
    const correctUsers = correctConn.db.collection('users');
    
    // Delete existing seeded users in correct database if any
    const deleteResult = await correctUsers.deleteMany({ 
      role: { $in: ['manager', 'employee', 'hr'] }
    });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} old users from correct database\n`);

    // Insert users
    const insertResult = await correctUsers.insertMany(users);
    console.log(`✅ Inserted ${insertResult.insertedCount} users into correct database\n`);

    // Verify
    const verifyCount = await correctUsers.countDocuments({ role: { $in: ['manager', 'employee', 'hr'] } });
    console.log(`✅ Verification: ${verifyCount} users now in correct database\n`);

    // Show sample
    const sample = await correctUsers.find({ role: { $in: ['manager', 'employee', 'hr'] } }).limit(5).toArray();
    console.log('📝 Sample users in correct database:');
    sample.forEach(u => {
      console.log(`   - ${u.email} | ${u.role}`);
    });

    // Delete users from wrong database
    const deleteWrongResult = await wrongUsers.deleteMany({ role: { $in: ['manager', 'employee', 'hr'] } });
    console.log(`\n🗑️  Deleted ${deleteWrongResult.deletedCount} users from wrong database\n`);

    await wrongConn.close();
    await correctConn.close();

    console.log('✅ Migration complete!');
    console.log('\n🎯 You can now login with:');
    console.log('   - riya.reddy.manager@tts.com | Manager@123');
    console.log('   - sneha.patel.emp1@tts.com | Employee@123');
    console.log('   - shreya.pillai.hr1@tts.com | HR@123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

moveUsers();
