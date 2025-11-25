const express = require('express');
const router = express.Router();
const controller = require('../controllers/LibraryController');
const { authLimiter } = require('../middlewares/authLimit');

// Health / Welcome
router.get('/api/library', authLimiter, (req, res) => {
  res.json({
    success: true,
    message: 'CozyClip Stories — DepEd-Ready Short Stories for Filipino Students',
    endpoints: {
      "GET /api/library/stories": "All stories",
      "GET /api/library/stories?level=junior": "Grade 7–10",
      "GET /api/library/stories?level=senior": "Grade 11–12",
      "GET /api/library/stories?genre=horror": "Horror only",
      "GET /api/library/stories?genre=mystery": "Mystery only",
      "GET /api/library/stories?genre=scifi": "Sci-Fi only",
      "GET /api/library/stories?genre=humor": "Funny stories",
      "GET /api/library/stories?genre=romance": "Love stories",
      "GET /api/library/stories?genre=fantasy": "Magic & myths",
      "Combine → ?level=senior&genre=horror&limit=10": "Mix any filters!"
    },
    proud: "Made with love for Filipino students"
  });
});

// Main endpoint — handles filters (level, age, genre, limit)
router.get('/api/library/stories', authLimiter, controller.getStories);

// Quick genre shortcuts
const genres = ["mystery", "horror", "scifi", "humor", "romance", "drama", "adventure", "fantasy"];
genres.forEach(g => {
  router.get(`/api/library/stories/${g}`, authLimiter, (req, res) => {
    req.query.genre = g;
    controller.getStories(req, res);
  });
});

// Level shortcuts
router.get('/api/library/stories/junior', authLimiter, (req, res) => {
  req.query.level = 'junior';
  controller.getStories(req, res);
});

router.get('/api/library/stories/senior', authLimiter, (req, res) => {
  req.query.level = 'senior';
  controller.getStories(req, res);
});

module.exports = router;
