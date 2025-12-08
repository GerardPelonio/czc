// Backend/services/ShopService.js - FULLY FIRESTORE INTEGRATED

const admin = require("firebase-admin");
const { getDb, getFieldValue, serverTimestampOrDate } = require('../utils/getDb');

const SHOP_COLLECTION = "shopItems"; 
const STUDENTS_COLLECTION = "students"; 
const TRANSACTIONS_COLLECTION = "transactions";

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

/**
 * List all available shop items with pagination.
 */
async function listItems(db, { page = 1, limit = 20 }) {
  if (!db) throw err('Database not initialized', 503);
  
  const shopCollection = db.collection(SHOP_COLLECTION); 
  
  const offset = (page - 1) * limit;
  
  try {
    const snapshot = await shopCollection
      .orderBy('cost', 'asc') 
      .limit(limit)
      .offset(offset)
      .get();

    const items = snapshot.docs.map(doc => ({
      itemId: doc.id,
      ...doc.data()
    }));

    // Get total count
    const totalSnap = await shopCollection.count().get();
    const totalCount = totalSnap.data().count || 0;

    return {
      items,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };
  } catch (error) {
    console.error("Error listing shop items:", error.message);
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

      // Get total count
      const totalSnap = await db.collection(TRANSACTIONS_COLLECTION)
        .where('userId', '==', userId)
        .count()
        .get();
      const totalCount = totalSnap.data().count || 0;

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
      if (!itemSnap.exists) throw err("Shop item not found", 404);

      const student = studentSnap.data();
      const item = itemSnap.data();

      // Check coins
      const studentCoins = student.coins || 0;
      if (studentCoins < item.cost) {
        throw err(`Insufficient coins. You have ${studentCoins}, but this item costs ${item.cost}`, 400);
      }

      // Check if already owned (for non-consumable items)
      const inventory = student.inventory || [];
      if (item.type !== 'consumable' && inventory.some(i => i.id === itemId)) {
        throw err("You already own this item", 400);
      }

      // Create inventory entry
      const entry = {
        id: itemId,
        name: item.name || "Unnamed Item",
        description: item.description || "",
        type: item.type || "boost",
        rarity: item.rarity || "common",
        icon: item.icon || null,
        cost: item.cost,
        duration: item.duration || null,
        uses: item.uses || 1,
        remainingUses: item.uses || 1,
        used: false,
        purchasedAt: new Date().toISOString(),
      };

      const FieldValue = getFieldValue();
      const newCoins = studentCoins - item.cost;
      
      // Update student document
      tx.update(studentRef, {
        coins: FieldValue ? FieldValue.increment(-item.cost) : newCoins,
        inventory: FieldValue ? FieldValue.arrayUnion(entry) : (Array.isArray(inventory) ? [...inventory, entry] : [entry]),
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
      });
      
      // Log transaction
      const transactionRecord = {
        userId: userId,
        itemId: itemId,
        itemName: item.name,
        cost: item.cost,
        type: item.type || "boost",
        rarity: item.rarity || "common",
        redeemedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
      };
      tx.set(db.collection(TRANSACTIONS_COLLECTION).doc(), transactionRecord);

      return { 
        success: true, 
        item: entry,
        coinsRemaining: newCoins,
        message: `Successfully purchased ${item.name}! You have ${newCoins} coins remaining.`
      };
    });
  } catch (error) {
    console.error("Error redeeming item:", error.message);
    throw err(error.message || "Failed to redeem item", error.status || 500);
  }
}

module.exports = { redeemItem, listItems, getTransactions };

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