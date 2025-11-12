const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function fixHRUserPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    // Find the HR user
    const hrUser = await User.findOne({ email: 'hr@manufacturingco.com' });
    if (!hrUser) {
      console.log('❌ HR user not found');
      return;
    }
    
    console.log('✅ Found HR user:', hrUser.name);
    console.log('🔍 Current password hash:', hrUser.password);
    
    // Test the current password
    const currentPasswordWorks = await bcrypt.compare('password123', hrUser.password);
    console.log('🔍 Current password works:', currentPasswordWorks);
    
    if (!currentPasswordWorks) {
      console.log('🔧 Fixing password hash...');
      
      // Create a new hash
      const newHashedPassword = await bcrypt.hash('password123', 10);
      console.log('🔍 New password hash:', newHashedPassword);
      
      // Update the user
      hrUser.password = newHashedPassword;
      await hrUser.save();
      
      console.log('✅ Password updated successfully!');
      
      // Test the new password
      const newPasswordWorks = await bcrypt.compare('password123', hrUser.password);
      console.log('✅ New password verification:', newPasswordWorks);
    } else {
      console.log('✅ Password is already correct');
    }
    
    // Also check other users for comparison
    console.log('\n🔍 Checking other users...');
    const otherUser = await User.findOne({ email: 'lisa.rodriguez@manufacturingco.com' });
    if (otherUser) {
      const otherPasswordWorks = await bcrypt.compare('password123', otherUser.password);
      console.log(`🔍 Lisa's password works: ${otherPasswordWorks}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing password:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixHRUserPassword();
