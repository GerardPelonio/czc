const { check } = require('express-validator');

const createValidator = [
  check('plan').isIn(['Free', 'Premium']).withMessage('plan must be Free or Premium'),
  check('name').optional().isString(),
  check('email').optional().isEmail()
];

module.exports = { createValidator };