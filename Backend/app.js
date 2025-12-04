require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const morgan = require('morgan');
const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit'); 

// Routes
const HomeRoutes = require('./routes/HomeRoutes');
const LibraryRoutes = require('./routes/LibraryRoutes');
const StoryRoutes = require('./routes/StoryRoutes');
const ShopRoutes = require('./routes/ShopRoutes');
const QuizRoutes = require('./routes/QuizRoutes');
const BookmarkRoutes = require('./routes/BookmarkRoutes');
const QuestRoutes = require('./routes/QuestRoutes');

const userRoute = require('./routes/userRoute');
const studentRoute = require('./routes/studentRoute');
const teacherRoute = require('./routes/teacherRoute');
const settingsRoute = require('./routes/settingsRoute');
const streakRoute = require('./routes/streakRoute');
const wordHelperRoute = require('./routes/wordHelperRoute');
const paymentRoute = require('./routes/paymentRoute');
const rankingRoute = require('./routes/rankingRoute');

const app = express();

// =============================================================================
// 1. TRUST PROXY: Fixes X-Forwarded-For issue on Vercel/proxies
// =============================================================================
app.set('trust proxy', 1); 
// =============================================================================

// ------------------ Middlewares ------------------

// =============================================================================
// CORS FIX: ALLOW ALL ORIGINS
// This ensures localhost:5173 can talk to your Vercel Backend
// =============================================================================
app.use(cors({
  origin: '*', // Allow any frontend (Localhost or Production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
}));

app.use(morgan('dev'));

// PayMaya webhook needs raw body → must come BEFORE express.json()
app.use('/api/webhook/paymaya', express.raw({ type: 'application/json' }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 600,                 
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

app.use('/api', limiter);

const jsonParser = express.json({ limit: '5mb' });

app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/webhook/')) return next();
  if (typeof req.body !== 'undefined') return next();
  if (!req.readable) return next();

  try {
    return jsonParser(req, res, (err) => {
      if (err) return next(err);
      return next();
    });
  } catch (err) {
    return next();
  }
});

app.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({ 
        field: err.path || err.param, 
        message: err.msg 
      })),
    });
  }
  next();
});

// ------------------ Mount Routes ------------------
app.use('/', HomeRoutes);
app.use('/', LibraryRoutes);
app.use('/', StoryRoutes);
app.use('/', ShopRoutes);
app.use('/', QuizRoutes);
app.use('/', BookmarkRoutes);
app.use('/', QuestRoutes);

app.use(userRoute);
app.use(studentRoute);
app.use(teacherRoute);
app.use(settingsRoute);
app.use(streakRoute);
app.use(wordHelperRoute);
app.use(paymentRoute);
app.use('/api', rankingRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CozyClip Stories API — Running Perfectly',
    version: '1.0',
    features: 'Library • Quiz • Shop • Quests • Firebase • Payments',
  });
});

app.get('/health', (req, res) => {
  const hasDb = !!(req.app?.locals?.db);
  res.json({ 
    success: true, 
    uptime: process.uptime(), 
    db: hasDb ? 'connected' : 'disconnected' 
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;