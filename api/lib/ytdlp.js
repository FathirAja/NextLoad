'use strict';

/**
 * yt-dlp wrapper for serverless environments.
 * Uses `yt-dlp-exec` which bundles the yt-dlp binary — no system install needed.
 */

let ytDlp;
function getYtDlp() {
  if (!ytDlp) ytDlp = require('yt-dlp-exec');
  return ytDlp;
}

/**
 * Fetch media metadata (title, thumbnail, formats) without downloading
 * @param {string} url
 * @returns {Promise<object>} parsed yt-dlp JSON info
 */
async function getInfo(url) {
  const exec = getYtDlp();
  const info = await exec(url, {
    dumpSingleJson: true,
    noPlaylist: true,
    noWarnings: true,
    socketTimeout: 15,
    quiet: true,
  });
  return info;
}

/**
 * Build a clean list of download options from yt-dlp format list
 * @param {object} info - parsed yt-dlp info object
 * @returns {Array}
 */
function buildFormats(info) {
  const formats = info.formats || [];
  const result = [];
  const seen = new Set();

  // Best combined video+audio MP4 per resolution
  const videoFmts = formats
    .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4')
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  for (const f of videoFmts) {
    const key = `${f.height}p-mp4`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      formatId:    f.format_id,
      quality:     f.height ? `${f.height}p` : 'Original',
      format:      'mp4',
      size:        f.filesize ? fmtBytes(f.filesize) : (f.filesize_approx ? `~${fmtBytes(f.filesize_approx)}` : '?'),
      label:       f.height >= 1080 ? 'Full HD' : f.height >= 720 ? 'HD' : f.height >= 480 ? 'SD' : 'Low',
      recommended: result.length === 0,
    });
    if (result.length >= 4) break;
  }

  // Fallback: best available video
  if (result.length === 0) {
    result.push({ formatId: 'bestvideo+bestaudio/best', quality: 'Best', format: info.ext || 'mp4', size: '?', label: 'Best Quality', recommended: true });
  }

  // Separate audio: best audio-only → mp3
  const audioFmt = formats
    .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
  if (audioFmt) {
    result.push({
      formatId:    audioFmt.format_id,
      quality:     `${Math.round(audioFmt.abr || 128)}kbps`,
      format:      'mp3',
      size:        audioFmt.filesize ? fmtBytes(audioFmt.filesize) : '?',
      label:       'Audio Only',
      recommended: false,
    });
  }

  return result;
}

function fmtBytes(b) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

function fmtDuration(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

module.exports = { getInfo, buildFormats, fmtDuration };
