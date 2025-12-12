const { body, validationResult } = require('express-validator');

const createOrUpdateProfile = [
  body('displayName').optional().isString().trim().notEmpty(),
  body('grade_level').optional().isString().trim(),
  body('age').optional().isInt({ min: 0, max: 120 }).withMessage('age must be an integer between 0 and 120').toInt(),
  body('classes').optional().isArray(),
  body('classes.*').optional().isString().trim(),
  body('booksRead').optional().isArray(),
  body('booksRead.*').optional().isString().trim(),
  body('avatarUrl').optional().isString().trim(),
  body('customization').optional().isObject(),
  body('unlockedItems').optional().isArray(),
  body('unlockedItems.*').optional().isString().trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { createOrUpdateProfile };