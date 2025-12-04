// Backend/controllers/QuestController.js
const QuestService = require('../services/QuestService');
const { getDb } = require('../utils/getDb'); // Keep as fallback only

// Helper for error responses
const errorResponse = (res, message, status = 400) => {
    return res.status(status).json({ success: false, message });
};

async function getQuestsProgress(req, res) {
    const userId = req.user?.uid; 
    
    // 1. RETRIEVE DB SAFELY: Use app.locals (primary) or fallback to getDb()
    // This ensures we get the active instance created in app.js
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }
    
    if (!userId) {
        return errorResponse(res, "Authentication required to view quests.", 401);
    }
    
    try {
        // 2. INJECT DB: Pass the valid db instance to the service
        const quests = await QuestService.getQuestsWithProgress(db, userId);

        return res.json({
            success: true,
            quests: quests,
        });
    } catch (error) {
        console.error("Error in getQuestsProgress:", error.message);
        return errorResponse(res, "Failed to retrieve quest progress.", 500);
    }
}

async function completeQuest(req, res) {
    const userId = req.user?.uid;
    const { questId } = req.params;
    
    // 1. RETRIEVE DB SAFELY
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    if (!userId) return errorResponse(res, "Authentication required.", 401);
    if (!questId) return errorResponse(res, "Quest ID is required.", 400);

    try {
        // 2. INJECT DB: Pass the valid db instance to the service
        const claimedQuest = await QuestService.claimQuestReward(db, userId, questId);
        
        return res.json({
            success: true,
            message: `Reward claimed! You earned ${claimedQuest.reward} coins.`,
            newCoins: claimedQuest.newCoins, 
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