const express = require('express');
const router = express.Router();
const { protect, requireSuperAdmin } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');

// Import controllers
const superAdminController = require('../controllers/superAdminController');

// Apply authentication and super admin check to all routes
router.use(protect);
router.use(requireSuperAdmin);

// Dashboard routes
router.get('/dashboard/stats', superAdminController.getDashboardStats);
router.get('/dashboard/health', superAdminController.getSystemHealth);

// Client management routes
router.get('/clients', superAdminController.getClients);
router.get('/clients/:id', superAdminController.getClient);
router.post('/clients', 
  auditLog('create', 'client'),
  superAdminController.createClient
);
router.put('/clients/:id', 
  auditLog('update', 'client'),
  superAdminController.updateClient
);
router.patch('/clients/:id/status', 
  auditLog('status_change', 'client'),
  superAdminController.updateClientStatus
);
router.patch('/clients/:id/subscription', 
  auditLog('subscription_update', 'subscription'),
  superAdminController.updateClientSubscription
);
router.delete('/clients/:id', 
  auditLog('delete', 'client'),
  superAdminController.deleteClient
);

module.exports = router;
