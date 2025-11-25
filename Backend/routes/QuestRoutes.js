const express = require('express');
const router = express.Router();
const controller = require('../controllers/QuestController');
const { updateProgressValidator } = require('../validators/QuestValidators');
const { authLimiter } = require('../middlewares/authLimit');

// Update Quest Progress
router.post(
  '/api/quest/progress',
  authLimiter,
  updateProgressValidator,
  controller.updateProgress
);

module.exports = router;
