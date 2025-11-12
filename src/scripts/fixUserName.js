const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixUserName() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    const user = await User.findOne({ email: 'hr@manufacturingco.com' });
    if (user) {
      user.name = 'HR Department';
      await user.save();
      console.log('✅ Fixed user name');
      
      // Verify
      const updatedUser = await User.findOne({ email: 'hr@manufacturingco.com' });
      console.log('✅ Updated user name:', updatedUser.name);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixUserName();
