module.exports = (req, res) => {
  res.json({ ok: true, message: 'hello', url: req.url, method: req.method });
};
