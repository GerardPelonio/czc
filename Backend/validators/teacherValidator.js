const { body, validationResult } = require('express-validator');

const MAX_AVATAR_BYTES = 1 * 1024 * 1024; // 1MB
const DATA_URI_RE = /^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i;

const validateTeacherUpdate = [
  body('name').optional().isString().trim().notEmpty(),
  body('subject').optional().isString().trim(),
  body('username').optional().isString().trim().notEmpty(),
  body('password').optional().isString().isLength({ min: 6 }),
  body('currentPassword').optional().isString().isLength({ min: 1 }),
  body('avatarUrl').optional().isURL().withMessage('avatarUrl must be a valid URL'),
  body('customization').optional().isObject(),
  body('assignedStudents').optional().isArray(),
  body('assignedStudents.*').optional().isString().trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { validateTeacherUpdate };