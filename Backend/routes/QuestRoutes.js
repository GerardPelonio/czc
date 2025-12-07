// Backend/routes/questRoutes.js - ADD THESE TWO ROUTES

const express = require('express');
const router = express.Router();
const controller = require('../controllers/QuestController');
const { authLimiter } = require('../middlewares/authLimit');
const { verifyToken } = require('../middlewares/auth');

// Existing routes
router.get('/api/quest/progress', verifyToken, controller.getQuestsProgress);
router.post('/api/quest/complete/:questId', authLimiter, verifyToken, controller.completeQuest);
router.post('/api/quest/update-progress', verifyToken, controller.updateQuestProgress);

// NEW: Coin routes
router.get('/api/user/coins', verifyToken, controller.getUserCoins);
router.post('/api/user/add-coins', authLimiter, verifyToken, controller.addCoins);

module.exports = router;