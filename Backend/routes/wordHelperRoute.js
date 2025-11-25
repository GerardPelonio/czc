const express = require('express');
const router = express.Router();
const controller = require('../controllers/wordHelperController');
const { verifyToken } = require('../middlewares/studentMiddleware');

// Word helper route
router.get('/api/word-helper', verifyToken, controller.wordHelper);

module.exports = router;