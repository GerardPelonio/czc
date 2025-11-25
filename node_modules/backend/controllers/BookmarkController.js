const BookmarkService = require("../services/BookmarkService");

// ----------------------------------------------------
// Add or update a bookmark
// POST /api/bookmarks
// ----------------------------------------------------
async function addBookmark(req, res) {
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

    return res.json({
      success: true,
      message: "Bookmark saved successfully",
      bookmark
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ----------------------------------------------------
// Get all bookmarks for a user
// GET /api/bookmarks/all?userId=u123
// ----------------------------------------------------
async function getBookmarks(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required in query"
      });
    }

    const bookmarks = await BookmarkService.getBookmarksByUser(userId);

    return res.json({
      success: true,
      bookmarks
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ----------------------------------------------------
// Delete a bookmark
// DELETE /api/bookmarks/:bookmarkId
// ----------------------------------------------------
async function deleteBookmark(req, res) {
  try {
    const { bookmarkId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required in body"
      });
    }

    await BookmarkService.removeBookmark(bookmarkId, userId);

    return res.json({
      success: true,
      message: "Bookmark removed successfully"
    });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
}

module.exports = { addBookmark, getBookmarks, deleteBookmark };
