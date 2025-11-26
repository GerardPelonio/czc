// routes/StoryRoutes.js
const express = require("express");
const router = express.Router();
const StoryController = require("../controllers/StoryController");
const validate = require("../validators/StoryValidators"); // Fixed path

// Health check for stories
router.get("/api/stories", (req, res) => {
  res.status(200).json({ success: true, message: "Story API is running" });
});

// Fetch story
// Fetch story by id: usage => GET /api/stories/GB22440
router.get("/api/stories/:id", validate("getStoryById"), StoryController.getStoryById);
// Backwards-compatible route for older clients that request GET /GB22440
router.get('/:id([gG][bB]\d+)', validate('getStoryById'), StoryController.getStoryById);

// Save progress
router.post("/progress", validate("saveProgress"), async (req, res) => {
  // ... your logic
});

module.exports = router;