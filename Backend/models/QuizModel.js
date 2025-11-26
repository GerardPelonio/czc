const firebase = require('firebase-admin');
// In-memory fallback cache (shared with controller fallback)
const inMemoryQuizCache = new Map();
const fs = require('fs');
const path = require('path');
const FALLBACK_FILE = path.join(__dirname, '..', 'data', 'quiz-fallback.json');

function _readFallbackFile() {
  try {
    if (!fs.existsSync(FALLBACK_FILE)) return {};
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to read fallback file', FALLBACK_FILE, e && e.message ? e.message : e);
    return {};
  }
}

function _writeFallbackFile(data) {
  try {
    const dir = path.dirname(FALLBACK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.warn('QuizModel: wrote fallback quiz data to', FALLBACK_FILE);
  } catch (e) {
    console.warn('Failed to write fallback file', FALLBACK_FILE, e && e.message ? e.message : e);
  }
}

const COLLECTION = 'quizzes';

const quizSchema = {
  userId: { type: 'string', required: true },
  storyId: { type: 'string', required: true },
  answers: { type: 'array', items: { type: 'string' }, default: [] },
  score: { type: 'number', default: 0 },
  completedAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

function _docId(userId, storyId) {
  return `${userId}_${storyId}`;
}

async function getQuiz(userId, storyId, db) {
  if (!userId || !storyId) return null;
  const docId = _docId(userId, storyId);
  // If a db instance was provided (e.g., server initialized firestore), use it
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).doc(docId).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.warn('getQuiz: Firestore read error, falling back to in-memory and file fallback', e && e.message ? e.message : e);
      // check file fallback
      const all = _readFallbackFile();
      if (all[docId]) return all[docId];
      return inMemoryQuizCache.get(docId) || null;
    }
  }

  // Otherwise try firebase-admin firestore; fall back to in-memory on any error
  try {
    // Only attempt to call firebase if it's initialized; otherwise skip
    if (firebase && Array.isArray(firebase.apps) && firebase.apps.length > 0) {
      const database = firebase.firestore();
      const snap = await database.collection(COLLECTION).doc(docId).get();
      return snap.exists ? snap.data() : null;
    }
    // no firebase app initialized, fall through to file/in-memory fallback
  } catch (e) {
    console.warn('getQuiz: firebase not initialized or read failed, using in-memory and file cache', e && e.message ? e.message : e);
    // try file fallback
    const all = _readFallbackFile();
    if (all[docId]) return all[docId];
    return inMemoryQuizCache.get(docId) || null;
  }
}

async function saveQuiz(userId, storyId, data = {}, db) {
  if (!userId || !storyId) throw new Error('userId and storyId are required');
  const docId = _docId(userId, storyId);
  if (db) {
    try {
      await db.collection(COLLECTION).doc(docId).set({ userId, storyId, ...data, updatedAt: new Date().toISOString() }, { merge: true });
      const snap = await db.collection(COLLECTION).doc(docId).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.warn('saveQuiz: Firestore write failed, falling back to in-memory and file fallback', e && e.message ? e.message : e);
      const doc = { userId, storyId, ...data, updatedAt: new Date().toISOString() };
      inMemoryQuizCache.set(docId, doc);
      const all = _readFallbackFile();
      all[docId] = doc;
      _writeFallbackFile(all);
      return inMemoryQuizCache.get(docId);
    }
  }

  try {
    if (firebase && Array.isArray(firebase.apps) && firebase.apps.length > 0) {
      const database = firebase.firestore();
      await database.collection(COLLECTION).doc(docId).set({ userId, storyId, ...data, updatedAt: new Date().toISOString() }, { merge: true });
      const snap = await database.collection(COLLECTION).doc(docId).get();
      return snap.exists ? snap.data() : null;
    }
    // No firebase initialized, will fall through to fallback handler below
  } catch (e) {
    console.warn('saveQuiz: firebase not initialized or write failed, using in-memory and file fallback', e && e.message ? e.message : e);
    const doc = { userId, storyId, ...data, updatedAt: new Date().toISOString() };
    inMemoryQuizCache.set(docId, doc);
    const all = _readFallbackFile();
    all[docId] = doc;
    _writeFallbackFile(all);
    return inMemoryQuizCache.get(docId);
  }
}

module.exports = { COLLECTION, quizSchema, getQuiz, saveQuiz };
