const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
require('dotenv').config();

const updateSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Update the superadmin user
    const result = await User.findOneAndUpdate(
      { email: 'superadmin@hrms.com' },
      {
        $set: {
          email: 'vaibhavsingh5373@gmail.com',
          password: hashedPassword,
          role: 'superadmin',
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    if (result) {
      console.log('✅ Super Admin credentials updated successfully!');
      console.log('📧 Email:', 'vaibhavsingh5373@gmail.com');
      console.log('🔑 Password:', 'admin123');
    } else {
      console.log('❌ Failed to update Super Admin');
    }
  } catch (error) {
    console.error('❌ Error updating Super Admin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

updateSuperAdmin();
