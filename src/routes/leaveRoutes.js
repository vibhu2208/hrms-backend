const express = require('express');
const router = express.Router();
const {
  getLeaves,
  getLeave,
  createLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  deleteLeave
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getLeaves)
  .post(createLeave);

router.put('/:id/approve', authorize('admin', 'hr'), approveLeave);
router.put('/:id/reject', authorize('admin', 'hr'), rejectLeave);

router.route('/:id')
  .get(getLeave)
  .put(updateLeave)
  .delete(deleteLeave);

module.exports = router;
