const express = require('express');
const router = express.Router();
const {
  getOnboardingList,
  getOnboarding,
  createOnboarding,
  updateOnboarding,
  advanceStage,
  setJoiningDate,
  addTask,
  completeTask,
  deleteOnboarding
} = require('../controllers/onboardingController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/')
  .get(getOnboardingList)
  .post(createOnboarding);

router.post('/:id/advance', advanceStage);
router.post('/:id/joining', setJoiningDate);
router.post('/:id/tasks', addTask);
router.put('/:id/tasks/:taskId/complete', completeTask);

router.route('/:id')
  .get(getOnboarding)
  .put(updateOnboarding)
  .delete(deleteOnboarding);

module.exports = router;
