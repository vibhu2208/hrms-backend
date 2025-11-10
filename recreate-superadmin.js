const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const recreateSuperAdmin = async () => {
  try {
    // Connect to local MongoDB (same as your server is using)
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Delete any existing superadmin users
    await User.deleteMany({ role: 'superadmin' });
    console.log('🗑️ Deleted existing superadmin users');

    // Create fresh superadmin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const superAdmin = new User({
      email: 'vaibhavsingh5373@gmail.com',
      password: hashedPassword,
      role: 'superadmin',
      isActive: true,
      authProvider: 'local'
    });

    await superAdmin.save();
    console.log('✅ Fresh superadmin user created');
    console.log('📧 Email: vaibhavsingh5373@gmail.com');
    console.log('🔑 Password: admin123');

    // Test the password immediately
    const testUser = await User.findOne({ email: 'vaibhavsingh5373@gmail.com' }).select('+password');
    const isMatch = await bcrypt.compare('admin123', testUser.password);
    console.log('🧪 Password test result:', isMatch);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

recreateSuperAdmin();
