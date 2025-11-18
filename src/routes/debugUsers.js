const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');

// Debug endpoint to list users in tenant database
router.get('/tenant-users/:clientId', protect, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { getTenantModel } = require('../utils/tenantModels');
    const tenantConnectionManager = require('../config/tenantConnection');
    
    console.log('🔍 Checking users in tenant:', clientId);
    
    // Get tenant connection
    const tenantConnection = await tenantConnectionManager.getTenantConnection(clientId);
    const TenantUser = getTenantModel(tenantConnection, 'TenantUser');
    
    if (!TenantUser) {
      return res.status(500).json({
        success: false,
        message: 'TenantUser model not available'
      });
    }
    
    // Get all users in this tenant (without passwords)
    const users = await TenantUser.find({ clientId })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      message: `Found ${users.length} users in tenant ${clientId}`,
      data: {
        clientId,
        userCount: users.length,
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          roleName: user.roleName,
          roleSlug: user.roleSlug,
          isActive: user.isActive,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword,
          createdAt: user.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking tenant users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check tenant users',
      error: error.message
    });
  }
});

// Debug endpoint to list users in main database
router.get('/main-users', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    
    console.log('🔍 Checking users in main database');
    
    // Get all users in main database (without passwords)
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      message: `Found ${users.length} users in main database`,
      data: {
        userCount: users.length,
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
          isActive: user.isActive,
          createdAt: user.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking main users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check main users',
      error: error.message
    });
  }
});

module.exports = router;
