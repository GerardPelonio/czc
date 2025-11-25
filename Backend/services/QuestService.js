const QuestModel = require('../models/QuestModel');

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

async function updateUserQuestProgress(userId, eventType) {
  if (!userId) throw err('userId is required', 400);
  if (!eventType) throw err('eventType is required', 400);

  return QuestModel.updateProgress(userId, eventType);
}

module.exports = {
  updateUserQuestProgress,
};
