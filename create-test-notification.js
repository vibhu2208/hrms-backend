const mongoose = require('mongoose');
const Notification = require('./src/models/Notification');
const User = require('./src/models/User');

async function createTestNotification() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');

    // Find a user to create notification for
    const user = await User.findOne({ role: { $ne: 'super_admin' } }).limit(1);

    if (!user) {
      console.log('No regular user found. Creating notification for first user...');
      const anyUser = await User.findOne();
      if (!anyUser) {
        console.log('No users found in database');
        return;
      }

      const testNotification = await Notification.create({
        recipient: anyUser._id,
        type: 'general',
        title: 'Test Notification',
        message: 'This is a test notification to verify the notification system is working.',
        priority: 'medium',
        actionUrl: '/dashboard'
      });

      console.log('Test notification created:', testNotification);
    } else {
      const testNotification = await Notification.create({
        recipient: user._id,
        type: 'general',
        title: 'Test Notification',
        message: 'This is a test notification to verify the notification system is working.',
        priority: 'medium',
        actionUrl: '/dashboard'
      });

      console.log('Test notification created for user:', user.email);
      console.log('Notification details:', testNotification);
    }

    console.log('Test notification creation completed');
  } catch (error) {
    console.error('Error creating test notification:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createTestNotification();