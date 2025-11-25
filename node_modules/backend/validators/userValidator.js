const { body, validationResult } = require('express-validator');

const registerValidator = [
  body('email').isEmail().normalizeEmail(),
  body('username').isString().notEmpty(),
  body('password').isString().notEmpty().isLength({ min: 6 }),
  body('role').isString().notEmpty().trim().toLowerCase().isIn(['student', 'teacher']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

const loginValidator = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { registerValidator, loginValidator };