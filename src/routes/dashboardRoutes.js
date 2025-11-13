const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Apply middleware in correct order: auth first, then tenant
router.use(protect);
router.use(tenantMiddleware);

router.get('/stats', getDashboardStats);

module.exports = router;
