const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword, googleLogin } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;
