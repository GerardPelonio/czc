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
    // Assuming you have an 'auth' middleware that attaches user data.
    const userId = req.user?.uid; 
    
    // NOTE: Implement proper authentication check if not done in middleware.
    if (!userId) {
        return errorResponse(res, "Authentication required.", 401);
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
        return errorResponse(res, "Authentication required.", 401);
    }

    if (!questId) {
        return errorResponse(res, "Quest ID is required.", 400);
    }

    try {
        const claimedQuest = await QuestService.claimQuestReward(userId, questId);
        
        return res.json({
            success: true,
            message: `Reward claimed for ${claimedQuest.title}`,
            quest: claimedQuest
        });
    } catch (error) {
        // Send a 409 Conflict if already claimed or incomplete
        const status = error.message.includes('claimed') || error.message.includes('complete') ? 409 : 500;
        console.error(`Error claiming quest ${questId}:`, error.message);
        return errorResponse(res, error.message, status);
    }
}


module.exports = {
    getQuestsProgress,
    completeQuest
};