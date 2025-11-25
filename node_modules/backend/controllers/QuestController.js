// controllers/QuestController.js
const QuestModel = require("../models/QuestModel");

async function updateProgress(req, res) {
  try {
    const { userId, eventType } = req.body || {};

    if (!userId || !eventType) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or eventType"
      });
    }

    const result = await QuestModel.updateProgress(userId, eventType);

    return res.status(200).json({
      success: true,
      message: "Quest progress updated",
      data: {
        coinsEarned: result.coinsEarned || 0,
        error: result.error || null
      }
    });

  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update quest progress"
    });
  }
}

module.exports = { updateProgress };
