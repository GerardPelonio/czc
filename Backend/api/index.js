// api/index.js
const app = require('../app');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    });
  } catch (err) {
    // If no service account provided, try default credentials
    admin.initializeApp();
  }
}
app.locals.db = admin.firestore();

module.exports = (req, res) => {
  // Minimal log to help debug routing during vercel dev builds
  try { console.log('[api/index] Request:', req.method, req.url); } catch (e) {}
  return app(req, res);
};