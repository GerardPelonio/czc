// controllers/HomeController.js
const HomeService = require("../services/HomeService");

// Save reading progress
async function saveProgress(req, res) {
  try {
    const data = await HomeService.saveProgress(req.body);
    return res.status(200).json({
      success: true,
      message: "Progress saved",
      data
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to save progress"
    });
  }
}

// Get progress for specific story
async function getProgress(req, res) {
  try {
    const { userId, storyId } = req.params;
    const data = await HomeService.getProgress(userId, storyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch progress"
    });
  }
}

// Get all progress of a user
async function getAllUserProgress(req, res) {
  try {
    const { userId } = req.params;
    const data = await HomeService.getAllUserProgress(userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch all user progress"
    });
  }
}

// Update session duration
async function updateSession(req, res) {
  try {
    const { userId, storyId, sessionDuration } = req.body;
    const data = await HomeService.updateSessionDuration(
      userId,
      storyId,
      sessionDuration
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update session duration"
    });
  }
}

// Mark story as completed
async function markCompleted(req, res) {
  try {
    const { userId, storyId, totalReadingTime } = req.body;
    const data = await HomeService.markStoryCompleted(
      userId,
      storyId,
      totalReadingTime
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to mark story completed"
    });
  }
}

// Reset story progress
async function resetProgress(req, res) {
  try {
    const { userId, storyId } = req.params;
    const data = await HomeService.resetProgress(userId, storyId);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to reset progress"
    });
  }
}

// Get user reading stats
async function getStats(req, res) {
  try {
    const { userId } = req.params;
    const data = await HomeService.getReadingStats(userId);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch reading stats"
    });
  }
}

// Get recently read stories
async function getRecentStories(req, res) {
  try {
    const { userId } = req.params;
    const data = await HomeService.getRecentStories(userId);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch recent stories"
    });
  }
}

// Get completed stories
async function getCompletedStories(req, res) {
  try {
    const { userId } = req.params;
    const data = await HomeService.getCompletedStories(userId);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch completed stories"
    });
  }
}

// Helper for internal usage (does not return res)
async function getReadingProgress(userId, storyId) {
  try {
    return await HomeService.getProgress(userId, storyId);
  } catch (error) {
    console.error("Error getting reading progress:", error);
    throw error;
  }
}

module.exports = {
  saveProgress,
  getProgress,
  getAllUserProgress,
  updateSession,
  markCompleted,
  resetProgress,
  getStats,
  getRecentStories,
  getCompletedStories,
  getReadingProgress
};
