const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Client = require('../models/Client');
require('dotenv').config();

async function createHRUser() {
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
    
    // Check if hr@manufacturingco.com already exists
    const existingUser = await User.findOne({ email: 'hr@manufacturingco.com' });
    if (existingUser) {
      console.log('⚠️ User hr@manufacturingco.com already exists');
      return;
    }
    
    // Create the HR user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const hrUser = new User({
      name: 'HR Department',
      email: 'hr@manufacturingco.com',
      password: hashedPassword,
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
    
    await hrUser.save();
    console.log('✅ Created HR user successfully!');
    console.log('📧 Email: hr@manufacturingco.com');
    console.log('🔑 Password: password123');
    console.log('🏢 Client: Manufacturing Co');
    console.log('👤 Role: admin');
    
  } catch (error) {
    console.error('❌ Error creating HR user:', error);
  } finally {
    await mongoose.connection.close();
  }
}

createHRUser();
