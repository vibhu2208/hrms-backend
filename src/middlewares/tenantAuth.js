const jwt = require('jsonwebtoken');
const { getTenantModel } = require('../utils/tenantModels');

/**
 * Middleware to authenticate tenant users
 */
const authenticateTenantUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if this is a tenant user token
    if (decoded.type !== 'tenant_user') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type for tenant access'
      });
    }

    // Get tenant connection
    const tenantConnectionManager = require('../config/tenantConnection');
    const tenantConnection = await tenantConnectionManager.getTenantConnection(decoded.clientId);

    if (!tenantConnection) {
      return res.status(401).json({
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

    // Find the user
    const user = await TenantUser.findOne({ 
      _id: decoded.userId, 
      clientId: decoded.clientId 
    }).populate('roleId', 'name slug scope permissions');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Attach user and tenant info to request
    req.user = {
      userId: user._id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.roleName,
      roleSlug: user.roleSlug,
      permissions: user.permissions,
      scope: user.scope,
      clientId: user.clientId,
      isFirstLogin: user.isFirstLogin,
      mustChangePassword: user.mustChangePassword
    };

    req.tenant = {
      clientId: decoded.clientId,
      connection: tenantConnection,
      dbName: `hrms_tenant_${decoded.clientId}`
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('❌ Tenant auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

/**
 * Middleware to check if user must change password
 */
const checkPasswordChangeRequired = (req, res, next) => {
  if (req.user.mustChangePassword || req.user.isFirstLogin) {
    // Allow access to change password endpoint
    if (req.path === '/change-password' || req.method === 'PUT' && req.path.includes('change-password')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Password change required',
      requirePasswordChange: true,
      isFirstLogin: req.user.isFirstLogin
    });
  }

  next();
};

/**
 * Middleware to check specific permissions
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`
      });
    }
    next();
  };
};

/**
 * Middleware to check role-based access
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    const userRole = req.user.roleSlug;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    next();
  };
};

/**
 * Middleware to check scope-based access
 */
const requireScope = (scopes) => {
  return (req, res, next) => {
    const userScope = req.user.scope;
    const allowedScopes = Array.isArray(scopes) ? scopes : [scopes];

    if (!allowedScopes.includes(userScope)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required scope: ${allowedScopes.join(' or ')}`
      });
    }
    next();
  };
};

module.exports = {
  authenticateTenantUser,
  checkPasswordChangeRequired,
  requirePermission,
  requireRole,
  requireScope
};
