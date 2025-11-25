const express = require('express');
const router = express.Router();
const controller = require('../controllers/streakController');
const { verifyToken } = require('../middlewares/studentMiddleware'); 

// Streak routes
router.get('/api/streaks', verifyToken, controller.getStreak);
router.post('/api/streaks/session', verifyToken, controller.recordSession);

module.exports = router;