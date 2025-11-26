// validators/QuizValidators.js
const { body, param, query } = require("express-validator");

const generateQuizValidator = [
  body("userId").trim().notEmpty().isString(),
  body("storyId").trim().notEmpty().matches(/^GB\d+$/), // Only GB for now
  body("content").optional().isString().isLength({ min: 50 })
];

const getQuizValidator = [
  param("storyId").trim().notEmpty().matches(/^GB\d+$/),
  query("userId").trim().notEmpty().isString()
];

const submitQuizValidator = [
  body("userId").trim().notEmpty().isString(),
  body("storyId").trim().notEmpty().matches(/^GB\d+$/),
  body("answers").isArray({ min: 10, max: 10 }),
  body("answers.*").isString(),
  body("timeTaken").isInt({ min: 1 })
];

module.exports = { generateQuizValidator, getQuizValidator, submitQuizValidator };  