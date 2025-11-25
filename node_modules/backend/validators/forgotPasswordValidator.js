const { body, validationResult } = require('express-validator');

const sendOtpValidator = [
  body('email').exists().isEmail().normalizeEmail(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

const resetOtpValidator = [
  body('email').exists().isEmail().normalizeEmail(),
  body('code').exists().isString().isLength({ min: 4, max: 10 }),
  body('newPassword').exists().isString().isLength({ min: 8 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { sendOtpValidator, resetOtpValidator };