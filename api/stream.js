'use strict';

const { spawn } = require('child_process');
const { validateUrl, rateLimit, getClientIp } = require('./lib/utils');

// yt-dlp-exec exposes the binary path
function getYtDlpBin() {
  try {
    // yt-dlp-exec stores the binary here after npm install
    return require('yt-dlp-exec/lib/binInfo').getBinaryPath();
  } catch {
    return 'yt-dlp'; // fallback to PATH
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed.' });

  // Rate limit: 5 streams/min per IP
  const ip = getClientIp(req);
  if (!rateLimit(`stream:${ip}`, 5, 60_000)) {
    return res.status(429).json({ success: false, error: 'Too many download requests. Wait 1 minute.' });
  }

  const { url, formatId, format, filename } = req.query;

  // Validate
  const validation = validateUrl(url);
  if (!validation.valid) return res.status(400).json({ success: false, error: validation.error });

  if (!formatId) return res.status(400).json({ success: false, error: 'Missing formatId.' });

  const outputFormat = (format || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeFilename = (filename || `nexload-${Date.now()}.${outputFormat}`)
    .replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 120);

  // Build yt-dlp args for piped stdout output
  const isAudio = outputFormat === 'mp3';
  const formatSelector = isAudio ? 'bestaudio/best' : `${formatId}+bestaudio/best`;

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '20',
    '-f', formatSelector,
    '-o', '-',                    // ← pipe to stdout
  ];

  if (isAudio) {
    // Post-process to mp3 via ffmpeg
    args.push(
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '192K'
    );
  } else {
    args.push('--merge-output-format', outputFormat);
  }

  args.push(validation.url.href);

  // Set response headers before spawning
  const mimeMap = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', gif: 'image/gif' };
  res.setHeader('Content-Type', mimeMap[outputFormat] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('X-Accel-Buffering', 'no');

  let ytdlpBin;
  try {
    ytdlpBin = getYtDlpBin();
  } catch {
    ytdlpBin = 'yt-dlp';
  }

  const child = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let stderrBuf = '';
  let headersSent = false;

  // Pipe yt-dlp stdout directly to HTTP response
  child.stdout.on('data', (chunk) => {
    if (!headersSent) { headersSent = true; }
    if (!res.writableEnded) res.write(chunk);
  });

  child.stderr.on('data', (d) => { stderrBuf += d.toString(); });

  child.on('close', (code) => {
    if (res.writableEnded) return;
    if (code !== 0 && !headersSent) {
      // Nothing was sent yet — we can still send a JSON error
      res.removeHeader('Content-Disposition');
      res.setHeader('Content-Type', 'application/json');
      const errMsg = stderrBuf.slice(0, 200) || `yt-dlp exited with code ${code}`;
      return res.status(500).json({ success: false, error: errMsg });
    }
    res.end();
  });

  child.on('error', (err) => {
    if (!headersSent && !res.writableEnded) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ success: false, error: err.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  // If client disconnects, kill yt-dlp
  req.on('close', () => {
    if (!child.killed) child.kill('SIGTERM');
  });
};
