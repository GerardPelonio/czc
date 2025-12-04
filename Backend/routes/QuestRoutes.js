const express = require('express');
const router = express.Router();
const controller = require('../controllers/QuestController');
const { authLimiter } = require('../middlewares/authLimit');

// 1. GET /api/quest/progress
// Matches Frontend: fetchQuests()
// Maps to Controller: getQuestsProgress
router.get(
  '/api/quest/progress',
  authLimiter,
  controller.getQuestsProgress
);

// 2. POST /api/quest/complete/:questId
// Matches Frontend: completeQuest(id)
// Maps to Controller: completeQuest
router.post(
  '/api/quest/complete/:questId',
  authLimiter,
  controller.completeQuest
);

module.exports = router;