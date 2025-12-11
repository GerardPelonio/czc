const express = require('express');
const router = express.Router();
const controller = require('../controllers/studentController');
const { createOrUpdateProfile } = require('../validators/studentValidator');
const { verifyToken, requireRole } = require('../middlewares/studentMiddleware');

// Student profile routes
router.get('/api/student/profile', verifyToken, requireRole('student'), controller.getAllProfiles);
router.post('/api/student/profile', verifyToken, requireRole('student'), createOrUpdateProfile, controller.createProfile);
router.get('/api/student/profile/:id', verifyToken, requireRole('student'), controller.getProfile);
router.patch('/api/student/profile/:id', verifyToken, requireRole('student'), createOrUpdateProfile, controller.updateProfile);
router.delete('/api/student/profile/:id', verifyToken, requireRole('student'), controller.deleteProfile);

// Consume a power-up (remove one from unlockedItems)
router.post('/api/student/powerups/consume', verifyToken, requireRole('student'), controller.consumePowerUp);

// Mark book as finished
router.post('/api/student/finish-book', verifyToken, requireRole('student'), controller.markBookFinished);

// Bookmark routes
router.post('/api/student/bookmarks/add', verifyToken, requireRole('student'), controller.addBookmark);
router.post('/api/student/bookmarks/remove', verifyToken, requireRole('student'), controller.removeBookmark);
router.get('/api/student/bookmarks', verifyToken, requireRole('student'), controller.getBookmarks);

module.exports = router;