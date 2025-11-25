const wordService = require('../services/wordHelperService');

async function wordHelper(req, res) {
  try {
    const qword = (req.body && req.body.word)
      ? String(req.body.word).trim()
      : (req.query && req.query.word ? String(req.query.word).trim() : '');

    if (!qword) return res.status(400).json({ success: false, message: 'Missing parameter: word (body or query)' });

    // tl for tagalog and en for english
    const translateTo = (req.body && req.body.translate) || (req.query && req.query.translate) || null;

    const data = await wordService.getWord(qword, translateTo ? { translateTo } : {});
    return res.status(200).json({ success: true, data });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

module.exports = { wordHelper };