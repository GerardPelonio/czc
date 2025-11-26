const fs = require('fs');
const path = require('path');
const { getDb } = require('../utils/getDb');

const FALLBACK_FILE = path.join(__dirname, '..', 'data', 'quiz-fallback.json');

async function main() {
  const db = getDb();
  if (!db) {
    console.error('Firestore not initialized — please set credentials or run emulator and try again');
    process.exit(1);
  }

  if (!fs.existsSync(FALLBACK_FILE)) {
    console.log('Fallback file not found: nothing to migrate');
    return;
  }

  const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
  const all = raw ? JSON.parse(raw) : {};
  const keys = Object.keys(all);
  if (!keys.length) {
    console.log('No quizzes to migrate');
    return;
  }

  console.log('Found', keys.length, 'quizzes to migrate.');

  for (const docId of keys) {
    const doc = all[docId];
    if (!doc || !doc.userId || !doc.storyId) continue;
    try {
      const ref = db.collection('quizzes').doc(docId);
      await ref.set(doc, { merge: true });
      console.log('Migrated', docId);
    } catch (e) {
      console.warn('Failed to migrate', docId, e && e.message ? e.message : e);
    }
  }

  console.log('Migration complete');
}

main();
