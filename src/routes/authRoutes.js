const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword, googleLogin, adminResetPassword } = require('../controllers/authController');
const { protect, authorize } = require('../middlewares/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);

// Admin only route to reset user passwords
router.put('/admin/reset-password/:userId', protect, authorize('admin'), adminResetPassword);

module.exports = router;
