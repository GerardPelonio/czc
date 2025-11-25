const { validationResult } = require("express-validator");
const QuizModel = require("../models/QuizModel");
const QuizService = require("../services/QuizService");
const https = require("https");
const admin = require("firebase-admin");

// Firestore setup
if (!admin.apps.length) {
  const serviceAccount = require("../firebaseConfig.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// HTTPS agent to bypass expired/self-signed SSL certificates
const agent = new https.Agent({
  rejectUnauthorized: false
});

const QuizController = {
  async generateQuiz(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    try {
      const { userId, storyId } = req.body;

      // Check if quiz already exists
      const cached = await QuizModel.getQuiz(userId, storyId);
      if (cached) {
        return res.json({
          success: true,
          quiz: {
            storyId,
            type: cached.type,
            numQuestions: cached.numQuestions,
            questions: cached.questions.map(q => ({
              question: q.question,
              choices: q.choices
            }))
          }
        });
      }

      // Only GB storyIds supported
      if (!storyId.startsWith("GB")) {
        return res.status(400).json({ success: false, message: "Only GB storyId supported" });
      }

      const gutenbergId = storyId.slice(2);
      let title = "Unknown";
      let content = "";

      // Fetch metadata from Gutendex
      const metaRes = await require("axios").get(`https://gutendex.com/books/${gutenbergId}`, {
        timeout: 5000,
        httpsAgent: agent
      });
      title = metaRes.data.title || title;

      const formats = metaRes.data.formats || {};
      let txtUrl =
        formats["text/plain; charset=utf-8"] ||
        formats["text/plain"] ||
        formats["text/html"];

      if (!txtUrl) {
        return res.status(404).json({ success: false, message: "Story content not available" });
      }

      const txtRes = await require("axios").get(txtUrl, {
        timeout: 10000,
        httpsAgent: agent
      });
      content = txtRes.data;
      if (!content || content.length < 50) {
        return res.status(404).json({ success: false, message: "Story content too short" });
      }

      // Generate mixed quiz
      const quizData = await QuizService.generateQuiz(userId, storyId, content, title);

      res.json({
        success: true,
        quiz: {
          storyId,
          type: quizData.type,
          numQuestions: quizData.numQuestions,
          questions: quizData.questions.map(q => ({
            question: q.question,
            choices: q.choices
          }))
        }
      });
    } catch (err) {
      console.error("Generate quiz error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getQuiz(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    try {
      const { storyId } = req.params;
      const { userId } = req.query;

      const quiz = await QuizModel.getQuiz(userId, storyId);
      if (!quiz) {
        return res.status(404).json({ success: false, message: "Quiz not generated yet" });
      }

      res.json({
        success: true,
        quiz: {
          storyId,
          type: quiz.type,
          numQuestions: quiz.numQuestions,
          questions: quiz.questions.map(q => ({
            question: q.question,
            choices: q.choices
          }))
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async submitQuiz(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    try {
      const { userId, storyId, answers, timeTaken } = req.body;
      const quiz = await QuizModel.getQuiz(userId, storyId);
      if (!quiz || quiz.submitted) {
        return res.status(400).json({ success: false, message: "Invalid or already submitted" });
      }

      if (!Array.isArray(answers) || answers.length !== quiz.numQuestions) {
        return res.status(400).json({ success: false, message: `Exactly ${quiz.numQuestions} answers required` });
      }

      let correct = 0;
      const results = quiz.questions.map((q, i) => {
        const userAnswer = (answers[i] || "").toString().trim().toLowerCase();
        const correctAnswer = (q.correctAnswer || "").toString().trim().toLowerCase();
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) correct++;
        return {
          question: q.question,
          userAnswer: answers[i],
          correctAnswer: q.correctAnswer,
          isCorrect,
          explanation: q.explanation
        };
      });

      const coinsEarned = correct; // 1 coin per correct answer
      const score = correct;
      const accuracy = (correct / quiz.numQuestions) * 100;
      let bonus = 0;
      if (accuracy === 100 && Number(timeTaken) < 120) bonus = 10;

      const totalPoints = score * 5 + bonus;

      // Save quiz submission
      await QuizModel.saveQuiz(userId, storyId, {
        ...quiz,
        submitted: true,
        lastScore: score,
        lastAccuracy: accuracy,
        lastTime: timeTaken,
        lastBonus: bonus,
        results,
        submittedAt: new Date().toISOString()
      });

      // Update coins in students table
      const studentRef = db.collection("students").doc(userId);
      await studentRef.set({
        coins: FieldValue.increment(coinsEarned),
        totalCoinsEarned: FieldValue.increment(coinsEarned),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      res.json({
        success: true,
        coinsEarned,
        result: { score, accuracy, bonus, totalPoints, timeTaken, results }
      });
    } catch (err) {
      console.error("Submit error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = QuizController;
