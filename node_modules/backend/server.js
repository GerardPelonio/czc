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
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        firebase.initializeApp({ credential: firebase.credential.cert(serviceAccount) });
      } else if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      ) {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
        firebase.initializeApp({ credential: firebase.credential.cert(serviceAccount) });
      } else if (process.env.NODE_ENV !== 'production') {
        console.log('Using Firebase emulator or default credentials');
        firebase.initializeApp();
      }
      resolve(firebase.firestore());
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
      console.log(`Server running on http://localhost:${PORT} (Firestore NOT connected)`),
    );
  });
