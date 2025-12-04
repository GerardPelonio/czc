// Backend/models/QuestModel.js

const getDb = require('../utils/getDb');

// --- Mock Firestore Structures (Replace with real logic) ---
// For a real application, Quest definitions should be in a global 'quests' collection, 
// and user progress would be in a 'users/{uid}/quest_progress' subcollection.

const MOCK_USER_PROGRESS = {
    // Key: Quest ID (must match global quest definition IDs)
    '0': { currentProgress: 1, isClaimed: false, lastUpdate: new Date() },
    '1': { currentProgress: 3, isClaimed: false, lastUpdate: new Date() },
    '2': { currentProgress: 3, isClaimed: true, lastUpdate: new Date() },
    '3': { currentProgress: 0, isClaimed: false, lastUpdate: new Date() },
};

/**
 * Fetches the user's current progress for all quests from Firestore.
 * @param {string} userId - The UID of the authenticated user.
 * @returns {Promise<Object>} An object mapping quest IDs to progress data.
 */
async function getUserQuestProgress(userId) {
    try {
        // --- REAL FIREBASE LOGIC HERE ---
        // const db = await getDb();
        // const progressRef = db.collection('users').doc(userId).collection('quest_progress');
        // const snapshot = await progressRef.get();
        // ... map snapshot to an object like MOCK_USER_PROGRESS
        
        // For demonstration, we use the mock data. 
        // In a real app, you'd fetch user-specific data.
        return MOCK_USER_PROGRESS;

    } catch (error) {
        console.error("Error fetching user quest progress:", error.message);
        // Fallback to empty progress if Firestore fails
        return {}; 
    }
}

/**
 * Marks a quest as claimed in Firestore.
 * @param {string} userId 
 * @param {string} questId 
 */
async function markQuestAsClaimed(userId, questId) {
    try {
        // --- REAL FIREBASE LOGIC HERE ---
        // const db = await getDb();
        // const progressDocRef = db.collection('users').doc(userId).collection('quest_progress').doc(questId);
        // await progressDocRef.update({ isClaimed: true, claimedAt: new Date() });
        
        console.log(`[Firestore] Quest ${questId} marked as claimed for user ${userId}`);
        
        return true;
    } catch (error) {
        console.error(`Error claiming quest ${questId}:`, error.message);
        throw new Error("Failed to claim quest reward.");
    }
}


module.exports = {
    getUserQuestProgress,
    markQuestAsClaimed
};