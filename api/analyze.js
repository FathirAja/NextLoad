'use strict';

const { validateUrl, detectPlatform, rateLimit, getClientIp } = require('./lib/utils');
const { getInfo, buildFormats, fmtDuration } = require('./lib/ytdlp');

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed.' });

  // Rate limit: 20 analyze/min per IP
  const ip = getClientIp(req);
  if (!rateLimit(`analyze:${ip}`, 20, 60_000)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Wait a moment.' });
  }

  const { url } = req.body || {};
  const validation = validateUrl(url);
  if (!validation.valid) return res.status(400).json({ success: false, error: validation.error });

  try {
    const info = await getInfo(validation.url.href);
    const platform = detectPlatform(validation.url.href);
    const formats = buildFormats(info);

    res.status(200).json({
      success: true,
      data: {
        url:          validation.url.href,
        platform:     platform.platform,
        platformName: platform.name,
        platformColor: platform.color,
        title:        info.title || 'Unknown Title',
        thumbnail:    info.thumbnail || null,
        description:  (info.description || '').slice(0, 220),
        duration:     fmtDuration(info.duration),
        uploader:     info.uploader || info.channel || null,
        viewCount:    info.view_count || null,
        siteName:     info.extractor_key || platform.name,
        downloadLinks: formats,
      },
    });
  } catch (err) {
    const msg = err.message || '';
    // Friendly error messages
    if (msg.includes('not found') || msg.includes('No such'))
      return res.status(422).json({ success: false, error: 'yt-dlp could not find media at this URL. It may be private or unsupported.' });
    if (msg.includes('Private video') || msg.includes('private'))
      return res.status(422).json({ success: false, error: 'This media is private.' });
    if (msg.includes('age') || msg.includes('sign in'))
      return res.status(422).json({ success: false, error: 'Age-restricted content — cannot fetch without login.' });
    return res.status(500).json({ success: false, error: `Failed to analyze: ${msg.slice(0, 120)}` });
  }
};
