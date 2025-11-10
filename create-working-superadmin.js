const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const createWorkingSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Delete ALL existing users to start fresh
    await User.deleteMany({});
    console.log('🗑️ Deleted all existing users');

    const email = 'vaibhavsingh5373@gmail.com';
    const password = 'admin123';

    // Create hash using the EXACT same method as the User model pre-save hook
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('🔍 Creating user with:');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('🔑 Hash:', hashedPassword);

    // Test the hash before saving
    const preTestMatch = await bcrypt.compare(password, hashedPassword);
    console.log('🧪 Pre-save hash test:', preTestMatch);

    // Create user object
    const superAdmin = new User({
      email: email,
      password: hashedPassword,
      role: 'superadmin',
      isActive: true,
      authProvider: 'local',
      isFirstLogin: false
    });

    // Save the user
    await superAdmin.save();
    console.log('✅ Superadmin user created and saved');

    // Retrieve the user from database and test
    const savedUser = await User.findOne({ email: email }).select('+password');
    console.log('🔍 Retrieved user hash:', savedUser.password);
    
    const postSaveMatch = await bcrypt.compare(password, savedUser.password);
    console.log('🧪 Post-save hash test:', postSaveMatch);

    const methodMatch = await savedUser.comparePassword(password);
    console.log('🧪 Method test:', methodMatch);

    if (postSaveMatch && methodMatch) {
      console.log('\n🎉 SUCCESS! Superadmin user is working correctly!');
      console.log('📧 Login Email: vaibhavsingh5373@gmail.com');
      console.log('🔑 Login Password: admin123');
    } else {
      console.log('\n❌ Something is still wrong...');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createWorkingSuperAdmin();
