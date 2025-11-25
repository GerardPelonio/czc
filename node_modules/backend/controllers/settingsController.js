const settingsService = require('../services/settingsService');

async function getSettings(req, res) {
  try {
    const paramId = req.params && req.params.id;
    const userId = paramId || (req.user && req.user.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // Ensure user can only access their own settings
    if (paramId && req.user && req.user.id !== paramId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const settings = await settingsService.getSettings(userId);
    res.status(200).json({ success: true, data: { settings } });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

async function updateSettings(req, res) {
  try {
    const paramId = req.params && req.params.id;
    const userId = paramId || (req.user && req.user.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // makes sure that users can only update their own settings
    if (paramId && req.user && req.user.id !== paramId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const settings = await settingsService.updateSettings(userId, req.body || {});

    try {
      const cache = require('../middlewares/cache');
      if (cache && typeof cache.del === 'function') await cache.del(`settings:${userId}`);
    } catch (e) { /* ignore */ }

    res.status(200).json({ success: true, data: { settings } });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

module.exports = { getSettings, updateSettings };