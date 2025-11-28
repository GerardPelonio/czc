const fs = require('fs');
const path = require('path');
const { getDb } = require('../utils/getDb');

const FALLBACK_FILE = path.join(__dirname, '..', 'data', 'quest-progress.json');
const QUEST_COLLECTION = 'quests';
const DEFAULT_TARGET = 1;
const DEFAULT_REWARD = 5;
const DEFAULT_REWARDS_BY_TRIGGER = {
  story_completed: 70,
  word_assist: 30,
  chapter_read: 30,
  chapter_completed: 20,
};

function buildDefaultQuest(eventType) {
  const now = new Date().toISOString();
  const normalized = typeof eventType === 'string' ? eventType.trim() : eventType;
  const reward = (normalized && DEFAULT_REWARDS_BY_TRIGGER[normalized]) || DEFAULT_REWARD;
  return {
    questId: eventType,
    title: `Complete ${eventType}`,
    description: `Auto-generated quest for event "${eventType}"`,
    trigger: eventType,
    target: DEFAULT_TARGET,
    rewardCoins: reward,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const db = getDb();
  if (!db) {
    console.error('Firestore not initialized — please set credentials or run emulator and try again');
    console.error('\nHere are some ways to initialize Firestore (PowerShell examples):');
    console.error('\n1) Use GOOGLE_APPLICATION_CREDENTIALS (recommended if you have a service account file):');
    console.error("$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\\path\\to\\serviceAccount.json'");
    console.error("node Backend/tools/migrate-quests.js chapter_completed\n");
    console.error('2) Provide the service account JSON directly in env var:');
    console.error("$env:FIREBASE_SERVICE_ACCOUNT_JSON = (Get-Content -Raw 'C:\\path\\to\\serviceAccount.json')");
    console.error("node Backend/tools/migrate-quests.js chapter_completed\n");
    console.error('3) Use explicit env vars (project id, client email and private key):');
    console.error("$env:FIREBASE_PROJECT_ID = 'your-project-id'");
    console.error("$env:FIREBASE_CLIENT_EMAIL = 'my@project.iam.gserviceaccount.com'");
    console.error("$env:FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n'");
    console.error("node Backend/tools/migrate-quests.js chapter_completed\n");
    console.error('4) Use Firestore emulator (install firebase-tools and start emulator):');
    console.error('npx firebase emulators:start --only firestore --project demo-project');
    console.error("# then set environmental variables to point to emulator in the same shell:\n$env:FIRESTORE_EMULATOR_HOST = 'localhost:8080'\n$env:FIREBASE_PROJECT_ID = 'demo-project'\nnode Backend/tools/migrate-quests.js chapter_completed\n");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const toLowerArgs = args.map(a => (typeof a === 'string' ? a.toLowerCase() : a));
  // If args present we support the following flows:
  //  - node migrate-quests.js chapter_completed  => create a single default quest for that event trigger
  //  - node migrate-quests.js seed              => create a list of seeded quests (see seedList below)
  if (args.length) {
    if (toLowerArgs[0] === 'seed' || toLowerArgs[0] === '--seed') {
      const seedList = [
        {
          questId: 'genre_adventurer',
          title: 'Genre Adventurer',
          description: 'Read at least one story from each genre (Fantasy, Mystery, Adventure) within a month.',
          trigger: 'story_completed',
          genresRequired: ['Fantasy', 'Mystery', 'Adventure', 'Horror', 'Sci-Fi', 'Humor', 'Romance', 'Drama'],
          order: 3,
          rewardCoins: 70,
          timeWindow: 'monthly',
        },
        {
          questId: 'stories_explorer',
          title: 'Stories Explorer',
          description: 'Complete 3 different stories in one week.',
          trigger: 'story_completed',
          order: 4,
          rewardCoins: 60,
          target: 3,
          timeWindow: 'weekly',
          uniqueStories: true,
        },
        {
          questId: 'perfect_memory',
          title: 'Perfect Memory',
          description: 'Get 100% on a comprehension quiz without losing a single life.',
          trigger: 'word_assist',
          order: 2,
          rewardCoins: 30,
          target: 10,
          timeWindow: 'Session',
        },
        {
          questId: 'read_3_chapters',
          title: 'Read 3 Chapters',
          description: 'Complete 3 chapters to earn coins',
          trigger: 'chapter_read',
          order: 1,
          rewardCoins: 30,
          target: 3,
        },
        {
          questId: 'chapter_conqueror',
          title: 'Chapter Conqueror',
          description: 'Finish one full chapter of a story to earn coins and experience points.',
          trigger: 'chapter_completed',
          order: 5,
          rewardCoins: 20,
          target: 1,
        },
      ];

      for (const def of seedList) {
        try {
          await db.collection(QUEST_COLLECTION).doc(def.questId).set({ ...def, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
          console.log('Seeded quest', def.questId);
        } catch (e) {
          console.warn('Failed to seed', def.questId, e && e.message ? e.message : e);
        }
      }
      console.log('Seeding complete');
      return;
    }

    // Otherwise, treat args as event types and create default quests for them
    for (const eventType of args) {
      try {
        const def = buildDefaultQuest(eventType);
        await db.collection(QUEST_COLLECTION).doc(eventType).set(def, { merge: true });
        console.log('Created default quest for', eventType);
      } catch (e) {
        console.warn('Failed to create default quest for', eventType, e && e.message ? e.message : e);
      }
    }
    console.log('Migration/creation complete for provided event types');
    return;
  }

  // If the user asked to convert student quest storage from object to array
  if (toLowerArgs.indexOf('--convert-student-quests') >= 0 || toLowerArgs.indexOf('convert-student-quests') >= 0) {
    console.log('Converting students.quest object shape to array in Firestore...');
    const studentsSnap = await db.collection('students').get();
    for (const sdoc of studentsSnap.docs) {
      const data = sdoc.data() || {};
      const quests = data.quests;
      if (Array.isArray(quests)) continue;
      if (quests && typeof quests === 'object') {
        const converted = Object.keys(quests).map(k => ({ questId: k, ...(quests[k] || {}) }));
        try {
          await db.collection('students').doc(sdoc.id).set({ quests: converted }, { merge: true });
          console.log('Converted student', sdoc.id);
        } catch (e) {
          console.warn('Failed to convert student', sdoc.id, e && e.message ? e.message : e);
        }
      }
    }
    console.log('Student conversion complete');
    return;
  }

  // otherwise try to read from fallback file
  if (!fs.existsSync(FALLBACK_FILE)) {
    console.log('Fallback file not found: nothing to migrate');
    return;
  }

  const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
  const all = raw ? JSON.parse(raw) : {};
  const defs = all.questDefinitions || {};
  const keys = Object.keys(defs);
  if (!keys.length) {
    console.log('No quest definitions to migrate in fallback file. You can pass event types as args, e.g.: node migrate-quests.js chapter_completed');
    return;
  }

  console.log('Found', keys.length, 'quest definitions to migrate.');

  for (const docId of keys) {
    const doc = defs[docId];
    if (!doc) continue;
    try {
      const ref = db.collection(QUEST_COLLECTION).doc(docId);
      await ref.set(doc, { merge: true });
      console.log('Migrated', docId);
    } catch (e) {
      console.warn('Failed to migrate', docId, e && e.message ? e.message : e);
    }
  }

  console.log('Quest migration complete');
}

main();
