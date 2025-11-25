const firebase = require('firebase-admin');
const BookmarkModel = require('../models/BookmarkModel');

const err = (msg, status = 400) => { 
  const e = new Error(msg); 
  e.status = status; 
  throw e; 
};

async function addOrUpdateBookmark(userId, bookId, bookTitle, chapter = 1) {
  if (!userId || !bookId || !bookTitle) throw err('userId, bookId, and bookTitle are required', 400);

  const bookmark = await BookmarkModel.saveBookmark(userId, bookId, bookTitle, chapter);
  return bookmark;
}

async function getBookmarksByUser(userId) {
  if (!userId) throw err('userId is required', 400);

  const bookmarks = await BookmarkModel.getBookmarksByUser(userId);
  return bookmarks;
}

async function removeBookmark(bookmarkId, userId) {
  if (!bookmarkId || !userId) throw err('bookmarkId and userId are required', 400);

  await BookmarkModel.deleteBookmark(bookmarkId, userId);
  return true;
}

module.exports = {
  addOrUpdateBookmark,
  getBookmarksByUser,
  removeBookmark,
};
