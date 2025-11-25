const COLLECTION = 'bookmarks';

const bookmarkSchema = {
  id: { type: 'string', required: true, unique: true }, // format: userId_bookId
  userId: { type: 'string', required: true },
  bookId: { type: 'string', required: true },
  bookTitle: { type: 'string', required: true },
  chapter: { type: 'number', default: 1 },
  updatedAt: { type: 'timestamp', default: null },
};

module.exports = { COLLECTION, bookmarkSchema };
