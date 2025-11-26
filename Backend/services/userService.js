const firebase = require('firebase-admin');
const { getDb } = require('../utils/getDb');
const { COLLECTION } = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const jwtKey = process.env.JWT_KEY || null;

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
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
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
  if (!db) throw Object.assign(new Error('Firestore not initialized (missing credentials or emulator).'), { status: 500 });
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

module.exports = { registerUser, authenticateUser, changePassword, createForgotOtp, resetPasswordByOtp };