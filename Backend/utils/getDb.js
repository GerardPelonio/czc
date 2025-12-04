// Backend/utils/getDb.js

const firebase = require('firebase-admin');

let defaultApp = null; // Store the initialized app instance

function getDb() {
  try {
    // Check if a default app has already been initialized
    if (defaultApp) {
      return defaultApp.firestore();
    }
    
    // --- Existing logic to handle mocks/tests ---
    if (process && process.env && process.env.NODE_ENV === 'test') {
      if (firebase && typeof firebase.firestore === 'function') return firebase.firestore();
    }
    // ---------------------------------------------

    // Check if an app exists in the global array (e.g., if initialized elsewhere)
    if (firebase.apps && firebase.apps.length) {
      defaultApp = firebase.apps[0];
      return defaultApp.firestore();
    }

    // Attempt to initialize Firebase lazily using env vars
    const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const hasExplicitCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
    const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_EMULATOR_HOST;
    const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (hasServiceAccountJson || hasExplicitCreds || hasEmulator || hasADC) {
      try {
        let options = {};
        if (hasServiceAccountJson) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          options.credential = firebase.credential.cert(serviceAccount);
        } else if (hasExplicitCreds) {
          const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          };
          options.credential = firebase.credential.cert(serviceAccount);
        } else if (hasEmulator) {
          options.projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-project';
        }

        defaultApp = firebase.initializeApp(options);
        return defaultApp.firestore();
        
      } catch (e) {
        console.error('getDb: FATAL Firebase Initialization Failed:', e.message);
        return null; 
      }
    }
    
    console.warn('getDb: Firebase not initialized - returning null. Check FIREBASE_* env vars.');
    return null;

  } catch (e) {
    console.error('getDb: Unexpected error:', e.message);
    return null;
  }
}

function getFieldValue() {
  try {
    if (firebase && firebase.firestore && firebase.firestore.FieldValue) return firebase.firestore.FieldValue;
  } catch (e) {
    // ignore
  }
  return null;
}

function serverTimestampOrDate() {
  const FieldValue = getFieldValue();
  if (FieldValue && typeof FieldValue.serverTimestamp === 'function') return FieldValue.serverTimestamp();
  return new Date();
}

module.exports = { getDb, getFieldValue, serverTimestampOrDate };