const tenantConnectionManager = require('../config/tenantConnection');
const Client = require('../models/Client');

/**
 * Middleware to inject tenant context into requests
 * This middleware should be used for all tenant-specific routes
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    // Skip tenant middleware for super admin routes
    if (req.path.startsWith('/api/super-admin')) {
      return next();
    }

    // Get clientId from user (set by auth middleware)
    const clientId = req.user?.clientId;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID not found in user context'
      });
    }

    // Validate client exists and is active
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    if (!client.isActive || client.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Client account is inactive'
      });
    }

    // Get tenant database connection
    const tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);
    
    // Inject tenant context into request
    req.tenant = {
      clientId: clientId.toString(),
      client: client,
      connection: tenantConnection,
      dbName: `hrms_tenant_${clientId}`
    };
    
    next();
  } catch (error) {
    console.error('❌ Tenant Middleware Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to establish tenant context',
      error: error.message
    });
  }
};

/**
 * Middleware to ensure Super Admin context
 * This middleware should be used for super admin routes only
 */
const superAdminMiddleware = async (req, res, next) => {
  try {
    // Ensure user is super admin
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Super Admin access required'
      });
    }

    // Get Super Admin database connection
    const superAdminConnection = tenantConnectionManager.getSuperAdminConnection();
    
    // Inject Super Admin context
    req.superAdmin = {
      connection: superAdminConnection,
      user: req.user
    };

    console.log(`👑 Super Admin Context: ${req.user.email}`);
    
    next();
  } catch (error) {
    console.error('❌ Super Admin Middleware Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to establish Super Admin context',
      error: error.message
    });
  }
};

/**
 * Helper function to get tenant model
 * @param {Object} tenantConnection - Tenant database connection
 * @param {string} modelName - Name of the model
 * @param {Object} schema - Mongoose schema
 * @returns {Model} - Tenant-specific model
 */
const getTenantModel = (tenantConnection, modelName, schema) => {
  try {
    // Check if model already exists in this connection
    if (tenantConnection.models[modelName]) {
      return tenantConnection.models[modelName];
    }
    
    // Create new model for this tenant
    return tenantConnection.model(modelName, schema);
  } catch (error) {
    console.error(`❌ Error creating tenant model ${modelName}:`, error);
    throw error;
  }
};

/**
 * Middleware to validate tenant subscription and module access
 */
const validateTenantAccess = (requiredModule = null) => {
  return async (req, res, next) => {
    try {
      const { client } = req.tenant;
      
      // Check subscription status
      if (client.subscription?.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Subscription is not active'
        });
      }

      // Check subscription expiry
      if (client.subscription?.endDate && new Date() > new Date(client.subscription.endDate)) {
        return res.status(403).json({
          success: false,
          message: 'Subscription has expired'
        });
      }

      // Check module access if required
      if (requiredModule && !client.enabledModules.includes(requiredModule)) {
        return res.status(403).json({
          success: false,
          message: `Module '${requiredModule}' is not enabled for this client`
        });
      }

      next();
    } catch (error) {
      console.error('❌ Tenant Access Validation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate tenant access',
        error: error.message
      });
    }
  };
};

module.exports = {
  tenantMiddleware,
  superAdminMiddleware,
  getTenantModel,
  validateTenantAccess
};
