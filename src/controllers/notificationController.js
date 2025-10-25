const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const { isRead, type, priority } = req.query;
    let query = { recipient: req.user.id };

    if (isRead !== undefined) query.isRead = isRead === 'true';
    if (type) query.type = type;
    if (priority) query.priority = priority;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user.id, 
      isRead: false 
    });

    res.status(200).json({ 
      success: true, 
      count: notifications.length, 
      unreadCount,
      data: notifications 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    notification.isRead = true;
    notification.readAt = Date.now();
    await notification.save();

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true, readAt: Date.now() }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await notification.deleteOne();
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to create notifications (used by other controllers)
exports.createNotification = async (data) => {
  try {
    return await Notification.create(data);
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};
