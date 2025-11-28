// Backend/services/ShopService.js - FULLY CORRECTED

const admin = require("firebase-admin");
const { getDb, getFieldValue, serverTimestampOrDate } = require('../utils/getDb');

const SHOP_COLLECTION = "shopItems"; 
const STUDENTS_COLLECTION = "students"; 
const TRANSACTIONS_COLLECTION = "transactions"; // Assuming a separate collection for shop transactions

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

/**
 * List all available shop items with pagination.
 */
async function listItems({ page = 1, limit = 20 }) {
  const db = getDb();
  if (!db) throw err('Firestore not initialized (missing credentials or emulator).');
  
  const shopCollection = db.collection(SHOP_COLLECTION); 
  
  const offset = (page - 1) * limit;
  
  const snapshot = await shopCollection
    .orderBy('cost', 'asc') 
    .limit(limit)
    .offset(offset)
    .get();

  const items = snapshot.docs.map(doc => ({
    itemId: doc.id,
    ...doc.data()
  }));

  // NOTE: In a real app, you would fetch total count here (using count() or a cached value)
  return {
    items,
    page,
    limit,
  };
}

/**
 * Get a user's transaction history.
 */
async function getTransactions(userId, { page = 1, limit = 50 }) {
    if (!userId) throw err("userId is required");

    const db = getDb();
    if (!db) throw err('Firestore not initialized (missing credentials or emulator).');
    
    // We assume transactions are stored in a top-level collection or a subcollection on the user
    // Using a top-level collection filtered by userId for scalability:
    const offset = (page - 1) * limit;
    
    const snapshot = await db.collection(TRANSACTIONS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('redeemedAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();
      
    const transactions = snapshot.docs.map(doc => ({
      transactionId: doc.id,
      ...doc.data()
    }));

    return {
      transactions,
      page,
      limit,
    };
}


/**
 * Redeem a shop item using student coins
 * (redeemItem logic remains largely the same, but uses SHOP_COLLECTION)
 */
async function redeemItem(userId, itemId) {
  if (!userId) throw err("userId is required");
  if (!itemId) throw err("itemId is required");

  const db = getDb();
  if (!db) throw err('Firestore not initialized (missing credentials or emulator).');
  const shopCollection = db.collection(SHOP_COLLECTION);
  const studentsCollection = db.collection(STUDENTS_COLLECTION);
  const transactionsCollection = db.collection(TRANSACTIONS_COLLECTION); // For logging the transaction

  const studentRef = studentsCollection.doc(userId);
  const itemRef = shopCollection.doc(itemId);

  return db.runTransaction(async (tx) => {
    const [studentSnap, itemSnap] = await Promise.all([tx.get(studentRef), tx.get(itemRef)]);

    if (!studentSnap.exists) throw err("Student not found", 404);
    if (!itemSnap.exists) throw err("Item not found", 404);

    const student = studentSnap.data();
    const item = itemSnap.data();

    const inventory = student.inventory || [];
    // Only throw "Item already owned" if the item type is meant to be unique (e.g., themes, hats)
    // Assuming custom items are non-consumable and unique for this check.
    if (inventory.some(i => i.id === itemId && i.type !== 'consumable')) throw err("Item already owned");
    if ((student.coins || 0) < item.cost) throw err("Insufficient coins");

    const entry = {
      id: itemId,
      name: item.name || item.title || "Unnamed Item",
      type: item.type || "boost", // Use item's actual type if present
      icon: item.icon || null,
      cost: item.cost,
      durationUses: item.uses || 1,
      remainingUses: item.uses || 1,
      used: false,
      redeemedAt: new Date().toISOString(),
    };

    const FieldValue = getFieldValue();
    
    // 1. Update Student Profile (decrement coins, update inventory)
    tx.update(studentRef, {
      coins: FieldValue ? FieldValue.increment(-item.cost) : (student.coins - item.cost),
      inventory: FieldValue ? FieldValue.arrayUnion(entry) : (Array.isArray(student.inventory) ? [...student.inventory, entry] : [entry]),
      updatedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
    });
    
    // 2. Log Transaction
    const transactionRecord = {
        userId: userId,
        itemId: itemId,
        cost: item.cost,
        type: item.type || "boost",
        redeemedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
    };
    tx.set(transactionsCollection.doc(), transactionRecord);

    return { success: true, item: entry };
  });
}

module.exports = { redeemItem, listItems, getTransactions };