const User = require('../models/User');

/**
 * Get user theme preference
 * @route GET /api/user/theme
 * @access Private
 */
exports.getThemePreference = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('themePreference');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        themePreference: user.themePreference || 'dark'
      }
    });
  } catch (error) {
    console.error('Error fetching theme preference:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch theme preference'
    });
  }
};

/**
 * Update user theme preference
 * @route PUT /api/user/theme
 * @access Private
 */
exports.updateThemePreference = async (req, res) => {
  try {
    const { themePreference } = req.body;

    if (!themePreference) {
      return res.status(400).json({
        success: false,
        message: 'Theme preference is required'
      });
    }

    const validThemes = ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red', 'teal', 'grey', 'custom'];
    if (!validThemes.includes(themePreference)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theme preference'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { themePreference },
      { new: true, runValidators: true }
    ).select('themePreference email role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Theme preference updated successfully',
      data: {
        themePreference: user.themePreference
      }
    });
  } catch (error) {
    console.error('Error updating theme preference:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update theme preference'
    });
  }
};

/**
 * Get user profile
 * @route GET /api/user/profile
 * @access Private
 */
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('employeeId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user profile'
    });
  }
};

/**
 * Get all users (Admin only)
 * @route GET /api/user/all
 * @access Private/Admin
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate({
        path: 'employeeId',
        select: 'firstName lastName employeeCode email phone department position'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch users'
    });
  }
};
