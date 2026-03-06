const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middlewares/auth');
const networkController = require('../controllers/networkController');
const allowedNetworkController = require('../controllers/allowedNetworkController');

router.use(protect);

// Employee: verify if current public IP is office-whitelisted
router.get('/verify', authorize('employee', 'admin', 'hr', 'manager', 'company_admin'), networkController.verifyNetwork);

// Admin/HR: manage office IP whitelist
router.get('/allowed', authorize('admin', 'hr', 'company_admin'), allowedNetworkController.listAllowedNetworks);
router.post('/allowed', authorize('admin', 'hr', 'company_admin'), allowedNetworkController.createAllowedNetwork);
router.put('/allowed/:id', authorize('admin', 'hr', 'company_admin'), allowedNetworkController.updateAllowedNetwork);
router.delete('/allowed/:id', authorize('admin', 'hr', 'company_admin'), allowedNetworkController.deleteAllowedNetwork);

module.exports = router;
