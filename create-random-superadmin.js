const mongoose = require('mongoose');
const User = require('./src/models/User');

const createRandomSuperAdmin = async () => {
  try {
    // Generate random email
    const randomId = Math.random().toString(36).substring(2, 10);
    const email = `superadmin${randomId}@hrms.com`;
    const password = 'admin123';

    console.log('🎲 Generated Random Superadmin Credentials:');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('');

    // Connect to Atlas (using the connection from your server logs)
    const mongoUri = 'mongodb+srv://vaibhavsingh5373:vaibhav5373@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Atlas connected successfully');

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
    console.log('✅ Random superadmin created successfully!');
    
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
      console.log('\n💾 Save these credentials - you\'ll need them to login!');
    } else {
      console.log('❌ Password verification failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // If Atlas fails, try local MongoDB
    if (error.message.includes('Authentication failed') || error.message.includes('ENOTFOUND')) {
      console.log('\n🔄 Atlas failed, trying local MongoDB...');
      
      try {
        await mongoose.disconnect();
        await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log('✅ Local MongoDB connected');

        const randomId2 = Math.random().toString(36).substring(2, 10);
        const localEmail = `superadmin${randomId2}@hrms.com`;
        
        const localSuperAdmin = new User({
          email: localEmail,
          password: password,
          role: 'superadmin',
          isActive: true,
          authProvider: 'local',
          isFirstLogin: false
        });

        await localSuperAdmin.save();
        console.log('✅ Local superadmin created successfully!');
        
        console.log('\n🎉 SUCCESS! Your new superadmin login credentials:');
        console.log('═══════════════════════════════════════════════');
        console.log('📧 EMAIL:', localEmail);
        console.log('🔑 PASSWORD:', password);
        console.log('═══════════════════════════════════════════════');
        
      } catch (localError) {
        console.error('❌ Local MongoDB also failed:', localError.message);
      }
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

createRandomSuperAdmin();
