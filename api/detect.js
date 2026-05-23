'use strict';

const { validateUrl, detectPlatform } = require('./lib/utils');

module.exports = function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  const validation = validateUrl(url);
  if (!validation.valid) return res.status(400).json({ success: false, error: validation.error });

  const platform = detectPlatform(validation.url.href);
  res.status(200).json({ success: true, data: platform });
};
