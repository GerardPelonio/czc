// routes/StoryRoutes.js
const express = require("express");
const router = express.Router();
const StoryController = require("../controllers/StoryController");
const validate = require("../validators/StoryValidators"); // Fixed path

// Health check
router.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Story API is running" });
});

// Fetch story
router.get("/:id", validate("getStoryById"), StoryController.getStoryById);

// Save progress
router.post("/progress", validate("saveProgress"), async (req, res) => {
  // ... your logic
});

module.exports = router;