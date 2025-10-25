const express = require('express');
const router = express.Router();
const {
  getOffboardingList,
  getOffboarding,
  createOffboarding,
  updateOffboarding,
  advanceStage,
  scheduleExitInterview,
  completeExitInterview,
  recordAssetReturn,
  updateClearance,
  processFinalSettlement,
  deleteOffboarding
} = require('../controllers/offboardingController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/')
  .get(getOffboardingList)
  .post(createOffboarding);

router.post('/:id/advance', advanceStage);
router.post('/:id/exit-interview/schedule', scheduleExitInterview);
router.post('/:id/exit-interview/complete', completeExitInterview);
router.post('/:id/assets/return', recordAssetReturn);
router.post('/:id/clearance', updateClearance);
router.post('/:id/settlement', processFinalSettlement);

router.route('/:id')
  .get(getOffboarding)
  .put(updateOffboarding)
  .delete(deleteOffboarding);

module.exports = router;
