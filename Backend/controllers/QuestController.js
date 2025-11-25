// controllers/QuestController.js
const QuestModel = require("../models/QuestModel");

exports.updateProgress = async (req, res) => {
  try {
    const { userId, eventType } = req.body;

    if (!userId || !eventType) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or eventType"
      });
    }

    const result = await QuestModel.updateProgress(userId, eventType);

    res.json({
      success: true,
      coinsEarned: result.coinsEarned || 0,
      error: result.error || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
