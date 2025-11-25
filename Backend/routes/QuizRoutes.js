const express = require("express");
const router = express.Router();
const QuizController = require("../controllers/QuizController");
const { generateQuizValidator, getQuizValidator, submitQuizValidator } = require("../validators/QuizValidators");

router.post("/generate", generateQuizValidator, QuizController.generateQuiz);
router.get("/:storyId", getQuizValidator, QuizController.getQuiz);
router.post("/submit", submitQuizValidator, QuizController.submitQuiz);

module.exports = router;
