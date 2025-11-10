const mongoose = require('mongoose');
const User = require('./src/models/User');
const Client = require('./src/models/Client');

const createWorkingClientAndAdmin = async () => {
  try {
    // Connect to your Atlas database
    const mongoUri = 'mongodb+srv://krishnaupadhyay161003_db_user:Ram161003@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Atlas connected successfully');

    // Generate a unique client code
    const clientCount = await Client.countDocuments();
    const clientCode = `CLT${String(clientCount + 1).padStart(5, '0')}`;

    // Create a client with all required fields
    const client = new Client({
      clientCode: clientCode, // Set manually
      name: 'Test Company Ltd',
      companyName: 'Test Company Ltd',
      email: 'contact@testcompany.com',
      phone: '+1234567890',
      address: {
        street: '123 Business Street',
        city: 'Business City',
        state: 'Business State',
        zipCode: '12345',
        country: 'USA'
      },
      contactPerson: {
        name: 'John Doe',
        designation: 'CEO',
        email: 'john@testcompany.com',
        phone: '+1234567890'
      },
      industry: 'Technology',
      website: 'https://testcompany.com',
      status: 'active',
      isActive: true,
      enabledModules: ['hr', 'payroll', 'attendance', 'recruitment'],
      subscription: {
        status: 'active',
        billingCycle: 'monthly'
      }
    });

    await client.save();
    console.log('✅ Client created successfully');
    console.log('🏢 Client Code:', client.clientCode);
    console.log('🏢 Company Name:', client.companyName);

    // Now create admin user with clientId
    const adminEmail = 'admin@testcompany.com';
    const adminPassword = 'admin123';

    const adminUser = new User({
      email: adminEmail,
      password: adminPassword, // Plain text - pre-save hook will hash it
      role: 'admin',
      clientId: client._id, // Link to the client
      isActive: true,
      authProvider: 'local',
      isFirstLogin: false
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    
    // Test the admin user
    const testUser = await User.findOne({ email: adminEmail }).select('+password');
    const isMatch = await testUser.comparePassword(adminPassword);
    console.log('🧪 Password verification test:', isMatch);

    if (isMatch) {
      console.log('\n🎉 SUCCESS! Your new admin login credentials:');
      console.log('═══════════════════════════════════════════════');
      console.log('📧 EMAIL:', adminEmail);
      console.log('🔑 PASSWORD:', adminPassword);
      console.log('🏢 COMPANY:', client.companyName);
      console.log('🆔 CLIENT CODE:', client.clientCode);
      console.log('═══════════════════════════════════════════════');
      console.log('\n💡 This admin user is linked to the client organization');
      console.log('💡 They will access regular HRMS features at /dashboard');
      console.log('💡 SuperAdmin accesses different features at /super-admin');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.log('💡 Duplicate key error - client or user might already exist');
      console.log('💡 Try using different email addresses');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createWorkingClientAndAdmin();
