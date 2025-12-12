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

        // Map event types to quest triggers
        const eventTriggerMap = {
            'book_completed': 'books_read',  // book_completed event triggers the books_read quest
            'first_book': 'first_book',
            'quizzes_completed': 'quizzes_completed',
            'fast_reader': 'fast_reader'
        };

        const questTrigger = eventTriggerMap[eventType] || eventType;
        
        // Find quests matching this trigger
        const matchingQuests = quests.filter(q => q.trigger === questTrigger);

        if (matchingQuests.length === 0) {
            return res.json({ success: true, message: "No quests triggered by this event" });
        }

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
// DISABLED: Auto-quest generation removed - This function was auto-creating quests 0, 1, 2
// Function body removed to prevent auto-generation of hardcoded quests
/**
 * Initialize quests in Firestore from JSON data
 * Admin/Internal endpoint (protected)
 */
async function initQuests(req, res) {
  try {
    // For now, allow during development
    const allowInit = process.env.NODE_ENV === 'development' || req.headers['x-init-quests'] === 'true';
    
    if (!allowInit) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Admin initialization required"
      });
    }

    const db = req.app.locals.db || getDb();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable - Database not initialized"
      });
    }

    const questsData = require("../data/quests.json");
    const questsCollection = db.collection('quests');
    
    // Use batch for efficient writes
    const batch = db.batch();
    let processed = 0;

    for (const quest of questsData) {
      const docRef = questsCollection.doc(quest.questId);
      batch.set(docRef, {
        ...quest,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      processed++;
    }
    
    await batch.commit();

    console.log(`Quests initialized successfully: ${processed} quests`);
    
    return res.status(200).json({
      success: true,
      message: "Quests initialized successfully in Firestore",
      stats: {
        questsProcessed: processed,
        quests: questsData.map(q => ({ questId: q.questId, title: q.title }))
      }
    });
  } catch (err) {
    console.error("Error initializing quests:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to initialize quests"
    });
  }
}

async function deleteAllQuests(req, res) {
  try {
    const db = req.app.locals.db || getDb();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable - Database not initialized"
      });
    }

    const questsCollection = db.collection('quests');
    const docs = await questsCollection.get();
    
    const batch = db.batch();
    let deleted = 0;

    docs.forEach(doc => {
      batch.delete(doc.ref);
      deleted++;
    });

    await batch.commit();

    console.log(`All quests deleted: ${deleted} quests removed`);
    
    return res.status(200).json({
      success: true,
      message: "All quests deleted successfully",
      stats: {
        questsDeleted: deleted
      }
    });
  } catch (error) {
    console.error('Error deleting quests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete quests',
      error: error.message
    });
  }
}

module.exports = {
    getQuestsProgress,
    completeQuest,
    getUserCoins,
    addCoins,
    updateQuestProgress,
    fixQuestTargets,
    initQuests,
    deleteAllQuests
};