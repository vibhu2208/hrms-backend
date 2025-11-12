const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkDuplicateUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    const email = 'hr@manufacturingco.com';
    
    // Find all users with this email
    const users = await User.find({ email }).select('+password');
    
    console.log(`🔍 Found ${users.length} users with email: ${email}`);
    
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Password exists: ${!!user.password}`);
      console.log(`   Password length: ${user.password?.length || 0}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Updated: ${user.updatedAt}`);
    });
    
    if (users.length > 1) {
      console.log('\n⚠️ Multiple users found! This could cause login issues.');
      console.log('🔧 Removing duplicates...');
      
      // Keep the most recent one, delete others
      const sortedUsers = users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const keepUser = sortedUsers[0];
      const deleteUsers = sortedUsers.slice(1);
      
      for (const user of deleteUsers) {
        await User.findByIdAndDelete(user._id);
        console.log(`🗑️ Deleted duplicate user: ${user._id}`);
      }
      
      console.log(`✅ Kept most recent user: ${keepUser._id}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkDuplicateUsers();
