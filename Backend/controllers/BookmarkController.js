// controllers/BookmarkController.js
const BookmarkService = require("../services/BookmarkService");

const BookmarkController = {
  // POST /api/bookmarks
  async addBookmark(req, res) {
    try {
      const { userId, bookId, bookTitle, chapter } = req.body;

      if (!userId || !bookId || !bookTitle) {
        return res.status(400).json({
          success: false,
          message: "userId, bookId, and bookTitle are required"
        });
      }

      const bookmark = await BookmarkService.addOrUpdateBookmark(
        userId,
        bookId,
        bookTitle,
        chapter
      );

      res.json({
        success: true,
        message: "Bookmark saved successfully",
        bookmark
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/bookmarks/all?userId=u123
  async getBookmarks(req, res) {
    try {
      const { userId } = req.query;  // ← from query

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required in query"
        });
      }

      const bookmarks = await BookmarkService.getBookmarksByUser(userId);

      res.json({
        success: true,
        bookmarks
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/bookmarks/:bookmarkId
  async deleteBookmark(req, res) {
    try {
      const { bookmarkId } = req.params;
      const { userId } = req.body;  // ← send userId in body

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required in body"
        });
      }

      await BookmarkService.removeBookmark(bookmarkId, userId);

      res.json({
        success: true,
        message: "Bookmark removed successfully"
      });
    } catch (err) {
      res.status(404).json({ success: false, message: err.message });
    }
  }
};

module.exports = BookmarkController;