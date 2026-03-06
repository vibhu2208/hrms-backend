const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  assignEmployee,
  removeEmployee,
  deleteProject,
  getPendingProjects,
  approveProject,
  rejectProject
} = require('../controllers/projectController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

router.route('/')
  .get(getProjects)
  .post(authorize('admin', 'hr'), createProject);

router.post('/:id/assign', authorize('admin', 'hr'), assignEmployee);
router.post('/:id/remove', authorize('admin', 'hr'), removeEmployee);

// Admin approval routes
router.get('/pending', authorize('admin', 'hr'), getPendingProjects);
router.post('/:id/approve', authorize('admin', 'hr'), approveProject);
router.post('/:id/reject', authorize('admin', 'hr'), rejectProject);

router.route('/:id')
  .get(getProject)
  .put(authorize('admin', 'hr'), updateProject)
  .delete(authorize('admin'), deleteProject);

module.exports = router;
