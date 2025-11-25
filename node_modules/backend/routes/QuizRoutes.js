const express = require('express');
const router = express.Router();
const controller = require('../controllers/QuizController');
const { authLimiter } = require('../middlewares/authLimit');
const { generateQuizValidator, getQuizValidator, submitQuizValidator } = require('../validators/QuizValidators');

// Generate a quiz for a story
router.post('/api/quiz/generate', authLimiter, generateQuizValidator, controller.generateQuiz);

// Get quiz by story ID
router.get('/api/quiz/:storyId', authLimiter, getQuizValidator, controller.getQuiz);

// Submit quiz answers
router.post('/api/quiz/submit', authLimiter, submitQuizValidator, controller.submitQuiz);

module.exports = router;
