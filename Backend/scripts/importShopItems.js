/**
 * Script to import shop items from JSON to Firestore
 * Usage: node scripts/importShopItems.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../path-to-your-service-account.json'); // Update this path
const shopItemsData = require('../data/shopItems.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function importShopItems() {
  try {
    console.log('Starting import of shop items...');
    
    const shopCollection = db.collection('shopItems');
    
    // Check if items already exist
    const existingSnapshot = await shopCollection.get();
    if (!existingSnapshot.empty) {
      console.log(`Found ${existingSnapshot.size} existing items. Skipping import.`);
      process.exit(0);
    }

    // Import items from JSON
    for (const item of shopItemsData) {
      const docRef = shopCollection.doc(item.id);
      await docRef.set(item);
      console.log(`Imported item: ${item.name} (${item.id})`);
    }

    console.log(`Successfully imported ${shopItemsData.length} shop items to Firestore`);
    process.exit(0);
  } catch (error) {
    console.error('Error importing shop items:', error);
    process.exit(1);
  }
}

importShopItems();
