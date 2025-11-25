const express = require('express');
const router = express.Router();
const controller = require('../controllers/BookmarkController');
const { 
  addBookmarkValidator, 
  getBookmarksValidator, 
  deleteBookmarkValidator 
} = require('../validators/BookmarkValidators');
const { authLimiter } = require('../middlewares/authLimit');

// Health check
router.get('/api/bookmark', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bookmark API is working',
  });
});

// Bookmark Routes
router.post('/api/bookmark', authLimiter, addBookmarkValidator, controller.addBookmark);
router.get('/api/bookmark/all', authLimiter, getBookmarksValidator, controller.getBookmarks);
router.delete('/api/bookmark/:bookmarkId', authLimiter, deleteBookmarkValidator, controller.deleteBookmark);

module.exports = router;
