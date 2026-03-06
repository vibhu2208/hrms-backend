const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Apply middleware in correct order: auth first, then tenant, then authorization
router.use(protect);
router.use(tenantMiddleware);
router.use(authorize('admin', 'hr', 'company_admin'));

router.get('/stats', getDashboardStats);

module.exports = router;
