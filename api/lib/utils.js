'use strict';

const PLATFORM_PATTERNS = {
  youtube:    { regex: /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/, name: 'YouTube',     color: '#FF0000', formats: ['mp4','mp3'] },
  instagram:  { regex: /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/,                name: 'Instagram',   color: '#E1306C', formats: ['mp4','jpg'] },
  twitter:    { regex: /(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/,                                   name: 'X (Twitter)', color: '#1DA1F2', formats: ['mp4'] },
  tiktok:     { regex: /(?:tiktok\.com)\/@[^/]+\/video\/(\d+)|(?:vm\.tiktok\.com)\/([a-zA-Z0-9]+)/,       name: 'TikTok',      color: '#69C9D0', formats: ['mp4'] },
  facebook:   { regex: /(?:facebook\.com|fb\.watch)\/(?:watch\/?\?v=|[^/]+\/videos\/)([0-9]+)/,           name: 'Facebook',    color: '#1877F2', formats: ['mp4'] },
  vimeo:      { regex: /vimeo\.com\/([0-9]+)/,                                                             name: 'Vimeo',       color: '#1AB7EA', formats: ['mp4'] },
  soundcloud: { regex: /soundcloud\.com\/([^/]+\/[^/]+)/,                                                  name: 'SoundCloud',  color: '#FF5500', formats: ['mp3'] },
  reddit:     { regex: /reddit\.com\/r\/[^/]+\/comments\/([a-zA-Z0-9]+)/,                                  name: 'Reddit',      color: '#FF4500', formats: ['mp4'] },
};

function validateUrl(raw) {
  if (!raw || typeof raw !== 'string') return { valid: false, error: 'URL is required.' };
  const trimmed = raw.trim();
  if (trimmed.length > 2048) return { valid: false, error: 'URL too long.' };
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return { valid: false, error: 'Only HTTP/HTTPS allowed.' };
    const h = url.hostname.toLowerCase();
    if (['localhost','127.0.0.1','0.0.0.0','::1'].includes(h) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h))
      return { valid: false, error: 'Private URLs not allowed.' };
    return { valid: true, url };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

function detectPlatform(raw) {
  for (const [key, cfg] of Object.entries(PLATFORM_PATTERNS)) {
    if (cfg.regex.test(raw)) {
      const m = raw.match(cfg.regex);
      return { platform: key, name: cfg.name, color: cfg.color, formats: cfg.formats, id: m?.[1] || m?.[2] || null };
    }
  }
  return { platform: 'generic', name: 'Unknown', color: '#888', formats: ['mp4'], id: null };
}

// Simple in-memory rate limiter (per serverless instance)
const _buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const bucket = _buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + windowMs; }
  bucket.count++;
  _buckets.set(key, bucket);
  return bucket.count <= max;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

module.exports = { validateUrl, detectPlatform, PLATFORM_PATTERNS, rateLimit, getClientIp };
