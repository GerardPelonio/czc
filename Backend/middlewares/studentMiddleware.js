let verifyToken;
let requireRole;

try {
  const auth = require('./auth');
  verifyToken = auth.verifyToken; 
  requireRole = auth.requireRole;
} catch (e) {
  verifyToken = (req, res, next) => next();
  requireRole = () => (req, res, next) => next();
}

module.exports = { verifyToken, requireRole };