const express = require('express');
const router = express.Router();
const SPCProjectController = require('../controllers/spcProjectControllerFixed');
const { protect } = require('../middlewares/auth');
const { PROJECT_PERMISSIONS } = require('../config/spcProjectPermissions');
const SPCProjectAccessMiddleware = require('../middlewares/spcProjectAccess');

/**
 * SPC Project Management Routes - Simplified Version
 */

router.use(protect);

router.get('/projects', SPCProjectController.getProjects);

router.post('/projects',
  SPCProjectAccessMiddleware.requirePermission(PROJECT_PERMISSIONS.PROJECT_CREATE),
  SPCProjectController.createProject
);

router.get('/projects/:projectId',
  SPCProjectAccessMiddleware.requireProjectAccess(),
  SPCProjectController.getProjectDetails
);

router.put('/projects/:projectId',
  SPCProjectAccessMiddleware.requireProjectAccess(),
  SPCProjectAccessMiddleware.requirePermission(PROJECT_PERMISSIONS.PROJECT_EDIT),
  SPCProjectController.updateProject
);

router.post('/projects/:projectId/assign',
  SPCProjectAccessMiddleware.requirePermission(PROJECT_PERMISSIONS.TEAM_ASSIGN_MANAGER),
  SPCProjectController.assignUsersToProject
);

router.post('/projects/:projectId/team', SPCProjectController.createTeamAssignments);

router.get('/dashboard', SPCProjectController.getUserDashboard);

module.exports = router;
