const COLLECTION_STORIES = 'stories';
const COLLECTION_PROGRESS = 'storyProgress';

const storySchema = {
  id: { type: 'string', required: true, unique: true },
  title: { type: 'string', required: true },
  author: { type: 'string', default: 'Unknown' },
  genre: { type: 'string', default: 'Drama' },
  difficulty: { type: 'string', default: 'medium', enum: ['easy', 'medium', 'hard'] },
  coverUrl: { type: 'string', default: null },
  sourceUrl: { type: 'string', required: true },
  estimatedReadingTime: { type: 'number', default: 10 }, // in minutes
  createdAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

const progressSchema = {
  userId: { type: 'string', required: true },
  storyId: { type: 'string', required: true },
  currentPage: { type: 'number', default: 0 },
  totalPages: { type: 'number', required: true },
  readingTime: { type: 'number', default: 0 }, // minutes
  completed: { type: 'boolean', default: false },
  updatedAt: { type: 'timestamp', default: null },
};

module.exports = { COLLECTION_STORIES, storySchema, COLLECTION_PROGRESS, progressSchema };
