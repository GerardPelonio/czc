const paymentService = require('../services/paymentService');
const { validationResult } = require('express-validator');

// Create payment intent
async function createPaymentIntent(req, res) {
  try {
    const attrs = req.body && req.body.data && req.body.data.attributes ? req.body.data.attributes : req.body || {};
    const userId = req.user && (req.user.id || req.user.uid) ? (req.user.id || req.user.uid) : null;
    attrs.metadata = attrs.metadata || {};
    if (userId) attrs.metadata.userId = attrs.metadata.userId || userId;

    attrs.buyer = attrs.buyer || {
      firstName: req.user?.firstName || req.user?.first_name || '',
      lastName: req.user?.lastName || req.user?.last_name || '',
      email: req.user?.email || ''
    };

    const result = await paymentService.createPaymentIntent(userId, {
      amount: attrs.amount,
      currency: attrs.currency || 'PHP',
      description: attrs.description || '',
      return_url: attrs.return_url,
      cancel_url: attrs.cancel_url,
      metadata: attrs.metadata,
      buyer: attrs.buyer,
      plan: attrs.plan
    });

    return res.status(201).json({ success: true, checkoutUrl: result.checkoutUrl, checkoutId: result.checkoutId, reference: result.requestReferenceNumber });
  } catch (err) {
    console.error('createPaymentIntent error:', err && err.message ? err.message : err);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

// Create subscription
async function createSubscription(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const userId = req.user?.id || req.user?.uid;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body && req.body.data && req.body.data.attributes ? req.body.data.attributes : req.body || {};
    const plan = body.plan || 'Premium';
    const amount = body.amount || 0;
    const metadata = body.metadata || {};

    const result = await paymentService.createSubscription(userId, { plan, amount, metadata });
    return res.status(result.statusCode || 201).json(result);
  } catch (err) {
    console.error('createSubscription error:', err && err.message ? err.message : err);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

async function paypalWebhook(req, res) {
  try {
    await paymentService.handlepaypalWebhook(req.body, req.headers);
    return res.status(200).send('ok');
  } catch (err) {
    console.error('paypalWebhook error:', err && err.message ? err.message : err);
    const status = err.status || 400;
    return res.status(status).send('invalid');
  }
}

async function getSubscription(req, res) {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (!req.user || (req.user.id !== userId && req.user.uid !== userId)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const data = await paymentService.getSubscription(userId);
    if (!data) return res.status(404).json({ success: false, message: 'Subscription not found' });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('getSubscription error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
  }
}

async function updateSubscription(req, res) {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (!req.user || (req.user.id !== userId && req.user.uid !== userId)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const patch = req.body || {};
    const data = await paymentService.updateSubscription(userId, patch);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('updateSubscription error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
  }
}

async function cancelSubscription(req, res) {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (!req.user || (req.user.id !== userId && req.user.uid !== userId)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const data = await paymentService.cancelSubscription(userId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('cancelSubscription error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
  }
}

// Premium plan required 
async function requirePremium(req, res, next) {
  try {
    const userId = req.user && (req.user.id || req.user.uid);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const sub = await paymentService.getSubscription(userId);
    if (!sub || sub.plan !== 'Premium' || sub.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Premium plan required' });
    }
    req.subscription = sub;
    return next();
  } catch (err) {
    console.error('requirePremium error:', err && err.message ? err.message : err);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

module.exports = {
  createPaymentIntent,
  createSubscription,
  paypalWebhook,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  requirePremium
};