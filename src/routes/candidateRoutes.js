const express = require('express');
const router = express.Router();
const {
  getCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
  updateStage,
  scheduleInterview,
  convertToEmployee,
  deleteCandidate
} = require('../controllers/candidateController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/')
  .get(getCandidates)
  .post(createCandidate);

router.put('/:id/stage', updateStage);
router.post('/:id/interview', scheduleInterview);
router.post('/:id/convert', convertToEmployee);

router.route('/:id')
  .get(getCandidate)
  .put(updateCandidate)
  .delete(deleteCandidate);

module.exports = router;
