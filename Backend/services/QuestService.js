// Backend/services/QuestService.js - FULLY CORRECTED

const fs = require('fs');
const path = require('path');
const { getDb, serverTimestampOrDate } = require('../utils/getDb');

const QUEST_COLLECTION = 'quests';
const STUDENT_COLLECTION = 'students';
const FALLBACK_FILE = path.join(__dirname, '..', 'data', 'quest-progress.json');
const DEFAULT_TARGET = 1;
const DEFAULT_REWARD = 5;

// default rewards per trigger eventType — override default reward for common triggers
const DEFAULT_REWARDS_BY_TRIGGER = {
  story_completed: 70,
  word_assist: 30,
  chapter_read: 30,
  chapter_completed: 20,
};

// NEW: Default targets per trigger eventType — override default target for specific triggers
const DEFAULT_TARGETS_BY_TRIGGER = {
  chapter_completed: 5, // Requires 5 unique chapters to be completed for the auto-generated quest
};

const dbg = !!process.env.DEBUG_QUESTS;

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

// --- NEW HELPER FUNCTION FOR TIME-WINDOW CHECK ---
function shouldQuestReset(def, entry) {
    if (!entry.completed || !def.timeWindow || !entry.completedAt) return false;

    const now = new Date();
    const completedAtDate = new Date(entry.completedAt);

    if (def.timeWindow === 'weekly') {
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        // Check if a full 7 days has passed since completion
        return (now.getTime() - completedAtDate.getTime()) >= oneWeekMs;
    }

    if (def.timeWindow === 'monthly') {
        // Check if the current month is different from the completed month (and year)
        return now.getFullYear() > completedAtDate.getFullYear() || 
               (now.getFullYear() === completedAtDate.getFullYear() && now.getMonth() > completedAtDate.getMonth());
    }
    
    // Quests with other timeWindows (like 'Session') or no timeWindow are treated as one-time completions
    return false;
}
// ----------------------------------------------------

function ensureFallbackFile() {
  try {
    if (!fs.existsSync(FALLBACK_FILE)) {
      fs.mkdirSync(path.dirname(FALLBACK_FILE), { recursive: true });
      fs.writeFileSync(
        FALLBACK_FILE,
        JSON.stringify({ users: {}, questDefinitions: {} }, null, 2),
        'utf8',
      );
    }
  } catch (e) {
    console.warn('QuestService: failed to ensure fallback file', e && e.message ? e.message : e);
  }
}

function readFallbackState() {
  ensureFallbackFile();
  try {
    return JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8'));
  } catch (e) {
    console.warn('QuestService: failed to read fallback state — recreating file', e && e.message ? e.message : e);
    const empty = { users: {}, questDefinitions: {} };
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function writeFallbackState(state) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.warn('QuestService: failed to write fallback state', e && e.message ? e.message : e);
  }
}

function buildDefaultQuest(eventType) {
  const now = new Date().toISOString();
  const normalized = typeof eventType === 'string' ? eventType.trim() : eventType;
  const reward = (normalized && DEFAULT_REWARDS_BY_TRIGGER[normalized]) || DEFAULT_REWARD;
  // Use new default target for the event type, or fall back to DEFAULT_TARGET (1)
  const target = (normalized && DEFAULT_TARGETS_BY_TRIGGER[normalized]) || DEFAULT_TARGET; 
  return {
    questId: eventType,
    title: `Complete ${eventType}`,
    description: `Auto-generated quest for event "${eventType}"`,
    trigger: eventType,
    target: target,
    rewardCoins: reward,
    createdAt: now,
    updatedAt: now,
  };
}

async function updateProgressFirestore(userId, eventType, db, meta) {
  const questsSnap = await db
    .collection(QUEST_COLLECTION)
    .where('trigger', '==', eventType)
    .get()
    .catch(err => {
      const error = new Error(err?.message || 'Failed to fetch quests');
      error.status = 500;
      throw error;
    });

  if (questsSnap.empty) {
    // No quest definitions found — create a default quest in Firestore to mirror
    // the fallback behavior and continue processing.
    try {
      const defaultQuest = buildDefaultQuest(eventType);
      // Use eventType as the document ID for consistency
      await db.collection(QUEST_COLLECTION).doc(eventType).set({
        ...defaultQuest,
      }, { merge: true });
      console.log(`QuestService: created default quest for event "${eventType}" in Firestore`);
      // build questDefinitions manually so we can continue processing without a re-query
      const questDefinitions = [{ questId: eventType, ...(defaultQuest || {}) }];
      if (dbg) console.log('[QuestService] no quest docs found; creating default quest and proceeding with definitions', questDefinitions);
      // continue with the same logic as when quests exist
      const studentRef = db.collection(STUDENT_COLLECTION).doc(userId);
      const studentSnap = await studentRef.get();
      const studentData = studentSnap.exists ? studentSnap.data() : {};
      const questProgress = Array.isArray(studentData.quests) ? [...studentData.quests] : [];
      const questMap = new Map();
      questProgress.forEach(q => { if (q && q.questId) questMap.set(q.questId, { ...q }); });

      let coinsEarned = 0;
      const nowIso = new Date().toISOString();

      questDefinitions.forEach(def => {
        const questId = def.questId || def.id;
        if (!questId) return;
        let entry = questMap.get(questId) || { questId, progress: 0, completed: false };

        if (shouldQuestReset(def, entry)) {
            entry.completed = false;
            entry.progress = 0;
            entry.completedAt = null;
            entry.storyIds = [];
            entry.chapters = [];
            if (dbg) console.log(`[QuestService] Resetting auto-generated quest: ${questId}`);
        }
        if (entry.completed) return;
        
        // Respect uniqueStories: only increment progress for unique story IDs
        if (def.uniqueStories && meta && meta.storyId) {
          entry.storyIds = Array.isArray(entry.storyIds) ? entry.storyIds : [];
          if (!entry.storyIds.includes(meta.storyId)) {
            entry.storyIds.push(meta.storyId);
            entry.progress = (entry.progress || 0) + 1;
          }
        } else if (def.trigger === 'chapter_completed' && meta && (meta.chapter || meta.chapter === 0)) {
            // Track unique chapter completions
            entry.chapters = Array.isArray(entry.chapters) ? entry.chapters : [];
            const ch = String(meta.chapter); // Ensure string conversion for consistency
            if (!entry.chapters.includes(ch)) {
              entry.chapters.push(ch);
              entry.progress = (entry.progress || 0) + 1;
            }
        } else {
          entry.progress = (entry.progress || 0) + 1;
        }
        entry.updatedAt = nowIso;
        
        // FIX: Check for the common typo 'targer' if 'target' is missing
        const target = def.target || def.targer || DEFAULT_TARGET;
        const reward = typeof def.rewardCoins === 'number' ? def.rewardCoins : DEFAULT_REWARD;
        
        if (entry.progress >= target) {
          entry.completed = true;
          entry.completedAt = nowIso;
          coinsEarned += reward;
        }
        questMap.set(questId, entry);
      });

      const coins = (studentData.coins || 0) + coinsEarned;
      const totalCoinsEarned = (studentData.totalCoinsEarned || 0) + coinsEarned;
      const payload = {
        userId,
        quests: Array.from(questMap.values()),
        coins,
        totalCoinsEarned,
        updatedAt: serverTimestampOrDate(),
      };
      await studentRef.set(payload, { merge: true });

      return { coinsEarned, error: null };
    } catch (e) {
      const error = new Error(e?.message || `Failed to create default quest for ${eventType}`);
      error.status = 500;
      throw error;
    }
  }

  const questDefinitions = questsSnap.docs.map(doc => ({
    questId: doc.id,
    ...(doc.data() || {}),
  }));
  if (dbg) console.log('[QuestService] found quest definitions', questDefinitions.map(q => ({ questId: q.questId, trigger: q.trigger, target: q.target, rewardCoins: q.rewardCoins })));

  const studentRef = db.collection(STUDENT_COLLECTION).doc(userId);
  const studentSnap = await studentRef.get();
  const studentData = studentSnap.exists ? studentSnap.data() : {};
  if (dbg) console.log('[QuestService] studentData before update', { studentId: userId, coins: studentData.coins || 0, existingQuests: Array.isArray(studentData.quests) ? studentData.quests.length : 0 });
  let questProgress = [];
  if (Array.isArray(studentData.quests)) questProgress = [...studentData.quests];
  else if (studentData.quests && typeof studentData.quests === 'object') {
    // convert legacy object-shaped quests into an array
    questProgress = Object.keys(studentData.quests).map(k => ({ ...studentData.quests[k], questId: k }));
    if (dbg) console.log('[QuestService] converted legacy student quests object to array for update', { userId, length: questProgress.length });
  }
  const questMap = new Map();
  questProgress.forEach(q => {
    if (q && q.questId) questMap.set(q.questId, { ...q });
  });

  let coinsEarned = 0;
  const nowIso = new Date().toISOString();

  questDefinitions.forEach(def => {
    if (dbg) console.log('[QuestService] processing quest def', { questId: def.questId, target: def.target, rewardCoins: def.rewardCoins, uniqueStories: def.uniqueStories, timeWindow: def.timeWindow });
    const questId = def.questId || def.id;
    if (!questId) return;

    let entry = questMap.get(questId) || { questId, progress: 0, completed: false };
    
    // LOGIC: Handle Repeatable Quests/Time Windows
    if (shouldQuestReset(def, entry)) {
        entry.completed = false;
        entry.progress = 0;
        entry.completedAt = null;
        // Important: Reset tracking arrays too!
        entry.storyIds = []; 
        entry.chapters = [];
        if (dbg) console.log(`[QuestService] Resetting repeatable quest: ${questId} (${def.timeWindow})`);
    }
    
    if (entry.completed) {
      if (dbg) console.log('[QuestService] skipping completed quest', { questId, userId });
      return;
    }

    // Respect uniqueStories: only increment progress for unique story IDs, and track chapters for chapter_completed
    if (def.uniqueStories && meta && meta.storyId) {
      entry.storyIds = Array.isArray(entry.storyIds) ? entry.storyIds : [];
      if (!entry.storyIds.includes(meta.storyId)) {
        entry.storyIds.push(meta.storyId);
        entry.progress = (entry.progress || 0) + 1;
      }
    } else if (def.trigger === 'chapter_completed' && meta && (meta.chapter || meta.chapter === 0)) {
      // Track unique chapter completions
      entry.chapters = Array.isArray(entry.chapters) ? entry.chapters : [];
      const ch = String(meta.chapter); // FIX: Convert to string for consistent comparison
      if (!entry.chapters.includes(ch)) {
        entry.chapters.push(ch);
        entry.progress = (entry.progress || 0) + 1;
      }
    } else {
      entry.progress = (entry.progress || 0) + 1;
    }
    entry.updatedAt = nowIso;

    // FIX: Check for the common typo 'targer' if 'target' is missing
    const target = def.target || def.targer || DEFAULT_TARGET; 
    const reward = typeof def.rewardCoins === 'number' ? def.rewardCoins : DEFAULT_REWARD;
    
    // LOGIC: ONLY AWARD COINS IF PROGRESS MEETS TARGET
    if (entry.progress >= target) {
      entry.completed = true;
      entry.completedAt = nowIso;
      coinsEarned += reward;
      if (dbg) console.log('[QuestService] quest completed for user', { questId, userId, reward, coinsEarned });
    }

    questMap.set(questId, entry);
  });

  const coins = (studentData.coins || 0) + coinsEarned;
  const totalCoinsEarned = (studentData.totalCoinsEarned || 0) + coinsEarned;
  const payload = {
    userId,
    quests: Array.from(questMap.values()),
    coins,
    totalCoinsEarned,
    updatedAt: serverTimestampOrDate(),
  };
  await studentRef.set(payload, { merge: true });
  if (dbg) console.log('[QuestService] updateProgressFirestore -> wrote student', userId, 'coinsEarned', coinsEarned, 'payload', { quests: payload.quests.length, coins: payload.coins, totalCoinsEarned: payload.totalCoinsEarned });

  return { coinsEarned, error: null };
}

async function updateProgressFallback(userId, eventType, meta) {
  const state = readFallbackState();
  state.questDefinitions = state.questDefinitions || {};
  state.users = state.users || {};

  if (!state.questDefinitions[eventType]) {
    state.questDefinitions[eventType] = buildDefaultQuest(eventType);
  }

  let userState = state.users[userId];
  if (!userState) {
    userState = {
      userId,
      coins: 0,
      totalCoinsEarned: 0,
      quests: [],
      updatedAt: null,
    };
  }

  // Ensure quests is an array. If it exists as an object (legacy), convert it to array
  // for backward compatibility.
  if (!Array.isArray(userState.quests)) {
    if (userState.quests && typeof userState.quests === 'object') {
      userState.quests = Object.keys(userState.quests).map(k => ({ ...userState.quests[k], questId: k }));
    } else {
      userState.quests = [];
    }
  }

  const questDef = state.questDefinitions[eventType];
  const existingIndex = userState.quests.findIndex(q => q && q.questId === questDef.questId);
  let questProgress = existingIndex >= 0 ? { ...userState.quests[existingIndex] } : {
    questId: questDef.questId,
    progress: 0,
    completed: false,
  };

  let coinsEarned = 0;
  let error = null;
  const nowIso = new Date().toISOString();
  
  // LOGIC: Handle Repeatable Quests/Time Windows in Fallback
  if (shouldQuestReset(questDef, questProgress)) {
      questProgress.completed = false;
      questProgress.progress = 0;
      questProgress.completedAt = null;
      questProgress.storyIds = [];
      questProgress.chapters = [];
      if (dbg) console.log(`[QuestService] Resetting fallback quest: ${questDef.questId} (${questDef.timeWindow})`);
  }
  
    if (questProgress.completed) {
    error = 'Quest already completed';
  } else {
      // Respect uniqueStories: only increment progress for unique story IDs
      if (questDef.uniqueStories && meta && meta.storyId) {
        questProgress.storyIds = Array.isArray(questProgress.storyIds) ? questProgress.storyIds : [];
        if (!questProgress.storyIds.includes(meta.storyId)) {
          questProgress.storyIds.push(meta.storyId);
          questProgress.progress = (questProgress.progress || 0) + 1;
        }
      } else if (questDef.trigger === 'chapter_completed' && meta && (meta.chapter || meta.chapter === 0)) {
        questProgress.chapters = Array.isArray(questProgress.chapters) ? questProgress.chapters : [];
        const ch = String(meta.chapter); // FIX: Ensure string conversion for consistency
        if (!questProgress.chapters.includes(ch)) {
          questProgress.chapters.push(ch);
          questProgress.progress = (questProgress.progress || 0) + 1;
        }
      } else {
        questProgress.progress = (questProgress.progress || 0) + 1;
      }
    
    // FIX: Check for the common typo 'targer' if 'target' is missing
    const target = questDef.target || questDef.targer || DEFAULT_TARGET; 

    if (questProgress.progress >= target) {
      questProgress.completed = true;
      questProgress.completedAt = nowIso;
      coinsEarned = questDef.rewardCoins || DEFAULT_REWARD;
      userState.coins = (userState.coins || 0) + coinsEarned;
      userState.totalCoinsEarned = (userState.totalCoinsEarned || 0) + coinsEarned;
    }
  }

  questProgress.updatedAt = nowIso;
  if (existingIndex >= 0) {
    userState.quests[existingIndex] = questProgress;
  } else {
    userState.quests.push(questProgress);
  }
  userState.updatedAt = nowIso;
  state.users[userId] = userState;

  writeFallbackState(state);
  if (dbg) console.log('[QuestService] updateProgressFallback wrote fallback state for', userId, 'coinsEarned', coinsEarned, 'error', error);
  return { coinsEarned, error };
}

async function updateUserQuestProgress(userId, eventType, meta) {
  if (!userId) throw err('userId is required', 400);
  if (!eventType) throw err('eventType is required', 400);
  // Normalize event type string to avoid mismatches like leading/trailing spaces
  eventType = (typeof eventType === 'string' && eventType) ? eventType.trim() : eventType;

  const db = getDb();
  const dbg = !!process.env.DEBUG_QUESTS;
  if (dbg) console.log('[QuestService] updateUserQuestProgress:', { userId, eventType, meta });
  if (db) return updateProgressFirestore(userId, eventType, db, meta);
  return updateProgressFallback(userId, eventType, meta);
}

module.exports = {
  updateUserQuestProgress,
};