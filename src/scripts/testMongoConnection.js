/**
 * Test MongoDB Connection
 * Diagnoses connection issues with MongoDB Atlas
 * 
 * Run: node src/scripts/testMongoConnection.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const testConnection = async () => {
  console.log('\n🔍 MongoDB Connection Diagnostics\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const uri = process.env.MONGODB_URI;
  console.log('📋 Connection String:');
  console.log(`   ${uri.replace(/:[^:@]+@/, ':****@')}\n`);
  
  console.log('🔗 Attempting to connect...\n');
  
  try {
    const connection = await mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      family: 4, // Force IPv4
    });
    
    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      connection.once('open', resolve);
      connection.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 30000);
    });
    
    console.log('✅ SUCCESS! Connected to MongoDB\n');
    console.log('📊 Connection Details:');
    console.log(`   Ready State: ${connection.readyState}`);
    console.log(`   Database Name: ${connection.name || 'default'}\n`);
    
    // Try to list collections
    try {
      const collections = await connection.db.listCollections().toArray();
      console.log(`🗄️  Collections in database (${collections.length}):`);
      if (collections.length > 0) {
        collections.forEach(coll => {
          console.log(`   - ${coll.name}`);
        });
      } else {
        console.log('   (No collections yet - database is empty)');
      }
    } catch (e) {
      console.log('   Could not list collections');
    }
    
    await connection.close();
    console.log('\n✅ Connection test completed successfully!\n');
    console.log('💡 You can now run: node src/scripts/seedCompleteSystem.js\n');
    process.exit(0);
    
  } catch (error) {
    console.log('❌ CONNECTION FAILED!\n');
    console.log('Error Details:');
    console.log(`   Type: ${error.name}`);
    console.log(`   Message: ${error.message}`);
    console.log(`   Code: ${error.code || 'N/A'}\n`);
    
    console.log('💡 Troubleshooting Steps:\n');
    
    if (error.message.includes('EREFUSED') || error.message.includes('querySrv')) {
      console.log('   DNS Resolution Issue:');
      console.log('   1. Check your internet connection');
      console.log('   2. Try using Google DNS (8.8.8.8, 8.8.4.4)');
      console.log('   3. Disable VPN if using one');
      console.log('   4. Check firewall settings');
      console.log('   5. Try from a different network\n');
    }
    
    if (error.message.includes('authentication')) {
      console.log('   Authentication Issue:');
      console.log('   1. Verify username and password in .env');
      console.log('   2. Check if user has correct permissions');
      console.log('   3. Ensure password doesn\'t have special characters\n');
    }
    
    if (error.message.includes('timeout')) {
      console.log('   Timeout Issue:');
      console.log('   1. Check if MongoDB Atlas cluster is running');
      console.log('   2. Verify IP whitelist in Atlas (add 0.0.0.0/0 for testing)');
      console.log('   3. Check if cluster is paused\n');
    }
    
    console.log('   General Steps:');
    console.log('   1. Go to: https://cloud.mongodb.com/');
    console.log('   2. Check cluster status (should be green)');
    console.log('   3. Network Access → Add IP Address → Allow from Anywhere (0.0.0.0/0)');
    console.log('   4. Database Access → Verify user exists and has permissions');
    console.log('   5. Try connecting with MongoDB Compass first\n');
    
    console.log('   Alternative: Use Local MongoDB');
    console.log('   1. Install MongoDB locally');
    console.log('   2. Update .env: MONGODB_URI=mongodb://127.0.0.1:27017/hrms');
    console.log('   3. Run: mongod\n');
    
    process.exit(1);
  }
};

testConnection();
