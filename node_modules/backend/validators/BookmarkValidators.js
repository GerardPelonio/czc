// validators/BookmarkValidator.js
const { body, query, param } = require("express-validator");

const addBookmarkValidator = [
  body("userId")
    .trim()
    .notEmpty()
    .withMessage("userId is required")
    .isString()
    .withMessage("userId must be a string"),

  body("bookId")
    .trim()
    .notEmpty()
    .withMessage("bookId is required")
    .matches(/^(GB|OL)\d+$/)
    .withMessage("bookId must be in format GB123 or OL456"),

  body("bookTitle")
    .trim()
    .notEmpty()
    .withMessage("bookTitle is required")
    .isString()
    .withMessage("bookTitle must be a string")
    .isLength({ min: 1, max: 200 })
    .withMessage("bookTitle too long"),

  body("chapter")
    .optional()
    .isInt({ min: 1 })
    .withMessage("chapter must be a positive integer")
];

const getBookmarksValidator = [
  query("userId")
    .trim()
    .notEmpty()
    .withMessage("userId is required in query")
    .isString()
    .withMessage("userId must be a string")
];

const deleteBookmarkValidator = [
  param("bookmarkId")
    .trim()
    .notEmpty()
    .withMessage("bookmarkId is required in URL")
    .matches(/^.+$/)
    .withMessage("Invalid bookmarkId format"),

  body("userId")
    .trim()
    .notEmpty()
    .withMessage("userId is required in body")
    .isString()
    .withMessage("userId must be a string")
];

module.exports = {
  addBookmarkValidator,
  getBookmarksValidator,
  deleteBookmarkValidator
};