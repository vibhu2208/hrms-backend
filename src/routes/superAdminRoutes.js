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
const packageManagementController = require('../controllers/packageManagementController');
const subscriptionController = require('../controllers/subscriptionController');
const billingController = require('../controllers/billingController');
const paymentController = require('../controllers/paymentController');
const revenueController = require('../controllers/revenueController');
const billingAutomationController = require('../controllers/billingAutomationController');
const { seedBillingData } = require('../seeders/billingSeeder');

// Import Super Admin bypass middleware
const { superAdminBypass, forceSuperAdminBypass } = require('../middlewares/superAdminBypass');

// Import billing RBAC middleware
const {
  canCreateSubscription,
  canUpdateSubscription,
  canCancelSubscription,
  canSuspendSubscription,
  canGenerateInvoice,
  canUpdateInvoice,
  canMarkInvoiceAsPaid,
  canSendInvoiceReminder,
  canProcessPayment,
  canProcessRefund,
  canVerifyPayment,
  canReconcilePayment,
  canViewRevenueDashboard,
  canExportRevenueData,
  requireHighValueApproval,
  requireClientBillingAccess,
  auditBillingOperation
} = require('../middlewares/billingRBAC');

// Apply authentication and super admin check to all routes
router.use(protect);
router.use(requireSuperAdmin);
router.use(superAdminBypass); // SUPER ADMIN BYPASS - Give Super Admin full access to everything
// Fixed Super Admin bypass implementation
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

// Package Management routes - Package Management module
router.get('/packages', 
  requireModuleAccess(MODULES.PACKAGE_MANAGEMENT),
  packageManagementController.getPackages
);
router.get('/packages/analytics', 
  requireModuleAccess(MODULES.PACKAGE_MANAGEMENT),
  packageManagementController.getPackageAnalytics
);
router.get('/packages/:id', 
  requireModuleAccess(MODULES.PACKAGE_MANAGEMENT),
  packageManagementController.getPackage
);
router.post('/packages', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.CREATE),
  auditSuperAdminAction('CREATE_PACKAGE', 'Package'),
  packageManagementController.createPackage
);
router.put('/packages/:id', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('UPDATE_PACKAGE', 'Package'),
  packageManagementController.updatePackage
);
router.patch('/packages/:id/toggle-status', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('TOGGLE_PACKAGE_STATUS', 'Package'),
  packageManagementController.togglePackageStatus
);
router.delete('/packages/:id', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.DELETE),
  auditSuperAdminAction('DELETE_PACKAGE', 'Package'),
  packageManagementController.deletePackage
);

// Module Management routes - Package Management module
router.get('/modules', 
  requireModuleAccess(MODULES.PACKAGE_MANAGEMENT),
  packageManagementController.getModules
);

// Client Package Assignment routes - Package Management module
router.post('/packages/assign', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.CREATE),
  auditSuperAdminAction('ASSIGN_PACKAGE', 'ClientPackage'),
  packageManagementController.assignPackageToClient
);
router.get('/clients/:clientId/packages', 
  requireModuleAccess(MODULES.PACKAGE_MANAGEMENT),
  packageManagementController.getClientPackages
);
router.put('/client-packages/:clientPackageId', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('UPDATE_CLIENT_PACKAGE', 'ClientPackage'),
  packageManagementController.updateClientPackage
);
router.patch('/client-packages/:clientPackageId/cancel', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.UPDATE),
  auditSuperAdminAction('CANCEL_CLIENT_PACKAGE', 'ClientPackage'),
  packageManagementController.cancelClientPackage
);

// Module Customization routes - Package Management module
router.post('/clients/:clientId/modules/customize', 
  checkSuperAdminPermission(MODULES.PACKAGE_MANAGEMENT, ACTIONS.CONFIGURE),
  auditSuperAdminAction('CUSTOMIZE_CLIENT_MODULES', 'ClientModuleOverride'),
  packageManagementController.customizeClientModules
);
router.get('/clients/:clientId/modules/overrides', 
  requireModuleAccess(MODULES.PACKAGE_MANAGEMENT),
  packageManagementController.getClientModuleOverrides
);

// Subscription Management routes - Subscription & Billing module
router.get('/subscriptions', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  subscriptionController.getAllSubscriptions
);
router.get('/subscriptions/expiring', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  subscriptionController.getExpiringSubscriptions
);
router.get('/subscriptions/expired', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  subscriptionController.getExpiredSubscriptions
);
router.get('/subscriptions/:id', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  subscriptionController.getSubscriptionById
);
router.post('/subscriptions', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.CREATE),
  auditSuperAdminAction('CREATE_SUBSCRIPTION', 'Subscription'),
  subscriptionController.createSubscription
);
router.put('/subscriptions/:id', 
  auditBillingOperation('UPDATE_SUBSCRIPTION'),
  auditSuperAdminAction('UPDATE_SUBSCRIPTION', 'Subscription'),
  subscriptionController.updateSubscription
);
router.patch('/subscriptions/:id/renew', 
  auditBillingOperation('RENEW_SUBSCRIPTION'),
  auditSuperAdminAction('RENEW_SUBSCRIPTION', 'Subscription'),
  subscriptionController.renewSubscription
);
router.patch('/subscriptions/:id/cancel', 
  auditBillingOperation('CANCEL_SUBSCRIPTION'),
  auditSuperAdminAction('CANCEL_SUBSCRIPTION', 'Subscription'),
  subscriptionController.cancelSubscription
);
router.patch('/subscriptions/:id/suspend', 
  auditBillingOperation('SUSPEND_SUBSCRIPTION'),
  auditSuperAdminAction('SUSPEND_SUBSCRIPTION', 'Subscription'),
  subscriptionController.suspendSubscription
);
router.patch('/subscriptions/:id/reactivate', 
  auditBillingOperation('REACTIVATE_SUBSCRIPTION'),
  auditSuperAdminAction('REACTIVATE_SUBSCRIPTION', 'Subscription'),
  subscriptionController.reactivateSubscription
);

// Invoice Management routes - Subscription & Billing module
router.get('/invoices/stats', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingController.getInvoiceStats
);
router.get('/invoices', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingController.getAllInvoices
);
router.get('/invoices/overdue', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingController.getOverdueInvoices
);
router.get('/invoices/due-soon', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingController.getInvoicesDueSoon
);
router.get('/invoices/:id', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingController.getInvoiceById
);
router.post('/invoices/generate', 
  auditBillingOperation('GENERATE_INVOICE'),
  auditSuperAdminAction('GENERATE_INVOICE', 'Invoice'),
  billingController.generateInvoice
);
router.put('/invoices/:id', 
  auditBillingOperation('UPDATE_INVOICE'),
  auditSuperAdminAction('UPDATE_INVOICE', 'Invoice'),
  billingController.updateInvoice
);
router.patch('/invoices/:id/mark-paid', 
  forceSuperAdminBypass, // Force Super Admin bypass for this route
  auditBillingOperation('MARK_INVOICE_PAID'), // Now respects bypass
  auditSuperAdminAction('MARK_INVOICE_PAID', 'Invoice'), // Now respects bypass
  billingController.markInvoiceAsPaid
);
router.patch('/invoices/:id/send-reminder', 
  auditBillingOperation('SEND_INVOICE_REMINDER'),
  auditSuperAdminAction('SEND_INVOICE_REMINDER', 'Invoice'),
  billingController.sendInvoiceReminder
);
router.get('/invoices/:id/pdf', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingController.generateInvoicePDF
);

// Payment Management routes - Subscription & Billing module
router.get('/payments', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  paymentController.getAllPayments
);
router.get('/payments/pending', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  paymentController.getPendingPayments
);
router.get('/payments/failed', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  paymentController.getFailedPayments
);
router.get('/payments/stats', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  paymentController.getPaymentStats
);
router.get('/payments/:id', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  paymentController.getPaymentById
);
router.post('/payments', 
  canProcessPayment,
  auditBillingOperation('CREATE_PAYMENT'),
  auditSuperAdminAction('CREATE_PAYMENT', 'Payment'),
  paymentController.createPayment
);
router.patch('/payments/:id/status', 
  canProcessPayment,
  auditBillingOperation('UPDATE_PAYMENT_STATUS'),
  auditSuperAdminAction('UPDATE_PAYMENT_STATUS', 'Payment'),
  paymentController.updatePaymentStatus
);
router.patch('/payments/:id/refund', 
  canProcessRefund,
  requireHighValueApproval(1000),
  auditBillingOperation('PROCESS_REFUND'),
  auditSuperAdminAction('PROCESS_REFUND', 'Payment'),
  paymentController.processRefund
);
router.patch('/payments/:id/verify', 
  canVerifyPayment,
  auditBillingOperation('VERIFY_PAYMENT'),
  auditSuperAdminAction('VERIFY_PAYMENT', 'Payment'),
  paymentController.verifyPayment
);
router.patch('/payments/:id/reconcile', 
  canReconcilePayment,
  auditBillingOperation('RECONCILE_PAYMENT'),
  auditSuperAdminAction('RECONCILE_PAYMENT', 'Payment'),
  paymentController.reconcilePayment
);

// Revenue Analytics routes - Subscription & Billing module
router.get('/revenue/dashboard', 
  canViewRevenueDashboard,
  revenueController.getRevenueDashboard
);
router.get('/revenue/report', 
  canExportRevenueData,
  revenueController.getRevenueReport
);
router.get('/revenue/subscription-analytics', 
  canViewRevenueDashboard,
  revenueController.getSubscriptionAnalytics
);
router.get('/billing/revenue-stats', 
  canViewRevenueDashboard,
  billingController.getRevenueStats
);

// Billing Automation routes - Subscription & Billing module
router.post('/billing/automation/run-daily', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.CONFIGURE),
  auditSuperAdminAction('RUN_BILLING_AUTOMATION', 'System'),
  billingAutomationController.runDailyAutomation
);
router.get('/billing/automation/status', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingAutomationController.getAutomationStatus
);
router.get('/billing/automation/settings', 
  requireModuleAccess(MODULES.SUBSCRIPTION_BILLING),
  billingAutomationController.getAutomationSettings
);
router.put('/billing/automation/settings', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.CONFIGURE),
  auditSuperAdminAction('UPDATE_AUTOMATION_SETTINGS', 'System'),
  billingAutomationController.updateAutomationSettings
);
router.post('/billing/automation/trigger-renewal/:subscriptionId', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.UPDATE),
  auditSuperAdminAction('TRIGGER_RENEWAL_ALERT', 'Subscription'),
  billingAutomationController.triggerRenewalAlert
);
router.post('/billing/automation/trigger-auto-renewal/:subscriptionId', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.UPDATE),
  auditSuperAdminAction('TRIGGER_AUTO_RENEWAL', 'Subscription'),
  billingAutomationController.triggerAutoRenewal
);
router.post('/billing/automation/test-notifications', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.CONFIGURE),
  auditSuperAdminAction('TEST_BILLING_NOTIFICATIONS', 'System'),
  billingAutomationController.testNotifications
);

// Database Seeding route - Development/Testing only
router.post('/system/seed-billing-data', 
  checkSuperAdminPermission(MODULES.SUBSCRIPTION_BILLING, ACTIONS.CONFIGURE),
  auditSuperAdminAction('SEED_BILLING_DATA', 'System'),
  async (req, res) => {
    try {
      const { clearExisting = false } = req.body;
      
      console.log('🌱 Seeding billing data via API...');
      const result = await seedBillingData(clearExisting);
      
      res.json({
        success: true,
        message: 'Billing data seeded successfully',
        data: {
          users: result.users.length,
          clients: result.clients.length,
          packages: result.packages.length,
          clientPackages: result.clientPackages.length,
          subscriptions: result.subscriptions.length,
          invoices: result.invoices.length,
          payments: result.payments.length
        }
      });
    } catch (error) {
      console.error('❌ Error seeding billing data:', error);
      res.status(500).json({
        success: false,
        message: 'Error seeding billing data',
        error: error.message
      });
    }
  }
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
