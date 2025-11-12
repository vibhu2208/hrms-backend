const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Client = require('../models/Client');
require('dotenv').config();

async function recreateHRUser() {
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
    
    // Create a fresh password hash
    console.log('🔧 Creating password hash...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    console.log('✅ Password hash created');
    
    // Create the HR user with explicit fields
    const hrUser = new User({
      name: 'HR Department',
      email: 'hr@manufacturingco.com',
      password: hashedPassword,
      authProvider: 'local',
      role: 'admin',
      clientId: mfgClient._id,
      isActive: true,
      permissions: {
        canManageEmployees: true,
        canManagePayroll: true,
        canViewReports: true,
        canManageSettings: true
      }
    });
    
    console.log('💾 Saving user...');
    await hrUser.save();
    console.log('✅ HR user created successfully!');
    
    // Verify the user was created correctly
    const verifyUser = await User.findOne({ email: 'hr@manufacturingco.com' }).select('+password');
    if (verifyUser && verifyUser.password) {
      console.log('✅ User verification: Password field exists');
      
      // Test password comparison
      const passwordWorks = await bcrypt.compare('password123', verifyUser.password);
      console.log('✅ Password verification:', passwordWorks);
      
      if (passwordWorks) {
        console.log('🎉 SUCCESS! User is ready for login');
        console.log('📧 Email: hr@manufacturingco.com');
        console.log('🔑 Password: password123');
      } else {
        console.log('❌ Password verification failed');
      }
    } else {
      console.log('❌ User verification failed: No password field');
    }
    
  } catch (error) {
    console.error('❌ Error recreating HR user:', error);
    if (error.code === 11000) {
      console.log('💡 User might already exist. Try deleting first.');
    }
  } finally {
    await mongoose.connection.close();
  }
}

recreateHRUser();
