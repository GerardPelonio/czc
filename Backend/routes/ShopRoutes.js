const express = require('express');
const router = express.Router();
const controller = require('../controllers/ShopController');
const { authLimiter } = require('../middlewares/authLimit');
const { verifyToken } = require('../middlewares/auth');

// List available shop items (no auth required to browse)
router.get('/api/shop', authLimiter, controller.listItems);

// Redeem an item using student coins (auth required)
router.post('/api/shop/redeem', authLimiter, verifyToken, controller.redeem);

// Get user's purchase transactions (auth required)
router.get('/api/shop/transactions/:userId', authLimiter, verifyToken, controller.getTransactions);

module.exports = router;
