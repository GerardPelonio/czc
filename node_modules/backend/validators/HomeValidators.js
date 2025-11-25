// validators/HomeValidator.js
const { body, param } = require("express-validator");

const HomeValidator = {
  validateSaveProgress: [
    body("userId").notEmpty().withMessage("userId is required"),
    body("storyId").notEmpty().withMessage("storyId is required"),
    body("progressPercentage")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("progressPercentage must be between 0 and 100"),
  ],

  validateGetProgress: [
    param("userId").notEmpty().withMessage("userId param required"),
    param("storyId").notEmpty().withMessage("storyId param required"),
  ],

  validateGetAllProgress: [
    param("userId").notEmpty().withMessage("userId param required"),
  ],

  validateUpdateSession: [
    body("userId").notEmpty().withMessage("userId is required"),
    body("storyId").notEmpty().withMessage("storyId is required"),
    body("sessionDuration")
      .isNumeric()
      .withMessage("sessionDuration must be numeric"),
  ],

  validateMarkCompleted: [
    body("userId").notEmpty().withMessage("userId is required"),
    body("storyId").notEmpty().withMessage("storyId is required"),
    body("totalReadingTime")
      .isNumeric()
      .withMessage("totalReadingTime must be numeric"),
  ],

  validateResetProgress: [
    param("userId").notEmpty().withMessage("userId param required"),
    param("storyId").notEmpty().withMessage("storyId param required"),
  ],

  validateGetStats: [
    param("userId").notEmpty().withMessage("userId param required"),
  ],

  validateGetRecentStories: [
    param("userId").notEmpty().withMessage("userId param required"),
  ],

  validateGetCompletedStories: [
    param("userId").notEmpty().withMessage("userId param required"),
  ],
};

module.exports = HomeValidator;
