const admin = require("firebase-admin");
const { getDb, getFieldValue, serverTimestampOrDate } = require('../utils/getDb');
const shopItemsData = require("../data/shopItems.json");

const SHOP_COLLECTION = "shopItems"; 
const STUDENTS_COLLECTION = "students"; 
const TRANSACTIONS_COLLECTION = "transactions";

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

async function listItems(db, { page = 1, limit = 20 }) {
  if (!db) throw err('Database not initialized', 503);
  
  try {
    const shopCollection = db.collection(SHOP_COLLECTION);
    const offset = (page - 1) * limit;
    
    // Check if Firestore collection has items
    let snapshot;
    try {
      snapshot = await shopCollection
        .orderBy('cost', 'asc') 
        .limit(limit)
        .offset(offset)
        .get();
    } catch (orderErr) {
      // If ordering fails (no items or index issue), try without ordering
      console.warn("OrderBy failed, trying without ordering", orderErr.message);
      snapshot = await shopCollection
        .limit(limit)
        .offset(offset)
        .get();
    }

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // If no items in Firestore, fallback to JSON data
    if (items.length === 0) {
      const start = offset;
      const end = start + limit;
      items = shopItemsData
        .sort((a, b) => a.cost - b.cost)
        .slice(start, end)
        .map(item => ({ ...item }));
    }

    // Get total count with fallback
    let totalCount = 0;
    try {
      const countSnap = await shopCollection.count().get();
      totalCount = countSnap.data().count || 0;
    } catch (countErr) {
      // Fallback: get all items and count (less efficient but works)
      console.warn("Count aggregation not available, using fallback", countErr.message);
      const allSnap = await shopCollection.get();
      totalCount = allSnap.size;
    }

    // If Firestore is empty, use JSON data count
    if (totalCount === 0 && shopItemsData.length > 0) {
      totalCount = shopItemsData.length;
    }

    return {
      items,
      page,
      limit,
      totalCount,
      totalPages: totalCount > 0 ? Math.ceil(totalCount / limit) : 1,
    };
  } catch (error) {
    console.error("Error listing shop items:", error.message, error);
    throw err(error.message || "Failed to list shop items", 500);
  }
}

/**
 * Get a user's transaction history.
 */
async function getTransactions(db, userId, { page = 1, limit = 50 }) {
    if (!db) throw err('Database not initialized', 503);
    if (!userId) throw err("User ID is required", 400);

    try {
      const offset = (page - 1) * limit;
      
      // Query transactions for this user
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

      // Get total count using aggregation or fallback
      let totalCount = 0;
      try {
        const countSnap = await db.collection(TRANSACTIONS_COLLECTION)
          .where('userId', '==', userId)
          .count()
          .get();
        totalCount = countSnap.data().count || 0;
      } catch (countErr) {
        // Fallback: get all user transactions and count
        console.warn("Count aggregation not available, using fallback", countErr.message);
        const allSnap = await db.collection(TRANSACTIONS_COLLECTION)
          .where('userId', '==', userId)
          .get();
        totalCount = allSnap.size;
      }

      return {
        transactions,
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      console.error("Error fetching transactions:", error.message);
      throw err(error.message || "Failed to fetch transactions", 500);
    }
}

/**
 * Redeem a shop item using student coins
 */
async function redeemItem(db, userId, itemId) {
  if (!db) throw err('Database not initialized', 503);
  if (!userId) throw err("User ID is required", 401);
  if (!itemId) throw err("Item ID is required", 400);

  const studentRef = db.collection(STUDENTS_COLLECTION).doc(userId);
  const itemRef = db.collection(SHOP_COLLECTION).doc(itemId);

  try {
    return await db.runTransaction(async (tx) => {
      const [studentSnap, itemSnap] = await Promise.all([
        tx.get(studentRef), 
        tx.get(itemRef)
      ]);

      if (!studentSnap.exists) throw err("Student profile not found", 404);
      
      // Fallback to JSON data if item not in Firestore
      let item = itemSnap.data();
      if (!item) {
        item = shopItemsData.find(i => i.id === itemId);
        if (!item) throw err("Shop item not found", 404);
      }

      const student = studentSnap.data();

      // Check coins
      const studentCoins = student.coins || 0;
      if (studentCoins < item.cost) {
        throw err(`Insufficient coins. You have ${studentCoins}, but this item costs ${item.cost}`, 400);
      }

      // Check if already unlocked (block only for non-consumables)
      const unlockedItems = student.unlockedItems || [];
      const isConsumable = item.type === 'consumable' || item.type === 'power-up';
      if (!isConsumable && unlockedItems.includes(itemId)) {
        throw err("You already own this item", 400);
      }

      const FieldValue = getFieldValue();
      const newCoins = studentCoins - item.cost;
      const itemName = item.name || itemId;
      
      // Update student document with unlocked item
      // For consumables, append to allow multiple copies; for non-consumables, keep set semantics
      const nextUnlocked = Array.isArray(unlockedItems) ? [...unlockedItems, itemId] : [itemId];
      tx.update(studentRef, {
        coins: FieldValue ? FieldValue.increment(-item.cost) : newCoins,
        unlockedItems: isConsumable
          ? nextUnlocked
          : (FieldValue ? FieldValue.arrayUnion(itemId) : (Array.isArray(unlockedItems) ? [...new Set([...unlockedItems, itemId])] : [itemId])),
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
      });
      
      // Log transaction
      const transactionRecord = {
        userId: userId,
        itemId: itemId,
        itemName: itemName,
        cost: item.cost || 0,
        type: item.type || "power-up",
        rarity: item.rarity || "common",
        redeemedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
      };
      tx.set(db.collection(TRANSACTIONS_COLLECTION).doc(), transactionRecord);

      return { 
        success: true, 
        itemId: itemId,
        itemName: itemName,
        coinsRemaining: newCoins,
        message: `Successfully purchased ${itemName}! You have ${newCoins} coins remaining.`
      };
    });
  } catch (error) {
    console.error("Error redeeming item:", error.message);
    throw err(error.message || "Failed to redeem item", error.status || 500);
  }
}

module.exports = { redeemItem, listItems, getTransactions };