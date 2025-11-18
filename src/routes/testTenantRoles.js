const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Test endpoint to check tenant role system
router.get('/test-tenant-roles', 
  tenantMiddleware,
  protect,
  (req, res) => {
    res.json({
      success: true,
      message: 'Tenant role system is working!',
      data: {
        user: req.user,
        tenant: {
          clientId: req.tenant?.clientId,
          dbName: req.tenant?.dbName
        },
        timestamp: new Date().toISOString()
      }
    });
  }
);

// Simple role creation test
router.post('/test-create-role',
  tenantMiddleware,
  protect,
  async (req, res) => {
    try {
      const { getTenantModel } = require('../utils/tenantModels');
      
      console.log('🧪 TEST CREATE ROLE:', {
        body: req.body,
        user: req.user,
        tenant: req.tenant?.clientId
      });

      const Role = getTenantModel(req.tenant.connection, 'Role');
      
      if (!Role) {
        return res.status(500).json({
          success: false,
          message: 'Role model not available'
        });
      }

      // Create a simple test role
      const testRole = new Role({
        name: 'Test Role',
        slug: 'test_role',
        scope: 'self',
        clientId: req.tenant.clientId,
        permissions: ['test_permission'],
        description: 'Test role for debugging',
        isActive: true,
        isSystemRole: false,
        createdBy: req.user._id || 'test'
      });

      await testRole.save();

      res.json({
        success: true,
        message: 'Test role created successfully!',
        data: {
          role: testRole,
          tenant: req.tenant.clientId
        }
      });

    } catch (error) {
      console.error('❌ Test role creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Test role creation failed',
        error: error.message
      });
    }
  }
);

module.exports = router;
