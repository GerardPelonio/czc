// Backend/models/QuestModel.js

// NO getDb IMPORT HERE - We use dependency injection

async function getUserQuestProgress(db, userId) {
    // Safety check
    if (!db) {
        console.error("QuestModel: DB instance is missing/null.");
        return {}; 
    }

    try {
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

async function markQuestAsClaimed(db, userId, questId) {
    if (!db) throw new Error("Database connection missing for write operation.");
    
    const progressDocRef = db.collection('users').doc(userId).collection('quest_progress').doc(questId);
    const progressDoc = await progressDocRef.get();
    
    // Preserve existing progress data
    const currentData = progressDoc.exists ? progressDoc.data() : {};
    
    await progressDocRef.set({ 
        ...currentData,
        isClaimed: true, 
        claimedAt: new Date() 
    }, { merge: true });

    return true;
}

module.exports = {
    getUserQuestProgress,
    markQuestAsClaimed
};  