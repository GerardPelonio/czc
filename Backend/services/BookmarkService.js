// services/BookmarkService.js
const BookmarkModel = require("../models/BookmarkModel");

class BookmarkService {
  // Add or update bookmark (auto-updates if exists)
  static async addOrUpdateBookmark(userId, bookId, bookTitle, chapter = 1) {
    if (!userId || !bookId || !bookTitle) {
      throw new Error("userId, bookId, and bookTitle are required");
    }

    const bookmark = await BookmarkModel.saveBookmark(
      userId,
      bookId,
      bookTitle,
      chapter
    );

    return bookmark;
  }

  // Get all bookmarks for user
  static async getBookmarksByUser(userId) {
    if (!userId) throw new Error("userId required");

    return await BookmarkModel.getBookmarksByUser(userId);
  }

  // Delete bookmark
  static async removeBookmark(bookmarkId, userId) {
    if (!bookmarkId || !userId) {
      throw new Error("bookmarkId and userId required");
    }

    await BookmarkModel.deleteBookmark(bookmarkId, userId);
    return true;
  }
}

module.exports = BookmarkService;