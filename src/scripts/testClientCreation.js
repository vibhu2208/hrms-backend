const mongoose = require('mongoose');
const Client = require('../models/Client');
const User = require('../models/User');
require('dotenv').config();

async function testClientCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    // Test data (similar to what the frontend would send)
    const testClientData = {
      clientCode: 'TEST001',
      name: 'Test Company Inc',
      companyName: 'Test Company Inc',
      email: 'info@testcompany.com',
      adminEmail: 'admin@testcompany.com',
      phone: '+1-555-9999',
      address: '123 Test Street',
      contactPerson: {
        name: 'Test Admin',
        email: 'admin@testcompany.com',
        phone: '+1-555-9999'
      },
      status: 'active',
      industry: 'Technology',
      website: 'https://testcompany.com'
    };
    
    console.log('🧪 Testing client creation with admin user...');
    
    // Clean up any existing test data
    await Client.findOneAndDelete({ clientCode: 'TEST001' });
    await User.findOneAndDelete({ email: 'admin@testcompany.com' });
    
    // Simulate the backend createClient function
    const { adminEmail, ...clientData } = testClientData;
    
    // Create client
    const client = new Client(clientData);
    await client.save();
    console.log('✅ Client created:', client.companyName);
    
    // Create admin user
    if (adminEmail) {
      const adminUser = new User({
        email: adminEmail,
        password: 'password123',
        authProvider: 'local',
        role: 'admin',
        clientId: client._id,
        isActive: true
      });
      
      await adminUser.save();
      console.log('✅ Admin user created:', adminEmail);
      
      // Verify the user can login
      const verifyUser = await User.findOne({ email: adminEmail }).select('+password');
      const passwordWorks = await verifyUser.comparePassword('password123');
      console.log('✅ Password verification:', passwordWorks);
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('📧 Admin login email:', adminEmail);
    console.log('🔑 Admin password: password123');
    
    // Clean up test data
    await Client.findByIdAndDelete(client._id);
    await User.findOneAndDelete({ email: adminEmail });
    console.log('🧹 Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testClientCreation();
