function maskApiKey(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([&?]key=)[^&]*/gi, '$1REDACTED');
}

function sanitizeAxiosError(err) {
  if (!err) return { message: 'Unknown error' };
  const res = {};
  res.message = err.message || 'Axios error';
  if (err.config && err.config.url) {
    res.url = maskApiKey(err.config.url);
    res.method = err.config.method;
  }
  if (err.response) {
    res.status = err.response.status;
    res.statusText = err.response.statusText;
  }
  if (err.code) res.code = err.code;
  return res;
}

module.exports = { maskApiKey, sanitizeAxiosError };
