const express = require('express');
const { verifyToken } = require('../middlewares/auth');
const rankingMiddleware = require('../middlewares/rankingMiddleware');
const rankingController = require('../controllers/rankingController');
const router = express.Router();

const loadStudent = (rankingMiddleware && rankingMiddleware.loadStudent) || rankingMiddleware;

router.get('/ranking', verifyToken, loadStudent, rankingController.getRanking);
router.get('/ranking/history', verifyToken, loadStudent, rankingController.getHistory);

module.exports = router;