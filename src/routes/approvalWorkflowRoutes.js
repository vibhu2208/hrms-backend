const express = require('express');
const router = express.Router();
const {
  getWorkflows,
  getWorkflow,
  getWorkflowStats,
  createWorkflow,
  updateWorkflow,
  duplicateWorkflow,
  archiveWorkflow,
  getWorkflowHistory,
  validateWorkflowDryRun,
  exportWorkflowsCSV,
  exportWorkflowJSON,
  importWorkflowJSON,
  getApprovalMatrices,
  createApprovalMatrix,
  getDelegations,
  createDelegation,
  processApproval,
  getSLAMonitoring,
  triggerSLAEscalation,
  getPendingApprovals
} = require('../controllers/approvalWorkflowController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Pending approvals for current user
router.get('/pending', authorize('admin', 'hr', 'manager', 'spc_manager'), getPendingApprovals);

// Quick stats for dashboards / sidebar badges
router.get('/workflows/stats', authorize('admin'), getWorkflowStats);

// Validate (dry-run) workflow payload without saving
router.post('/workflows/validate', authorize('admin'), validateWorkflowDryRun);

// Export/import workflows
router.get('/workflows/export', authorize('admin'), exportWorkflowsCSV);
router.get('/workflows/:id/export', authorize('admin'), exportWorkflowJSON);
router.post('/workflows/import', authorize('admin'), importWorkflowJSON);

// Workflow management
router.route('/workflows')
  .get(authorize('admin'), getWorkflows)
  .post(authorize('admin'), createWorkflow);

router.route('/workflows/:id')
  .get(authorize('admin'), getWorkflow)
  .put(authorize('admin'), updateWorkflow)
  // Backward-compatible soft archive for older UIs calling DELETE
  .delete(authorize('admin'), archiveWorkflow);

router.post('/workflows/:id/duplicate', authorize('admin'), duplicateWorkflow);
router.post('/workflows/:id/archive', authorize('admin'), archiveWorkflow);
router.get('/workflows/:id/history', authorize('admin'), getWorkflowHistory);

// Approval matrix
router.route('/matrices')
  .get(authorize('admin'), getApprovalMatrices)
  .post(authorize('admin'), createApprovalMatrix);

// Delegation
router.route('/delegations')
  .get(authorize('admin', 'hr', 'manager'), getDelegations)
  .post(authorize('admin', 'hr', 'manager'), createDelegation);

// Approval actions
router.post('/:entityType/:entityId/approve', authorize('admin', 'hr', 'manager'), processApproval);

// SLA monitoring
router.get('/sla', authorize('admin', 'hr'), getSLAMonitoring);
router.post('/sla/escalate', authorize('admin', 'hr'), triggerSLAEscalation);

module.exports = router;


