// Backend/controllers/QuestController.js

const QuestService = require('../services/QuestService');
const { getDb } = require('../utils/getDb');

// Helper for error responses
const errorResponse = (res, message, status = 400) => {
    return res.status(status).json({ success: false, message });
};

// EXISTING FUNCTION 1: Get quests progress
async function getQuestsProgress(req, res) {
    const userId = req.user?.id; 
    
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }
    
    if (!userId) {
        return errorResponse(res, "Authentication required to view quests.", 401);
    }
    
    try {
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

// EXISTING FUNCTION 2: Complete quest
async function completeQuest(req, res) {
    const userId = req.user?.id;
    const { questId } = req.params;
    
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    if (!userId) return errorResponse(res, "Authentication required.", 401);
    if (!questId) return errorResponse(res, "Quest ID is required.", 400);

    try {
        const claimedQuest = await QuestService.claimQuestReward(db, userId, questId);
        
        return res.json({
            success: true,
            message: `Reward claimed! You earned ${claimedQuest.reward} coins.`,
            newCoins: claimedQuest.newCoins, 
            quest: claimedQuest
        });
    } catch (error) {
        let status = 500;
        let message = error.message;
        
        if (error.message.includes('claimed')) {
            status = 409;
        } else if (error.message.includes('not yet complete')) {
            status = 400;
        } else if (error.message.includes('not found')) {
            status = 404;
        }
        
        console.error(`Error claiming quest ${questId}:`, error.message);
        return errorResponse(res, message, status);
    }
}

// NEW FUNCTION 3: GET user's coin balance
async function getUserCoins(req, res) {
    const userId = req.user?.id;
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    if (!userId) {
        return errorResponse(res, "Authentication required", 401);
    }

    try {
        const studentDoc = await db.collection('students').doc(userId).get();
        
        console.log(`getUserCoins for ${userId}:`);
        console.log(`Document exists: ${studentDoc.exists}`);
        
        if (!studentDoc.exists) {
            console.log("Student document doesn't exist, returning 0 coins");
            return res.json({ success: true, coins: 0 });
        }

        const studentData = studentDoc.data();
        console.log("Student data:", studentData);
        const coins = studentData.coins || 0;
        console.log(`Returning coins: ${coins}`);
        return res.json({ success: true, coins });
    } catch (error) {
        console.error("Error fetching coins:", error);
        return errorResponse(res, "Failed to fetch coins", 500);
    }
}

// NEW FUNCTION 4: Add coins to user
async function addCoins(req, res) {
    const userId = req.user?.id;
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

// NEW FUNCTION 5: Update quest progress when user completes an action
async function updateQuestProgress(req, res) {
    const userId = req.user?.id;
    const { eventType, bookId } = req.body;
    
    const db = req.app.locals.db || getDb();

    if (!db) {
        console.error("CRITICAL: Database connection missing in QuestController.");
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    if (!userId) return errorResponse(res, "Authentication required.", 401);
    if (!eventType) return errorResponse(res, "Event type is required.", 400);

    try {
        // If book_completed event, add book to student's booksRead array
        if (eventType === 'book_completed' && bookId) {
            const studentRef = db.collection('students').doc(userId);
            const studentDoc = await studentRef.get();
            
            if (studentDoc.exists) {
                const currentBooksRead = studentDoc.data().booksRead || [];
                const bookReadingTimes = studentDoc.data().bookReadingTimes || {};
                
                // Only add if not already in the array
                if (!currentBooksRead.includes(bookId)) {
                    currentBooksRead.push(bookId);
                    
                    // Track reading time for this book
                    // Get the book start time from localStorage (sent by frontend or default to now - 1 hour)
                    const completionTime = Date.now();
                    const startTime = req.body.startTime ? Number(req.body.startTime) : completionTime - (60 * 60 * 1000); // Default 1 hour ago
                    
                    bookReadingTimes[bookId] = {
                        startTime: startTime,
                        completionTime: completionTime
                    };
                    
                    await studentRef.update({
                        booksRead: currentBooksRead,
                        bookReadingTimes: bookReadingTimes
                    });
                    console.log(`Added book ${bookId} to booksRead for user ${userId}. Read time: ${(completionTime - startTime) / (1000 * 60)} minutes`);
                }
            }
        }

        // Get all quests from Firestore
        const questsRef = db.collection('quests');
        const snapshot = await questsRef.get();
        
        const quests = [];
        snapshot.forEach(doc => {
            quests.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Find quests matching this event type
        const matchingQuests = quests.filter(q => q.trigger === eventType);

        if (matchingQuests.length === 0) {
            return res.json({ success: true, message: "No quests triggered by this event" });
        }

        // NOTE: Progress is now calculated dynamically from student data (booksRead array length)
        // in QuestModel.getUserQuestProgress(), so we don't manually increment here.
        // We only need to update the book in the student's booksRead array (done above)

        return res.json({
            success: true,
            message: `Progress updated for ${matchingQuests.length} quest(s)`,
            updatedQuests: matchingQuests.length
        });
    } catch (error) {
        console.error("Error updating quest progress:", error);
        return errorResponse(res, "Failed to update quest progress", 500);
    }
}

// ADMIN FUNCTION: Fix quest target values in Firestore
async function fixQuestTargets(req, res) {
    const db = req.app.locals.db || getDb();

    if (!db) {
        return errorResponse(res, "Service temporarily unavailable (DB connection failed).", 503);
    }

    try {
        // First, fetch all quests to see what IDs actually exist
        const questsRef = db.collection('quests');
        const snapshot = await questsRef.get();
        
        const existingQuests = {};
        snapshot.forEach(doc => {
            existingQuests[doc.id] = doc.data();
        });
        
        console.log("Existing quest IDs:", Object.keys(existingQuests));
        console.log("All quest data:", existingQuests);

        // Update each quest based on its title
        const updates = [];
        for (const [questId, questData] of Object.entries(existingQuests)) {
            let targetValue = questData.target || 1;
            
            // Determine correct target based on title or trigger
            if (questData.title?.includes("Marathon") || questData.title?.includes("Read 5")) {
                targetValue = 5;
                console.log(`Updating quest ${questId} (${questData.title}) to target: 5`);
                updates.push({
                    questId,
                    oldTarget: questData.target,
                    newTarget: 5
                });
                await db.collection('quests').doc(questId).update({ target: 5 });
            } else if (questData.title?.includes("Speed") || questData.title?.includes("week")) {
                targetValue = 1;
                console.log(`Updating quest ${questId} (${questData.title}) to target: 1`);
                updates.push({
                    questId,
                    oldTarget: questData.target,
                    newTarget: 1
                });
                await db.collection('quests').doc(questId).update({ target: 1 });
            }
        }

        return res.json({
            success: true,
            message: "Quest targets fixed",
            existingQuests: Object.keys(existingQuests),
            updatedQuests: updates
        });
    } catch (error) {
        console.error("Error fixing quest targets:", error);
        return errorResponse(res, "Failed to fix quest targets", 500);
    }
}

// ADMIN FUNCTION: Fix quest target values in Firestore (called server-side only)
async function fixQuestTargets(db) {
    if (!db) {
        console.error("Database connection missing");
        return { success: false, message: "DB connection failed" };
    }

    try {
        // Fetch all quests to see what IDs exist
        const questsRef = db.collection('quests');
        const snapshot = await questsRef.get();
        
        const updates = [];
        const updatePromises = [];
        
        snapshot.forEach(doc => {
            const questId = doc.id;
            const questData = doc.data();
            const title = questData.title || "";
            
            // Determine correct target based on title
            if (title.includes("Marathon") || title.includes("Read 5")) {
                // Reading Marathon should be 5 books
                updatePromises.push(db.collection('quests').doc(questId).update({ target: 5 }));
                updates.push({ questId, title, newTarget: 5 });
                console.log(`Fixing ${questId} (${title}) to target: 5`);
            } else if (title.includes("Speed") || title.includes("week")) {
                // Speed Reader should be 1 book in 1 week
                updatePromises.push(db.collection('quests').doc(questId).update({ target: 1 }));
                updates.push({ questId, title, newTarget: 1 });
                console.log(`Fixing ${questId} (${title}) to target: 1`);
            } else if (title.includes("first") || title.includes("first book")) {
                // First book should be 1
                updatePromises.push(db.collection('quests').doc(questId).update({ target: 1 }));
                updates.push({ questId, title, newTarget: 1 });
                console.log(`Fixing ${questId} (${title}) to target: 1`);
            }
        });
        
        // Wait for all updates to complete
        await Promise.all(updatePromises);
        
        console.log("Quest target fixes applied:", updates);
        return { success: true, updates };
    } catch (error) {
        console.error("Error fixing quest targets:", error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getQuestsProgress,
    completeQuest,
    getUserCoins,
    addCoins,
    updateQuestProgress,
    fixQuestTargets
};