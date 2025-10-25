const express = require('express');
const router = express.Router();
const {
  getExitProcesses,
  getExitProcess,
  initiateExitProcess,
  updateClearance,
  scheduleExitInterview,
  completeExitInterview,
  processFinalSettlement,
  deleteExitProcess
} = require('../controllers/exitProcessController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/')
  .get(getExitProcesses)
  .post(initiateExitProcess);

router.post('/:id/clearance', updateClearance);
router.post('/:id/exit-interview/schedule', scheduleExitInterview);
router.post('/:id/exit-interview/complete', completeExitInterview);
router.post('/:id/settlement', processFinalSettlement);

router.route('/:id')
  .get(getExitProcess)
  .delete(deleteExitProcess);

module.exports = router;
