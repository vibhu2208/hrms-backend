const express = require('express');
const router = express.Router();
const {
  getLeaveQuotas,
  setDefaultQuota,
  createGroupOverride,
  updateGroupOverride,
  deleteGroupOverride,
  applyQuotasToEmployees
} = require('../controllers/leaveManagementController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Get all quotas (defaults and overrides)
router.get('/quotas', authorize('admin', 'company_admin', 'hr'), getLeaveQuotas);

// Default quota management
router.post('/quota/default', authorize('admin', 'company_admin', 'hr'), setDefaultQuota);
router.put('/quota/default/:leaveType', authorize('admin', 'company_admin', 'hr'), setDefaultQuota);

// Group override management
router.post('/quota/override', authorize('admin', 'company_admin', 'hr'), createGroupOverride);
router.put('/quota/override/:id', authorize('admin', 'company_admin', 'hr'), updateGroupOverride);
router.delete('/quota/override/:id', authorize('admin', 'company_admin', 'hr'), deleteGroupOverride);

// Apply quotas to employees
router.post('/quota/apply', authorize('admin', 'company_admin', 'hr'), applyQuotasToEmployees);

module.exports = router;
