const service = require('../services/userService');
const nodemailer = require('nodemailer');
const studentService = require('../services/studentService');
const teacherService = require('../services/teacherService');

async function registerUser (req, res) {
  try {
    const { username, email, password, id, role } = req.body;
    const user = await service.registerUser({ username, email, password, id, role });

    const r = String(role || '').toLowerCase();
    if (r === 'student') {
      await studentService.createProfile(user.id, { displayName: username, username });
    } else if (r === 'teacher') {
      await teacherService.createProfile(user.id, { name: username, username });
    }

    res.status(201).json({ success: true, message: 'User registered successfully', data: { user } });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function loginUser (req, res) {
  try {
    const { email, password, role } = req.body;
    const result = await service.authenticateUser(email, password, role);
    res.status(200).json({ success: true, message: 'Login successful', data: result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

// Sends OTP to email for password reset
async function sendForgotPasswordOtp(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'Missing email' });

    const { code } = await service.createForgotOtp(email);

    if (process.env.DEBUG_FORGOT === 'true') {
      return res.status(201).json({ success: true, message: 'OTP created (debug)', data: { code } });
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;

    if (host && user && pass) {
      const transporter = nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
      const text = `Your password reset code is: ${code}. It expires in 15 minutes.`;
      await transporter.sendMail({ from: user, to: email, subject: 'Password reset code', text });
      return res.status(202).json({ success: true, message: 'OTP sent' });
    }

    return res.status(202).json({ success: true, message: 'OTP created (delivery not configured)' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message || 'Failed to create OTP' });
  }
}

// Verifies OTP and resets password
async function resetPasswordWithOtp(req, res) {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) return res.status(400).json({ success: false, message: 'Missing parameters' });

    await service.resetPasswordByOtp(email, code, newPassword);
    return res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message || 'Failed to reset password' });
  }
}
module.exports = { registerUser, loginUser, sendForgotPasswordOtp, resetPasswordWithOtp };