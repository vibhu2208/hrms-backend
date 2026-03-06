const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

router.route('/')
  .get(getDepartments)
  .post(authorize('admin', 'hr', 'company_admin'), createDepartment);

router.route('/:id')
  .get(getDepartment)
  .put(authorize('admin', 'hr', 'company_admin'), updateDepartment)
  .delete(authorize('admin', 'company_admin'), deleteDepartment);

module.exports = router;
