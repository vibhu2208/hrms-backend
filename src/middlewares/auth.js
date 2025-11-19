const { verifyToken } = require('../utils/jwt');
const TenantUserSchema = require('../models/tenant/TenantUser');
const { getTenantConnection } = require('../config/database.config');
const { getSuperAdmin } = require('../models/global');

const protect = async (req, res, next) => {
  let tenantConnection = null;
  
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    let user = null;

    // Check if token contains company info (tenant user)
    if (decoded.companyId) {
      // User is from a tenant database
      try {
        console.log(`🔍 Auth middleware: Fetching user from tenant DB for company: ${decoded.companyId}`);
        tenantConnection = await getTenantConnection(decoded.companyId);
        const TenantUser = tenantConnection.model('User', TenantUserSchema);
        user = await TenantUser.findById(decoded.userId).select('-password');
        
        console.log(`✅ User found in tenant DB: ${user?.email}`);
        
        if (tenantConnection) {
          await tenantConnection.close();
        }
      } catch (tenantError) {
        console.error('Error accessing tenant database:', tenantError);
        if (tenantConnection) await tenantConnection.close();
        return res.status(500).json({
          success: false,
          message: 'Error accessing company database'
        });
      }
    } else {
      // User is from main database (super admin, etc.)
      console.log('🔍 Auth middleware: Fetching super admin from global DB');
      const SuperAdmin = await getSuperAdmin();
      user = await SuperAdmin.findById(decoded.userId).select('-password');
      console.log(`✅ Super admin found: ${user?.email}`);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Attach user and company info to request
    req.user = user;
    if (decoded.companyId) {
      req.companyId = decoded.companyId;
      req.companyCode = decoded.companyCode;
      req.databaseName = decoded.databaseName;
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (tenantConnection) {
      await tenantConnection.close();
    }
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Super Admin specific middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access required'
    });
  }
  next();
};

// Tenant isolation middleware - ensures users can only access their client's data
const tenantIsolation = async (req, res, next) => {
  try {
    // Super admins can access all data
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Other users are restricted to their client's data
    if (!req.user.clientId) {
      return res.status(403).json({
        success: false,
        message: 'User not associated with any client'
      });
    }

    // Add clientId to request for filtering
    req.clientId = req.user.clientId;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in tenant isolation'
    });
  }
};

module.exports = { protect, authorize, requireSuperAdmin, tenantIsolation };
