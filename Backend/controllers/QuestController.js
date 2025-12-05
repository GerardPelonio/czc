// Backend/controllers/QuestController.js - ADD THESE TWO FUNCTIONS

const QuestService = require('../services/QuestService');
const { getDb } = require('../utils/getDb');

// Helper for error responses
const errorResponse = (res, message, status = 400) => {
    return res.status(status).json({ success: false, message });
};

// ... (keep your existing getQuestsProgress and completeQuest functions) ...

// NEW: GET user's coin balance
async function getUserCoins(req, res) {
    const userId = req.user?.uid;
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    if (!userId) {
        return errorResponse(res, "Authentication required", 401);
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.json({ success: true, coins: 0 });
        }

        const coins = userDoc.data().coins || 0;
        return res.json({ success: true, coins });
    } catch (error) {
        console.error("Error fetching coins:", error);
        return errorResponse(res, "Failed to fetch coins", 500);
    }
}

// NEW: Add coins to user
async function addCoins(req, res) {
    const userId = req.user?.uid;
    const { amount, reason } = req.body;
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    if (!userId) {
        return errorResponse(res, "Authentication required", 401);
    }

    if (!amount || amount <= 0) {
        return errorResponse(res, "Invalid amount", 400);
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        const currentCoins = userDoc.exists ? (userDoc.data().coins || 0) : 0;
        const newBalance = currentCoins + amount;

        await userRef.set({ coins: newBalance }, { merge: true });

        return res.json({ 
            success: true, 
            coins: newBalance,
            newBalance: newBalance,
            added: amount,
            reason: reason || "Quest reward"
        });
    } catch (error) {
        console.error("Error adding coins:", error);
        return errorResponse(res, "Failed to add coins", 500);
    }
}

module.exports = {
    getQuestsProgress,
    completeQuest,
    getUserCoins,      // ADD THIS
    addCoins           // ADD THIS
};