const firebase = require('firebase-admin');
const { getDb } = require('../utils/getDb');
const { COLLECTION } = require('../models/studentModel');

// Show available customization items
const AVAILABLE_CUSTOM_ITEMS = ['hat_basic','hat_star','bg_forest','bg_space'];

async function uploadBase64ToStorage(base64Data, userId) {
  try {
    const bucket = firebase.storage().bucket();
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }
    
    const contentType = matches[1];
    const base64Image = matches[2];
    const buffer = Buffer.from(base64Image, 'base64');
    
    const fileName = `avatars/${userId}_${Date.now()}.jpg`;
    const file = bucket.file(fileName);
    
    await file.save(buffer, {
      metadata: { contentType },
      public: true
    });
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to storage:', error);
    throw error;
  }
}

async function createProfile(userId, data = {}) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  
  // Handle base64 avatar upload
  if (data.avatarBase64) {
    try {
      const avatarUrl = await uploadBase64ToStorage(data.avatarBase64, userId);
      data.avatarUrl = avatarUrl;
      delete data.avatarBase64;
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      delete data.avatarBase64;
    }
  }
  
  const ref = db.collection(COLLECTION).doc(userId);
  const payload = {
    studentId: userId,
    username: data.username || '',
    displayName: data.displayName || '',
    age: Number.isFinite(data.age) ? data.age : null,
    rank: data.rank || null,
    coins: Number(data.coins || 0),
    points: Number(data.points || 0),
    badges: data.badges || [],
    readingProgress: data.readingProgress || [],
    quizHistory: data.quizHistory || [],
    achievements: data.achievements || [],
    customization: data.customization || {},
    avatarUrl: data.avatarUrl || '',
    unlockedItems: Array.isArray(data.unlockedItems) ? data.unlockedItems : [],
    booksRead: Array.isArray(data.booksRead) ? data.booksRead : [],
    booksReadCount: Number(data.booksReadCount || (Array.isArray(data.booksRead) ? data.booksRead.length : 0)), // initialize counter
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : []
  };
  await ref.set(payload, { merge: true });
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function getProfile(userId) {
  if (!userId) return null;
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return null;
  const profile = snap.data();

  const unlocked = Array.isArray(profile.unlockedItems) ? profile.unlockedItems : [];
  const unlockedSet = new Set(unlocked);
  const itemsStatus = {
    unlocked: AVAILABLE_CUSTOM_ITEMS.filter(i => unlockedSet.has(i)),
    locked: AVAILABLE_CUSTOM_ITEMS.filter(i => !unlockedSet.has(i))
  };

  return { ...profile, itemsStatus };
}

async function getAllProfiles() {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map(d => d.data());
}

async function updateProfile(userId, data = {}) {
  if (!userId) throw new Error('Missing userId');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  
  // Handle base64 avatar upload
  if (data.avatarBase64) {
    try {
      const avatarUrl = await uploadBase64ToStorage(data.avatarBase64, userId);
      data.avatarUrl = avatarUrl;
      delete data.avatarBase64;
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      // Continue without failing the entire update
      delete data.avatarBase64;
    }
  }
  
  const ref = db.collection(COLLECTION).doc(userId);
  await ref.set(data, { merge: true }); 
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

async function addBookmark(userId, storyId) {
  if (!userId || !storyId) throw new Error('userId and storyId are required');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  const ref = db.collection(COLLECTION).doc(userId);
  
  // Check if document exists
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('Student profile not found');
  }
  
  // Use set with merge to handle missing bookmarks field
  await ref.set({
    bookmarks: firebase.firestore.FieldValue.arrayUnion(storyId)
  }, { merge: true });
  
  const updatedSnap = await ref.get();
  return updatedSnap.exists ? (updatedSnap.data().bookmarks || []) : [];
}

async function removeBookmark(userId, storyId) {
  if (!userId || !storyId) throw new Error('userId and storyId are required');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  const ref = db.collection(COLLECTION).doc(userId);
  
  // Check if document exists
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('Student profile not found');
  }
  
  // Use set with merge to handle missing bookmarks field
  await ref.set({
    bookmarks: firebase.firestore.FieldValue.arrayRemove(storyId)
  }, { merge: true });
  
  const updatedSnap = await ref.get();
  return updatedSnap.exists ? (updatedSnap.data().bookmarks || []) : [];
}

async function getBookmarks(userId) {
  if (!userId) throw new Error('userId is required');
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
  const snap = await db.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return [];
  return snap.data().bookmarks || [];
}

module.exports = { createProfile, getProfile, getAllProfiles, updateProfile, deleteProfile, addBookmark, removeBookmark, getBookmarks };
