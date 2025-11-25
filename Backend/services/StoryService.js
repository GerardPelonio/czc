// services/BookmarkService.js
const BookmarkModel = require("../models/BookmarkModel");

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

/**
 * Add or update a bookmark (auto-updates if exists)
 * @param {string} userId
 * @param {string} bookId
 * @param {string} bookTitle
 * @param {number} chapter
 */
async function addOrUpdateBookmark(userId, bookId, bookTitle, chapter = 1) {
  if (!userId) throw err("userId is required");
  if (!bookId) throw err("bookId is required");
  if (!bookTitle) throw err("bookTitle is required");

  return BookmarkModel.saveBookmark(userId, bookId, bookTitle, chapter);
}

/**
 * Get all bookmarks for a user
 * @param {string} userId
 */
async function getBookmarksByUser(userId) {
  if (!userId) throw err("userId is required");
  return BookmarkModel.getBookmarksByUser(userId);
}

/**
 * Delete a bookmark
 * @param {string} bookmarkId
 * @param {string} userId
 */
async function removeBookmark(bookmarkId, userId) {
  if (!bookmarkId) throw err("bookmarkId is required");
  if (!userId) throw err("userId is required");

  await BookmarkModel.deleteBookmark(bookmarkId, userId);
  return true;
}

module.exports = {
  addOrUpdateBookmark,
  getBookmarksByUser,
  removeBookmark,
};
