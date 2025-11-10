const mongoose = require('mongoose');
const User = require('./src/models/User');

const createWorkingSuperAdmin = async () => {
  try {
    // Generate random email
    const randomId = Math.random().toString(36).substring(2, 10);
    const email = `superadmin${randomId}@hrms.com`;
    const password = 'admin123';

    console.log('🎲 Creating Random Superadmin:');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('');

    // Connect to local MongoDB first
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Local MongoDB connected successfully');

    // Delete any existing superadmin users to avoid conflicts
    const deleteResult = await User.deleteMany({ role: 'superadmin' });
    console.log('🗑️ Deleted', deleteResult.deletedCount, 'existing superadmin users');

    // Create superadmin with PLAIN TEXT password
    const superAdmin = new User({
      email: email,
      password: password, // Plain text - pre-save hook will hash it
      role: 'superadmin',
      isActive: true,
      authProvider: 'local',
      isFirstLogin: false
    });

    await superAdmin.save();
    console.log('✅ Superadmin created successfully in local database!');
    
    // Test the user immediately
    const testUser = await User.findOne({ email: email }).select('+password');
    const isMatch = await testUser.comparePassword(password);
    console.log('🧪 Password verification test:', isMatch);
    
    if (isMatch) {
      console.log('\n🎉 SUCCESS! Your new superadmin login credentials:');
      console.log('═══════════════════════════════════════════════');
      console.log('📧 EMAIL:', email);
      console.log('🔑 PASSWORD:', password);
      console.log('═══════════════════════════════════════════════');
      console.log('\n📝 COPY THESE CREDENTIALS:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log('\n💡 Make sure your server is using local MongoDB:');
      console.log('   MONGO_URI=mongodb://127.0.0.1:27017/hrms');
    } else {
      console.log('❌ Password verification failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createWorkingSuperAdmin();
