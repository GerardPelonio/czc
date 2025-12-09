// Backend/models/QuestModel.js

// NO getDb IMPORT HERE - We use dependency injection
const fs = require('fs');
const path = require('path');

async function getUserQuestProgress(db, userId) {
    // Safety check
    if (!db) {
        console.error("QuestModel: DB instance is missing/null.");
        return {}; 
    }

    try {
        // Get user quest progress from quest_progress collection
        const progressRef = db.collection('users').doc(userId).collection('quest_progress');
        const snapshot = await progressRef.get();

        const progressMap = {};
        snapshot.forEach(doc => {
            progressMap[doc.id] = { 
                currentProgress: doc.data().currentProgress || 0,
                isClaimed: doc.data().isClaimed || false,
                lastUpdate: doc.data().lastUpdate ? doc.data().lastUpdate.toDate() : null
            };
        });
        
        // Also fetch student data to calculate dynamic progress based on triggers
        try {
            const studentDoc = await db.collection('students').doc(userId).get();
            if (studentDoc.exists) {
                const studentData = studentDoc.data();
                const booksRead = (studentData.booksRead || []).length;
                const booksReadIds = studentData.booksRead || [];
                const quizzesCompleted = (studentData.quizzesCompleted || []).length;
                const bookReadingTimes = studentData.bookReadingTimes || {}; // Maps bookId to {startTime, completionTime}
                
                // Fetch book details to get genres from cache
                let bookGenres = {};
                try {
                    console.log(`[QuestModel] Fetching genres for ${booksReadIds.length} books:`, booksReadIds);
                    
                    // Load the cache file
                    const cacheFilePath = path.join(__dirname, '../data/perfect-books-cache.json');
                    const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
                    
                    // Build a map of book IDs to genres from cache
                    const cacheGenreMap = {};
                    cacheData.forEach(book => {
                        cacheGenreMap[book.id] = book.genre || 'unknown';
                    });
                    
                    // Get genres for the books read
                    for (const bookId of booksReadIds) {
                        const genre = cacheGenreMap[bookId] || 'unknown';
                        bookGenres[bookId] = genre;
                        console.log(`[QuestModel] Book ${bookId}: genre="${genre}"`);
                    }
                    console.log(`[QuestModel] Final bookGenres map:`, bookGenres);
                } catch (err) {
                    console.warn("Could not fetch book genres from cache:", err.message);
                }
                
                // Fetch all quests to map triggers to quest IDs
                const questsRef = db.collection('quests');
                const questsSnapshot = await questsRef.get();
                
                questsSnapshot.forEach(questDoc => {
                    const questId = questDoc.id;
                    const questData = questDoc.data();
                    const trigger = questData.trigger;
                    
                    console.log(`[Quest: ${questData.title}] ID: ${questId}, Trigger: ${trigger}`);
                    
                    // ALWAYS recalculate for dynamic triggers, don't use stored progress
                    let currentProgress = 0;
                    let isClaimed = progressMap[questId]?.isClaimed || false; // Keep claimed status
                    
                    if (trigger === 'books_read') {
                        // Count total books read - ALWAYS calculate dynamically
                        currentProgress = booksRead;
                    } else if (trigger === 'quizzes_completed') {
                        currentProgress = quizzesCompleted;
                    } else if (trigger === 'first_book') {
                        currentProgress = booksRead > 0 ? 1 : 0;
                    } else if (trigger === 'fast_reader') {
                        // Count books completed within 1 week
                        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                        let fastBooksCount = 0;
                        
                        for (const bookId in bookReadingTimes) {
                            const times = bookReadingTimes[bookId];
                            if (times && times.startTime && times.completionTime) {
                                const timeToComplete = times.completionTime - times.startTime;
                                if (timeToComplete <= oneWeekMs) {
                                    fastBooksCount++;
                                }
                            }
                        }
                        currentProgress = fastBooksCount;
                    } else if (trigger === 'genre_variety') {
                        // Count unique genres read
                        const uniqueGenres = new Set(Object.values(bookGenres));
                        currentProgress = uniqueGenres.size;
                        console.log(`[${questData.title}] genre_variety: bookGenres=${JSON.stringify(bookGenres)}, uniqueGenres=${Array.from(uniqueGenres)}, progress=${currentProgress}`);
                    } else if (trigger === 'genre_books') {
                        // Count books of a specific genre
                        const targetGenre = questData.genre;
                        if (targetGenre) {
                            currentProgress = Object.values(bookGenres).filter(g => 
                                g && g.toLowerCase() === targetGenre.toLowerCase()
                            ).length;
                            console.log(`[${questData.title}] genre_books: targetGenre=${targetGenre}, bookGenres=${JSON.stringify(bookGenres)}, progress=${currentProgress}`);
                        }
                    } else if (progressMap[questId]) {
                        // For other trigger types, use stored progress if it exists
                        currentProgress = progressMap[questId].currentProgress || 0;
                    }
                    
                    // Update the progress map with the calculated value
                    progressMap[questId] = {
                        currentProgress: currentProgress,
                        isClaimed: isClaimed,
                        lastUpdate: new Date()
                    };
                });
            }
        } catch (err) {
            console.warn("Could not fetch student data for dynamic quest progress:", err.message);
        }
        
        return progressMap;

    } catch (error) {
        console.error("Error fetching user quest progress:", error.message);
        return {}; 
    }
}

async function markQuestAsClaimed(db, userId, questId) {
    if (!db) throw new Error("Database connection missing for write operation.");
    
    const progressDocRef = db.collection('users').doc(userId).collection('quest_progress').doc(questId);
    const progressDoc = await progressDocRef.get();
    
    // Preserve existing progress data
    const currentData = progressDoc.exists ? progressDoc.data() : {};
    
    await progressDocRef.set({ 
        ...currentData,
        isClaimed: true, 
        claimedAt: new Date() 
    }, { merge: true });

    return true;
}

module.exports = {
    getUserQuestProgress,
    markQuestAsClaimed
};  