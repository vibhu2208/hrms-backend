const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function testLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    const email = 'hr@manufacturingco.com';
    const password = 'password123';
    
    console.log('🔍 Testing login for:', email);
    
    // Find user (same as login controller)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.name);
    console.log('🔍 User role:', user.role);
    console.log('🔍 User active:', user.isActive);
    console.log('🔍 Password hash exists:', !!user.password);
    console.log('🔍 Password hash length:', user.password?.length);
    
    // Test password comparison (same as login controller)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔍 Password comparison result:', isPasswordValid);
    
    // Also test using model method
    const isPasswordValidMethod = await user.comparePassword(password);
    console.log('🔍 Model method result:', isPasswordValidMethod);
    
    if (isPasswordValid) {
      console.log('🎉 LOGIN SHOULD WORK!');
      console.log('📧 Email: hr@manufacturingco.com');
      console.log('🔑 Password: password123');
    } else {
      console.log('❌ Login would fail - password mismatch');
    }
    
  } catch (error) {
    console.error('❌ Error testing login:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testLogin();
