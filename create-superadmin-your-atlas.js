const mongoose = require('mongoose');
const User = require('./src/models/User');

const createSuperAdminYourAtlas = async () => {
  try {
    // Generate random email
    const randomId = Math.random().toString(36).substring(2, 10);
    const email = `superadmin${randomId}@hrms.com`;
    const password = 'admin123';

    console.log('🎲 Creating Random Superadmin in Your Atlas DB:');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('');

    // Connect to YOUR Atlas database
    const mongoUri = 'mongodb+srv://krishnaupadhyay161003_db_user:Ram161003@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Your MongoDB Atlas connected successfully');

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
    console.log('✅ Superadmin created successfully in your Atlas database!');
    
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
      console.log('\n💡 Update your .env file with:');
      console.log('MONGO_URI=mongodb+srv://krishnaupadhyay161003_db_user:Ram161003@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority');
    } else {
      console.log('❌ Password verification failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Authentication failed')) {
      console.log('💡 Please check your Atlas credentials');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createSuperAdminYourAtlas();
