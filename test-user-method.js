const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const testUserMethod = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Find the user
    const user = await User.findOne({ email: 'vaibhavsingh5373@gmail.com' }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User found:', user.email);
    console.log('🔑 Password hash:', user.password);
    console.log('🔑 Hash length:', user.password.length);

    const password = 'admin123';
    console.log('📝 Testing password:', password);

    // Test 1: Direct bcrypt compare
    console.log('\n📋 Test 1: Direct bcrypt.compare');
    const directMatch = await bcrypt.compare(password, user.password);
    console.log('🔐 Direct result:', directMatch);

    // Test 2: User model method
    console.log('\n📋 Test 2: User.comparePassword method');
    const methodMatch = await user.comparePassword(password);
    console.log('🔐 Method result:', methodMatch);

    // Test 3: Check if password field is actually selected
    console.log('\n📋 Test 3: Password field check');
    console.log('🔍 Password field exists:', !!user.password);
    console.log('🔍 Password field type:', typeof user.password);
    console.log('🔍 Password starts with $2a$:', user.password.startsWith('$2a$'));

    // Test 4: Create a new user and test immediately
    console.log('\n📋 Test 4: Fresh user test');
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(password, salt);
    
    const testUser = new User({
      email: 'test@example.com',
      password: newHash,
      role: 'employee',
      isActive: true
    });

    // Don't save, just test the method
    const freshMatch = await testUser.comparePassword(password);
    console.log('🔐 Fresh user method result:', freshMatch);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

testUserMethod();
