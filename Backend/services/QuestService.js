// services/QuestService.js
const QuestModel = require("../models/QuestModel");

class QuestService {
  static async updateUserQuestProgress(userId, eventType) {
    return await QuestModel.updateProgress(userId, eventType);
  }
}

module.exports = QuestService;
