const express = require('express');
const router = express.Router();
const {
  getDocuments,
  getDocument,
  uploadDocument,
  verifyDocument,
  rejectDocument,
  getExpiringDocuments,
  deleteDocument
} = require('../controllers/documentController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/expiring', authorize('admin', 'hr'), getExpiringDocuments);

router.route('/')
  .get(getDocuments)
  .post(uploadDocument);

router.put('/:id/verify', authorize('admin', 'hr'), verifyDocument);
router.put('/:id/reject', authorize('admin', 'hr'), rejectDocument);

router.route('/:id')
  .get(getDocument)
  .delete(deleteDocument);

module.exports = router;
