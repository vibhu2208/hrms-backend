const mongoose = require('mongoose');

async function checkManager() {
  try {
    // Connect directly to tenant database using the connection string from .env
    await mongoose.connect('mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_67891af8c2e4b4d4e8d9e5f9?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to tenant database');

    // Define a simple user schema to check
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema);

    // Find manager with email vibhu2208@gmail.com
    const manager = await User.findOne({ email: 'vibhu2208@gmail.com' });
    
    if (manager) {
      console.log('✅ Manager found!');
      console.log('📧 Email:', manager.email);
      console.log('🆔 User ID:', manager._id);
      console.log('👤 Name:', manager.firstName + ' ' + manager.lastName);
      console.log('🔑 Role:', manager.role);
      console.log('✅ Status:', manager.isActive ? 'Active' : 'Inactive');
      console.log('🔐 Password is hashed in database');
      console.log('🌐 Login URL: http://localhost:5173/login');
    } else {
      console.log('❌ Manager with email vibhu2208@gmail.com not found');
      
      // Show all users to help debug
      const allUsers = await User.find({}).select('email role firstName lastName isActive');
      console.log('📋 All users in tenant:');
      allUsers.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkManager();
