const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const fixEmailCase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb+srv://vaibhavsingh5373:vaibhav5373@hrms.mrkwfvx.mongodb.net/hrms?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Find the user with case-insensitive search
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^vaibhavsingh5373@gmail.com$', 'i') } 
    }).select('+password');

    if (user) {
      console.log('👤 Found user:', user.email);
      console.log('🔑 Current password hash:', user.password);
      
      // Test password with current hash
      const currentMatch = await bcrypt.compare('admin123', user.password);
      console.log('🔐 Current password test:', currentMatch);
      
      // Create a fresh hash and update the user
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash('admin123', salt);
      
      // Update user with correct email case and fresh password hash
      await User.findByIdAndUpdate(user._id, {
        email: 'vaibhavsingh5373@gmail.com', // Ensure lowercase
        password: newHash
      });
      
      console.log('✅ User updated with fresh password hash');
      
      // Verify the update
      const updatedUser = await User.findById(user._id).select('+password');
      const newMatch = await bcrypt.compare('admin123', updatedUser.password);
      console.log('🔐 New password test:', newMatch);
      console.log('📧 Updated email:', updatedUser.email);
      
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

fixEmailCase();
