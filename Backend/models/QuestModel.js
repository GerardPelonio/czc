// models/QuestModel.js
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

class QuestModel {
  static async updateProgress(userId, eventTypeRaw) {
    const eventType = String(eventTypeRaw).trim().toLowerCase();
    const studentRef = db.collection("students").doc(userId);

    return await db.runTransaction(async (t) => {
      const studentDoc = await t.get(studentRef);

      if (!studentDoc.exists) {
        return { coinsEarned: 0, error: "User not found" };
      }

      let studentData = studentDoc.data();
      let quests = studentData.quests || [];
      let coinsEarned = 0;

      // Load quest definitions
      const questsSnap = await t.get(db.collection("quests"));
      const questDefs = {};

      questsSnap.forEach(doc => {
        const data = doc.data();
        questDefs[doc.id] = {
          ...data,
          trigger: String(data.trigger || "").trim().toLowerCase()
        };
      });

      if (Object.keys(questDefs).length === 0) {
        return { coinsEarned: 0, error: "No quest definitions found" };
      }

      // Auto initialize ALL quests if length mismatch
      if (quests.length !== Object.keys(questDefs).length) {
        quests = Object.keys(questDefs).map(questId => ({
          questId,
          progress: 0,
          completed: false
        }));
      }

      let changed = false;

      // Process quests
      for (const q of quests) {
        if (q.completed) continue;

        const def = questDefs[q.questId];
        if (!def) continue;

        // Normalize comparison
        if (def.trigger !== eventType) continue;

        q.progress += 1;
        changed = true;

        if (q.progress >= Number(def.target || 0)) {
          q.completed = true;
          coinsEarned += Number(def.rewardCoins || 0);
        }
      }

      // If nothing updated
      if (!changed && coinsEarned === 0) {
        return { coinsEarned: 0 };
      }

      // Save
      t.set(
        studentRef,
        {
          quests,
          coins: FieldValue.increment(coinsEarned),
          totalCoinsEarned: FieldValue.increment(coinsEarned),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { coinsEarned };
    });
  }
}

module.exports = QuestModel;
