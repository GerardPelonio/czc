const firebase = require('firebase-admin');
const { getDb } = require('../utils/getDb');
const { COLLECTION } = require('../models/settingsModel');

const DEFAULTS = {
  notifications: {
    email: true,
    push: false,
    reminderSchedule: { enabled: false, frequency: 'daily' }
  },
  privacy: {
    shareProfile: true,
    twoFactorEnabled: false
  },
  reading: {
    view: 'paged',
    autoSave: true,
    showStats: true,
    showTimer: false
  }
};

async function getRef(userId) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  return db.collection(COLLECTION).doc(userId); // doc id == userId
}

async function getSettings(userId) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const ref = db.collection(COLLECTION).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) {
    // apply default settings if none exist
    await applyDefaults(userId);
    const newSnap = await ref.get();
    return newSnap.exists ? newSnap.data() : null;
  }
  return snap.data();
}

async function updateSettings(userId, data = {}) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const ref = db.collection(COLLECTION).doc(userId);
  const payload = {
    ...data,
    updatedAt: new Date().toISOString()
  };
  await ref.set(payload, { merge: true });
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function applyDefaults(userId) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const ref = db.collection(COLLECTION).doc(userId);
  await ref.set({ userId, ...DEFAULTS, updatedAt: new Date().toISOString() }, { merge: true });
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

module.exports = { getSettings, updateSettings, applyDefaults, DEFAULTS };