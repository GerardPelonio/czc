require('dotenv').config();
const express = require('express');
const cors = require('cors'); // <--- CORS is required here
const morgan = require('morgan');
const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit'); // ← Make sure this is installed!

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

// MODIFIED CORS CONFIGURATION:
// This sets the Access-Control-Allow-Origin header based on the environment.
// ACTION REQUIRED: When deploying your frontend, replace 'YOUR_PRODUCTION_FRONTEND_URL'
// with the actual URL (e.g., https://cozyclips-fe.vercel.app).
const allowedOrigin = process.env.NODE_ENV === 'production' 
  ? 'YOUR_PRODUCTION_FRONTEND_URL' // <-- CHANGE THIS WHEN DEPLOYING FRONTEND
  : 'http://localhost:5173'; // Allows local development

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));

// PayMaya webhook needs raw body → must come BEFORE express.json()
app.use('/api/webhook/paymaya', express.raw({ type: 'application/json' }));

// Rate limiter (now works correctly because of trust proxy above)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,                 // adjust as needed
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Apply rate limiting to all /api routes (recommended)
app.use('/api', limiter);

// Use JSON body parser for all routes except webhook routes that require a RAW body.
const jsonParser = express.json({ limit: '5mb' });

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const readable = !!req.readable;
      const bodyExists = typeof req.body !== 'undefined';
      console.debug(`[body-debug] ${req.method} ${req.originalUrl} readable=${readable} bodyExists=${bodyExists}`);
    } catch (e) {
      console.debug('[body-debug] failed to check req properties', e && e.message ? e.message : e);
    }
  }
  return next();
});

app.use((req, res, next) => {
  // Skip JSON parsing for webhook endpoints that expect a raw body
  if (req.originalUrl && req.originalUrl.startsWith('/api/webhook/')) return next();

  // If a body is already present (previous middleware parsed it), skip JSON parsing.
  if (typeof req.body !== 'undefined') return next();

  // If the stream is not readable, don't attempt to parse as it will throw an error.
  if (!req.readable) {
    console.warn('[warn] Request stream not readable; skipping express.json parse for', req.method, req.originalUrl);
    return next();
  }

  try {
    return jsonParser(req, res, (err) => {
      if (err) {
        if (err && err.type === 'stream.not.readable') {
          console.warn('[warn] express.json failed due to unreadable stream; skipping parse for', req.method, req.originalUrl);
          return next();
        }
        return next(err);
      }
      return next();
    });
  } catch (err) {
    console.warn('[warn] Unexpected error during JSON parsing', err && err.message ? err.message : err);
    return next();
  }
});

// Global express-validator error handler
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

// Health check
app.get('/health', (req, res) => {
  const hasDb = !!(req.app?.locals?.db);
  res.json({ 
    success: true, 
    uptime: process.uptime(), 
    db: hasDb ? 'connected' : 'disconnected' 
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler (optional but recommended)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;
