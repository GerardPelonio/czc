const studentService = require('../services/studentService');
const userService = require('../services/userService');
const rankingService = require('../services/rankingService');

async function createProfile(req, res) {
  try {
    const userId = req.params.id || req.body.userId || (req.user && req.user.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const profile = await studentService.createProfile(userId, req.body || {});
    res.status(201).json({ success: true, message: 'Profile created', data: { profile } });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function getProfile(req, res) {
  try {
    const userId = req.params.id || (req.user && req.user.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const profile = await studentService.getProfile(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function getAllProfiles(req, res) {
  try {
    const profiles = await studentService.getAllProfiles();
    res.status(200).json({ success: true, data: { profiles } });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

function isOwner(reqUser, targetId) {
  return reqUser && String(reqUser.id) === String(targetId);
}


async function updateProfile(req, res) {
  try {
    const userId = req.params.id || (req.user && req.user.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // Check for ownership
    if (req.user && req.user.role === 'student' && !isOwner(req.user, userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // check for password change request
    if (req.body && req.body.password) {
      const current = req.body.currentPassword;
      const newPass = req.body.password;
      if (!current) return res.status(400).json({ success: false, message: 'Current password required to change password' });
      await userService.changePassword(userId, current, newPass);
      delete req.body.password;
      delete req.body.currentPassword;
    }

    const profile = await studentService.updateProfile(userId, req.body || {});

    res.status(200).json({ success: true, message: 'Profile updated', data: { profile } });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function deleteProfile(req, res) {
  try {
    const userId = req.params.id || (req.user && req.user.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // Check for ownership
    if (req.user && req.user.role === 'student' && String(req.user.id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await studentService.deleteProfile(userId);
    res.status(200).json({ success: true, message: 'Profile deleted' });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function markBookFinished(req, res) {
  try {
    const db = req.app && req.app.locals && req.app.locals.db;
    if (!db) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const uid = (req.user && (req.user.id || req.user.uid));
    if (!uid) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookId, title } = req.body || {};
    if (!bookId || typeof bookId !== 'string') return res.status(400).json({ success: false, message: 'bookId is required' });

    
    if (typeof studentService.markBookFinished === 'function') {
      await studentService.markBookFinished(uid, { bookId, title });
    }

    // single-line ranking update (transactional, deduplicating) - minimal, secure, non-fatal
    try {
      await rankingService.addCompletedBook(db, uid, { bookId, title });
    } catch (err) {
      console.error('ranking update failed:', err);
    }

    // Updated rank/progress
    const studentRef = db.collection('students').doc(uid);
    const snap = await studentRef.get();
    const student = snap.exists ? snap.data() : {};
    const total =
      typeof student.completedBooksCount === 'number'
        ? student.completedBooksCount
        : (student.completedBooks || []).length;

    const rankInfo = rankingService.computeRank(total);
    rankInfo.badge = rankingService.badgeForTier(rankInfo.tier);

    return res.status(200).json({
      success: true,
      message: 'Book marked finished',
      totalCompletedBooks: total,
      ...rankInfo,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

async function addBookmark(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { storyId } = req.body;
    if (!storyId) return res.status(400).json({ success: false, message: 'storyId is required' });
    
    const bookmarks = await studentService.addBookmark(userId, String(storyId));
    res.status(200).json({ success: true, message: 'Bookmark added', bookmarks });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function removeBookmark(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { storyId } = req.body;
    if (!storyId) return res.status(400).json({ success: false, message: 'storyId is required' });
    
    const bookmarks = await studentService.removeBookmark(userId, String(storyId));
    res.status(200).json({ success: true, message: 'Bookmark removed', bookmarks });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

async function getBookmarks(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const bookmarks = await studentService.getBookmarks(userId);
    res.status(200).json({ success: true, bookmarks });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
}

module.exports = {
  createProfile,
  getAllProfiles,
  getProfile,
  updateProfile,
  deleteProfile,
  markBookFinished,
  addBookmark,
  removeBookmark,
  getBookmarks
};