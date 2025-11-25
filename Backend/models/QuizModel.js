const COLLECTION = 'quizzes';

const quizSchema = {
  userId: { type: 'string', required: true },
  storyId: { type: 'string', required: true },
  answers: { type: 'array', items: { type: 'string' }, default: [] },
  score: { type: 'number', default: 0 },
  completedAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

module.exports = { COLLECTION, quizSchema };
