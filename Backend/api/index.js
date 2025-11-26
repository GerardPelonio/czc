// api/index.js
const app = require('../app');
const { getDb } = require('../utils/getDb');
// Do not initialize firebase here; server.js handles that. Use getDb helper to get db instance or null.
app.locals.db = getDb();

module.exports = (req, res) => {
  // Minimal log to help debug routing during vercel dev builds
  try { console.log('[api/index] Request:', req.method, req.url); } catch (e) {}
  return app(req, res);
};