const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword, googleLogin, adminResetPassword, getActiveCompanies, unlockAccount, refreshToken, logout, logoutAll, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const { forgotPasswordLimiter, loginLimiter, generalLimiter } = require('../middleware/rateLimiter');

// Apply general rate limiting to all routes
router.use(generalLimiter);

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/google', googleLogin);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);
router.get('/companies', getActiveCompanies);

// Logout routes
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);

// Password reset routes (public with specific rate limiting)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', forgotPasswordLimiter, resetPassword);

// Admin only route to reset user passwords (requires tenant context)
router.put('/admin/reset-password/:userId', protect, tenantMiddleware, authorize('company_admin', 'hr', 'admin'), adminResetPassword);

// Admin only route to unlock accounts
router.post('/unlock-account', protect, authorize('superadmin', 'company_admin', 'hr', 'admin'), unlockAccount);

module.exports = router;
