// Backend/controllers/QuestController.js

const QuestService = require('../services/QuestService');

// Helper function for quick error formatting
const errorResponse = (res, message, status = 400) => {
    return res.status(status).json({ success: false, message });
};

/**
 * GET /api/quest/progress - Returns all quests with user-specific progress.
 */
async function getQuestsProgress(req, res) {
    const userId = req.user?.uid; 
    
    if (!userId) {
        return errorResponse(res, "Authentication required to view quests.", 401);
    }
    
    try {
        const quests = await QuestService.getQuestsWithProgress(userId);

        return res.json({
            success: true,
            quests: quests,
        });
    } catch (error) {
        console.error("Error in getQuestsProgress:", error.message);
        return errorResponse(res, "Failed to retrieve quest progress.", 500);
    }
}

/**
 * POST /api/quest/complete/:questId - Claims a completed quest reward.
 */
async function completeQuest(req, res) {
    const userId = req.user?.uid;
    const { questId } = req.params;

    if (!userId) {
        return errorResponse(res, "Authentication required to claim reward.", 401);
    }

    if (!questId) {
        return errorResponse(res, "Quest ID is required.", 400);
    }

    try {
        // Service returns the new coin balance in claimedQuest.newCoins
        const claimedQuest = await QuestService.claimQuestReward(userId, questId);
        
        return res.json({
            success: true,
            message: `Reward claimed for ${claimedQuest.title}. You earned ${claimedQuest.reward} coins!`,
            newCoins: claimedQuest.newCoins, // <--- NEW FIELD for frontend to update coin display
            quest: claimedQuest
        });
    } catch (error) {
        const status = error.message.includes('claimed') || error.message.includes('complete') ? 409 : 500;
        console.error(`Error claiming quest ${questId}:`, error.message);
        return errorResponse(res, error.message, status);
    }
}


module.exports = {
    getQuestsProgress,
    completeQuest
};