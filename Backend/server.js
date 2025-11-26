require('dotenv').config();
const firebase = require('firebase-admin');
const app = require('./app');
const paymentService = require('./services/paymentService');

// `app.js` contains all middlewares, routes, and error handlers.

// ------------------ Firebase Connection ------------------
const connectFirebase = () =>
  new Promise((resolve, reject) => {
    if (firebase.apps.length) return resolve(firebase.firestore());

    try {
      const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const hasExplicitCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
      const hasEmulator = !!process.env.FIREBASE_EMULATOR_HOST || !!process.env.FIRESTORE_EMULATOR_HOST;
      const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

      // If nothing is provided and we're not in production, avoid calling initializeApp with default credentials
      if (!hasServiceAccountJson && !hasExplicitCreds && !hasEmulator && !hasADC) {
        const msg = `No Firebase credentials detected. You can:
  - Set FIREBASE_SERVICE_ACCOUNT_JSON to a service account JSON string
  - Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY
  - Set GOOGLE_APPLICATION_CREDENTIALS to a local service account file
  - Start the Firestore emulator and export FIRESTORE_EMULATOR_HOST
Run the server in "limited mode" without Firestore. See README_FIRESTORE.md for details.`;
        // Non-prod: just return null db so server runs in limited mode
        if (process.env.NODE_ENV !== 'production') {
          console.warn(msg);
          return resolve(null);
        }
        // Prod: fail hard to avoid data loss silently
        throw new Error(msg);
      }

      if (hasServiceAccountJson) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        firebase.initializeApp({ credential: firebase.credential.cert(serviceAccount) });
      } else if (hasExplicitCreds) {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
        firebase.initializeApp({ credential: firebase.credential.cert(serviceAccount) });
      } else if (hasEmulator) {
        // When emulator is in use, set projectId if provided or fallback to demo
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-project';
        firebase.initializeApp({ projectId });
        console.log('Connecting to Firestore emulator', process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_EMULATOR_HOST);
      } else if (hasADC) {
        // ADC credentials are available on the environment
        firebase.initializeApp();
      }

      return resolve(firebase.firestore());
    } catch (err) {
      reject(err);
    }
  });

// ------------------ Start Server ------------------
const PORT = process.env.PORT || 5000;

connectFirebase()
  .then(db => {
    app.locals.db = db;
    console.log('Firebase initialized');

    // Start payment expiry checker
    if (paymentService && typeof paymentService.startExpiryChecker === 'function') {
      try {
        paymentService.startExpiryChecker(db);
        console.log('Payment expiry checker started');
      } catch (e) {
        console.warn('Payment expiry checker failed to start:', e.message || e);
      }
    }

    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Firebase initialization error:', err);
    console.warn('Running in limited mode: Firestore is not initialized. Some features will be disabled or will use local fallback (see Backend/README_FIRESTORE.md).');

    // Start server anyway (limited mode)
    app.locals.db = null;
    try {
      if (paymentService && typeof paymentService.startExpiryChecker === 'function') {
        paymentService.startExpiryChecker(null);
        console.log('Payment expiry checker started (no DB)');
      }
    } catch (e) {
      console.warn('Payment expiry checker not started:', e.message || e);
    }

    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT} (Firestore NOT connected, using fallbacks)`),
    );
  });
