const streakService = require('../services/streakService');

async function getStreak(req, res) {
  try {
    const userId = req.user && req.user.id; 
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const streak = await streakService.getStreak(userId);
    return res.status(200).json({ success: true, data: { streak } });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

async function recordSession(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { date } = req.body || {};
    const updated = await streakService.recordReadingSession(userId, date);
    const motivation = await streakService.fetchMotivation();
    return res.status(200).json({ success: true, data: { streak: updated, motivation } });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Failed to record session' });
  }
}

module.exports = { getStreak, recordSession };