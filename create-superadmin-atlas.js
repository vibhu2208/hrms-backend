const mongoose = require('mongoose');
const User = require('./src/models/User');

const createSuperAdminAtlas = async () => {
  try {
    // Use the same connection string your server is trying to use
    // Replace with your actual Atlas credentials
    const mongoUri = 'mongodb+srv://vaibhavsingh5373:vaibhav5373@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Atlas connected successfully');

    // Create superadmin with PLAIN TEXT password
    const superAdmin = new User({
      email: 'vaibhavsingh5373@gmail.com',
      password: 'admin123', // Plain text - pre-save hook will hash it
      role: 'superadmin',
      isActive: true,
      authProvider: 'local',
      isFirstLogin: false
    });

    await superAdmin.save();
    console.log('✅ Superadmin created successfully in Atlas!');
    
    // Test the user
    const testUser = await User.findOne({ email: 'vaibhavsingh5373@gmail.com' }).select('+password');
    const isMatch = await testUser.comparePassword('admin123');
    console.log('🧪 Password test:', isMatch);
    
    if (isMatch) {
      console.log('\n🎉 SUCCESS! You can now login with:');
      console.log('📧 Email: vaibhavsingh5373@gmail.com');
      console.log('🔑 Password: admin123');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Authentication failed')) {
      console.log('\n💡 Please update the MongoDB Atlas credentials in this script');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createSuperAdminAtlas();
