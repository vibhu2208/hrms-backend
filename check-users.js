const mongoose = require('mongoose');
const User = require('./src/models/User');

const checkUsers = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    const users = await User.find({ role: 'superadmin' }).select('email role internalRole isActive');
    console.log('Super Admin Users:');
    users.forEach(user => {
      console.log(`- ${user.email}: role=${user.role}, internalRole=${user.internalRole}, active=${user.isActive}`);
    });
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
};

checkUsers();
