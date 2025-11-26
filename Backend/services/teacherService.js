const firebase = require('firebase-admin');
const { getDb } = require('../utils/getDb');
const { COLLECTION } = require('../models/teacherModel');

async function getProfile(userId) {
  const db = getDb();
  if (!db) return null;
  if (!userId) return null;
  const snap = await db.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return null;
  const profile = snap.data();

  const assignedStudents = profile.assignedStudents || [];

  return { ...profile, assignedStudents };
}

async function createProfile(userId, data = {}) {
  if (!userId) throw new Error('Missing userId');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  const docRef = db.collection(COLLECTION).doc(userId);

  const payload = {
    teacherId: userId,
    name: data.name || data.displayName || data.username || '',
    subject: data.subject || '',
    username: data.username || '',
    customization: data.customization || {},
    avatarUrl: data.avatarUrl || '',
    avatarBase64: data.avatarBase64 || '',
    assignedStudents: Array.isArray(data.assignedStudents) ? data.assignedStudents : []
  };

  await docRef.set(payload, { merge: true });
  const snap = await docRef.get();
  return snap.exists ? snap.data() : null;
}

async function updateProfile(userId, data = {}) {
  if (!userId) throw new Error('Missing userId');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  const ref = db.collection(COLLECTION).doc(userId);
  const payload = { ...data, teacherId: userId };
  await ref.set(payload, { merge: true });
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function deleteProfile(userId) {
  if (!userId) throw new Error('Missing userId');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  await db.collection(COLLECTION).doc(userId).delete();
  return true;
}

module.exports = { getProfile, createProfile, updateProfile, deleteProfile };