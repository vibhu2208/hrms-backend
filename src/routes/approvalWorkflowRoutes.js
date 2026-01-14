const express = require('express');
const router = express.Router();
const {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  getApprovalMatrices,
  createApprovalMatrix,
  getDelegations,
  createDelegation,
  processApproval,
  getSLAMonitoring,
  triggerSLAEscalation
} = require('../controllers/approvalWorkflowController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Workflow management
router.route('/workflows')
  .get(authorize('admin', 'hr'), getWorkflows)
  .post(authorize('admin', 'hr'), createWorkflow);

router.route('/workflows/:id')
  .put(authorize('admin', 'hr'), updateWorkflow);

// Approval matrix
router.route('/matrices')
  .get(authorize('admin', 'hr'), getApprovalMatrices)
  .post(authorize('admin', 'hr'), createApprovalMatrix);

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


