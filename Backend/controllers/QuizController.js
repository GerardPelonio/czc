const { validationResult } = require("express-validator");
const axios = require("axios");
const { sanitizeAxiosError } = require('../utils/logging');
const https = require("https");
const QuizModel = require("../models/QuizModel");
const QuizService = require("../services/QuizService");

// HTTPS agent for expired or self-signed certificates
const agent = new https.Agent({ rejectUnauthorized: false });

// Fallback in-memory cache (development only, volatile)
const inMemoryQuizCache = new Map();

const hasModelGetQuiz = QuizModel && typeof QuizModel.getQuiz === 'function';
const hasModelSaveQuiz = QuizModel && typeof QuizModel.saveQuiz === 'function';

function _docId(userId, storyId) {
  return `${userId}_${storyId}`;
}

async function getQuizFallback(userId, storyId, db) {
  // Try model if available
  if (hasModelGetQuiz) return QuizModel.getQuiz(userId, storyId);

  // Try Firestore if provided
  if (db) {
    try {
      const docId = _docId(userId, storyId);
      const snap = await db.collection('quizzes').doc(docId).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.warn('getQuizFallback firestore read error:', e && e.message ? e.message : e);
      return null;
    }
  }

  // Fallback to in-memory (non-persistent) cache
  const docId = _docId(userId, storyId);
  return inMemoryQuizCache.get(docId) || null;
}

async function saveQuizFallback(userId, storyId, data, db) {
  if (hasModelSaveQuiz) return QuizModel.saveQuiz(userId, storyId, data);

  if (db) {
    try {
      const docId = _docId(userId, storyId);
      await db.collection('quizzes').doc(docId).set({ userId, storyId, ...data, updatedAt: new Date().toISOString() }, { merge: true });
      const snap = await db.collection('quizzes').doc(docId).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.warn('saveQuizFallback firestore write error:', e && e.message ? e.message : e);
      return null;
    }
  }

  // In-memory
  const docId = _docId(userId, storyId);
  inMemoryQuizCache.set(docId, { userId, storyId, ...data, updatedAt: new Date().toISOString() });
  return inMemoryQuizCache.get(docId);
}

// ----------------------------------------------------
// Generate Quiz
// ----------------------------------------------------
async function generateQuiz(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });

    const db = req.app.locals.db;
    const { userId, storyId, content: providedContent } = req.body;

    // Check cached quiz
    const cached = await getQuizFallback(userId, storyId, db);
    const docId = _docId(userId, storyId);
    if (cached) return res.status(200).json({ success: true, message: "Quiz loaded", data: { quizId: docId, storyId, type: cached.type, numQuestions: cached.numQuestions, questions: cached.questions.map(q => ({ question: q.question, choices: q.choices })) } });

    if (!storyId.startsWith("GB")) return res.status(400).json({ success: false, message: "Only GB storyId supported" });

    const gutenbergId = storyId.slice(2);

    // If provided content exists and looks valid, use it instead of fetching the whole book
    let content = '';
    let title = 'Unknown Title';
    if (providedContent && typeof providedContent === 'string' && providedContent.length >= 50) {
      content = providedContent;
      // try to fetch metadata (title) in the background but do not fail if it can't be fetched
      try {
        const metaRes = await axios.get(`https://gutendex.com/books/${gutenbergId}`, { timeout: 6000, httpsAgent: agent });
        title = metaRes.data.title || title;
      } catch (e) {
        // ignore; we'll use Unknown Title if metadata can't be fetched
      }
    } else {
      // Fetch metadata and content
      const metaRes = await axios.get(`https://gutendex.com/books/${gutenbergId}`, { timeout: 6000, httpsAgent: agent });
      title = metaRes.data.title || title;
      const formats = metaRes.data.formats || {};
      const txtUrl = formats["text/plain; charset=utf-8"] || formats["text/plain"] || formats["text/html"];
      if (!txtUrl) return res.status(404).json({ success: false, message: "Story content not available" });

      const txtRes = await axios.get(txtUrl, { timeout: 10000, httpsAgent: agent });
      content = txtRes.data || "";
      if (content.length < 50) return res.status(400).json({ success: false, message: "Story content too short" });
    }

    // Generate quiz (service persists via save fallback)
      const quizData = await QuizService.generateQuiz(userId, storyId, content, title, db);

    return res.status(200).json({ success: true, message: "Quiz generated successfully", data: { quizId: docId, storyId, type: quizData.type, numQuestions: quizData.numQuestions, questions: quizData.questions.map(q => ({ question: q.question, choices: q.choices })) } });

  } catch (err) {
    console.error("Generate quiz error:", err?.message || sanitizeAxiosError(err));
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

    const quiz = await getQuizFallback(userId, storyId, req.app.locals.db);
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not generated yet" });
    const docId = _docId(userId, storyId);

    return res.status(200).json({ success: true, message: "Quiz fetched", data: { quizId: docId, storyId, type: quiz.type, numQuestions: quiz.numQuestions, questions: quiz.questions.map(q => ({ question: q.question, choices: q.choices })) } });

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

    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ success: false, message: "Firestore not initialized" });
    const { getFieldValue, serverTimestampOrDate } = require('../utils/getDb');
    const FieldValue = getFieldValue();

    const { userId, storyId, answers, timeTaken } = req.body;

    const quiz = await getQuizFallback(userId, storyId, db);
    if (!quiz) {
      console.warn('submitQuiz: quiz not found', { userId, storyId });
      return res.status(404).json({ success: false, message: "Quiz not generated yet" });
    }
    if (quiz.submitted) {
      console.warn('submitQuiz: already submitted', { userId, storyId });
      return res.status(400).json({ success: false, message: "Quiz already submitted" });
    }
    if (!Array.isArray(answers) || answers.length !== quiz.numQuestions) return res.status(400).json({ success: false, message: `Exactly ${quiz.numQuestions} answers required` });

    let correct = 0;
    const results = quiz.questions.map((q, i) => {
      const userAnswer = (answers[i] || "").toString().trim().toLowerCase();
      const correctAnswer = (q.correctAnswer || "").toString().trim().toLowerCase();
      const isCorrect = userAnswer === correctAnswer;
      if (isCorrect) correct++;
      return { question: q.question, userAnswer: answers[i], correctAnswer: q.correctAnswer, isCorrect, explanation: q.explanation };
    });

    const score = correct;
    const accuracy = (correct / quiz.numQuestions) * 100;
    const bonus = accuracy === 100 && Number(timeTaken) < 120 ? 10 : 0;
    
    // FIX APPLIED HERE: Include the bonus in coinsEarned
    const coinsEarned = correct + bonus;
    
    const totalPoints = score * 5 + bonus;

    await saveQuizFallback(userId, storyId, { ...quiz, submitted: true, lastScore: score, lastAccuracy: accuracy, lastTime: timeTaken, lastBonus: bonus, results, submittedAt: new Date().toISOString() }, db);

    if (FieldValue) {
      await db.collection("students").doc(userId).set({ coins: FieldValue.increment(coinsEarned), totalCoinsEarned: FieldValue.increment(coinsEarned), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      // fallback: read student, update numerically
      try {
        const studentSnap = await db.collection('students').doc(userId).get();
        const studentData = studentSnap.exists ? studentSnap.data() : {};
        const currentCoins = Number(studentData.coins || 0);
        const currentTotal = Number(studentData.totalCoinsEarned || 0);
        await db.collection('students').doc(userId).set({ coins: currentCoins + coinsEarned, totalCoinsEarned: currentTotal + coinsEarned, updatedAt: serverTimestampOrDate() }, { merge: true });
      } catch (e) {
        console.warn('submitQuiz: student update fallback failed', e && e.message ? e.message : e);
      }
    }

    return res.status(200).json({ success: true, message: "Quiz submitted successfully", data: { coinsEarned, score, accuracy, bonus, totalPoints, timeTaken, results } });

  } catch (err) {
    console.error("Submit error:", err?.message || sanitizeAxiosError(err));
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Failed to submit quiz" });
  }
}

module.exports = { generateQuiz, getQuiz, submitQuiz };