const { getTenantModel } = require('../../utils/tenantModels');
const { 
  TENANT_ROLES, 
  EMPLOYEE_PERMISSIONS, 
  TENANT_PERMISSION_MATRIX 
} = require('../../config/tenantPermissions');

/**
 * Test tenant role system functionality
 * GET /api/tenant/test/system-info
 */
const getSystemInfo = async (req, res) => {
  try {
    const { clientId } = req.tenant;

    const Role = getTenantModel(req.tenant.connection, 'Role');
    const TenantUser = getTenantModel(req.tenant.connection, 'TenantUser');

    if (!Role || !TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Role management models not available'
      });
    }

    // Get system statistics
    const roleCount = await Role.countDocuments({ clientId });
    const userCount = await TenantUser.countDocuments({ clientId });
    const activeUserCount = await TenantUser.countDocuments({ clientId, isActive: true });
    const firstLoginUserCount = await TenantUser.countDocuments({ clientId, isFirstLogin: true });

    // Get all roles and users
    const roles = await Role.find({ clientId }).sort({ createdAt: -1 });
    const users = await TenantUser.find({ clientId })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        tenant: {
          clientId,
          dbName: req.tenant.dbName
        },
        statistics: {
          totalRoles: roleCount,
          totalUsers: userCount,
          activeUsers: activeUserCount,
          firstLoginUsers: firstLoginUserCount
        },
        roles: roles.map(role => ({
          id: role._id,
          name: role.name,
          slug: role.slug,
          scope: role.scope,
          permissionCount: role.permissions.length,
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
          createdAt: user.createdAt
        })),
        availableRoles: Object.keys(TENANT_ROLES).map(key => ({
          key,
          value: TENANT_ROLES[key],
          permissions: TENANT_PERMISSION_MATRIX[TENANT_ROLES[key]]?.length || 0
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error getting system info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system information',
      error: error.message
    });
  }
};

/**
 * Test user permissions for current authenticated user
 * GET /api/tenant/test/my-permissions
 */
const getMyPermissions = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          roleSlug: user.roleSlug,
          roleName: user.roleName,
          scope: user.scope,
          clientId: user.clientId
        },
        permissions: user.permissions,
        permissionCount: user.permissions.length,
        roleInfo: {
          canCreateRoles: user.permissions.includes(EMPLOYEE_PERMISSIONS.ROLE_CREATE_EMPLOYEE),
          canAssignRoles: user.permissions.includes(EMPLOYEE_PERMISSIONS.ROLE_ASSIGN_EMPLOYEE),
          canViewTeam: user.permissions.includes(EMPLOYEE_PERMISSIONS.PROFILE_VIEW_TEAM),
          canApproveLeave: user.permissions.includes(EMPLOYEE_PERMISSIONS.LEAVE_APPROVE_TEAM),
          canManageTeam: user.permissions.includes(EMPLOYEE_PERMISSIONS.TEAM_MANAGE)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user permissions',
      error: error.message
    });
  }
};

/**
 * Test role creation with validation
 * POST /api/tenant/test/create-test-role
 */
const createTestRole = async (req, res) => {
  try {
    const { roleType } = req.body;
    const { clientId } = req.tenant;

    if (!roleType || !TENANT_ROLES[roleType.toUpperCase()]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role type'
      });
    }

    const Role = getTenantModel(req.tenant.connection, 'Role');
    const TenantUser = getTenantModel(req.tenant.connection, 'TenantUser');

    if (!Role || !TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Role management models not available'
      });
    }

    const roleSlug = TENANT_ROLES[roleType.toUpperCase()];
    const permissions = TENANT_PERMISSION_MATRIX[roleSlug] || [];

    // Create test role
    const testRole = new Role({
      name: `Test ${roleType}`,
      slug: `test_${roleSlug}`,
      scope: roleType === 'TEAM_LEAD' ? 'team' : 'self',
      clientId,
      permissions,
      description: `Test role for ${roleType}`,
      isActive: true,
      isSystemRole: false,
      createdBy: req.user._id || 'system'
    });

    await testRole.save();

    // Create test user
    const testUser = new TenantUser({
      name: `Test ${roleType} User`,
      email: `test_${roleSlug}@tenant_${clientId}.local`,
      password: 'password123',
      roleId: testRole._id,
      roleName: testRole.name,
      roleSlug: testRole.slug,
      permissions: testRole.permissions,
      scope: testRole.scope,
      clientId,
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: true,
      createdBy: req.user._id || 'system'
    });

    await testUser.save();

    res.status(201).json({
      success: true,
      message: 'Test role and user created successfully',
      data: {
        role: {
          id: testRole._id,
          name: testRole.name,
          slug: testRole.slug,
          scope: testRole.scope,
          permissions: testRole.permissions
        },
        user: {
          id: testUser._id,
          name: testUser.name,
          email: testUser.email,
          roleSlug: testUser.roleSlug,
          scope: testUser.scope
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating test role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test role',
      error: error.message
    });
  }
};

/**
 * Test permission validation
 * POST /api/tenant/test/validate-permissions
 */
const validatePermissions = async (req, res) => {
  try {
    const { testPermissions } = req.body;
    const userPermissions = req.user.permissions;

    if (!Array.isArray(testPermissions)) {
      return res.status(400).json({
        success: false,
        message: 'testPermissions must be an array'
      });
    }

    const results = testPermissions.map(permission => ({
      permission,
      hasPermission: userPermissions.includes(permission),
      isValidPermission: Object.values(EMPLOYEE_PERMISSIONS).includes(permission)
    }));

    const summary = {
      totalTested: testPermissions.length,
      hasPermissions: results.filter(r => r.hasPermission).length,
      validPermissions: results.filter(r => r.isValidPermission).length,
      userTotalPermissions: userPermissions.length
    };

    res.json({
      success: true,
      data: {
        user: {
          roleSlug: req.user.roleSlug,
          scope: req.user.scope
        },
        results,
        summary
      }
    });

  } catch (error) {
    console.error('❌ Error validating permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate permissions',
      error: error.message
    });
  }
};

/**
 * Clean up test data
 * DELETE /api/tenant/test/cleanup
 */
const cleanupTestData = async (req, res) => {
  try {
    const { clientId } = req.tenant;

    const Role = getTenantModel(req.tenant.connection, 'Role');
    const TenantUser = getTenantModel(req.tenant.connection, 'TenantUser');

    if (!Role || !TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'Role management models not available'
      });
    }

    // Delete test roles and users
    const deletedRoles = await Role.deleteMany({ 
      clientId, 
      slug: { $regex: /^test_/ } 
    });

    const deletedUsers = await TenantUser.deleteMany({ 
      clientId, 
      email: { $regex: /^test_/ } 
    });

    res.json({
      success: true,
      message: 'Test data cleaned up successfully',
      data: {
        deletedRoles: deletedRoles.deletedCount,
        deletedUsers: deletedUsers.deletedCount
      }
    });

  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup test data',
      error: error.message
    });
  }
};

module.exports = {
  getSystemInfo,
  getMyPermissions,
  createTestRole,
  validatePermissions,
  cleanupTestData
};
