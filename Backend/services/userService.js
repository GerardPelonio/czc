
const firebase = require('firebase-admin');
const { getDb } = require('../utils/getDb');
const { COLLECTION } = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { demoRegisterUser, demoAuthenticateUser } = require('./demoAuthService');

const jwtKey = process.env.JWT_KEY || 'demo-key';

const err = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };

function normalizeRole(r) {
  if (!r) return null;
  const v = String(r).toLowerCase();
  return (v === 'student' || v === 'teacher') ? v : null;
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  if (!currentPassword || !newPassword) throw Object.assign(new Error('Current and new password are required'), { status: 400 });

  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const ref = db.collection(COLLECTION).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('User not found'), { status: 404 });

  const user = snap.data();
  const ok = await bcrypt.compare(currentPassword, user.password || '');
  if (!ok) throw Object.assign(new Error('Current password incorrect'), { status: 401 });

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);
  await ref.update({ password: hashed });

  return true;
}

async function registerUser({ username, email, password, id, role }) {
  const db = getDb();
  
  // Use demo auth if Firebase is not initialized
  if (!db) {
    console.warn('Using demo auth (Firebase not available)');
    return await demoRegisterUser({ username, email, password, id, role });
  }

  const users = db.collection(COLLECTION);

  // Check for existing email and username
  if (!email) throw err('Email is required', 400);
  const existingEmail = await users.where('email', '==', email).limit(1).get();
  if (!existingEmail.empty) throw err('Email already exists', 409);

  if (username) {
    const existingUser = await users.where('username', '==', username).limit(1).get();
    if (!existingUser.empty) throw err('Username already exists', 409);
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  const docId = id || users.doc().id;

  const userData = {
    id: docId,
    email,
    username,
    password: hashed,
    role: normalizeRole(role) || role,
    createdAt: require('../utils/getDb').serverTimestampOrDate()
  };

  await users.doc(docId).set(userData);

  const safe = { ...userData };
  delete safe.password;
  return safe;
}

async function authenticateUser(email, password, role) {
  const db = getDb();
  
  // Use demo auth if Firebase is not initialized
  if (!db) {
    console.warn('Using demo auth (Firebase not available)');
    return await demoAuthenticateUser(email, password, role);
  }

  let q = db.collection(COLLECTION).where('email', '==', email).limit(1);

  const roleNorm = normalizeRole(role);
  if (role && roleNorm) q = q.where('role', '==', roleNorm);

  const snap = await q.get();
  if (snap.empty) throw err('Invalid email or password', 401);

  const doc = snap.docs[0];
  const user = doc.data();

  const match = await bcrypt.compare(password, user.password || '');
  if (!match) throw err('Invalid email or password', 401);

  const payload = { id: user.id || doc.id, email: user.email, username: user.username, role: user.role };
  const token = jwtKey ? jwt.sign(payload, jwtKey, { expiresIn: '7d' }) : null;

  const safe = { ...user };
  delete safe.password;
  return { user: safe, token };
}

// Generates OTP for password reset
async function createForgotOtp(email) {
  if (!email) throw Object.assign(new Error('Missing email'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const users = db.collection(COLLECTION);
  const snap = await users.where('email', '==', email).limit(1).get();
  if (snap.empty) throw Object.assign(new Error('User not found'), { status: 404 });
  const doc = snap.docs[0];
  const userId = doc.id;

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  await users.doc(userId).set({ _forgotOtp: { code, expiresAt } }, { merge: true });

  return { userId, code };
}

//Verifies OTP and resets password
async function resetPasswordByOtp(email, code, newPassword) {
  if (!email || !code || !newPassword) throw Object.assign(new Error('Missing parameters'), { status: 400 });
  const db = getDb();
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
  const users = db.collection(COLLECTION);
  const snap = await users.where('email', '==', email).limit(1).get();
  if (snap.empty) throw Object.assign(new Error('User not found'), { status: 404 });
  const doc = snap.docs[0];
  const userId = doc.id;
  const data = doc.data() || {};
  const otp = data._forgotOtp || {};
  if (!otp.code || otp.expiresAt < Date.now()) throw Object.assign(new Error('OTP expired or not found'), { status: 400 });
  if (String(otp.code) !== String(code)) throw Object.assign(new Error('Invalid OTP'), { status: 401 });

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);
  await users.doc(userId).update({ password: hashed, _forgotOtp: null });

  return true;
}

// Add coins to a student's profile in Firestore
async function addCoinsToUser(db, userId, amount) {
  if (!db) throw Object.assign(new Error('Firestore not initialized'), { status: 500 });
  if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });
  if (!amount || amount <= 0) throw Object.assign(new Error('Invalid coin amount'), { status: 400 });

  try {
    // Store coins in the students collection to match getUserCoins
    const studentRef = db.collection('students').doc(userId);
    const snap = await studentRef.get();
    
    console.log(`Adding coins: userId=${userId}, amount=${amount}`);
    console.log(`Student doc exists: ${snap.exists}`);
    
    if (snap.exists) {
      console.log(`Student data before update:`, snap.data());
    }
    
    const currentCoins = snap.exists ? (snap.data().coins || 0) : 0;
    const newBalance = currentCoins + amount;

    console.log(`Current coins: ${currentCoins}, New balance: ${newBalance}`);
    
    // Use set with merge to ensure document exists and coins are updated
    await studentRef.set({ coins: newBalance }, { merge: true });
    
    // Verify the update
    const verifySnap = await studentRef.get();
    console.log(`Verified coins after update: ${verifySnap.data().coins}`);
    
    return newBalance;
  } catch (error) {
    console.error(`Error adding coins to user ${userId}:`, error);
    throw error;
  }
}

module.exports = { registerUser, authenticateUser, changePassword, createForgotOtp, resetPasswordByOtp, addCoinsToUser };
