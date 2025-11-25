const admin = require("firebase-admin");

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require("../firebaseConfig.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const shopCollection = db.collection("shop");
const studentsCollection = db.collection("students");
const transactionsCollection = db.collection("shopTransactions");

/**
 * List available shop items
 */
async function listItems({ page = 1, limit = 20 } = {}) {
  const snapshot = await shopCollection.offset((page - 1) * limit).limit(limit).get();
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  return { items, page, limit, totalFetched: items.length };
}

/**
 * Get single shop item by ID
 */
async function getItemById(itemId) {
  if (!itemId) throw new Error("Item ID is required");
  const doc = await shopCollection.doc(itemId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Redeem item using student coins
 */
async function redeemItem(userId, itemId) {
  if (!userId || !itemId) throw new Error("userId and itemId are required");

  const studentRef = studentsCollection.doc(userId);
  const itemRef = shopCollection.doc(itemId);

  try {
    const result = await db.runTransaction(async (t) => {
      // 1️⃣ Read student and item
      const [studentSnap, itemSnap] = await Promise.all([t.get(studentRef), t.get(itemRef)]);
      if (!studentSnap.exists) throw new Error("Student not found");
      if (!itemSnap.exists) throw new Error("Item not found");

      const student = studentSnap.data();
      const item = itemSnap.data();

      const coins = student.coins || 0;
      const inventory = student.inventory || [];

      // 2️⃣ Validate
      if (inventory.includes(itemId)) throw new Error("Item already purchased");
      if (coins < (item.cost || 0)) throw new Error("Insufficient coins");

      // 3️⃣ Compute new values
      const newCoins = coins - (item.cost || 0);
      const newInventory = [...inventory, itemId];

      // 4️⃣ Update student
      t.update(studentRef, {
        coins: newCoins,
        inventory: admin.firestore.FieldValue.arrayUnion(itemId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5️⃣ Create transaction log
      const txRef = transactionsCollection.doc();
      const tx = {
        userId,
        itemId,
        cost: item.cost || 0,
        itemSnapshot: item,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      t.set(txRef, tx);

      return {
        transactionId: txRef.id,
        ...tx,
        updatedStudent: {
          coins: newCoins,
          inventory: newInventory,
        },
      };
    });

    return result;
  } catch (error) {
    // log failed transaction
    try {
      await transactionsCollection.add({
        userId,
        itemId,
        cost: null,
        status: "failed",
        reason: error.message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      console.error("Failed to log failed transaction:", logErr);
    }
    throw new Error(error.message);
  }
}

/**
 * Get student transactions
 */
async function getTransactions(userId, { page = 1, limit = 50 } = {}) {
  const snapshot = await transactionsCollection
    .where("userId", "==", userId)
    .offset((page - 1) * limit)
    .limit(limit)
    .get();

  const transactions = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

  return { transactions, page, limit, totalFetched: transactions.length };
}

module.exports = {
  listItems,
  getItemById,
  redeemItem,
  getTransactions,
};
