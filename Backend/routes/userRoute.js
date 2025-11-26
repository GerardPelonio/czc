const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const { registerValidator, loginValidator } = require('../validators/userValidator');
const { sendOtpValidator, resetOtpValidator } = require('../validators/forgotPasswordValidator');
const { authLimiter } = require('../middlewares/authLimit');

// User Routes
router.post('/api/user/register', authLimiter, registerValidator, controller.registerUser);
router.post('/api/user/login', authLimiter, loginValidator, controller.loginUser);

// Forgot Password Routes
router.post('/api/user/forgot-password/send', authLimiter, sendOtpValidator, controller.sendForgotPasswordOtp);
router.post('/api/user/forgot-password/verify', authLimiter, resetOtpValidator, controller.resetPasswordWithOtp);

module.exports = router;