const mongoose = require('mongoose');
const User = require('./src/models/User');

const checkAllUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Find all users
    const users = await User.find({}).select('+password');
    console.log(`📊 Total users found: ${users.length}\n`);
    
    users.forEach((user, index) => {
      console.log(`👤 User ${index + 1}:`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`🎭 Role: ${user.role}`);
      console.log(`✅ Active: ${user.isActive}`);
      console.log(`🔑 Has Password: ${!!user.password}`);
      console.log(`🆔 ID: ${user._id}`);
      console.log('─'.repeat(50));
    });

    // Check specifically for our target email
    const targetUser = await User.findOne({ email: 'vaibhavsingh5373@gmail.com' }).select('+password');
    if (targetUser) {
      console.log('\n🎯 Target user details:');
      console.log(`📧 Email: ${targetUser.email}`);
      console.log(`🎭 Role: ${targetUser.role}`);
      console.log(`✅ Active: ${targetUser.isActive}`);
      console.log(`🔑 Password Hash: ${targetUser.password}`);
    }

    // Check for old superadmin email
    const oldUser = await User.findOne({ email: 'superadmin@hrms.com' }).select('+password');
    if (oldUser) {
      console.log('\n⚠️  Old superadmin user still exists:');
      console.log(`📧 Email: ${oldUser.email}`);
      console.log(`🎭 Role: ${oldUser.role}`);
      console.log(`✅ Active: ${oldUser.isActive}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

checkAllUsers();
