const express = require('express');
const router = express.Router();
const controller = require('../controllers/settingsController');
const { verifyToken } = require('../middlewares/studentMiddleware');
const { validateSettings } = require('../validators/settingsValidator');

// Settings Routes
router.get('/api/user/profile/:id/settings', verifyToken, controller.getSettings);
router.patch('/api/user/profile/:id/settings', verifyToken, validateSettings, controller.updateSettings);

module.exports = router;