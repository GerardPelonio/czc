const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.error('Firebase init failed in debug:', e);
  }
}

const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const snap = await db.collection('vercel_test').doc('health').get().catch(() => null);
    res.json({ ok: true, exists: !!(snap && snap.exists) });
  } catch (err) {
    console.error('debug db error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
