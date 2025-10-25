const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  assignEmployee,
  removeEmployee,
  deleteProject
} = require('../controllers/projectController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('admin', 'hr'), createProject);

router.post('/:id/assign', authorize('admin', 'hr'), assignEmployee);
router.post('/:id/remove', authorize('admin', 'hr'), removeEmployee);

router.route('/:id')
  .get(getProject)
  .put(authorize('admin', 'hr'), updateProject)
  .delete(authorize('admin'), deleteProject);

module.exports = router;
