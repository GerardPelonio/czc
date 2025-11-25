// controllers/HomeController.js
const HomeService = require("../services/HomeService");

const HomeController = {
  async saveProgress(req, res) {
    try {
      const result = await HomeService.saveProgress(req.body);
      res.json({ success: true, message: "Progress saved", result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getProgress(req, res) {
    try {
      const { userId, storyId } = req.params;
      const result = await HomeService.getProgress(userId, storyId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getAllUserProgress(req, res) {
    try {
      const { userId } = req.params;
      const result = await HomeService.getAllUserProgress(userId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateSession(req, res) {
    try {
      const { userId, storyId, sessionDuration } = req.body;
      const result = await HomeService.updateSessionDuration(userId, storyId, sessionDuration);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async markCompleted(req, res) {
    try {
      const { userId, storyId, totalReadingTime } = req.body;
      const result = await HomeService.markStoryCompleted(userId, storyId, totalReadingTime);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async resetProgress(req, res) {
    try {
      const { userId, storyId } = req.params;
      const result = await HomeService.resetProgress(userId, storyId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getStats(req, res) {
    try {
      const { userId } = req.params;
      const result = await HomeService.getReadingStats(userId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getRecentStories(req, res) {
    try {
      const { userId } = req.params;
      const result = await HomeService.getRecentStories(userId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getCompletedStories(req, res) {
    try {
      const { userId } = req.params;
      const result = await HomeService.getCompletedStories(userId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  async getReadingProgress(userId, storyId) {
    try {
      // Delegate to HomeService which implements reading progress retrieval
      return await HomeService.getProgress(userId, storyId);
    } catch (error) {
      console.error("Error getting reading progress:", error);
      throw error;
    }
  }
};

module.exports = HomeController;
