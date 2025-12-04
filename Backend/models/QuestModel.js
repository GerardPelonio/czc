// Backend/models/QuestModel.js

const getDb = require('../utils/getDb');

/**
 * Fetches the user's current progress for all quests from Firestore.
 * @param {string} userId - The UID of the authenticated user.
 * @returns {Promise<Object>} An object mapping quest IDs to progress data.
 */
async function getUserQuestProgress(userId) {
    try {
        const db = await getDb();
        const progressRef = db.collection('users').doc(userId).collection('quest_progress');
        const snapshot = await progressRef.get();

        const progressMap = {};
        snapshot.forEach(doc => {
            progressMap[doc.id] = { 
                currentProgress: doc.data().currentProgress || 0,
                isClaimed: doc.data().isClaimed || false,
                lastUpdate: doc.data().lastUpdate ? doc.data().lastUpdate.toDate() : null
            };
        });
        
        return progressMap;

    } catch (error) {
        console.error("Error fetching user quest progress:", error.message);
        return {}; 
    }
}

/**
 * Marks a quest as claimed in Firestore.
 * @param {string} userId 
 * @param {string} questId 
 */
async function markQuestAsClaimed(userId, questId) {
    const db = await getDb();
    const progressDocRef = db.collection('users').doc(userId).collection('quest_progress').doc(questId);
    
    await progressDocRef.set({ 
        isClaimed: true, 
        claimedAt: new Date() 
    }, { merge: true });

    return true;
}


module.exports = {
    getUserQuestProgress,
    markQuestAsClaimed
};