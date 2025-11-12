const mongoose = require('mongoose');
const User = require('../models/User');
const Client = require('../models/Client');
require('dotenv').config();

async function createHRUserFinal() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    // Find Manufacturing Co client
    const mfgClient = await Client.findOne({ clientCode: 'MFG001' });
    if (!mfgClient) {
      console.log('❌ Manufacturing Co client not found');
      return;
    }
    
    console.log('✅ Found Manufacturing Co client:', mfgClient.name);
    
    // Delete existing HR user if exists
    const deletedUser = await User.findOneAndDelete({ email: 'hr@manufacturingco.com' });
    if (deletedUser) {
      console.log('🗑️ Deleted existing HR user');
    }
    
    // Create the HR user with correct fields only
    console.log('👤 Creating HR user...');
    const hrUser = new User({
      email: 'hr@manufacturingco.com',
      password: 'password123', // Plain password - will be hashed by pre-save hook
      authProvider: 'local',
      role: 'admin',
      clientId: mfgClient._id,
      isActive: true
    });
    
    console.log('💾 Saving user...');
    await hrUser.save();
    console.log('✅ HR user created successfully!');
    
    // Verify the user was created correctly
    const verifyUser = await User.findOne({ email: 'hr@manufacturingco.com' }).select('+password');
    if (verifyUser && verifyUser.password) {
      console.log('✅ User verification: Password field exists');
      console.log('🔍 Password hash length:', verifyUser.password.length);
      
      // Test password comparison using the model method
      const passwordWorks = await verifyUser.comparePassword('password123');
      console.log('✅ Password verification:', passwordWorks);
      
      if (passwordWorks) {
        console.log('🎉 SUCCESS! User is ready for login');
        console.log('📧 Email: hr@manufacturingco.com');
        console.log('🔑 Password: password123');
        console.log('🏢 Client ID:', verifyUser.clientId);
        console.log('👤 Role:', verifyUser.role);
        console.log('✅ Active:', verifyUser.isActive);
      } else {
        console.log('❌ Password verification failed');
      }
    } else {
      console.log('❌ User verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error creating HR user:', error);
  } finally {
    await mongoose.connection.close();
  }
}

createHRUserFinal();
