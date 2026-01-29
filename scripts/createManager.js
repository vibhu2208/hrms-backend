const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const createManager = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms-spc', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');

    // Check if manager already exists
    const existingManager = await User.findOne({ email: 'manager@spchrms.com' });
    if (existingManager) {
      console.log('✅ Manager user already exists');
      console.log('📧 Email: manager@spchrms.com');
      console.log('🔑 Password: manager123');
      console.log('👤 Role: manager');
      return;
    }

    // Create manager user
    const manager = new User({
      email: 'manager@spchrms.com',
      password: 'manager123',
      role: 'manager',
      firstName: 'John',
      lastName: 'Manager',
      isActive: true,
      isFirstLogin: false,
      mustChangePassword: false
    });

    await manager.save();

    console.log('✅ Manager user created successfully!');
    console.log('📧 Email: manager@spchrms.com');
    console.log('🔑 Password: manager123');
    console.log('👤 Role: manager');
    console.log('🌐 Access URL: http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error creating manager:', error);
  } finally {
    await mongoose.disconnect();
  }
};

createManager();
