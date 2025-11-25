const { body, validationResult } = require('express-validator');

const recordSessionValidator = [
  body('date').optional().isISO8601(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { recordSessionValidator };