COZYCLIPS STORIES BRIEF INFORMATION

📘 PROJECT OVERVIEW

CozyClips is an interactive learning platform for Filipino students, providing 
a curated library of short stories tailored for DepEd curricula. Students can 
read stories, take quizzes, earn coins through quests, bookmark favorites, and 
track reading progress through an engaging gamification system.

🚀 CORE FEATURES

📚 Story Library: Curated short stories filtered by grade level and genre
📝 Quiz System: AI-generated quizzes to test comprehension and retention
🏆 Quest & Rewards: Earn coins by completing reading challenges
🔖 Bookmarks: Save favorite stories for quick access
📊 Progress Tracking: Monitor reading sessions, chapters completed, and stats
👥 User Roles: Support for students, teachers, and admins
💰 Shop & Subscriptions: Redeem coins for premium features
⭐ Rankings: Leaderboards to foster healthy competition
🔄 Reading Streaks: Daily streak tracking to promote consistency
💬 Word Helper: Get instant word definitions while reading

🛠️ BACKEND TECH STACK
Framework: Express.js (Node.js)
Language: JavaScript
Database: Firebase Firestore (with fallback JSON storage)
Authentication: JWT + Firebase Admin SDK
Validation: Express-validator
Rate Limiting: express-rate-limit
Email: Nodemailer (password recovery)
AI: Google Generative AI (quiz generation)
Payment: PayPal webhooks

📂 BACKEND STRUCTURE

Backend/
├── controllers/      # Business logic for each feature
├── routes/          # API endpoint definitions
├── services/        # Database & external service interactions
├── models/          # Firestore data models
├── middlewares/     # Auth, rate limiting, validation
├── validators/      # Request validation rules
├── utils/           # Helper functions & database utilities
├── data/            # JSON fallback files & cached data
├── tools/           # Migration & utility scripts
└── scripts/         # Data generation scripts
