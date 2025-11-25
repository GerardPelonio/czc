// validators/StoryValidator.js
const { param, body } = require("express-validator");

const StoryValidator = {
  // Validate GET /:id
  validateGetStoryById: [
    param("id")
      .notEmpty()
      .withMessage("Story ID is required")
      .isString()
      .withMessage("Story ID must be a string"),
  ],

  // Validate progress save
  validateSaveProgress: [
    body("userId").notEmpty().withMessage("User ID is required"),
    body("storyId").notEmpty().withMessage("Story ID is required"),
    body("scrollPosition").optional().isNumeric(),
    body("readingTime").optional().isNumeric(),
    body("currentPage").optional().isInt({ min: 1 }),
    body("completed").optional().isBoolean(),
  ],
};

// Export as function to use with router
module.exports = (method) => {
  switch (method) {
    case "getStoryById":
      return StoryValidator.validateGetStoryById;
    case "saveProgress":
      return StoryValidator.validateSaveProgress;
    default:
      return [];
  }
};