const admin = require('firebase-admin');
const paymentService = require('../../services/paymentService');

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.error('Firebase init failed in cron:', e);
  }
}

const db = admin.firestore();

module.exports = async (req, res) => {
  // Optional: protect this endpoint with a secret
  if (process.env.CRON_SECRET && req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  try {
    await paymentService.runExpiryOnce(db);
    res.status(200).send('Expiry check run');
  } catch (err) {
    console.error('Cron expiry error', err);
    res.status(500).send('Error running expiry check');
  }
};
