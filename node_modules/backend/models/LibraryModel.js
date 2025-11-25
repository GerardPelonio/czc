const COLLECTION = 'stories';

const storySchema = {
  id: { type: 'string', required: true, unique: true }, // Firestore doc ID
  title: { type: 'string', required: true },
  title_lower: { type: 'string', required: true }, // lowercase for search
  author: { type: 'string', required: true },
  cover_url: { type: 'string', required: false },
  source_url: { type: 'string', required: false },
  school_level: { type: 'string', required: false, enum: ['Junior High', 'Senior High'] },
  grade_range: { type: 'string', required: false }, // e.g., "7–10"
  age_range: { type: 'string', required: false }, // e.g., "12–16"
  genre: { type: 'string', required: true },
  pages: { type: 'number', required: true },
  reading_time: { type: 'string', required: false },
  difficulty: { type: 'string', required: false, enum: ['Easy', 'Medium', 'Hard'] },
  estimatedReadingTime: { type: 'number', required: false }, // in minutes
  viewCount: { type: 'number', default: 0 },
  completionCount: { type: 'number', default: 0 },
  createdAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

module.exports = { COLLECTION, storySchema };
