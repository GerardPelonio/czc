require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
// 1. THIS IS THE ONLY LINE YOU ABSOLUTELY NEEDED TO ADD
// =============================================================================
app.set('trust proxy', 1); 
// → Fixes the "X-Forwarded-For header is set but trust proxy is false" error
// → Works perfectly on Render, Railway, Fly.io, Vercel, Heroku, etc.
// → Safe in development too
// =============================================================================

// ------------------ Middlewares ------------------
app.use(cors());
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

app.use(express.json({ limit: '5mb' }));

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