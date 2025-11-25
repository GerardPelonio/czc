// models/StoryModel.js
const admin = require("firebase-admin");

// ✅ Initialize Firebase Admin if not initialized
if (!admin.apps.length) {
  const serviceAccount = require("../firebaseConfig.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const storiesCollection = db.collection("stories");
const progressCollection = db.collection("storyProgress");

// 🧠 Simple in-memory cache
const storyCache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Get story by ID
 */
async function getStoryById(storyId) {
  try {
    if (!storyId) throw new Error("Story ID is required");

    // ✅ Use cache
    if (storyCache.has(storyId)) {
      const cached = storyCache.get(storyId);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const doc = await storiesCollection.doc(storyId).get();
    if (!doc.exists) throw new Error("Story not found");

    const story = { id: doc.id, ...doc.data() };

    // Cache it
    storyCache.set(storyId, { timestamp: Date.now(), data: story });

    return story;
  } catch (error) {
    console.error("🔥 Error in getStoryById:", error);
    throw new Error(`Failed to fetch story: ${error.message}`);
  }
}

/**
 * Save or update user's reading progress
 * @param {string} userId
 * @param {string} storyId
 * @param {object} progressData - { currentPage, totalPages, readingTime, completed }
 */
async function saveProgress(userId, storyId, progressData) {
  try {
    if (!userId || !storyId) throw new Error("User ID and Story ID are required");

    const progressRef = progressCollection.doc(`${userId}_${storyId}`);

    await progressRef.set(
      {
        userId,
        storyId,
        ...progressData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true } // merge keeps previous data
    );

    return { success: true, message: "Progress saved successfully" };
  } catch (error) {
    console.error("🔥 Error in saveProgress:", error);
    throw new Error(`Failed to save progress: ${error.message}`);
  }
}

/**
 * Get user's progress for a story
 */
async function getProgress(userId, storyId) {
  try {
    const doc = await progressCollection.doc(`${userId}_${storyId}`).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("🔥 Error in getProgress:", error);
    throw new Error(`Failed to fetch progress: ${error.message}`);
  }
}

/**
 * Get all progress for a user (for dashboard)
 */
async function getUserProgress(userId) {
  try {
    const snapshot = await progressCollection.where("userId", "==", userId).get();
    const progressList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return progressList;
  } catch (error) {
    console.error("🔥 Error in getUserProgress:", error);
    throw new Error(`Failed to fetch user progress: ${error.message}`);
  }
}

module.exports = {
  getStoryById,
  saveProgress,
  getProgress,
  getUserProgress,
};
