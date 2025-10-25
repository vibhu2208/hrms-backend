const express = require('express');
const router = express.Router();
const {
  getAssets,
  getAsset,
  createAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  deleteAsset
} = require('../controllers/assetController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getAssets)
  .post(authorize('admin', 'hr'), createAsset);

router.put('/:id/assign', authorize('admin', 'hr'), assignAsset);
router.put('/:id/return', authorize('admin', 'hr'), returnAsset);

router.route('/:id')
  .get(getAsset)
  .put(authorize('admin', 'hr'), updateAsset)
  .delete(authorize('admin'), deleteAsset);

module.exports = router;
