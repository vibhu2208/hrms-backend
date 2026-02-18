const User = require('../models/User');
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const { generateToken, generateRefreshToken, createRefreshTokenExpiry, verifyRefreshToken } = require('../utils/jwt');
const { OAuth2Client } = require('google-auth-library');
const { getTenantConnection } = require('../config/database.config');
const emailService = require('../config/email.config');
const { logSecurityEvent, logAuthEvent } = require('../utils/logger');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, password, role, employeeId, firstName, lastName, isActive } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // If employeeId is provided, verify employee exists
    if (employeeId) {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
    }

    // Create user
    const user = await User.create({
      email,
      password,
      role: role || 'employee',
      employeeId,
      firstName,
      lastName,
      isActive: isActive !== undefined ? isActive : true
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          userId: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  let tenantConnection = null;
  
  try {
    console.log('🔍 Login attempt:', req.body);
    const { email, password, companyId } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Step 1: Check if this is a super admin (in hrms_global)
    console.log('🔍 Checking if user is a super admin...');
    const { getSuperAdmin, getCompanyRegistry } = require('../models/global');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    let userCompany = null;
    
    try {
      const SuperAdmin = await getSuperAdmin();
      const superAdmin = await SuperAdmin.findOne({ email }).select('+password');
      
      if (superAdmin) {
        console.log('✅ Super admin found');
        user = superAdmin;
        isTenantUser = false;
      }
    } catch (err) {
      console.log('⚠️  Error checking super admin:', err.message);
    }
    
    // Step 2: If not super admin and companyId provided, check specific company database
    if (!user && companyId) {
      console.log(`🔍 Checking specific company database: ${companyId}`);
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          console.log(`🏢 Authenticating against: ${company.companyName} (${company.tenantDatabaseName})`);
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ email }).select('+password');
          
          if (tenantUser) {
            console.log(`✅ User found in ${company.companyName}`);
            user = tenantUser;
            isTenantUser = true;
            userCompany = company;
          } else {
            // User not found in the selected company
            console.log(`❌ User ${email} not found in company ${company.companyName}`);
            if (tenantConnection) await tenantConnection.close();
            return res.status(401).json({
              success: false,
              message: `User not found in ${company.companyName}. Please select the correct company.`
            });
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
          if (tenantConnection) await tenantConnection.close();
          return res.status(500).json({
            success: false,
            message: 'Error accessing company database'
          });
        }
      } else {
        console.log('⚠️  Company not found or inactive');
        return res.status(404).json({
          success: false,
          message: 'Company not found or inactive'
        });
      }
    }
    
    // Step 3: If still not found and no companyId, check all companies (fallback)
    if (!user && !companyId) {
      console.log('🔍 Checking all company databases...');
      const CompanyRegistry = await getCompanyRegistry();
      
      const companies = await CompanyRegistry.find({
        status: 'active',
        databaseStatus: 'active'
      });
      
      console.log(`📊 Found ${companies.length} active companies`);
      
      for (const company of companies) {
        try {
          console.log(`🔍 Checking company: ${company.companyName}`);
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ email }).select('+password');
          
          if (tenantUser) {
            console.log(`✅ User found in ${company.companyName}`);
            user = tenantUser;
            isTenantUser = true;
            userCompany = company;
            break;
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
          continue;
        }
      }
    }

    if (!user) {
      console.log('❌ User not found for email:', email);
      // Don't close connection immediately - let it be reused
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      console.log(`🔒 Account locked for ${user.email}. ${lockTimeRemaining} minutes remaining`);
      // Don't close connection immediately
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${lockTimeRemaining} minutes.`,
        lockoutRemaining: lockTimeRemaining
      });
    }

    // Check if password matches
    console.log('🔍 Comparing password for user:', user.email);
    console.log('🔍 Password provided:', password);
    console.log('🔍 User has password field:', !!user.password);
    const isMatch = await user.comparePassword(password);
    console.log('🔍 Password match result:', isMatch);

    if (!isMatch) {
      console.log('❌ Password mismatch for user:', user.email);
      // Increment login attempts
      await user.incLoginAttempts();
      // Don't close connection immediately
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      // Don't close connection immediately
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Update last login and first login flag
    user.lastLogin = Date.now();
    
    // Check if this is first login
    const isFirstLogin = user.isFirstLogin;
    if (isFirstLogin) {
      user.isFirstLogin = false;
    }
    
    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    
    // Save user changes BEFORE closing connection
    try {
      await user.save();
      console.log('✅ User data saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving user data:', saveError.message);
      return res.status(500).json({
        success: false,
        message: 'Error updating user data'
      });
    }

    // Close tenant connection if used (AFTER save operation) - but delay it
    if (tenantConnection) {
      // Use setTimeout to close connection after response is sent
      setTimeout(async () => {
        try {
          await tenantConnection.close();
          console.log('🔌 Tenant connection closed');
        } catch (closeError) {
          console.error('⚠️  Error closing tenant connection:', closeError.message);
        }
      }, 1000);
    }

    // Generate token with additional company info for tenant users
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    
    if (isTenantUser && userCompany) {
      tokenPayload.companyId = userCompany.companyId;
      tokenPayload.companyCode = userCompany.companyCode;
      tokenPayload.tenantDatabaseName = userCompany.tenantDatabaseName;
    }

    const token = generateToken(user._id, tokenPayload);

    // Generate refresh token
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiry = createRefreshTokenExpiry();
    
    // Add refresh token to user record
    await user.addRefreshToken(refreshToken, refreshTokenExpiry, {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          userId: user._id,
          email: user.email,
          role: user.role,
          employee: user.employeeId,
          isFirstLogin: isFirstLogin,
          mustChangePassword: user.mustChangePassword,
          themePreference: user.themePreference || 'dark',
          firstName: user.firstName,
          lastName: user.lastName,
          // Add company info for tenant users
          ...(isTenantUser && userCompany ? {
            companyId: userCompany.companyId,
            companyName: userCompany.companyName,
            companyCode: userCompany.companyCode
          } : {})
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    if (tenantConnection) {
      await tenantConnection.close();
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('employeeId');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password and clear mustChangePassword flag
    user.password = newPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = Date.now();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Admin reset user password
// @route   PUT /api/auth/admin/reset-password/:userId
// @access  Private/Admin
exports.adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, mustChangePassword } = req.body;

    console.log('🔄 Admin reset password request for user ID:', userId);

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Check if tenant connection exists
    if (!req.tenant || !req.tenant.connection) {
      console.error('❌ No tenant connection found');
      return res.status(400).json({
        success: false,
        message: 'Tenant connection not found'
      });
    }

    const tenantConnection = req.tenant.connection;
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    console.log('✅ Tenant connection established');

    // Find the user to reset password (must select password field)
    const user = await TenantUser.findById(userId).select('+password');

    if (!user) {
      console.error('❌ User not found with ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User found:', user.email);

    // Update password
    user.password = newPassword;
    user.mustChangePassword = mustChangePassword !== undefined ? mustChangePassword : true;
    user.passwordChangedAt = Date.now();
    user.isFirstLogin = true;
    
    console.log('💾 Saving user with new password...');
    await user.save();
    console.log('✅ Password reset successful');

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${user.email}`,
      data: {
        userId: user._id,
        email: user.email,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: `Failed to reset password: ${error.message}`
    });
  }
};

// @desc    Google OAuth Login
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    // Verify Google token
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists with this email
    let user = await User.findOne({ email }).populate('employeeId');

    if (!user) {
      // User doesn't exist - reject login
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please contact your administrator to create an account.'
      });
    }

    // User exists - update Google info if needed
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = 'google';
      user.profilePicture = picture;
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    const isFirstLogin = user.isFirstLogin;
    if (isFirstLogin) {
      user.isFirstLogin = false;
    }
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          employee: user.employeeId,
          isFirstLogin: isFirstLogin,
          mustChangePassword: user.mustChangePassword,
          themePreference: user.themePreference || 'dark',
          profilePicture: user.profilePicture
        },
        token
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Google login failed'
    });
  }
};

// @desc    Get list of active companies for login selection
// @route   GET /api/auth/companies
// @access  Public
exports.getActiveCompanies = async (req, res) => {
  try {
    // Connect to global database
    const { connectGlobalDB } = require('../config/database.config');
    const globalConnection = await connectGlobalDB();
    
    // Get CompanyRegistry model
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);
    
    // Fetch companies from CompanyRegistry
    const registryCompanies = await CompanyRegistry.find({
      status: 'active'
    })
    .select('companyId companyName companyCode tenantDatabaseName status subscription')
    .sort({ companyName: 1 })
    .lean();

    res.status(200).json({
      success: true,
      data: registryCompanies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies'
    });
  }
};

// @desc    Unlock user account (admin only)
// @route   POST /api/auth/unlock-account
// @access  Private/Admin
exports.unlockAccount = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { email, companyId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    console.log('🔓 Unlock account request:', { email, companyId });

    // Check if this is a super admin
    const { getSuperAdmin } = require('../models/global');
    const SuperAdmin = await getSuperAdmin();
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    
    // Try super admin first
    try {
      const superAdmin = await SuperAdmin.findOne({ email });
      if (superAdmin) {
        user = superAdmin;
        isTenantUser = false;
        console.log('✅ Found super admin to unlock:', email);
      }
    } catch (err) {
      console.log('⚠️  Error checking super admin:', err.message);
    }
    
    // If not super admin and companyId provided, check tenant
    if (!user && companyId) {
      const { getCompanyRegistry } = require('../models/global');
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ email });
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
            console.log(`✅ Found tenant user to unlock: ${email} in ${company.companyName}`);
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking tenant:`, tenantError.message);
        }
      }
    }
    
    if (!user) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Reset login attempts
    await user.resetLoginAttempts();
    
    if (tenantConnection) await tenantConnection.close();
    
    res.status(200).json({
      success: true,
      message: `Account for ${email} has been successfully unlocked`,
      data: {
        email: user.email,
        role: user.role,
        unlockedAt: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error unlocking account:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: 'Error unlocking account'
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { refreshToken, companyId } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    console.log('🔄 Refresh token request:', { refreshToken: refreshToken.substring(0, 20) + '...', companyId });

    const { getSuperAdmin, getCompanyRegistry } = require('../models/global');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    let userCompany = null;
    
    // Try super admin first
    try {
      const SuperAdmin = await getSuperAdmin();
      const superAdmin = await SuperAdmin.findOne({ 'refreshTokens.token': refreshToken });
      
      if (superAdmin) {
        const validToken = await superAdmin.findValidRefreshToken(refreshToken);
        if (validToken) {
          console.log('✅ Valid refresh token found for super admin');
          user = superAdmin;
          isTenantUser = false;
        }
      }
    } catch (err) {
      console.log('⚠️  Error checking super admin refresh token:', err.message);
    }
    
    // If not super admin and companyId provided, check specific company database
    if (!user && companyId) {
      console.log(`🔍 Checking refresh token in company database: ${companyId}`);
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ 'refreshTokens.token': refreshToken });
          
          if (tenantUser) {
            const validToken = await tenantUser.findValidRefreshToken(refreshToken);
            if (validToken) {
              console.log(`✅ Valid refresh token found in ${company.companyName}`);
              user = tenantUser;
              isTenantUser = true;
              userCompany = company;
            }
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
        }
      }
    }
    
    // If still not found and no companyId, check all companies (fallback)
    if (!user && !companyId) {
      console.log('🔍 Checking refresh token in all company databases...');
      const CompanyRegistry = await getCompanyRegistry();
      
      const companies = await CompanyRegistry.find({
        status: 'active',
        databaseStatus: 'active'
      });
      
      for (const company of companies) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ 'refreshTokens.token': refreshToken });
          
          if (tenantUser) {
            const validToken = await tenantUser.findValidRefreshToken(refreshToken);
            if (validToken) {
              console.log(`✅ Valid refresh token found in ${company.companyName}`);
              user = tenantUser;
              isTenantUser = true;
              userCompany = company;
              break;
            }
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
          continue;
        }
      }
    }

    if (!user) {
      console.log('❌ Invalid or expired refresh token');
      if (tenantConnection) await tenantConnection.close();
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if user is still active
    if (!user.isActive) {
      console.log('❌ User account is inactive');
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Generate new access token
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    
    if (isTenantUser && userCompany) {
      tokenPayload.companyId = userCompany.companyId;
      tokenPayload.companyCode = userCompany.companyCode;
      tokenPayload.tenantDatabaseName = userCompany.tenantDatabaseName;
    }

    const newAccessToken = generateToken(user._id, tokenPayload);

    // Optionally generate new refresh token (rotation)
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenExpiry = createRefreshTokenExpiry();
    
    // Revoke old refresh token and add new one
    await user.revokeRefreshToken(refreshToken);
    await user.addRefreshToken(newRefreshToken, newRefreshTokenExpiry, {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    if (tenantConnection) {
      await tenantConnection.close();
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          userId: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          // Add company info for tenant users
          ...(isTenantUser && userCompany ? {
            companyId: userCompany.companyId,
            companyName: userCompany.companyName,
            companyCode: userCompany.companyCode
          } : {})
        }
      }
    });
  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    if (tenantConnection) {
      await tenantConnection.close();
    }
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    });
  }
};

// @desc    Logout user (revoke refresh token)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    console.log('🚪 Logout request for user:', req.user?.email);

    const { getSuperAdmin, getCompanyRegistry } = require('../models/global');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    
    // Try super admin first
    try {
      const SuperAdmin = await getSuperAdmin();
      const superAdmin = await SuperAdmin.findById(req.user.userId);
      
      if (superAdmin) {
        user = superAdmin;
        isTenantUser = false;
      }
    } catch (err) {
      console.log('⚠️  Error finding super admin for logout:', err.message);
    }
    
    // If not super admin, check tenant
    if (!user && req.user.companyId) {
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: req.user.companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findById(req.user.userId);
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
          }
        } catch (tenantError) {
          console.error(`⚠️  Error finding tenant user for logout:`, tenantError.message);
        }
      }
    }
    
    if (!user) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Revoke the specific refresh token
    await user.revokeRefreshToken(refreshToken);
    
    if (tenantConnection) await tenantConnection.close();
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('❌ Error during logout:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
};

// @desc    Logout from all devices (revoke all refresh tokens)
// @route   POST /api/auth/logout-all
// @access  Private
exports.logoutAll = async (req, res) => {
  let tenantConnection = null;
  
  try {
    console.log('🚪 Logout all devices request for user:', req.user?.email);

    const { getSuperAdmin, getCompanyRegistry } = require('../models/global');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    
    // Try super admin first
    try {
      const SuperAdmin = await getSuperAdmin();
      const superAdmin = await SuperAdmin.findById(req.user.userId);
      
      if (superAdmin) {
        user = superAdmin;
        isTenantUser = false;
      }
    } catch (err) {
      console.log('⚠️  Error finding super admin for logout all:', err.message);
    }
    
    // If not super admin, check tenant
    if (!user && req.user.companyId) {
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: req.user.companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findById(req.user.userId);
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
          }
        } catch (tenantError) {
          console.error(`⚠️  Error finding tenant user for logout all:`, tenantError.message);
        }
      }
    }
    
    if (!user) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Revoke all refresh tokens
    await user.revokeAllRefreshTokens();
    
    if (tenantConnection) await tenantConnection.close();
    
    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    console.error('❌ Error during logout all:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: 'Error during logout all'
    });
  }
};

// @desc    Forgot password request
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { email, companyId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    console.log('🔑 Forgot password request:', { email, companyId });

    // Log security event
    logSecurityEvent('password_reset_requested', {
      email,
      companyId: companyId || 'not_provided',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const { getSuperAdmin, getCompanyRegistry } = require('../models/global');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    let userCompany = null;
    
    // Try super admin first
    try {
      const SuperAdmin = await getSuperAdmin();
      const superAdmin = await SuperAdmin.findOne({ email });
      
      if (superAdmin) {
        user = superAdmin;
        isTenantUser = false;
        console.log('✅ Found super admin:', email);
      }
    } catch (err) {
      console.log('⚠️  Error checking super admin:', err.message);
    }
    
    // If not super admin and companyId provided, check specific company database
    if (!user && companyId) {
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          console.log(`🔍 Checking ${company.companyName} for user: ${email}`);
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ email });
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
            userCompany = company;
            console.log(`✅ Found tenant user: ${email} in ${company.companyName}`);
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
        }
      }
    }
    
    // If still not found and no companyId, check all companies (fallback)
    if (!user && !companyId) {
      console.log('🔍 Checking all company databases for user:', email);
      const CompanyRegistry = await getCompanyRegistry();
      
      const companies = await CompanyRegistry.find({
        status: 'active',
        databaseStatus: 'active'
      });
      
      for (const company of companies) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({ email });
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
            userCompany = company;
            console.log(`✅ Found tenant user: ${email} in ${company.companyName}`);
            break;
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
          continue;
        }
      }
    }

    if (!user) {
      // Don't reveal if user exists or not for security
      console.log('⚠️  Password reset requested for non-existent email:', email);
      if (tenantConnection) await tenantConnection.close();
      return res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = emailService.generateResetToken();
    const resetTokenExpiry = emailService.generateResetTokenExpiry();
    
    console.log('🔑 Generated reset token for:', user.email);

    // Save reset token to user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // Send reset email
    try {
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      await emailService.sendPasswordResetEmail(user.email, resetToken, userName);
      console.log('✅ Password reset email sent to:', user.email);
      
      // Log successful password reset
      logSecurityEvent('password_reset_email_sent', {
        email: user.email,
        userId: user._id,
        isTenantUser,
        companyId: companyId || 'super_admin',
        ip: req.ip
      });
    } catch (emailError) {
      console.error('❌ Error sending password reset email:', emailError);
      
      // Remove the reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      if (tenantConnection) await tenantConnection.close();
      return res.status(500).json({
        success: false,
        message: 'Error sending password reset email. Please try again later.'
      });
    }

    if (tenantConnection) await tenantConnection.close();
    
    res.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email address.',
      data: {
        email: user.email,
        expiresIn: 15 // minutes
      }
    });
  } catch (error) {
    console.error('❌ Error in forgot password:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { token, newPassword, companyId } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required'
      });
    }

    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    console.log('🔑 Reset password request with token:', token.substring(0, 10) + '...');

    const { getSuperAdmin, getCompanyRegistry } = require('../models/global');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    
    let user = null;
    let isTenantUser = false;
    
    // Try super admin first
    try {
      const SuperAdmin = await getSuperAdmin();
      const superAdmin = await SuperAdmin.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });
      
      if (superAdmin) {
        user = superAdmin;
        isTenantUser = false;
        console.log('✅ Found super admin with valid reset token');
      }
    } catch (err) {
      console.log('⚠️  Error checking super admin reset token:', err.message);
    }
    
    // If not super admin and companyId provided, check specific company database
    if (!user && companyId) {
      const CompanyRegistry = await getCompanyRegistry();
      
      const company = await CompanyRegistry.findOne({
        companyId: companyId,
        status: 'active',
        databaseStatus: 'active'
      });
      
      if (company) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
          });
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
            console.log(`✅ Found tenant user with valid reset token in ${company.companyName}`);
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
        }
      }
    }
    
    // If still not found and no companyId, check all companies (fallback)
    if (!user && !companyId) {
      console.log('🔍 Checking all company databases for reset token');
      const CompanyRegistry = await getCompanyRegistry();
      
      const companies = await CompanyRegistry.find({
        status: 'active',
        databaseStatus: 'active'
      });
      
      for (const company of companies) {
        try {
          tenantConnection = await getTenantConnection(company.tenantDatabaseName);
          const TenantUser = tenantConnection.model('User', TenantUserSchema);
          
          const tenantUser = await TenantUser.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
          });
          
          if (tenantUser) {
            user = tenantUser;
            isTenantUser = true;
            console.log(`✅ Found tenant user with valid reset token in ${company.companyName}`);
            break;
          }
        } catch (tenantError) {
          console.error(`⚠️  Error checking ${company.companyName}:`, tenantError.message);
          continue;
        }
      }
    }

    if (!user) {
      console.log('❌ Invalid or expired reset token');
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    user.mustChangePassword = false;
    
    // Reset login attempts on password reset
    await user.resetLoginAttempts();
    
    await user.save();
    console.log('✅ Password reset successful for:', user.email);

    // Send confirmation email
    try {
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      await emailService.sendPasswordResetConfirmationEmail(user.email, userName);
      console.log('✅ Password reset confirmation email sent to:', user.email);
    } catch (emailError) {
      console.error('⚠️  Error sending password reset confirmation email:', emailError);
      // Don't fail the request if confirmation email fails
    }

    if (tenantConnection) await tenantConnection.close();
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Error in reset password:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};
