/**
 * Script to import quests from JSON to Firestore
 * Usage: node scripts/importQuests.js
 * 
 * This script reads quests.json and imports all quests to Firestore quests collection
 */

const admin = require('firebase-admin');
const questsData = require('../data/quests.json');

// Initialize Firebase using environment variables (same as server.js)
async function initializeFirebase() {
  if (!admin.apps.length) {
    // Check for service account JSON in environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase initialized with service account from environment');
      } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        process.exit(1);
      }
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Use explicit credentials
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase initialized with explicit environment credentials');
    } else {
      console.error('Firebase credentials not found in environment variables');
      console.log('Please set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      process.exit(1);
    }
  }
}

async function importQuests() {
  try {
    await initializeFirebase();
    
    const db = admin.firestore();
    console.log('Starting import of quests to Firestore...');
    
    const questsCollection = db.collection('quests');
    
    // Check if quests already exist
    const existingSnapshot = await questsCollection.get();
    if (!existingSnapshot.empty) {
      console.log(`Found ${existingSnapshot.size} existing quests in Firestore.`);
      console.log('Updating existing quests and adding any new ones...');
    }

    // Import quests from JSON using batch write
    const batch = db.batch();
    let imported = 0;
    let updated = 0;

    for (const quest of questsData) {
      const docRef = questsCollection.doc(quest.questId);
      batch.set(docRef, {
        ...quest,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      imported++;
    }
    
    await batch.commit();

    console.log(`\n✓ Import complete!`);
    console.log(`  - Quests processed: ${imported}`);
    console.log(`  - Total quests in collection: ${existingSnapshot.size + imported}`);
    
    // Verify by fetching all quests
    const allQuests = await questsCollection.get();
    console.log(`\n✓ Verification - Total quests in Firestore: ${allQuests.size}`);
    allQuests.forEach(doc => {
      console.log(`  ✓ ${doc.data().title} (${doc.id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error importing quests:', error.message);
    process.exit(1);
  }
}

importQuests();
