const express = require('express');
const router = express.Router();
const { protect, requireSuperAdmin } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { 
  checkSuperAdminPermission, 
  requireModuleAccess,
  addUserPermissions 
} = require('../middlewares/superAdminRBAC');
const { 
  auditSuperAdminAction, 
  logRouteAccess 
} = require('../middlewares/superAdminAuditLog');
const { MODULES, ACTIONS } = require('../config/superAdminRoles');

// Import controllers
const superAdminController = require('../controllers/superAdminController');
const roleManagementController = require('../controllers/roleManagementController');
const auditLogController = require('../controllers/auditLogController');

// Apply authentication and super admin check to all routes
router.use(protect);
router.use(requireSuperAdmin);
router.use(addUserPermissions); // Add user permissions to all requests
router.use(logRouteAccess); // Log significant route access

// Dashboard routes - Analytics & Monitoring module
router.get('/dashboard/stats', 
  requireModuleAccess(MODULES.ANALYTICS_MONITORING),
  superAdminController.getDashboardStats
);
router.get('/dashboard/health', 
  requireModuleAccess(MODULES.ANALYTICS_MONITORING),
  superAdminController.getSystemHealth
);

// Client management routes - Client Management module
router.get('/clients', 
  requireModuleAccess(MODULES.CLIENT_MANAGEMENT),
  superAdminController.getClients
);
router.get('/clients/:id', 
  requireModuleAccess(MODULES.CLIENT_MANAGEMENT),
  superAdminController.getClient
);
router.post('/clients', 
  checkSuperAdminPermission(MODULES.CLIENT_MANAGEMENT, ACTIONS.CREATE),
  auditSuperAdminAction('CREATE_CLIENT', 'Client'),
  superAdminController.createClient
);
router.put('/clients/:id', 
  checkSuperAdminPermission(MODULES.CLIENT_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('UPDATE_CLIENT', 'Client'),
  superAdminController.updateClient
);
router.patch('/clients/:id/status', 
  checkSuperAdminPermission(MODULES.CLIENT_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('UPDATE_CLIENT_STATUS', 'Client'),
  superAdminController.updateClientStatus
);
router.patch('/clients/:id/subscription', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.UPDATE),
  auditSuperAdminAction('UPDATE_CLIENT_SUBSCRIPTION', 'Client'),
  superAdminController.updateClientSubscription
);
router.delete('/clients/:id', 
  checkSuperAdminPermission(MODULES.CLIENT_MANAGEMENT, ACTIONS.DELETE),
  auditSuperAdminAction('DELETE_CLIENT', 'Client'),
  superAdminController.deleteClient
);

// Role Management routes - Role Management module
router.get('/roles/definitions', 
  requireModuleAccess(MODULES.ROLE_MANAGEMENT),
  roleManagementController.getRoleDefinitions
);
router.get('/roles/users', 
  requireModuleAccess(MODULES.ROLE_MANAGEMENT),
  roleManagementController.getSuperAdminUsers
);
router.get('/roles/stats', 
  requireModuleAccess(MODULES.ROLE_MANAGEMENT),
  roleManagementController.getRoleStats
);
router.get('/roles/my-permissions', 
  roleManagementController.getMyPermissions
);
router.post('/roles/users', 
  checkSuperAdminPermission(MODULES.ROLE_MANAGEMENT, ACTIONS.CREATE),
  auditSuperAdminAction('CREATE_SUPER_ADMIN_USER', 'User'),
  roleManagementController.createSuperAdminUser
);
router.put('/roles/users/:userId', 
  checkSuperAdminPermission(MODULES.ROLE_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('UPDATE_USER_ROLE', 'User'),
  roleManagementController.updateUserRole
);
router.patch('/roles/users/:userId/deactivate', 
  checkSuperAdminPermission(MODULES.ROLE_MANAGEMENT, ACTIONS.DELETE),
  auditSuperAdminAction('DEACTIVATE_SUPER_ADMIN_USER', 'User'),
  roleManagementController.deactivateUser
);

// Audit Log routes - Audit Logs module
router.get('/audit/logs', 
  requireModuleAccess(MODULES.AUDIT_LOGS),
  auditLogController.getAuditLogs
);
router.get('/audit/stats', 
  requireModuleAccess(MODULES.AUDIT_LOGS),
  auditLogController.getAuditStats
);
router.get('/audit/security-events', 
  requireModuleAccess(MODULES.AUDIT_LOGS),
  auditLogController.getSecurityEvents
);
router.get('/audit/compliance', 
  requireModuleAccess(MODULES.AUDIT_LOGS),
  auditLogController.getComplianceLogs
);
router.get('/audit/export', 
  checkSuperAdminPermission(MODULES.AUDIT_LOGS, ACTIONS.EXPORT),
  auditSuperAdminAction('EXPORT_AUDIT_LOGS', 'System'),
  auditLogController.exportAuditLogs
);

module.exports = router;
