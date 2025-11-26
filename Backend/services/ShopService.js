// services/ShopService.js
const admin = require("firebase-admin");
const { getDb, getFieldValue, serverTimestampOrDate } = require('../utils/getDb');

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

/**
 * Redeem a shop item using student coins
 * @param {string} userId
 * @param {string} itemId
 */
async function redeemItem(userId, itemId) {
  if (!userId) throw err("userId is required");
  if (!itemId) throw err("itemId is required");

  const db = getDb();  // <- initialize from helper
  if (!db) throw err('Firestore not initialized (missing credentials or emulator).');
  const shopCollection = db.collection("shop");
  const studentsCollection = db.collection("students");

  const studentRef = studentsCollection.doc(userId);
  const itemRef = shopCollection.doc(itemId);

  return db.runTransaction(async (tx) => {
    const [studentSnap, itemSnap] = await Promise.all([tx.get(studentRef), tx.get(itemRef)]);

    if (!studentSnap.exists) throw err("Student not found", 404);
    if (!itemSnap.exists) throw err("Item not found", 404);

    const student = studentSnap.data();
    const item = itemSnap.data();

    const inventory = student.inventory || [];
    if (inventory.some(i => i.id === itemId)) throw err("Item already owned");
    if ((student.coins || 0) < item.cost) throw err("Insufficient coins");

    const entry = {
      id: itemId,
      name: item.name || item.title || "Unnamed Item",
      type: "boost",
      icon: item.icon || null,
      cost: item.cost,
      durationUses: 1,
      remainingUses: 1,
      used: false,
      redeemedAt: new Date().toISOString(),
    };

    const FieldValue = getFieldValue();
    tx.update(studentRef, {
      coins: FieldValue ? FieldValue.increment(-item.cost) : (student.coins - item.cost),
      inventory: FieldValue ? FieldValue.arrayUnion(entry) : (Array.isArray(student.inventory) ? [...student.inventory, entry] : [entry]),
      updatedAt: FieldValue ? FieldValue.serverTimestamp() : serverTimestampOrDate(),
    });

    return { success: true, item: entry };
  });
}

module.exports = { redeemItem };
