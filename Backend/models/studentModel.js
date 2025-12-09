const COLLECTION = 'students';

const studentSchema = {
  studentId: { type: 'string', required: true, unique: true },
  username: { type: 'string', required: true },
  displayName: { type: 'string' },
  grade_level: { type: 'string' },
  age: {type: 'number'},
  avatarUrl: { type: 'string' },
  avatarBase64: { type: 'string' },
  customization: { type: 'object' },
  unlockedItems: { type: 'array' },
  rank: { type: 'string' },
  coins: { type: 'number' },
  points: { type: 'number' },
  badges: { type: 'array' },
  readingProgress: { type: 'array' },
  booksRead: { type: 'array' },
  quizHistory: { type: 'array' },
  achievements: { type: 'array' },
  bookmarks: { type: 'array' }
};

module.exports = { COLLECTION, studentSchema };