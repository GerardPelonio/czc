require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { validationResult } = require('express-validator');
const firebase = require('firebase-admin');

const paymentService = require('./services/paymentService');

// ------------------ Routes ------------------
// CozyClip Features
const HomeRoutes = require('./routes/HomeRoutes');
const LibraryRoutes = require('./routes/LibraryRoutes');
const StoryRoutes = require('./routes/StoryRoutes');
const ShopRoutes = require('./routes/ShopRoutes');
const QuizRoutes = require('./routes/QuizRoutes');
const BookmarkRoutes = require('./routes/BookmarkRoutes');
const QuestRoutes = require('./routes/QuestRoutes');

// Legacy / User System Routes
const userRoute = require('./routes/userRoute');
const studentRoute = require('./routes/studentRoute');
const teacherRoute = require('./routes/teacherRoute');
const settingsRoute = require('./routes/settingsRoute');
const streakRoute = require('./routes/streakRoute');
const wordHelperRoute = require('./routes/wordHelperRoute');
const paymentRoute = require('./routes/paymentRoute');
const rankingRoute = require('./routes/rankingRoute');

const app = express();

// ------------------ Middlewares ------------------
app.use(cors());
app.use(morgan('dev'));

// PayMaya webhook must be before JSON parser
app.use('/api/webhook/paymaya', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '5mb' }));

// Global validation error handler
app.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({ field: err.path || err.param, message: err.msg })),
    });
  }
  next();
});

// ------------------ Mount Routes ------------------
// CozyClip Features
app.use('/api/home', HomeRoutes);
app.use('/api/library', LibraryRoutes);
app.use('/api/stories', StoryRoutes);
app.use('/api/shop', ShopRoutes);
app.use('/api/quiz', QuizRoutes);
app.use('/api/bookmarks', BookmarkRoutes);
app.use('/api/quests', QuestRoutes);

// Legacy / User System
app.use(userRoute);
app.use(studentRoute);
app.use(teacherRoute);
app.use(settingsRoute);
app.use(streakRoute);
app.use(wordHelperRoute);
app.use(paymentRoute);
app.use('/api', rankingRoute);

// Root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CozyClip Stories API — Running Perfectly',
    version: '1.0',
    features: 'Library • Quiz • Shop • Quests • Firebase • Payments',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

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
