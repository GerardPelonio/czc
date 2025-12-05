// Backend/routes/questRoutes.js - ADD THESE TWO ROUTES

const express = require('express');
const router = express.Router();
const controller = require('../controllers/QuestController');
const { authLimiter } = require('../middlewares/authLimit');

// Existing routes
router.get('/api/quest/progress', authLimiter, controller.getQuestsProgress);
router.post('/api/quest/complete/:questId', authLimiter, controller.completeQuest);

// NEW: Coin routes
router.get('/api/user/coins', authLimiter, controller.getUserCoins);
router.post('/api/user/add-coins', authLimiter, controller.addCoins);

module.exports = router;