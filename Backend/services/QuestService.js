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
            const data = doc.data();
            const target = Number(data.target) || 1; // Ensure it's always a number
            // Try multiple field names for reward
            const reward = Number(data.rewardCoins || data.reward || data.coins || 0);
            quests.push({
                id: doc.id,
                title: data.title,
                description: data.description,
                targetProgress: target,
                reward: reward,
                badgeColor: data.badgeColor,
                trigger: data.trigger,
                order: data.order
            });
            console.log(`Quest ${doc.id}:`, {
                title: data.title,
                target: target,
                reward: reward,
                allFields: Object.keys(data),
                rewardCoinsField: data.rewardCoins,
                rewardField: data.reward,
                coinsField: data.coins,
                trigger: data.trigger
            });
        });
        
        // Sort by order
        quests.sort((a, b) => (a.order || 0) - (b.order || 0));
        
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

        // FORCE correct targets based on quest title to work around Firestore data issues
        let correctTarget = quest.targetProgress; // Default to whatever is in DB
        if (quest.title && quest.title.includes("Marathon")) {
            correctTarget = 5;
        } else if (quest.title && quest.title.includes("Speed")) {
            correctTarget = 1;
        } else if (quest.title && (quest.title.includes("first") || quest.title.includes("first book"))) {
            correctTarget = 1;
        }

        let status;
        // Only mark as completed if reward has been claimed
        if (isClaimed) {
            status = 'completed';
        } 
        // Show ready to complete only if progress reached target but not claimed
        else if (currentProgress >= correctTarget) {
            status = 'ready_to_complete';
        } 
        // Otherwise in progress
        else {
            status = 'in_progress';
        }

        return {
            ...quest,
            currentProgress: Math.min(currentProgress, correctTarget),
            targetProgress: correctTarget,
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
    console.log("Available quest IDs:", quests.map(q => q.id));
    console.log("Looking for questId:", questId, "Type:", typeof questId);
    
    const quest = quests.find(q => q.id === questId);
    
    if (!quest) {
        throw new Error(`Quest not found. Looking for ID: ${questId}, available: ${quests.map(q => q.id).join(", ")}`);
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