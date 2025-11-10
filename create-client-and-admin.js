const mongoose = require('mongoose');
const User = require('./src/models/User');

// You'll need to check if you have a Client model
const createClientAndAdmin = async () => {
  try {
    // Connect to your Atlas database
    const mongoUri = 'mongodb+srv://krishnaupadhyay161003_db_user:Ram161003@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Atlas connected successfully');

    // First, let's check if you have a Client model
    let Client;
    try {
      Client = require('./src/models/Client');
      console.log('✅ Client model found');
    } catch (error) {
      console.log('❌ Client model not found. You need to create a Client model first.');
      console.log('💡 For now, let\'s create an admin user without clientId validation...');
      
      // Create admin user by temporarily bypassing clientId requirement
      const adminUser = new User({
        email: 'admin@company.com',
        password: 'admin123', // Plain text - pre-save hook will hash it
        role: 'admin',
        isActive: true,
        authProvider: 'local',
        isFirstLogin: false
        // Note: We're not setting clientId, which might cause validation error
      });

      // Try to save without clientId
      try {
        await adminUser.save();
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@company.com');
        console.log('🔑 Password: admin123');
      } catch (saveError) {
        console.log('❌ Failed to create admin user:', saveError.message);
        console.log('💡 The User model requires clientId for admin users.');
        console.log('💡 You need to either:');
        console.log('   1. Create a Client model and client record first');
        console.log('   2. Modify the User model to make clientId optional for testing');
        console.log('   3. Use the superadmin account instead');
      }
      
      await mongoose.connection.close();
      return;
    }

    // If Client model exists, create a client first
    const client = new Client({
      name: 'Test Company',
      email: 'contact@testcompany.com',
      phone: '1234567890',
      address: 'Test Address',
      subscriptionStatus: 'active',
      packageId: null, // You might need to create a package first
      isActive: true
    });

    await client.save();
    console.log('✅ Client created successfully');

    // Now create admin user with clientId
    const adminUser = new User({
      email: 'admin@testcompany.com',
      password: 'admin123',
      role: 'admin',
      clientId: client._id, // Link to the client
      isActive: true,
      authProvider: 'local',
      isFirstLogin: false
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@testcompany.com');
    console.log('🔑 Password: admin123');
    console.log('🏢 Client: Test Company');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createClientAndAdmin();
