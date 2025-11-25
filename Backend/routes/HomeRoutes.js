const express = require('express');
const router = express.Router();
const controller = require('../controllers/HomeController');
const validator = require('../validators/HomeValidators');
const { authLimiter } = require('../middlewares/authLimit');

// Health check
router.get('/api/home', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Home API is working 🚀',
  });
});

// Reading Progress Routes
router.post('/api/home/progress', authLimiter, validator.validateSaveProgress, controller.saveProgress);
router.get('/api/home/progress/:userId/:storyId', authLimiter, validator.validateGetProgress, controller.getProgress);
router.get('/api/home/progress/:userId', authLimiter, validator.validateGetAllProgress, controller.getAllUserProgress);
router.put('/api/home/session', authLimiter, validator.validateUpdateSession, controller.updateSession);
router.put('/api/home/completed', authLimiter, validator.validateMarkCompleted, controller.markCompleted);
router.delete('/api/home/reset/:userId/:storyId', authLimiter, validator.validateResetProgress, controller.resetProgress);

// Statistics & User Dashboard
router.get('/api/home/stats/:userId', authLimiter, validator.validateGetStats, controller.getStats);
router.get('/api/home/recent/:userId', authLimiter, validator.validateGetRecentStories, controller.getRecentStories);
router.get('/api/home/completed/:userId', authLimiter, validator.validateGetCompletedStories, controller.getCompletedStories);

module.exports = router;
