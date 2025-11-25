const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require("../firebaseConfig.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const progressCollection = db.collection("readingProgress");
const statsCollection = db.collection("readingStats");

/**
 * Save reading progress to Firebase
 */
async function saveReadingProgress(progressData) {
  try {
    const { userId, storyId } = progressData;
    const progressId = `${userId}_${storyId}`;

    const progressRecord = {
      ...progressData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await progressCollection.doc(progressId).set(progressRecord, { merge: true });

    await updateUserStats(userId, progressData);

    return { id: progressId, ...progressRecord };
  } catch (error) {
    console.error("Error saving reading progress:", error);
    throw new Error(`Failed to save progress: ${error.message}`);
  }
}

/**
 * Get reading progress for a specific user and story
 */
async function getReadingProgress(userId, storyId) {
  try {
    const progressId = `${userId}_${storyId}`;
    const doc = await progressCollection.doc(progressId).get();
    if (!doc.exists) return null;
    return { id: progressId, ...doc.data() };
  } catch (error) {
    console.error("Error getting reading progress:", error);
    throw new Error(`Failed to get progress: ${error.message}`);
  }
}

/**
 * Get all reading progress for a user
 */
async function getAllUserProgress(userId) {
  try {
    const snapshot = await progressCollection.where("userId", "==", userId).get();
    if (snapshot.empty) return [];

    const progressData = [];
    snapshot.forEach((doc) => progressData.push({ id: doc.id, ...doc.data() }));
    return progressData;
  } catch (error) {
    console.error("Error getting all user progress:", error);
    throw new Error(`Failed to get user progress: ${error.message}`);
  }
}

/**
 * Update session duration for a specific progress record
 */
async function updateSessionDuration(userId, storyId, sessionDuration) {
  try {
    const progressId = `${userId}_${storyId}`;
    const updates = {
      readingDuration: admin.firestore.FieldValue.increment(sessionDuration),
      lastSessionDuration: sessionDuration,
      lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await progressCollection.doc(progressId).update(updates);
    const doc = await progressCollection.doc(progressId).get();
    return { id: progressId, ...doc.data() };
  } catch (error) {
    console.error("Error updating session duration:", error);
    throw new Error(`Failed to update session duration: ${error.message}`);
  }
}

/**
 * Mark story as completed
 */
async function markStoryCompleted(userId, storyId, totalReadingTime) {
  try {
    const progressId = `${userId}_${storyId}`;
    const updates = {
      progressPercentage: 100,
      isCompleted: true,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalReadingTime,
      readingDuration: totalReadingTime,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await progressCollection.doc(progressId).update(updates);
    await updateCompletionStats(userId, storyId, totalReadingTime);

    const doc = await progressCollection.doc(progressId).get();
    return { id: progressId, ...doc.data() };
  } catch (error) {
    console.error("Error marking story as completed:", error);
    throw new Error(`Failed to mark story as completed: ${error.message}`);
  }
}

/**
 * Get reading statistics for a user
 */
async function getReadingStats(userId) {
  try {
    const allProgress = await getAllUserProgress(userId);
    const stats = {
      totalStoriesStarted: allProgress.length,
      totalStoriesCompleted: allProgress.filter((p) => p.isCompleted).length,
      totalReadingTime: allProgress.reduce((sum, p) => sum + (p.readingDuration || 0), 0),
      averageProgress:
        allProgress.length > 0
          ? allProgress.reduce((sum, p) => sum + (p.progressPercentage || 0), 0) /
            allProgress.length
          : 0,
      lastReadAt:
        allProgress.length > 0
          ? Math.max(...allProgress.map((p) => p.lastReadAt?.seconds || 0))
          : null,
      storiesInProgress: allProgress.filter((p) => !p.isCompleted && p.progressPercentage > 0)
        .length,
    };

    const statsDoc = await statsCollection.doc(userId).get();
    if (statsDoc.exists) {
      const detailedStats = statsDoc.data();
      stats.weeklyReadingTime = detailedStats.weeklyReadingTime || 0;
      stats.monthlyReadingTime = detailedStats.monthlyReadingTime || 0;
      stats.longestReadingSession = detailedStats.longestReadingSession || 0;
      stats.favoriteGenre = detailedStats.favoriteGenre || null;
    }

    return stats;
  } catch (error) {
    console.error("Error getting reading stats:", error);
    throw new Error(`Failed to get reading statistics: ${error.message}`);
  }
}

/**
 * Reset progress for a specific story
 */
async function resetProgress(userId, storyId) {
  try {
    const progressId = `${userId}_${storyId}`;
    await progressCollection.doc(progressId).delete();
    return { success: true, message: "Progress reset successfully", userId, storyId };
  } catch (error) {
    console.error("Error resetting progress:", error);
    throw new Error(`Failed to reset progress: ${error.message}`);
  }
}

/**
 * Update user's reading statistics (internal)
 */
async function updateUserStats(userId, progressData) {
  try {
    const statsUpdates = {
      lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      weeklyReadingTime: admin.firestore.FieldValue.increment(progressData.readingDuration || 0),
      monthlyReadingTime: admin.firestore.FieldValue.increment(progressData.readingDuration || 0),
    };
    await statsCollection.doc(userId).set(statsUpdates, { merge: true });
  } catch (error) {
    console.error("Error updating user stats:", error);
  }
}

/**
 * Update completion statistics (internal)
 */
async function updateCompletionStats(userId, storyId, totalReadingTime) {
  try {
    const completionStats = {
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalCompletedStories: admin.firestore.FieldValue.increment(1),
      totalReadingTime: admin.firestore.FieldValue.increment(totalReadingTime),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await statsCollection.doc(userId).set(completionStats, { merge: true });
  } catch (error) {
    console.error("Error updating completion stats:", error);
  }
}

/**
 * Get progress for multiple stories at once
 */
async function getBulkProgress(userId, storyIds) {
  try {
    const progressPromises = storyIds.map((storyId) => getReadingProgress(userId, storyId));
    const progressResults = await Promise.all(progressPromises);
    const result = {};
    storyIds.forEach((storyId, i) => (result[storyId] = progressResults[i]));
    return result;
  } catch (error) {
    console.error("Error getting bulk progress:", error);
    throw new Error(`Failed to get bulk progress: ${error.message}`);
  }
}

/**
 * Delete all progress for a user
 */
async function deleteAllUserProgress(userId) {
  try {
    const snapshot = await progressCollection.where("userId", "==", userId).get();
    if (!snapshot.empty) {
      const deletePromises = snapshot.docs.map((doc) => doc.ref.delete());
      await Promise.all(deletePromises);
    }
    await statsCollection.doc(userId).delete();

    return { success: true, message: "All user progress deleted successfully", userId };
  } catch (error) {
    console.error("Error deleting all user progress:", error);
    throw new Error(`Failed to delete user progress: ${error.message}`);
  }
}

module.exports = {
  saveReadingProgress,
  getReadingProgress,
  getAllUserProgress,
  updateSessionDuration,
  markStoryCompleted,
  getReadingStats,
  resetProgress,
  getBulkProgress,
  deleteAllUserProgress,
};
