const { getDb } = require('../../utils/getDb');
const db = getDb();

module.exports = async (req, res) => {
  try {
    if (!db) return res.json({ ok: true, message: 'Firestore not initialized (limited mode)' });
    const snap = await db.collection('vercel_test').doc('health').get().catch(() => null);
    res.json({ ok: true, exists: !!(snap && snap.exists) });
  } catch (err) {
    console.error('debug db error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
