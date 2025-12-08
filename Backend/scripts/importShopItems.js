/**
 * Script to import shop items from JSON to Firestore
 * Usage: node scripts/importShopItems.js
 * 
 * This script reads shopItems.json and imports all items to Firestore shopItems collection
 */

const admin = require('firebase-admin');
const shopItemsData = require('../data/shopItems.json');

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

async function importShopItems() {
  try {
    await initializeFirebase();
    
    const db = admin.firestore();
    console.log('Starting import of shop items to Firestore...');
    
    const shopCollection = db.collection('shopItems');
    
    // Check if items already exist
    const existingSnapshot = await shopCollection.get();
    if (!existingSnapshot.empty) {
      console.log(`Found ${existingSnapshot.size} existing items in Firestore.`);
      console.log('Updating existing items and adding any new ones...');
    }

    // Import items from JSON
    let imported = 0;
    let updated = 0;
    
    for (const item of shopItemsData) {
      const docRef = shopCollection.doc(item.id);
      const docSnapshot = await docRef.get();
      
      if (docSnapshot.exists) {
        await docRef.update(item);
        console.log(`Updated item: ${item.name} (${item.id})`);
        updated++;
      } else {
        await docRef.set(item);
        console.log(`Imported item: ${item.name} (${item.id})`);
        imported++;
      }
    }

    console.log(`\n✓ Import complete!`);
    console.log(`  - New items imported: ${imported}`);
    console.log(`  - Existing items updated: ${updated}`);
    console.log(`  - Total items in collection: ${existingSnapshot.size + imported}`);
    process.exit(0);
  } catch (error) {
    console.error('Error importing shop items:', error.message);
    process.exit(1);
  }
}

importShopItems();
