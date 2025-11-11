// Role Management Controller for Super Admin RBAC
// Phase 7: Internal role management within Super Admin module

const User = require('../models/User');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { 
  SUPER_ADMIN_ROLES, 
  ROLE_DEFINITIONS, 
  PERMISSION_MATRIX,
  MODULES,
  ACTIONS
} = require('../config/superAdminRoles');
const { logSuperAdminAction } = require('../middlewares/superAdminAuditLog');

// Get ALL users for Super Admin management (not just Super Admin users)
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = ''
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    // Role filter (all system roles)
    if (role) {
      if (Object.values(SUPER_ADMIN_ROLES).includes(role)) {
        // Filter by internal role for super admins
        query.role = 'superadmin';
        query.internalRole = role;
      } else {
        // Filter by main role for other users
        query.role = role;
      }
    }

    const skip = (page - 1) * limit;
    const users = await User.find(query)
      .select('email firstName lastName role internalRole isActive lastLogin createdAt clientId')
      .populate('clientId', 'companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Add role definitions and format response
    const usersWithRoleInfo = users.map(user => {
      const userObj = user.toObject();
      
      // For super admin users, add internal role info
      if (user.role === 'superadmin' && user.internalRole) {
        userObj.roleDefinition = ROLE_DEFINITIONS[user.internalRole];
        userObj.permissions = PERMISSION_MATRIX[user.internalRole] || {};
        userObj.displayRole = ROLE_DEFINITIONS[user.internalRole]?.name || user.internalRole;
      } else {
        // For regular users, show their main role
        userObj.displayRole = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      }
      
      return userObj;
    });

    res.json({
      success: true,
      data: {
        users: usersWithRoleInfo,
        pagination: {
          current: parseInt(page),
          pages,
          total,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Keep the original function for backward compatibility
const getSuperAdminUsers = getAllUsers;

// Get role definitions and permissions matrix
const getRoleDefinitions = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        roles: ROLE_DEFINITIONS,
        permissions: PERMISSION_MATRIX,
        modules: MODULES,
        actions: ACTIONS
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching role definitions',
      error: error.message
    });
  }
};

// Update user's internal role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { internalRole } = req.body;

    // Validate internal role
    if (!Object.values(SUPER_ADMIN_ROLES).includes(internalRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid internal role'
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is a super admin
    if (user.role !== 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'User is not a Super Admin'
      });
    }

    // Prevent self-demotion from super_admin role (unless there are other super_admins)
    if (user._id.toString() === req.user._id.toString() && 
        req.user.internalRole === SUPER_ADMIN_ROLES.SUPER_ADMIN &&
        internalRole !== SUPER_ADMIN_ROLES.SUPER_ADMIN) {
      
      const otherSuperAdmins = await User.countDocuments({
        role: 'superadmin',
        internalRole: SUPER_ADMIN_ROLES.SUPER_ADMIN,
        _id: { $ne: user._id },
        isActive: true
      });

      if (otherSuperAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change your own role. At least one Super Admin (Owner) must remain.'
        });
      }
    }

    const oldRole = user.internalRole;
    user.internalRole = internalRole;
    await user.save();

    // Log the action
    await logSuperAdminAction(
      req.user._id,
      null,
      'UPDATE_USER_ROLE',
      'User',
      user._id,
      {
        targetUserEmail: user.email,
        oldRole,
        newRole: internalRole,
        changedBy: req.user.email
      },
      req
    );

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          ...user.toObject(),
          roleDefinition: ROLE_DEFINITIONS[internalRole],
          permissions: PERMISSION_MATRIX[internalRole] || {}
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user role',
      error: error.message
    });
  }
};

// Create new Super Admin user
const createSuperAdminUser = async (req, res) => {
  try {
    const { email, password, internalRole } = req.body;

    // Validate required fields
    if (!email || !password || !internalRole) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and internal role are required'
      });
    }

    // Validate internal role
    if (!Object.values(SUPER_ADMIN_ROLES).includes(internalRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid internal role'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new Super Admin user
    const newUser = new User({
      email,
      password,
      role: 'superadmin',
      internalRole,
      isActive: true,
      mustChangePassword: true // Force password change on first login
    });

    await newUser.save();

    // Log the action
    await logSuperAdminAction(
      req.user._id,
      null,
      'CREATE_SUPER_ADMIN_USER',
      'User',
      newUser._id,
      {
        newUserEmail: email,
        assignedRole: internalRole,
        createdBy: req.user.email
      },
      req
    );

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Super Admin user created successfully',
      data: {
        user: {
          ...userResponse,
          roleDefinition: ROLE_DEFINITIONS[internalRole],
          permissions: PERMISSION_MATRIX[internalRole] || {}
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating Super Admin user',
      error: error.message
    });
  }
};

// Deactivate Super Admin user
const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'User is not a Super Admin'
      });
    }

    // Prevent self-deactivation
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    // Prevent deactivating the last super admin
    if (user.internalRole === SUPER_ADMIN_ROLES.SUPER_ADMIN) {
      const otherSuperAdmins = await User.countDocuments({
        role: 'superadmin',
        internalRole: SUPER_ADMIN_ROLES.SUPER_ADMIN,
        _id: { $ne: user._id },
        isActive: true
      });

      if (otherSuperAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last Super Admin (Owner)'
        });
      }
    }

    user.isActive = false;
    await user.save();

    // Log the action
    await logSuperAdminAction(
      req.user._id,
      null,
      'DEACTIVATE_SUPER_ADMIN_USER',
      'User',
      user._id,
      {
        deactivatedUserEmail: user.email,
        deactivatedUserRole: user.internalRole,
        deactivatedBy: req.user.email
      },
      req
    );

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
      error: error.message
    });
  }
};

// Get user's own permissions
const getMyPermissions = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const internalRole = user.internalRole || SUPER_ADMIN_ROLES.SUPER_ADMIN;

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          internalRole,
          isActive: user.isActive
        },
        roleDefinition: ROLE_DEFINITIONS[internalRole],
        permissions: PERMISSION_MATRIX[internalRole] || {},
        modules: Object.keys(PERMISSION_MATRIX[internalRole] || {})
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user permissions',
      error: error.message
    });
  }
};

// Get role-based statistics
const getRoleStats = async (req, res) => {
  try {
    // Count users by internal role
    const roleStats = await User.aggregate([
      { $match: { role: 'superadmin' } },
      {
        $group: {
          _id: '$internalRole',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Get recent role changes
    const recentRoleChanges = await SuperAdminAuditLog.find({
      action: { $in: ['UPDATE_USER_ROLE', 'CREATE_SUPER_ADMIN_USER', 'DEACTIVATE_SUPER_ADMIN_USER'] }
    })
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        roleStats,
        recentRoleChanges,
        totalRoles: Object.keys(ROLE_DEFINITIONS).length,
        totalModules: Object.keys(MODULES).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching role statistics',
      error: error.message
    });
  }
};

module.exports = {
  getSuperAdminUsers,
  getAllUsers,
  getRoleDefinitions,
  updateUserRole,
  createSuperAdminUser,
  deactivateUser,
  getMyPermissions,
  getRoleStats
};
