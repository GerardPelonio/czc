const COLLECTION = 'quests';

const questSchema = {
  questId: { type: 'string', required: true, unique: true },
  title: { type: 'string', required: true },
  description: { type: 'string', required: false },
  trigger: { type: 'string', required: true }, // event type that triggers the quest
  target: { type: 'number', required: true }, // number of times to complete
  rewardCoins: { type: 'number', required: true },
  createdAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

const studentQuestSchema = {
  userId: { type: 'string', required: true },
  quests: {
    type: 'array',
    items: {
      questId: { type: 'string', required: true },
      progress: { type: 'number', default: 0 },
      completed: { type: 'boolean', default: false },
      // FIX: Add missing fields used by QuestService
      updatedAt: { type: 'timestamp', default: null },
      completedAt: { type: 'timestamp', default: null },
      storyIds: { type: 'array', items: { type: 'string' }, default: [] },
      chapters: { type: 'array', items: { type: 'string' }, default: [] },
    },
  },
  coins: { type: 'number', default: 0 },
  totalCoinsEarned: { type: 'number', default: 0 },
  updatedAt: { type: 'timestamp', default: null },
};

module.exports = { COLLECTION, questSchema, studentQuestSchema };