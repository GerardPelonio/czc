const express = require('express');
const router = express.Router();
const controller = require('../controllers/ShopController');
const { authLimiter } = require('../middlewares/authLimit');

// List available shop items
router.get('/api/shop', authLimiter, controller.listItems);

// Redeem an item using student coins
router.post('/api/shop/redeem', authLimiter, controller.redeem);

// Get user transactions
router.get('/api/shop/transactions/:userId', authLimiter, controller.getTransactions);

module.exports = router;
