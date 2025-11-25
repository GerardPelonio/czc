// routes/HomeRoutes.js
const express = require("express");
const router = express.Router();
const HomeController = require("../controllers/HomeController");
const HomeValidator = require("../validators/HomeValidators");

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Home API is working 🚀"
  });
});

router.post("/progress", HomeValidator.validateSaveProgress, HomeController.saveProgress);
router.get("/progress/:userId/:storyId", HomeValidator.validateGetProgress, HomeController.getProgress);
router.get("/progress/:userId", HomeValidator.validateGetAllProgress, HomeController.getAllUserProgress);
router.put("/session", HomeValidator.validateUpdateSession, HomeController.updateSession);
router.put("/completed", HomeValidator.validateMarkCompleted, HomeController.markCompleted);
router.delete("/reset/:userId/:storyId", HomeValidator.validateResetProgress, HomeController.resetProgress);
router.get("/stats/:userId", HomeValidator.validateGetStats, HomeController.getStats);
router.get("/recent/:userId", HomeValidator.validateGetRecentStories, HomeController.getRecentStories);
router.get("/completed/:userId", HomeValidator.validateGetCompletedStories, HomeController.getCompletedStories);

module.exports = router;
