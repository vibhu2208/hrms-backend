const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    const users = await User.find({}).select('name email role clientId isActive');
    console.log('\n📋 All Users in Database:');
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}`);
    });
    
    console.log('\n🔍 Looking for Manufacturing Co users...');
    const mfgUsers = users.filter(user => user.email.includes('manufacturingco.com'));
    if (mfgUsers.length > 0) {
      console.log('✅ Found Manufacturing Co users:');
      mfgUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    } else {
      console.log('❌ No Manufacturing Co users found');
    }
    
    console.log('\n🔍 Checking for hr@manufacturingco.com specifically...');
    const hrUser = await User.findOne({ email: 'hr@manufacturingco.com' });
    if (hrUser) {
      console.log('✅ Found hr@manufacturingco.com user:', hrUser.name);
    } else {
      console.log('❌ No user found with email hr@manufacturingco.com');
      console.log('💡 You should use: lisa.rodriguez@manufacturingco.com');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkUsers();
