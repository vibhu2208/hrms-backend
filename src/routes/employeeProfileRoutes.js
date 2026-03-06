const express = require('express');
const router = express.Router();
const {
  getFamilyDetails,
  createFamilyDetail,
  updateFamilyDetail,
  deleteFamilyDetail,
  getCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
  getOfficialData,
  createProfileUpdateRequest,
  getProfileUpdateRequests,
  approveProfileUpdateRequest
} = require('../controllers/employeeProfileController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);

// Family Details
router.route('/family')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getFamilyDetails)
  .post(authorize('admin', 'hr', 'employee'), createFamilyDetail);

router.route('/family/:id')
  .put(authorize('admin', 'hr', 'employee'), updateFamilyDetail)
  .delete(authorize('admin', 'hr', 'employee'), deleteFamilyDetail);

// Certifications
router.route('/certifications')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getCertifications)
  .post(authorize('admin', 'hr', 'employee'), createCertification);

router.route('/certifications/:id')
  .put(authorize('admin', 'hr', 'employee'), updateCertification)
  .delete(authorize('admin', 'hr', 'employee'), deleteCertification);

// Official Data (read-only)
router.get('/official', authorize('admin', 'hr', 'manager', 'employee'), getOfficialData);

// Profile Update Requests
router.route('/update-requests')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getProfileUpdateRequests)
  .post(authorize('admin', 'hr', 'employee'), createProfileUpdateRequest);

router.post('/update-requests/:id/approve', authorize('admin', 'hr', 'manager'), approveProfileUpdateRequest);

module.exports = router;


