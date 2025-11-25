// routes/QuestRoutes.js
const express = require("express");
const router = express.Router();
const { updateProgress } = require("../controllers/QuestController");
const { updateProgressValidator } = require("../validators/QuestValidators");
const { validationResult } = require("express-validator");

router.post("/progress", updateProgressValidator, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}, updateProgress);

module.exports = router;
