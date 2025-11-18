const { getTenantModel } = require('../../utils/tenantModels');
const { 
  TENANT_ROLES, 
  EMPLOYEE_PERMISSIONS, 
  TENANT_PERMISSION_MATRIX 
} = require('../../config/tenantPermissions');
const bcrypt = require('bcryptjs');

// Predefined employee role configurations
const EMPLOYEE_ROLE_CONFIGS = {
  [TENANT_ROLES.REGULAR_EMPLOYEE]: {
    name: 'Regular Employee',
    slug: 'regular_employee',
    scope: 'self',
    description: 'Basic employee with self-service permissions',
    permissions: TENANT_PERMISSION_MATRIX[TENANT_ROLES.REGULAR_EMPLOYEE]
  },
  [TENANT_ROLES.TEAM_LEAD]: {
    name: 'Team Lead',
    slug: 'team_lead',
    scope: 'team',
    description: 'Team leader with team management permissions',
    permissions: TENANT_PERMISSION_MATRIX[TENANT_ROLES.TEAM_LEAD]
  },
  [TENANT_ROLES.CONSULTANT]: {
    name: 'Consultant',
    slug: 'consultant',
    scope: 'self',
    description: 'Consultant with timesheet and project focus',
    permissions: TENANT_PERMISSION_MATRIX[TENANT_ROLES.CONSULTANT]
  },
  [TENANT_ROLES.INTERN]: {
    name: 'Intern',
    slug: 'intern',
    scope: 'self',
    description: 'Intern with limited permissions',
    permissions: TENANT_PERMISSION_MATRIX[TENANT_ROLES.INTERN]
  }
};

/**
 * Create a new employee role and auto-generate user account
 * POST /api/tenant/roles
 */
const createEmployeeRole = async (req, res) => {
  try {
    console.log('🔥 CREATE ROLE REQUEST:', {
      body: req.body,
      user: req.user,
      tenant: req.tenant?.clientId
    });

    const { roleType, userEmail, userName, clientId: requestClientId } = req.body;
    
    // Get clientId from tenant context or request body
    const clientId = req.tenant?.clientId || requestClientId || '6914486fef016d63d6ac03ce'; // Default to your tenant ID
    const createdBy = req.user?._id || req.user?.id || 'system';

    console.log('🔍 Client ID resolution:', { 
      fromTenant: req.tenant?.clientId, 
      fromRequest: requestClientId, 
      final: clientId 
    });

    // Validate required fields
    if (!roleType || !userEmail || !userName) {
      console.log('❌ Missing required fields:', { roleType, userEmail, userName });
      return res.status(400).json({
        success: false,
        message: 'Role type, user email, and user name are required'
      });
    }

    // Validate role type
    if (!EMPLOYEE_ROLE_CONFIGS[roleType]) {
      console.log('❌ Invalid role type:', roleType);
      return res.status(400).json({
        success: false,
        message: 'Invalid role type. Must be one of: regular_employee, team_lead, consultant, intern'
      });
    }

    // Check if user has permission to create roles (more flexible check)
    const userRole = req.user?.role || req.user?.userRole;
    console.log('👤 User role check:', { userRole, fullUser: req.user });
    
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: `Access denied. Current role: ${userRole}. Only admin users can create employee roles.`
      });
    }

    // Get tenant connection manually if tenant middleware didn't work
    let tenantConnection = req.tenant?.connection;
    
    if (!tenantConnection) {
      console.log('🔧 Getting tenant connection manually for clientId:', clientId);
      const tenantConnectionManager = require('../../config/tenantConnection');
      tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);
    }

    const Role = getTenantModel(tenantConnection, 'Role');
    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!Role || !TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Role management models not available'
      });
    }

    const roleConfig = EMPLOYEE_ROLE_CONFIGS[roleType];

    // Check if role already exists for this tenant
    const existingRole = await Role.findOne({
      clientId,
      slug: roleConfig.slug
    });

    let role;
    if (existingRole) {
      role = existingRole;
    } else {
      // Create new role
      role = new Role({
        name: roleConfig.name,
        slug: roleConfig.slug,
        scope: roleConfig.scope,
        clientId,
        permissions: roleConfig.permissions,
        description: roleConfig.description,
        isActive: true,
        isSystemRole: true, // Mark as system-defined role
        createdBy
      });

      await role.save();
    }

    // Check if user already exists
    const existingUser = await TenantUser.findOne({
      clientId,
      email: userEmail
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists in this tenant'
      });
    }

    // Generate auto email if not provided
    const finalEmail = userEmail || `${roleConfig.slug}_user@tenant_${clientId}.local`;

    // Create new tenant user with default password
    const defaultPassword = 'password123';
    console.log('👤 Creating tenant user with data:', {
      name: userName,
      email: finalEmail,
      roleId: role._id,
      roleName: role.name,
      roleSlug: role.slug,
      clientId,
      createdBy
    });

    const tenantUser = new TenantUser({
      name: userName || `${roleConfig.name} User`,
      email: finalEmail,
      password: defaultPassword,
      roleId: role._id,
      roleName: role.name,
      roleSlug: role.slug,
      permissions: role.permissions,
      scope: role.scope,
      clientId,
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: true,
      createdBy
    });

    console.log('💾 Saving tenant user...');
    await tenantUser.save();
    console.log('✅ Tenant user saved successfully:', tenantUser._id);

    // Log the creation action
    console.log(`✅ Role and User Created: ${role.name} -> ${tenantUser.email} for tenant ${clientId}`);

    res.status(201).json({
      success: true,
      message: 'Employee role and user account created successfully',
      data: {
        role: {
          id: role._id,
          name: role.name,
          slug: role.slug,
          scope: role.scope,
          permissions: role.permissions,
          description: role.description
        },
        user: {
          id: tenantUser._id,
          name: tenantUser.name,
          email: tenantUser.email,
          roleName: tenantUser.roleName,
          roleSlug: tenantUser.roleSlug,
          scope: tenantUser.scope,
          isActive: tenantUser.isActive,
          mustChangePassword: tenantUser.mustChangePassword,
          defaultPassword: defaultPassword // Include for admin reference
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating employee role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee role',
      error: error.message
    });
  }
};

/**
 * Get all available employee role configurations
 * GET /api/tenant/roles/configs
 */
const getEmployeeRoleConfigs = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        availableRoles: Object.keys(EMPLOYEE_ROLE_CONFIGS).map(roleType => ({
          type: roleType,
          ...EMPLOYEE_ROLE_CONFIGS[roleType],
          permissionCount: EMPLOYEE_ROLE_CONFIGS[roleType].permissions.length
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching role configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role configurations',
      error: error.message
    });
  }
};

/**
 * Get all roles and users for current tenant
 * GET /api/tenant/roles
 */
const getTenantRolesAndUsers = async (req, res) => {
  try {
    // Get clientId from query params or default
    const clientId = req.query.clientId || '6914486fef016d63d6ac03ce';
    
    console.log('📋 Getting roles and users for clientId:', clientId);

    // Get tenant connection manually
    let tenantConnection = req.tenant?.connection;
    if (!tenantConnection) {
      const tenantConnectionManager = require('../../config/tenantConnection');
      tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);
    }

    const Role = getTenantModel(tenantConnection, 'Role');
    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!Role || !TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Role management models not available'
      });
    }

    // Get all roles for this tenant
    const roles = await Role.find({ clientId }).sort({ createdAt: -1 });

    // Get all users for this tenant with role information
    const users = await TenantUser.find({ clientId })
      .select('-password')
      .populate('roleId', 'name slug scope permissions')
      .sort({ createdAt: -1 });

    // Group users by role
    const roleUserMap = {};
    users.forEach(user => {
      const roleSlug = user.roleSlug;
      if (!roleUserMap[roleSlug]) {
        roleUserMap[roleSlug] = [];
      }
      roleUserMap[roleSlug].push(user);
    });

    res.json({
      success: true,
      data: {
        roles: roles.map(role => ({
          id: role._id,
          name: role.name,
          slug: role.slug,
          scope: role.scope,
          permissionCount: role.permissions.length,
          userCount: roleUserMap[role.slug]?.length || 0,
          isSystemRole: role.isSystemRole,
          createdAt: role.createdAt
        })),
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          roleName: user.roleName,
          roleSlug: user.roleSlug,
          scope: user.scope,
          isActive: user.isActive,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        })),
        summary: {
          totalRoles: roles.length,
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          firstTimeUsers: users.filter(u => u.isFirstLogin).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tenant roles and users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant roles and users',
      error: error.message
    });
  }
};

/**
 * Update user status (activate/deactivate)
 * PUT /api/tenant/roles/users/:userId/status
 */
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, clientId: requestClientId } = req.body;
    
    // Get clientId from request body, query params, or default
    const clientId = requestClientId || req.query.clientId || '6914486fef016d63d6ac03ce';

    console.log('👤 Updating user status:', { userId, isActive, clientId });

    // Check admin permission
    const userRole = req.user?.role || req.user?.userRole;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can update user status'
      });
    }

    // Get tenant connection manually
    let tenantConnection = req.tenant?.connection;
    if (!tenantConnection) {
      const tenantConnectionManager = require('../../config/tenantConnection');
      tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);
    }

    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'TenantUser model not available'
      });
    }

    const user = await TenantUser.findOne({ _id: userId, clientId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive;
    user.updatedBy = req.user._id;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        userId: user._id,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('❌ Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

/**
 * Reset user password to default
 * PUT /api/tenant/roles/users/:userId/reset-password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { clientId: requestClientId } = req.body;
    
    // Get clientId from request body, query params, or default
    const clientId = requestClientId || req.query.clientId || '6914486fef016d63d6ac03ce';

    console.log('🔑 Resetting password for user:', { userId, clientId });

    // Check admin permission
    const userRole = req.user?.role || req.user?.userRole;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can reset user passwords'
      });
    }

    // Get tenant connection manually
    let tenantConnection = req.tenant?.connection;
    if (!tenantConnection) {
      const tenantConnectionManager = require('../../config/tenantConnection');
      tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);
    }

    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');

    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'TenantUser model not available'
      });
    }

    const user = await TenantUser.findOne({ _id: userId, clientId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Reset to default password
    const defaultPassword = 'password123';
    user.password = defaultPassword;
    user.mustChangePassword = true;
    user.isFirstLogin = true;
    user.updatedBy = req.user._id;
    await user.save();

    res.json({
      success: true,
      message: 'User password reset successfully',
      data: {
        userId: user._id,
        email: user.email,
        defaultPassword: defaultPassword,
        mustChangePassword: true
      }
    });

  } catch (error) {
    console.error('❌ Error resetting user password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset user password',
      error: error.message
    });
  }
};

module.exports = {
  createEmployeeRole,
  getEmployeeRoleConfigs,
  getTenantRolesAndUsers,
  updateUserStatus,
  resetUserPassword
};
