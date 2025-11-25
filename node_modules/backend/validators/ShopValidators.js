const { body, query, param } = require("express-validator");

const listItemsValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
  query("limit").optional().isInt({ min: 1 }).withMessage("limit must be >= 1"),
];

const redeemValidator = [
  body("userId").trim().notEmpty().withMessage("userId is required").isString(),
  body("itemId").trim().notEmpty().withMessage("itemId is required").isString(),
];

const getTransactionsValidator = [
  param("userId").trim().notEmpty().withMessage("userId is required").isString(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1 }),
];

module.exports = { listItemsValidator, redeemValidator, getTransactionsValidator };
