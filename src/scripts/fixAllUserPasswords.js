const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixAllUserPasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    // Get all users that are not superadmin
    const users = await User.find({ 
      role: { $ne: 'superadmin' },
      email: { $regex: /@(techcorp|greenenergy|healthcareplus|manufacturingco|startuphub)\.com$/ }
    }).select('+password');
    
    console.log(`🔍 Found ${users.length} client users to fix:`);
    
    for (const user of users) {
      console.log(`\n👤 Fixing user: ${user.email}`);
      
      try {
        // Set password to plain text - the pre-save hook will hash it
        user.password = 'password123';
        await user.save();
        
        // Verify the password works
        const updatedUser = await User.findById(user._id).select('+password');
        const passwordWorks = await updatedUser.comparePassword('password123');
        
        if (passwordWorks) {
          console.log(`✅ Password fixed for: ${user.email}`);
        } else {
          console.log(`❌ Password fix failed for: ${user.email}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing password for ${user.email}:`, error.message);
      }
    }
    
    console.log('\n🎉 Password fix completed!');
    console.log('\n📋 All client users now have password: password123');
    console.log('\n🔑 Test these login credentials:');
    
    const testUsers = await User.find({ 
      role: { $ne: 'superadmin' },
      email: { $regex: /@(techcorp|greenenergy|healthcareplus|manufacturingco|startuphub)\.com$/ }
    });
    
    testUsers.forEach(user => {
      console.log(`   - ${user.email} / password123`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing passwords:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixAllUserPasswords();
