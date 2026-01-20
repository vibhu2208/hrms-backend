const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Email service (assuming it exists)
const sendEmail = require('../services/emailService');

/**
 * Get user theme preference
 * @route GET /api/user/theme
 * @access Private
 */
exports.getThemePreference = async (req, res) => {
  try {
    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const user = await TenantUser.findById(req.user.id).select('themePreference');
    
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

    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const user = await TenantUser.findByIdAndUpdate(
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
    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const user = await TenantUser.findById(req.user.id)
      .select('-password')
      .populate('departmentId');

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
 * @desc Get all users for current tenant (Admin only)
 * @route GET /api/user/all
 * @access Private/Admin
 */
exports.getAllUsers = async (req, res) => {
  try {
    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Query users from tenant database
    const users = await TenantUser.find()
      .select('-password')
      .populate({
        path: 'departmentId',
        select: 'name code'
      })
      .sort({ createdAt: -1 });

    console.log(`📋 Found ${users.length} users for company ${req.tenant.companyId}`);

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

/**
 * @desc Create new user (Admin only)
 * @route POST /api/user/create
 * @access Private/Admin
 */
exports.createUser = async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      role,
      phone,
      departmentId
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, first name, last name, and role are required'
      });
    }

    // Validate role
    const validRoles = ['hr', 'admin', 'company_admin', 'employee'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: hr, admin, company_admin, employee'
      });
    }

    // Only company_admin can create admin/company_admin users
    if ((role === 'admin' || role === 'company_admin') && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators can create admin users'
      });
    }

    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Check if user already exists
    const existingUser = await TenantUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // Create user in tenant database
    const newUser = new TenantUser({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone,
      departmentId,
      companyId: req.tenant.companyId,
      isFirstLogin: true,
      mustChangePassword: true,
      isActive: true
    });

    const savedUser = await newUser.save();

    // Send welcome email with credentials
    try {
      const emailData = {
        to: email,
        subject: `Welcome to ${req.tenant.companyName} - Your Account Credentials`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${req.tenant.companyName}!</h2>
            <p>Your account has been created successfully.</p>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Your Login Credentials:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>⚠️ Important:</strong> Please change your password on first login for security.</p>
            </div>

            <p><strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL || 'http://localhost:8080/login/spc-management'}">${process.env.FRONTEND_URL || 'http://localhost:8080/login/spc-management'}</a></p>

            <p>If you have any questions, please contact your administrator.</p>

            <p>Best regards,<br>${req.tenant.companyName} Team</p>
          </div>
        `
      };

      await sendEmail(emailData);
      console.log(`📧 Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the user creation if email fails
    }

    // Return user data (without password)
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    console.log(`👤 New user created: ${email} (${role}) by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully. Welcome email sent with credentials.',
      data: userResponse,
      tempPassword: tempPassword // Only for testing - remove in production
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create user'
    });
  }
};
