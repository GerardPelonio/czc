// Backend/services/QuestService.js

const QuestModel = require('../models/QuestModel');
const UserService = require('./userService'); // Assuming you have a user service for coin updates

const GLOBAL_QUESTS = [
    {
        id: '0',
        title: "New User Challenge",
        description: "Complete your first book and get your starting coins!",
        targetProgress: 1,
        reward: 250,
    },
    { 
        id: '1', 
        title: "Reading Marathon", 
        description: "Read 5 books this month", 
        targetProgress: 5, 
        reward: 100 
    },
    { 
        id: '2', 
        title: "Genre Explorer", 
        description: "Read books from 3 different genres", 
        targetProgress: 3, 
        reward: 75 
    },
    { 
        id: '3', 
        title: "Speed Reader", 
        description: "Complete a book in one week", 
        targetProgress: 1, 
        reward: 50 
    },
    // Add all 9 mock quests from your Challenges.jsx here, using string IDs
];


/**
 * Merges global quest definitions with user-specific progress.
 * @param {string} userId - The authenticated user's ID.
 * @returns {Promise<Array<Object>>} List of quests formatted for the frontend.
 */
async function getQuestsWithProgress(userId) {
    const userProgressMap = await QuestModel.getUserQuestProgress(userId);

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
        
        // Add special title for the 'ready_to_complete' state for the New User Challenge (ID '0')
        let finalTitle = quest.title;
        if (quest.id === '0' && status === 'ready_to_complete') {
            finalTitle = "New User Challenge (Claimable)";
        } else if (quest.id === '0' && status === 'completed') {
            finalTitle = "New User Challenge (Claimed)";
        }


        return {
            ...quest,
            title: finalTitle, // Use the dynamically updated title
            currentProgress: Math.min(currentProgress, quest.targetProgress), // Cap progress at target
            status: status,
        };
    });
}

/**
 * Handles the logic for claiming a quest reward.
 * @param {string} userId 
 * @param {string} questId 
 * @returns {Promise<Object>} The claimed quest object.
 */
async function claimQuestReward(userId, questId) {
    const quest = GLOBAL_QUESTS.find(q => q.id === questId);
    if (!quest) {
        throw new Error("Quest not found.");
    }

    const allQuests = await getQuestsWithProgress(userId);
    const userQuest = allQuests.find(q => q.id === questId);

    if (userQuest.status === 'completed') {
        throw new Error("Reward already claimed.");
    }
    if (userQuest.status !== 'ready_to_complete') {
        throw new Error("Quest is not yet complete.");
    }

    // 1. Update Firestore: Mark as claimed
    await QuestModel.markQuestAsClaimed(userId, questId);

    // 2. Update User Coins (Assuming a UserService handles this)
    // NOTE: You must update your UserService to have this function.
    // await UserService.addCoins(userId, quest.reward); 

    return {
        ...quest,
        status: 'completed'
    };
}


module.exports = {
    getQuestsWithProgress,
    claimQuestReward
};