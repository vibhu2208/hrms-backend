const express = require('express');
const router = express.Router();
const {
  getCompliances,
  getCompliance,
  createCompliance,
  updateCompliance,
  completeCompliance,
  getDueCompliances,
  deleteCompliance
} = require('../controllers/complianceController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/due', authorize('admin', 'hr'), getDueCompliances);

router.route('/')
  .get(getCompliances)
  .post(authorize('admin', 'hr'), createCompliance);

router.put('/:id/complete', authorize('admin', 'hr'), completeCompliance);

router.route('/:id')
  .get(getCompliance)
  .put(authorize('admin', 'hr'), updateCompliance)
  .delete(authorize('admin'), deleteCompliance);

module.exports = router;
