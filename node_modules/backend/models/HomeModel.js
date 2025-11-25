const COLLECTION = 'readingProgress';

const readingProgressSchema = {
  id: { type: 'string', required: true, unique: true }, // format: userId_storyId
  userId: { type: 'string', required: true },
  storyId: { type: 'string', required: true },
  progressPercentage: { type: 'number', default: 0 },
  readingDuration: { type: 'number', default: 0 }, // total time spent reading in minutes
  lastSessionDuration: { type: 'number', default: 0 },
  isCompleted: { type: 'boolean', default: false },
  completedAt: { type: 'timestamp', default: null },
  lastReadAt: { type: 'timestamp', default: null },
  totalReadingTime: { type: 'number', default: 0 }, // total time including completed story
  updatedAt: { type: 'timestamp', default: null },
};

const STATS_COLLECTION = 'readingStats';

const readingStatsSchema = {
  userId: { type: 'string', required: true, unique: true },
  totalStoriesStarted: { type: 'number', default: 0 },
  totalStoriesCompleted: { type: 'number', default: 0 },
  totalReadingTime: { type: 'number', default: 0 },
  averageProgress: { type: 'number', default: 0 },
  lastReadAt: { type: 'timestamp', default: null },
  storiesInProgress: { type: 'number', default: 0 },
  weeklyReadingTime: { type: 'number', default: 0 },
  monthlyReadingTime: { type: 'number', default: 0 },
  longestReadingSession: { type: 'number', default: 0 },
  favoriteGenre: { type: 'string', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

module.exports = {
  COLLECTION,
  readingProgressSchema,
  STATS_COLLECTION,
  readingStatsSchema,
};
