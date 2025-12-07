// Backend/services/QuestService.js

const QuestModel = require('../models/QuestModel');
const { addCoinsToUser } = require('./userService'); 

/**
 * Fetch all quests from Firestore
 */
async function getQuestsFromFirestore(db) {
    try {
        const questsRef = db.collection('quests');
        const snapshot = await questsRef.get();
        
        const quests = [];
        snapshot.forEach(doc => {
            quests.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return quests;
    } catch (error) {
        console.error("Error fetching quests from Firestore:", error.message);
        return [];
    }
}

/**
 * Merges global quest definitions with user-specific progress.
 * NOW ACCEPTS 'db' INJECTION and fetches from Firestore.
 */
async function getQuestsWithProgress(db, userId) {
    // Fetch quests from Firestore
    const quests = await getQuestsFromFirestore(db);
    
    if (quests.length === 0) {
        console.warn("No quests found in Firestore");
        return [];
    }
    
    // Pass the injected DB to the model
    const userProgressMap = await QuestModel.getUserQuestProgress(db, userId);

    return quests.map(quest => {
        const progressData = userProgressMap[quest.id] || { currentProgress: 0, isClaimed: false };
        const { currentProgress, isClaimed } = progressData;

        let status;
        if (isClaimed) {
            status = 'completed';
        } else if (currentProgress >= quest.targetProgress) {
            status = 'ready_to_complete';
        } else {
            status = 'in_progress';
        }

        return {
            ...quest,
            currentProgress: Math.min(currentProgress, quest.targetProgress),
            status: status,
        };
    });
}

/**
 * Handles claiming a quest reward.
 * NOW ACCEPTS 'db' INJECTION.
 */
async function claimQuestReward(db, userId, questId) {
    // Fetch all quests from Firestore
    const quests = await getQuestsFromFirestore(db);
    const quest = quests.find(q => q.id === questId);
    
    if (!quest) {
        throw new Error("Quest not found.");
    }

    // Pass 'db' to internal call
    const allQuests = await getQuestsWithProgress(db, userId);
    const userQuest = allQuests.find(q => q.id === questId);

    if (userQuest.status === 'completed') {
        throw new Error("Reward already claimed.");
    }
    if (userQuest.status !== 'ready_to_complete') {
        throw new Error("Quest is not yet complete.");
    }

    // Pass 'db' to model updates
    await QuestModel.markQuestAsClaimed(db, userId, questId);
    
    // Pass 'db' to user service
    const newCoins = await addCoinsToUser(db, userId, quest.reward);

    return {
        ...quest,
        status: 'completed',
        newCoins
    };
}

module.exports = {
    getQuestsWithProgress,
    claimQuestReward
};