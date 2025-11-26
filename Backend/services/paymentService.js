const admin = require('firebase-admin');
const { getDb } = require('../utils/getDb');
const fetch = require('node-fetch');

const COLLECTION = 'subscriptions';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE = process.env.PAYPAL_BASE;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;


// Firestore subscription record creation
async function createLocalRecord(userId, plan = 'Free', meta = {}) {
  if (!userId) throw Object.assign(new Error('userId required'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const now = new Date().toISOString();
  const record = {
    userId,
    plan,
    status: meta.status || (plan === 'Free' ? 'active' : 'pending'),
    startDate: meta.startDate || now,
    endDate: meta.endDate || meta.end || null,
    gateway: meta.gateway || null,
    createdAt: meta.createdAt || now,
    updatedAt: new Date().toISOString()
  };
  await db.collection(COLLECTION).doc(String(userId)).set(record, { merge: true });
  const snap = await db.collection(COLLECTION).doc(String(userId)).get();
  return snap.exists ? snap.data() : record;
}

async function getSubscription(userId) {
  if (!userId) return null;
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const snap = await db.collection(COLLECTION).doc(String(userId)).get();
  return snap.exists ? snap.data() : null;
}

async function updateSubscription(userId, patch = {}) {
  if (!userId) throw Object.assign(new Error('userId required'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  patch.updatedAt = new Date().toISOString();
  await db.collection(COLLECTION).doc(String(userId)).set(patch, { merge: true });
  const snap = await db.collection(COLLECTION).doc(String(userId)).get();
  return snap.exists ? snap.data() : null;
}

async function cancelSubscription(userId, opts = {}) {
  if (!userId) throw Object.assign(new Error('userId required'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const patch = { status: 'cancelled', endDate: new Date().toISOString(), updatedAt: new Date().toISOString(), ...(opts.patch || {}) };
  await db.collection(COLLECTION).doc(String(userId)).set(patch, { merge: true });
  const snap = await db.collection(COLLECTION).doc(String(userId)).get();
  return snap.exists ? snap.data() : null;
}

// Get PayPal access token
async function _getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw Object.assign(new Error('PayPal credentials not configured'), { status: 500 });
  }
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw Object.assign(new Error('PayPal token error: ' + text), { status: 502 });
  const json = JSON.parse(text || '{}');
  if (!json.access_token) throw Object.assign(new Error('PayPal token missing'), { status: 502 });
  return { accessToken: json.access_token, base: PAYPAL_BASE };
}

// Create PayPal order
async function createPayPalOrder({ amount = 0, currency = 'PHP', return_url = '', cancel_url = '', description = '', metadata = {} } = {}) {
  const { accessToken, base } = await _getPayPalAccessToken();
  const cents = Number(amount || 0);
  if (!Number.isFinite(cents) || cents <= 0) throw Object.assign(new Error('Invalid amount'), { status: 400 });
  const value = (cents / 100).toFixed(2);
  const reference = metadata.reference || `${metadata.userId || 'anon'}|${metadata.plan || ''}|${Date.now()}`;

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: currency, value },
      description,
      custom_id: reference
    }],
    application_context: {
      return_url: return_url || (FRONTEND_URL ? `${FRONTEND_URL}/payments/return` : ''),
      cancel_url: cancel_url || (FRONTEND_URL ? `${FRONTEND_URL}/payments/cancel` : '')
    }
  };

  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) throw Object.assign(new Error('PayPal order error: ' + text), { status: 502 });
  const json = JSON.parse(text || '{}');
  const approveLink = (json.links || []).find(l => l.rel === 'approve')?.href || null;
  return { checkoutId: json.id || null, checkoutUrl: approveLink, requestReferenceNumber: reference, raw: json };
}

// Create payment intent
async function createPaymentIntent(userId, attrs = {}) {
  const checkout = await createPayPalOrder(attrs);
  if (userId) {
    await createLocalRecord(userId, attrs.plan || 'Premium', {
      status: 'pending',
      gateway: { provider: 'paypal', checkoutId: checkout.checkoutId, reference: checkout.requestReferenceNumber }
    });
  }
  return checkout;
}

// Create subscription
async function createSubscription(userId, opts = {}) {
  if (!userId) return { success: false, message: 'userId required', statusCode: 400 };
  const plan = opts.plan || 'Premium';
  const metadata = opts.metadata || {};
  metadata.userId = metadata.userId || userId;
  metadata.plan = metadata.plan || plan;

  const rec = await createLocalRecord(userId, plan, {
    status: opts.status || 'pending',
    gateway: { provider: 'paypal', metadata },
    startDate: new Date().toISOString()
  });

  return { success: true, data: rec, statusCode: 201 };
}

// Webhook handler
async function handlepaypalWebhook(rawBuf, headers) {
  if (!PAYPAL_WEBHOOK_ID) throw Object.assign(new Error('PAYPAL_WEBHOOK_ID not configured'), { status: 500 });
  const { accessToken, base } = await _getPayPalAccessToken();

  let event;
  try { event = JSON.parse(rawBuf.toString()); } catch (e) { throw Object.assign(new Error('Invalid JSON body'), { status: 400 }); }

  const verifyPayload = {
    transmission_id: headers['paypal-transmission-id'] || headers['paypal-transmission_id'] || headers['paypal-transmissionid'],
    transmission_time: headers['paypal-transmission-time'] || headers['paypal-transmission_time'],
    cert_url: headers['paypal-cert-url'] || headers['paypal_cert_url'],
    auth_algo: headers['paypal-auth-algo'] || headers['paypal_auth_algo'],
    transmission_sig: headers['paypal-transmission-sig'] || headers['paypal-transmission_sig'],
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: event
  };

  const vr = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(verifyPayload)
  });

  const vText = await vr.text().catch(() => '');
  if (!vr.ok) throw Object.assign(new Error('PayPal verify error: ' + vText), { status: 502 });
  const vJson = JSON.parse(vText || '{}');
  if (vJson.verification_status !== 'SUCCESS') throw Object.assign(new Error('Invalid PayPal webhook signature'), { status: 401 });

  const eventType = event.event_type || '';
  const resource = event.resource || {};
  const ref = resource.custom_id || resource.invoice_id || (resource.purchase_units && resource.purchase_units[0] && (resource.purchase_units[0].custom_id || resource.purchase_units[0].reference_id)) || null;
  if (!ref) return { ok: true, message: 'no reference' };

  if (/CAPTURE.COMPLETED|PAYMENT.CAPTURE.COMPLETED|CHECKOUT.ORDER.APPROVED|ORDER.APPROVED/i.test(String(eventType))) {
    const [userId, plan = 'Premium'] = String(ref).split('|');
    if (!userId) return { ok: true, message: 'no user in reference' };
    const db = getDb();
    if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.collection(COLLECTION).doc(String(userId)).set({
      status: 'active',
      plan,
      startDate: now,
      endDate: end,
      gateway: { provider: 'paypal', reference: ref, raw: resource },
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { ok: true, action: 'activated' };
  }

  return { ok: true, message: 'ignored' };
}

// Expire checker
const DAY_MS = 24 * 60 * 60 * 1000;
async function runExpiryOnce(dbArg) {
  try {
    const db = dbArg || getDb();
    if (!db) throw new Error('Firestore not initialized (missing credentials or emulator).');
    const nowISO = new Date().toISOString();
    const col = db.collection(COLLECTION);
    const q = await col.where('endDate', '<=', nowISO).get();
    if (q.empty) return;
    const batch = db.batch();
    q.docs.forEach(doc => {
      const d = doc.data() || {};
      if (!d) return;
      if (d.status === 'expired' || d.plan === 'Free') return;
      batch.set(doc.ref, { plan: 'Free', status: 'expired', updatedAt: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();
  } catch (e) {
    console.error('runExpiryOnce error', e);
  }
}
function startExpiryChecker(dbOrInterval) {
  if (typeof dbOrInterval === 'object' && dbOrInterval !== null && typeof dbOrInterval.collection === 'function') {
    runExpiryOnce(dbOrInterval);
    setInterval(() => runExpiryOnce(dbOrInterval), DAY_MS);
  } else {
    const intervalMs = typeof dbOrInterval === 'number' ? dbOrInterval : DAY_MS;
    runExpiryOnce();
    setInterval(() => runExpiryOnce(), intervalMs);
  }
}

module.exports = {
  createLocalRecord,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  createPaymentIntent,
  createSubscription,
  handlepaypalWebhook,
  startExpiryChecker,
  runExpiryOnce
};