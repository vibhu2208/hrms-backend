const express = require('express');
const router = express.Router();
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientDeploymentSummary
} = require('../controllers/clientController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

router.get('/deployment-summary', authorize('admin', 'hr'), getClientDeploymentSummary);

router.route('/')
  .get(getClients)
  .post(authorize('admin', 'hr'), createClient);

router.route('/:id')
  .get(getClient)
  .put(authorize('admin', 'hr'), updateClient)
  .delete(authorize('admin'), deleteClient);

module.exports = router;
