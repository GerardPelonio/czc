const paymentService = require('../../services/paymentService');
const { getDb } = require('../../utils/getDb');
const db = getDb();

module.exports = async (req, res) => {
  // Optional: protect this endpoint with a secret
  if (process.env.CRON_SECRET && req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  try {
    if (!db) return res.status(200).send('Firestore not initialized — skipping expiry check in limited mode');
    await paymentService.runExpiryOnce(db);
    res.status(200).send('Expiry check run');
  } catch (err) {
    console.error('Cron expiry error', err);
    res.status(500).send('Error running expiry check');
  }
};
