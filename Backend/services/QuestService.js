// Backend/services/QuestService.js

const QuestModel = require('../models/QuestModel');
const { addCoinsToUser } = require('./userService'); 

// ... GLOBAL_QUESTS array (Keep your existing array here) ...
const GLOBAL_QUESTS = [
    { id: '0', title: "New User Challenge", description: "Complete your first book and get your starting coins!", targetProgress: 1, reward: 250 },
    { id: '1', title: "Reading Marathon", description: "Read 5 books this month", targetProgress: 5, reward: 100 },
    { id: '2', title: "Genre Explorer", description: "Read books from 3 different genres", targetProgress: 3, reward: 75 },
    { id: '3', title: "Speed Reader", description: "Complete a book in one week", targetProgress: 1, reward: 50 },
    { id: '4', title: "Classic Literature Fan", description: "Read 2 classic literature books", targetProgress: 2, reward: 120 },
    { id: '5', title: "Weekend Sprint", description: "Read for 2 hours over the weekend", targetProgress: 120, reward: 40 },
    { id: '6', title: "Non-fiction Navigator", description: "Finish a non-fiction book", targetProgress: 1, reward: 80 },
    { id: '7', title: "Poetry Path", description: "Read 10 poems", targetProgress: 10, reward: 60 },
    { id: '8', title: "Daily Habit", description: "Read 15 minutes daily for 5 days", targetProgress: 5, reward: 90 }
];

/**
 * Merges global quest definitions with user-specific progress.
 * NOW ACCEPTS 'db' INJECTION.
 */
async function getQuestsWithProgress(db, userId) {
    // Pass the injected DB to the model
    const userProgressMap = await QuestModel.getUserQuestProgress(db, userId);

    return GLOBAL_QUESTS.map(quest => {
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
        
        let finalTitle = quest.title;
        if (quest.id === '0' && status === 'ready_to_complete') {
            finalTitle = "New User Challenge (Claimable)";
        } else if (quest.id === '0' && status === 'completed') {
            finalTitle = "New User Challenge (Claimed)";
        }

        return {
            ...quest,
            title: finalTitle,
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
    const quest = GLOBAL_QUESTS.find(q => q.id === questId);
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