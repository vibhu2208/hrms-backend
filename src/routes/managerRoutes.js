const express = require('express');
const router = express.Router();
const {
  getTeamMembers,
  getTeamStats,
  getPendingLeaves,
  approveLeave,
  rejectLeave
} = require('../controllers/managerController');
const { protect } = require('../middlewares/auth');

// Protect all routes - require authentication
router.use(protect);

// Team management routes
router.get('/team-members', getTeamMembers);
router.get('/team-stats', getTeamStats);

// Leave management routes
router.get('/pending-leaves', getPendingLeaves);
router.put('/leave/:id/approve', approveLeave);
router.put('/leave/:id/reject', rejectLeave);

module.exports = router;
