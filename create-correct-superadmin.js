const mongoose = require('mongoose');
const User = require('./src/models/User');

const createCorrectSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Delete existing superadmin users
    await User.deleteMany({ role: 'superadmin' });
    console.log('🗑️ Deleted existing superadmin users');

    const email = 'vaibhavsingh5373@gmail.com';
    const password = 'admin123';

    console.log('🔍 Creating user with PLAIN TEXT password:');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);

    // Create user with PLAIN TEXT password - let the pre-save hook handle hashing
    const superAdmin = new User({
      email: email,
      password: password, // PLAIN TEXT - the pre-save hook will hash it
      role: 'superadmin',
      isActive: true,
      authProvider: 'local',
      isFirstLogin: false
    });

    // Save the user (pre-save hook will hash the password)
    await superAdmin.save();
    console.log('✅ Superadmin user created and saved');

    // Retrieve the user from database and test
    const savedUser = await User.findOne({ email: email }).select('+password');
    console.log('🔍 Retrieved user hash:', savedUser.password);
    console.log('🔍 Hash starts with $2a$:', savedUser.password.startsWith('$2a$'));
    
    const methodMatch = await savedUser.comparePassword(password);
    console.log('🧪 Method test:', methodMatch);

    if (methodMatch) {
      console.log('\n🎉 SUCCESS! Superadmin user is working correctly!');
      console.log('📧 Login Email: vaibhavsingh5373@gmail.com');
      console.log('🔑 Login Password: admin123');
      console.log('\n💡 The issue was double-hashing - the pre-save hook was hashing an already-hashed password!');
    } else {
      console.log('\n❌ Still not working...');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createCorrectSuperAdmin();
