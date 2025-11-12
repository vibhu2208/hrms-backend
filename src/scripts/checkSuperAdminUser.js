const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const checkSuperAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Find all super admin users
    const superAdmins = await User.find({ role: 'superadmin' });
    console.log(`\n👑 Found ${superAdmins.length} Super Admin users:`);
    
    superAdmins.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name || user.email}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Internal Role: ${user.internalRole || 'Not set (defaults to super_admin)'}`);
      console.log(`   - Active: ${user.isActive}`);
      console.log(`   - Client ID: ${user.clientId || 'None (Super Admin)'}`);
      console.log(`   - ID: ${user._id}`);
    });

    // Check if there are any users at all
    const totalUsers = await User.countDocuments();
    console.log(`\n📊 Total users in system: ${totalUsers}`);

    // Check for users with different roles
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📈 User role distribution:');
    roleStats.forEach(stat => {
      console.log(`   - ${stat._id}: ${stat.count} users`);
    });

    console.log('\n✅ Super Admin user check completed!');
    
  } catch (error) {
    console.error('❌ Error checking Super Admin users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the check function
checkSuperAdminUser();
