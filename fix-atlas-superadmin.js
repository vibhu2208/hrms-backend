const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const fixAtlasSuperAdmin = async () => {
  try {
    // Connect to the SAME Atlas database your server uses
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://vaibhavsingh5373:vaibhav5373@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Atlas connected successfully');

    // Delete existing superadmin users
    const deleteResult = await User.deleteMany({ role: 'superadmin' });
    console.log('🗑️ Deleted', deleteResult.deletedCount, 'existing superadmin users');

    const email = 'vaibhavsingh5373@gmail.com';
    const password = 'admin123';

    console.log('🔍 Creating fresh superadmin user:');
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
    console.log('✅ Superadmin user created in Atlas database');

    // Test the user immediately
    const savedUser = await User.findOne({ email: email }).select('+password');
    const methodMatch = await savedUser.comparePassword(password);
    console.log('🧪 Password verification test:', methodMatch);

    if (methodMatch) {
      console.log('\n🎉 SUCCESS! Atlas superadmin user is working correctly!');
      console.log('📧 Login Email: vaibhavsingh5373@gmail.com');
      console.log('🔑 Login Password: admin123');
      console.log('\n🚀 Try logging in now - it should work!');
    } else {
      console.log('\n❌ Still not working in Atlas...');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (error.message.includes('Authentication failed')) {
      console.log('💡 Tip: Check your MongoDB Atlas credentials in the .env file');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

fixAtlasSuperAdmin();
