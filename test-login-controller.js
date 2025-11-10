const mongoose = require('mongoose');
const User = require('./src/models/User');

const testLoginController = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Simulate the exact login controller logic
    const email = 'vaibhavsingh5373@gmail.com';
    const password = 'admin123';

    console.log('\n🔍 Simulating login controller logic...');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);

    // Step 1: Validate email & password (like controller does)
    if (!email || !password) {
      console.log('❌ Email or password missing');
      return;
    }
    console.log('✅ Email and password provided');

    // Step 2: Check for user (exactly like controller)
    console.log('\n📋 Finding user with populate...');
    const user = await User.findOne({ email }).select('+password').populate('employeeId');

    if (!user) {
      console.log('❌ User not found');
      return;
    }
    console.log('✅ User found');
    console.log('🆔 User ID:', user._id);
    console.log('📧 User Email:', user.email);
    console.log('🎭 User Role:', user.role);
    console.log('🔑 Password field present:', !!user.password);

    // Step 3: Check if password matches (exactly like controller)
    console.log('\n📋 Checking password match...');
    const isMatch = await user.comparePassword(password);
    console.log('🔐 Password match result:', isMatch);

    if (!isMatch) {
      console.log('❌ Password does not match - this is why login fails!');
      
      // Let's debug further
      console.log('\n🔍 Additional debugging...');
      console.log('🔑 Stored hash:', user.password);
      console.log('🔑 Input password:', password);
      
      // Try manual bcrypt comparison
      const bcrypt = require('bcryptjs');
      const manualMatch = await bcrypt.compare(password, user.password);
      console.log('🔐 Manual bcrypt compare:', manualMatch);
      
      return;
    }
    console.log('✅ Password matches');

    // Step 4: Check if user is active (like controller)
    if (!user.isActive) {
      console.log('❌ User is not active');
      return;
    }
    console.log('✅ User is active');

    console.log('\n🎉 All checks passed - login should succeed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

testLoginController();
