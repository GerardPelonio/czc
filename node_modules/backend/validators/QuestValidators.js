// validators/QuestValidator.js
const { body } = require("express-validator");

const updateProgressValidator = [
  body("userId")
    .trim()
    .notEmpty()
    .withMessage("userId is required"),

  body("eventType")
    .trim()
    .notEmpty()
    .withMessage("eventType is required")
    .isString()
    .withMessage("eventType must be a string")
];

module.exports = {
  updateProgressValidator
};
