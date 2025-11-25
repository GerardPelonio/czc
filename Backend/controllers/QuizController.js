const { validationResult } = require("express-validator");
const axios = require("axios");
const https = require("https");
const QuizModel = require("../models/QuizModel");
const QuizService = require("../services/QuizService");

// HTTPS agent for expired or self-signed certificates
const agent = new https.Agent({ rejectUnauthorized: false });

// ----------------------------------------------------
// Generate Quiz
// ----------------------------------------------------
async function generateQuiz(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });

    const db = req.app.locals.db;
    const { userId, storyId } = req.body;

    // Check cached quiz
    const cached = await QuizModel.getQuiz(userId, storyId);
    if (cached) return res.status(200).json({ success: true, message: "Quiz loaded", data: { storyId, type: cached.type, numQuestions: cached.numQuestions, questions: cached.questions.map(q => ({ question: q.question, choices: q.choices })) } });

    if (!storyId.startsWith("GB")) return res.status(400).json({ success: false, message: "Only GB storyId supported" });

    const gutenbergId = storyId.slice(2);

    // Fetch metadata
    const metaRes = await axios.get(`https://gutendex.com/books/${gutenbergId}`, { timeout: 6000, httpsAgent: agent });
    const title = metaRes.data.title || "Unknown Title";
    const formats = metaRes.data.formats || {};
    const txtUrl = formats["text/plain; charset=utf-8"] || formats["text/plain"] || formats["text/html"];
    if (!txtUrl) return res.status(404).json({ success: false, message: "Story content not available" });

    const txtRes = await axios.get(txtUrl, { timeout: 10000, httpsAgent: agent });
    const content = txtRes.data || "";
    if (content.length < 50) return res.status(400).json({ success: false, message: "Story content too short" });

    // Generate quiz
    const quizData = await QuizService.generateQuiz(userId, storyId, content, title);

    return res.status(200).json({ success: true, message: "Quiz generated successfully", data: { storyId, type: quizData.type, numQuestions: quizData.numQuestions, questions: quizData.questions.map(q => ({ question: q.question, choices: q.choices })) } });

  } catch (err) {
    console.error("Generate quiz error:", err);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Failed to generate quiz" });
  }
}

// ----------------------------------------------------
// Get Quiz
// ----------------------------------------------------
async function getQuiz(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });

    const { storyId } = req.params;
    const { userId } = req.query;

    const quiz = await QuizModel.getQuiz(userId, storyId);
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not generated yet" });

    return res.status(200).json({ success: true, message: "Quiz fetched", data: { storyId, type: quiz.type, numQuestions: quiz.numQuestions, questions: quiz.questions.map(q => ({ question: q.question, choices: q.choices })) } });

  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Failed to fetch quiz" });
  }
}

// ----------------------------------------------------
// Submit Quiz
// ----------------------------------------------------
async function submitQuiz(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });

    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ success: false, message: "Firestore not initialized" });
    const FieldValue = require("firebase-admin").firestore.FieldValue;

    const { userId, storyId, answers, timeTaken } = req.body;

    const quiz = await QuizModel.getQuiz(userId, storyId);
    if (!quiz || quiz.submitted) return res.status(400).json({ success: false, message: "Invalid or already submitted" });

    if (!Array.isArray(answers) || answers.length !== quiz.numQuestions) return res.status(400).json({ success: false, message: `Exactly ${quiz.numQuestions} answers required` });

    let correct = 0;
    const results = quiz.questions.map((q, i) => {
      const userAnswer = (answers[i] || "").toString().trim().toLowerCase();
      const correctAnswer = (q.correctAnswer || "").toString().trim().toLowerCase();
      const isCorrect = userAnswer === correctAnswer;
      if (isCorrect) correct++;
      return { question: q.question, userAnswer: answers[i], correctAnswer: q.correctAnswer, isCorrect, explanation: q.explanation };
    });

    const coinsEarned = correct;
    const score = correct;
    const accuracy = (correct / quiz.numQuestions) * 100;
    const bonus = accuracy === 100 && Number(timeTaken) < 120 ? 10 : 0;
    const totalPoints = score * 5 + bonus;

    await QuizModel.saveQuiz(userId, storyId, { ...quiz, submitted: true, lastScore: score, lastAccuracy: accuracy, lastTime: timeTaken, lastBonus: bonus, results, submittedAt: new Date().toISOString() });

    await db.collection("students").doc(userId).set({ coins: FieldValue.increment(coinsEarned), totalCoinsEarned: FieldValue.increment(coinsEarned), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    return res.status(200).json({ success: true, message: "Quiz submitted successfully", data: { coinsEarned, score, accuracy, bonus, totalPoints, timeTaken, results } });

  } catch (err) {
    console.error("Submit error:", err);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Failed to submit quiz" });
  }
}

module.exports = { generateQuiz, getQuiz, submitQuiz };
