const COLLECTION = 'quests';

const questSchema = {
  questId: { type: 'string', required: true, unique: true },
  title: { type: 'string', required: true },
  description: { type: 'string', required: false },
  trigger: { type: 'string', required: true }, // event type that triggers the quest
  target: { type: 'number', required: true }, // number of times to complete (or misspelled targer)
  rewardCoins: { type: 'number', required: true },
  createdAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
  // ADDED: Fields necessary for complex/repeatable quests
  timeWindow: { type: 'string', required: false }, // e.g., 'weekly', 'monthly', 'session'
  uniqueStories: { type: 'boolean', default: false }, // Flag for tracking unique stories
  genresRequired: { type: 'array', items: { type: 'string' }, default: [] }, // For 'Genre Adventurer'
};

const studentQuestSchema = {
  userId: { type: 'string', required: true },
  quests: {
    type: 'array',
    items: {
      questId: { type: 'string', required: true },
      progress: { type: 'number', default: 0 },
      completed: { type: 'boolean', default: false },
      // FIX: Add missing fields written by QuestService
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