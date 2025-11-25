const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = require("../firebaseConfig.json");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

module.exports = {
  async saveQuiz(userId, storyId, quizData){
    const docRef = db.collection("quizzes").doc(`${userId}_${storyId}`);
    await docRef.set(quizData, { merge: true });
  },

  async getQuiz(userId, storyId){
    const doc = await db.collection("quizzes").doc(`${userId}_${storyId}`).get();
    return doc.exists ? doc.data() : null;
  }
};
