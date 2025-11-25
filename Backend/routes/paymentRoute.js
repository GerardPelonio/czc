const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/auth');
const { createValidator } = require('../validators/paymentValidator');

// Subscription routes
router.post('/api/subscription', verifyToken, createValidator, controller.createSubscription);
router.get('/api/subscription/:userId', verifyToken, controller.getSubscription);
router.patch('/api/subscription/:userId', verifyToken, controller.updateSubscription);
router.delete('/api/subscription/:userId', verifyToken, controller.cancelSubscription);


router.post('/api/payment-intent', verifyToken, controller.createPaymentIntent);
router.post('/api/webhook/paypal', express.raw({ type: 'application/json' }), controller.paypalWebhook);

module.exports = router;