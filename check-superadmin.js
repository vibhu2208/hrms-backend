const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const checkSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Find all superadmin users
    const superAdmins = await User.find({ role: 'superadmin' }).select('+password');
    console.log('📊 Found superadmin users:', superAdmins.length);
    
    superAdmins.forEach((user, index) => {
      console.log(`\n👤 Super Admin ${index + 1}:`);
      console.log('📧 Email:', user.email);
      console.log('🔑 Password Hash:', user.password ? 'Present' : 'Missing');
      console.log('🎭 Role:', user.role);
      console.log('✅ Active:', user.isActive);
      console.log('🆔 ID:', user._id);
    });

    // Test password verification for the new email
    const testUser = await User.findOne({ email: 'vaibhavsingh5373@gmail.com' }).select('+password');
    if (testUser) {
      console.log('\n🧪 Testing password verification...');
      const isMatch = await bcrypt.compare('admin123', testUser.password);
      console.log('🔐 Password match:', isMatch);
    } else {
      console.log('\n❌ User with email vaibhavsingh5373@gmail.com not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

checkSuperAdmin();
