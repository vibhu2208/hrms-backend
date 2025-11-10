const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const debugLogin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    const email = 'vaibhavsingh5373@gmail.com';
    const password = 'admin123';

    console.log('\n🔍 Debugging login process...');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);

    // Step 1: Find user
    console.log('\n📋 Step 1: Finding user...');
    const user = await User.findOne({ email }).select('+password').populate('employeeId');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found');
    console.log('🆔 User ID:', user._id);
    console.log('📧 User Email:', user.email);
    console.log('🎭 User Role:', user.role);
    console.log('✅ User Active:', user.isActive);
    console.log('🔑 Password Hash Present:', !!user.password);
    console.log('🔑 Password Hash Length:', user.password ? user.password.length : 0);

    // Step 2: Test password comparison
    console.log('\n📋 Step 2: Testing password comparison...');
    
    // Direct bcrypt comparison
    const directMatch = await bcrypt.compare(password, user.password);
    console.log('🔐 Direct bcrypt.compare result:', directMatch);
    
    // Using model method
    const modelMatch = await user.comparePassword(password);
    console.log('🔐 Model comparePassword result:', modelMatch);

    // Step 3: Test with wrong password
    console.log('\n📋 Step 3: Testing with wrong password...');
    const wrongMatch = await user.comparePassword('wrongpassword');
    console.log('🔐 Wrong password result:', wrongMatch);

    // Step 4: Check if password was hashed correctly
    console.log('\n📋 Step 4: Password hash analysis...');
    console.log('🔑 Hash starts with $2a$ (bcrypt):', user.password.startsWith('$2a$'));
    console.log('🔑 Hash format looks correct:', /^\$2[aby]\$\d+\$.{53}$/.test(user.password));

    // Step 5: Test creating a new hash and comparing
    console.log('\n📋 Step 5: Creating fresh hash for comparison...');
    const salt = await bcrypt.genSalt(10);
    const freshHash = await bcrypt.hash(password, salt);
    const freshMatch = await bcrypt.compare(password, freshHash);
    console.log('🔐 Fresh hash comparison:', freshMatch);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

debugLogin();
