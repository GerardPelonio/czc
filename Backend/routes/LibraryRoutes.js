// routes/LibraryRoutes.js — FINAL & FIXED (No more crash!)
const express = require("express");
const router = express.Router();
const LibraryController = require("../controllers/LibraryController");

// Home / Welcome
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CozyClip Stories — DepEd-Ready Short Stories for Filipino Students",
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
      "Combine → ?level=senior&genre=horror&limit=10": "Mix any filters!"   // ← comma was missing here!
    },
    proud: "Made with love for Filipino students"
  });
});

// Main endpoint — handles ALL filters (level, age, genre, limit)
router.get("/stories", LibraryController.getStories);

// Quick genre shortcuts (super cute & clean URLs)
const genres = ["mystery", "horror", "scifi", "humor", "romance", "drama", "adventure", "fantasy"];
genres.forEach(g => {
  router.get(`/stories/${g}`, (req, res) => {
    req.query.genre = g;
    LibraryController.getStories(req, res);
  });
});

// Level shortcuts
router.get("/stories/junior", (req, res) => {
  req.query.level = "junior";
  LibraryController.getStories(req, res);
});

router.get("/stories/senior", (req, res) => {
  req.query.level = "senior";
  LibraryController.getStories(req, res);
});

module.exports = router;