// Backend/models/QuestModel.js

// NO getDb IMPORT HERE - We use dependency injection

async function getUserQuestProgress(db, userId) {
    // Safety check
    if (!db) {
        console.error("QuestModel: DB instance is missing/null.");
        return {}; 
    }

    try {
        // Get user quest progress from quest_progress collection
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
        
        // Also fetch student data to calculate dynamic progress based on triggers
        try {
            const studentDoc = await db.collection('students').doc(userId).get();
            if (studentDoc.exists) {
                const studentData = studentDoc.data();
                const booksRead = (studentData.booksRead || []).length;
                
                // If quest_progress doesn't exist for "Reading Marathon", calculate from booksRead
                if (!progressMap['reading-marathon']) {
                    progressMap['reading-marathon'] = {
                        currentProgress: booksRead,
                        isClaimed: false,
                        lastUpdate: new Date()
                    };
                }
                
                // For other quests based on completed quizzes, reading, etc.
                if (!progressMap['speed-reader']) {
                    progressMap['speed-reader'] = {
                        currentProgress: booksRead > 0 ? 1 : 0, // Mark as completed if at least 1 book read in a week (simplified)
                        isClaimed: false,
                        lastUpdate: new Date()
                    };
                }
            }
        } catch (err) {
            console.warn("Could not fetch student data for dynamic quest progress:", err.message);
        }
        
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