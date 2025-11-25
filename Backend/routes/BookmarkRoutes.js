// routes/BookmarkRoutes.js
const express = require("express");
const router = express.Router();
const BookmarkController = require("../controllers/BookmarkController");
const {
  addBookmarkValidator,
  getBookmarksValidator,
  deleteBookmarkValidator
} = require("../validators/BookmarkValidators");

// Health check
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Bookmark API is working",
  });
});

router.post("/", addBookmarkValidator, BookmarkController.addBookmark);
router.get("/all", getBookmarksValidator, BookmarkController.getBookmarks);
router.delete("/:bookmarkId", deleteBookmarkValidator, BookmarkController.deleteBookmark);

module.exports = router;