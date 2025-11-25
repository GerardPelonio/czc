const { body, validationResult } = require('express-validator');

const allowedFreq = ['daily', 'weekly', 'monthly'];

const validateSettings = [
  body('notifications').optional().isObject(),
  body('notifications.email').optional().isBoolean(),
  body('notifications.push').optional().isBoolean(),
  body('notifications.reminderSchedule').optional().isObject(),
  body('notifications.reminderSchedule.enabled').optional().isBoolean(),
  body('notifications.reminderSchedule.frequency').optional().isIn(allowedFreq),
  body('privacy').optional().isObject(),
  body('privacy.shareProfile').optional().isBoolean(),
  body('privacy.twoFactorEnabled').optional().isBoolean(),
  body('reading').optional().isObject(),
  body('reading.view').optional().isString().isIn(['paged', 'scroll']),
  body('reading.autoSave').optional().isBoolean(),
  body('reading.showStats').optional().isBoolean(),
  body('reading.showTimer').optional().isBoolean(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

const validatePasswordChange = [
  body('currentPassword').exists().isString().notEmpty(),
  body('password').exists().isString().isLength({ min: 6 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { validateSettings, validatePasswordChange };