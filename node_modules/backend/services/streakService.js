const firebase = require('firebase-admin');
const { COLLECTION } = require('../models/streakModel');
const https = require('https');

function toDateKey(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return dt.toISOString().slice(0, 10); 
}

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return toDateKey(d);
}

async function getRef(userId) {
  const db = firebase.firestore();
  return db.collection(COLLECTION).doc(userId);
}

async function getStreak(userId) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  const ref = await getRef(userId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  return {
    lastDate: data.lastDate || null,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    badges: Array.isArray(data.badges) ? data.badges : [],
    updatedAt: data.updatedAt || null
  };
}

async function recordReadingSession(userId, sessionIso) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  const dateKey = sessionIso ? toDateKey(new Date(sessionIso)) : toDateKey();
  const ref = await getRef(userId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};

  const last = data.lastDate || null;
  let current = data.currentStreak || 0;
  let longest = data.longestStreak || 0;
  const badges = Array.isArray(data.badges) ? data.badges.slice() : [];

  if (last === dateKey) {
    // already recorded today means don't record again
  } else if (last === yesterdayKey()) {
    current = (current || 0) + 1;
  } else {
    // missed or first record
    current = 1;
  }

  if (current > longest) {
    longest = current;
    // simple badge logic: unlock at 3,7,30 days will add once achievements are finalized
    const unlocks = [3, 7, 30];
    if (unlocks.includes(current)) {
      const badge = `streak-${current}`;
      if (!badges.includes(badge)) badges.push(badge);
    }
  }

  const payload = {
    lastDate: dateKey,
    currentStreak: current,
    longestStreak: longest,
    badges,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await ref.set(payload, { merge: true });
  return { userId, ...payload };
}

function fetchMotivation() {
  const denyWords = ['sex','porn','nude','naked','fuck','shit','bitch','drugs','kill','violence','alcohol'];
  const denyTags = new Set(['adult','nsfw']);
  const isSafe = (text, meta) => {
    if (!text) return false;
    const s = String(text).toLowerCase();
    for (const w of denyWords) if (s.includes(w)) return false;
    if (meta && Array.isArray(meta.tags)) {
      for (const t of meta.tags) if (denyTags.has(String(t).toLowerCase())) return false;
    }
    return true;
  };

  return new Promise((resolve) => {
    const url = 'https://thequoteshub.com/api/quote/random';
    let attempts = 0;
    const maxAttempts = 3;
    const MAX_LEN = 200;

    const tryFetch = () => {
      attempts++;
      const req = https.get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            const raw = j?.content || j?.quote || j?.text || (j?.data && (j.data.content || j.data.quote)) || '';

            // Only output 1 sentence quotes
            const m = raw.match(/^[\s\S]*?[.!?](?=\s|$)/);
            const sentence = m ? m[0].trim() : raw.trim();
            const author = j?.author || j?.person || 'CozyClips';

            if ((isSafe(sentence, j) && sentence.length <= MAX_LEN) || attempts >= maxAttempts) {
              return resolve({ content: sentence || 'Keep reading — small steps win.', author });
            }
            return tryFetch();
          } catch (e) {
            if (attempts >= maxAttempts) return resolve({ content: 'Keep reading — small steps win.', author: 'CozyClips' });
            return tryFetch();
          }
        });
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) return resolve({ content: 'Keep reading — small steps win.', author: 'CozyClips' });
        tryFetch();
      });

      req.end();
    };

    tryFetch();
  });
}

module.exports = { getStreak, recordReadingSession, fetchMotivation };