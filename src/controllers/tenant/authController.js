const jwt = require('jsonwebtoken');
const { getTenantModel } = require('../../utils/tenantModels');
const { TENANT_ROLES } = require('../../config/tenantPermissions');

/**
 * Tenant user login
 * POST /api/tenant/auth/login
 */
const tenantLogin = async (req, res) => {
  try {
    const { email, password, clientId: requestClientId } = req.body;

    // Get clientId from request body, query params, or default tenant
    const clientId = requestClientId || req.query.clientId || '6914486fef016d63d6ac03ce';

    console.log('🔐 Tenant login attempt:', { email, clientId });

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get tenant connection
    const tenantConnectionManager = require('../../config/tenantConnection');
    const tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);

    if (!tenantConnection) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tenant'
      });
    }

    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Tenant user model not available'
      });
    }

    // Find user by email and clientId
    const user = await TenantUser.findOne({ 
      email: email.toLowerCase(),
      clientId 
    }).select('+password').populate('roleId', 'name slug scope permissions');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        roleId: user.roleId,
        roleSlug: user.roleSlug,
        scope: user.scope,
        clientId: user.clientId,
        type: 'tenant_user'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    // Prepare user data for response (exclude sensitive fields)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      roleSlug: user.roleSlug,
      permissions: user.permissions,
      scope: user.scope,
      clientId: user.clientId,
      isFirstLogin: user.isFirstLogin,
      mustChangePassword: user.mustChangePassword,
      lastLogin: user.lastLogin,
      profilePicture: user.profilePicture,
      themePreference: user.themePreference
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token,
        expiresIn: process.env.JWT_EXPIRE || '24h'
      }
    });

  } catch (error) {
    console.error('❌ Tenant login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

/**
 * Change password (first login or regular change)
 * PUT /api/tenant/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.userId;
    const clientId = req.user.clientId;

    // Validate required fields
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation are required'
      });
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match'
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Prevent reusing default password
    if (newPassword === 'password123') {
      return res.status(400).json({
        success: false,
        message: 'Cannot use the default password. Please choose a different password'
      });
    }

    // Get tenant connection
    const tenantConnectionManager = require('../../config/tenantConnection');
    const tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);

    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Tenant user model not available'
      });
    }

    const user = await TenantUser.findOne({ _id: userId, clientId }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // For non-first login, verify current password
    if (!user.isFirstLogin && !user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required'
        });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Update password
    user.password = newPassword;
    user.isFirstLogin = false;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
      data: {
        isFirstLogin: false,
        mustChangePassword: false,
        passwordChangedAt: user.passwordChangedAt
      }
    });

  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 * GET /api/tenant/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;

    // Get tenant connection
    const tenantConnectionManager = require('../../config/tenantConnection');
    const tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);

    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Tenant user model not available'
      });
    }

    const user = await TenantUser.findOne({ _id: userId, clientId })
      .populate('roleId', 'name slug scope permissions description');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          roleName: user.roleName,
          roleSlug: user.roleSlug,
          permissions: user.permissions,
          scope: user.scope,
          clientId: user.clientId,
          employeeId: user.employeeId,
          departmentId: user.departmentId,
          teamId: user.teamId,
          isActive: user.isActive,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword,
          lastLogin: user.lastLogin,
          profilePicture: user.profilePicture,
          themePreference: user.themePreference,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: error.message
    });
  }
};

/**
 * Update user profile
 * PUT /api/tenant/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, profilePicture, themePreference } = req.body;
    const userId = req.user.userId;
    const clientId = req.user.clientId;

    // Get tenant connection
    const tenantConnectionManager = require('../../config/tenantConnection');
    const tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);

    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Tenant user model not available'
      });
    }

    const user = await TenantUser.findOne({ _id: userId, clientId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (name) user.name = name;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (themePreference) user.themePreference = themePreference;

    user.updatedBy = userId;
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture,
          themePreference: user.themePreference
        }
      }
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

module.exports = {
  tenantLogin,
  changePassword,
  getProfile,
  updateProfile
};
