const firebase = require('firebase-admin');

function getDb() {
  try {
    if (process && process.env && process.env.NODE_ENV === 'test') {
      // In tests we often mock firebase-admin so allow firebase.firestore()
      if (firebase && typeof firebase.firestore === 'function') return firebase.firestore();
    }
    // If firebase isn't initialized yet, and environment has credentials or emulator config, try to lazily initialize
    if (!firebase.apps || !firebase.apps.length) {
      const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const hasExplicitCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
      const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_EMULATOR_HOST;
      const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (hasServiceAccountJson || hasExplicitCreds || hasEmulator || hasADC) {
        try {
          if (hasServiceAccountJson) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            firebase.initializeApp({ 
              credential: firebase.credential.cert(serviceAccount),
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
            });
          } else if (hasExplicitCreds) {
            const serviceAccount = {
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            };
            firebase.initializeApp({ 
              credential: firebase.credential.cert(serviceAccount),
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
            });
          } else if (hasEmulator) {
            const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-project';
            firebase.initializeApp({ 
              projectId,
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`
            });
          } else if (hasADC) {
            firebase.initializeApp({
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET
            });
          }
        } catch (e) {
          console.warn('getDb: failed to initialize firebase from env vars; continuing with null db', e && e.message ? e.message : e);
        }
      }
    }
    if (firebase.apps && firebase.apps.length) {
      return firebase.firestore();
    }
    console.warn('getDb: firebase not initialized — returning null. Initialize firebase via server.js or set FIREBASE_* env vars.');
    return null;
  } catch (e) {
    console.warn('getDb: error while getting firestore', e && e.message ? e.message : e);
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
