/**
 * Test MongoDB Connection Directly
 */

const mongoose = require('mongoose');

async function testMongoConnection() {
  try {
    console.log('🧪 Testing MongoDB Connection...');
    
    const mongoURI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';
    
    console.log('🔗 Connecting to MongoDB...');
    console.log('🔗 URI:', mongoURI.replace(/:[^:@]+@/, ':****@')); // Hide password
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB Connected Successfully!');
    
    // Test a simple query
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log(`✅ Found ${collections.length} collections in hrms_spc database:`);
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Test tenant database connection
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    console.log(`\n🔗 Testing tenant database: ${tenantDbName}`);
    
    const tenantURI = `mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`;
    
    await mongoose.disconnect();
    await mongoose.connect(tenantURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ Tenant Database Connected: ${tenantDbName}`);
    
    const tenantCollections = await db.listCollections().toArray();
    console.log(`✅ Found ${tenantCollections.length} collections in tenant database:`);
    tenantCollections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Test user query
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const userCount = await User.countDocuments();
    console.log(`✅ Found ${userCount} users in tenant database`);
    
    await mongoose.disconnect();
    console.log('✅ MongoDB Connection Test Complete!');
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    
    if (error.message.includes('ETIMEOUT')) {
      console.log('\n🔧 Network Timeout Solutions:');
      console.log('1. Check internet connection');
      console.log('2. Try using VPN');
      console.log('3. Check MongoDB Atlas network access settings');
      console.log('4. Try different network (mobile hotspot)');
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n🔧 DNS Resolution Issues:');
      console.log('1. Check DNS settings');
      console.log('2. Try flushing DNS: ipconfig /flushdns');
      console.log('3. Try using Google DNS: 8.8.8.8');
    }
  }
}

testMongoConnection();
