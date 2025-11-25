// validators/LibraryValidator.js
const { query } = require("express-validator");

const LibraryValidator = {
  validateGetStories: [
    query("search")
      .optional()
      .isString()
      .withMessage("search must be a string"),

    query("genre")
      .optional()
      .isString()
      .withMessage("genre must be a string"),

    query("difficulty")
      .optional()
      .isIn(["easy", "medium", "hard"])
      .withMessage("difficulty must be one of: easy, medium, hard"),

    query("readingTime")
      .optional()
      .isNumeric()
      .withMessage("readingTime must be numeric"),

    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("page must be a positive integer"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ],
};

module.exports = LibraryValidator;
