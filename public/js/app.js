/**
 * NexLoad v2 — Serverless Frontend
 * Direct streaming download — no queue polling needed.
 */

// ─── Platform Config ────────────────────────────────────────────────────────
const PLATFORMS = [
  { key: 'youtube',    name: 'YouTube',     icon: '▶️', color: '#FF0000', formats: ['MP4','MP3'] },
  { key: 'instagram',  name: 'Instagram',   icon: '📷', color: '#E1306C', formats: ['MP4','JPG'] },
  { key: 'twitter',    name: 'X (Twitter)', icon: '🐦', color: '#1DA1F2', formats: ['MP4'] },
  { key: 'tiktok',     name: 'TikTok',      icon: '🎵', color: '#69C9D0', formats: ['MP4'] },
  { key: 'facebook',   name: 'Facebook',    icon: '👍', color: '#1877F2', formats: ['MP4'] },
  { key: 'vimeo',      name: 'Vimeo',       icon: '🎬', color: '#1AB7EA', formats: ['MP4'] },
  { key: 'soundcloud', name: 'SoundCloud',  icon: '🔊', color: '#FF5500', formats: ['MP3'] },
  { key: 'reddit',     name: 'Reddit',      icon: '👽', color: '#FF4500', formats: ['MP4'] },
];

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  currentMedia:   null,
  activeDownload: null,   // AbortController for in-progress fetch
  history:        JSON.parse(localStorage.getItem('nexload_history') || '[]'),
};

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $url          = $('url-input');
const $btnAnalyze   = $('btn-analyze');
const $btnPaste     = $('btn-paste');
const $btnClear     = $('btn-clear');
const $btnCancel    = $('btn-cancel');
const $inputCard    = $('input-card');
const $resultCard   = $('result-card');
const $skeleton     = $('skeleton');
const $resultContent = $('result-content');
const $progressCard  = $('progress-card');
const $historyCard   = $('history-card');
const $platformBadge = $('platform-badge');
const $platformIcon  = $('platform-icon');
const $platformName  = $('platform-name');

// ─── Init ────────────────────────────────────────────────────────────────────
function init() {
  renderPlatforms();
  renderHistory();
  bindEvents();
}

// ─── Events ──────────────────────────────────────────────────────────────────
function bindEvents() {
  $url.addEventListener('input', e => handleUrlChange(e.target.value));
  $url.addEventListener('paste', e => setTimeout(() => handleUrlChange(e.target.value), 40));
  $url.addEventListener('keydown', e => { if (e.key === 'Enter' && !$btnAnalyze.disabled) handleAnalyze(); });

  $btnAnalyze.addEventListener('click', handleAnalyze);
  $btnPaste.addEventListener('click', handlePaste);
  $btnClear.addEventListener('click', clearInput);
  $btnCancel.addEventListener('click', cancelDownload);

  $('btn-history').addEventListener('click', toggleHistory);
  $('btn-supported').addEventListener('click', openModal);
  $('modal-close').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });
  $('btn-clear-history').addEventListener('click', clearHistory);

  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDrop);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  setTimeout(() => { $url.focus(); tryAutoPaste(); }, 300);
}

// ─── URL Input ───────────────────────────────────────────────────────────────
function handleUrlChange(val) {
  const t = val.trim();
  $btnAnalyze.disabled = !isValidUrl(t);
  $btnClear.style.display = t ? 'flex' : 'none';
  if (t) detectPlatformLocal(t); else resetPlatformBadge();
}

function isValidUrl(s) {
  try { const u = new URL(s); return ['http:','https:'].includes(u.protocol); } catch { return false; }
}

function clearInput() {
  $url.value = '';
  $btnAnalyze.disabled = true;
  $btnClear.style.display = 'none';
  resetPlatformBadge();
  $resultCard.classList.add('hidden');
}

function resetPlatformBadge() {
  $platformIcon.textContent = '🌐';
  $platformName.textContent = 'Auto Detect';
  $platformBadge.classList.remove('detected');
}

function detectPlatformLocal(url) {
  let detected = PLATFORMS.find(p => url.includes(p.key));
  if (url.includes('youtu.be') || url.includes('youtube.com')) detected = PLATFORMS.find(p => p.key === 'youtube');
  if (url.includes('x.com') || url.includes('twitter.com'))   detected = PLATFORMS.find(p => p.key === 'twitter');
  if (url.includes('tiktok.com') || url.includes('vm.tiktok')) detected = PLATFORMS.find(p => p.key === 'tiktok');
  if (detected) {
    $platformIcon.textContent = detected.icon;
    $platformName.textContent = detected.name;
    $platformBadge.classList.add('detected');
  } else {
    resetPlatformBadge();
  }
}

// ─── Clipboard ───────────────────────────────────────────────────────────────
async function tryAutoPaste() {
  try {
    const text = await navigator.clipboard?.readText();
    if (text && isValidUrl(text) && !$url.value) {
      $url.value = text; handleUrlChange(text);
      showToast('info', '📋 URL detected from clipboard');
    }
  } catch { /* denied */ }
}

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) { $url.value = text.trim(); handleUrlChange(text.trim()); }
    showToast('success', '📋 Pasted!');
  } catch { showToast('error', 'Clipboard access denied — paste manually.'); }
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
function onDragOver(e) { e.preventDefault(); $inputCard.dataset.dragActive = 'true'; }
function onDragLeave(e) { if (!e.relatedTarget || !$inputCard.contains(e.relatedTarget)) $inputCard.dataset.dragActive = 'false'; }
function onDrop(e) {
  e.preventDefault();
  $inputCard.dataset.dragActive = 'false';
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (url && isValidUrl(url.trim())) { $url.value = url.trim(); handleUrlChange(url.trim()); showToast('success', '🔗 URL dropped!'); }
  else showToast('error', 'No valid URL found.');
}

// ─── Analyze ─────────────────────────────────────────────────────────────────
async function handleAnalyze() {
  const url = $url.value.trim();
  if (!url || !isValidUrl(url)) return;

  setAnalyzeLoading(true);
  showResultSkeleton();

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to analyze');
    state.currentMedia = json.data;
    renderResult(json.data);
    showToast('success', '✅ Media loaded!');
  } catch (err) {
    $resultCard.classList.add('hidden');
    showToast('error', err.message);
  } finally {
    setAnalyzeLoading(false);
  }
}

function setAnalyzeLoading(on) {
  $btnAnalyze.classList.toggle('loading', on);
  $btnAnalyze.disabled = on;
}

// ─── Result Rendering ─────────────────────────────────────────────────────────
function showResultSkeleton() {
  $resultCard.classList.remove('hidden');
  $skeleton.classList.remove('hidden');
  $resultContent.classList.add('hidden');
}

function renderResult(media) {
  $skeleton.classList.add('hidden');
  $resultContent.classList.remove('hidden');

  $('result-title').textContent = media.title || 'Unknown';
  $('result-desc').textContent  = media.description || '';

  const thumb = $('result-thumb');
  if (media.thumbnail) {
    thumb.src = media.thumbnail;
    thumb.onerror = () => { thumb.src = ''; };
  }
  $('result-platform-tag').textContent = media.platformName;
  $('meta-site').textContent           = media.siteName || media.platformName;
  $('meta-duration').textContent       = media.duration || '';
  $('meta-duration').style.display     = media.duration ? '' : 'none';

  renderFormats(media.downloadLinks || []);
}

function renderFormats(links) {
  const grid = $('formats-grid');
  grid.innerHTML = '';
  links.forEach(link => {
    const btn = document.createElement('button');
    btn.className = `format-btn${link.recommended ? ' recommended' : ''}`;
    btn.innerHTML = `
      <span class="format-quality">${escHtml(link.quality)}</span>
      <span class="format-meta">
        <span class="format-ext">${escHtml(link.format)}</span>
        <span class="format-size">${escHtml(link.size)}</span>
      </span>`;
    btn.addEventListener('click', () => startStreamDownload(link));
    grid.appendChild(btn);
  });
}

// ─── Stream Download (serverless-compatible) ─────────────────────────────────
/**
 * For serverless: build the /api/stream URL and navigate to it.
 * The browser handles the download — no client-side fetch needed.
 * This avoids the 60s function timeout issue for large files.
 */
async function startStreamDownload(link) {
  if (!state.currentMedia) return;

  const media = state.currentMedia;
  const filename = `${slugify(media.title)}.${link.format}`;

  const params = new URLSearchParams({
    url:      media.url,
    formatId: link.formatId || 'bestvideo+bestaudio/best',
    format:   link.format,
    filename,
  });

  const streamUrl = `/api/stream?${params}`;

  showProgressCard(link);
  showToast('info', `⬇️ Starting ${link.quality} ${link.format.toUpperCase()} download…`);

  // Use fetch + Blob for progress tracking, with AbortController for cancel
  const controller = new AbortController();
  state.activeDownload = controller;

  try {
    updateProgress(5, 'Connecting to media source…');

    const res = await fetch(streamUrl, { signal: controller.signal });

    if (!res.ok) {
      let errMsg = `Server error ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch {}
      throw new Error(errMsg);
    }

    // Stream the response body, tracking download progress
    const contentLength = res.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;

    updateProgress(10, 'Downloading…');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;

      if (total > 0) {
        const pct = Math.min(Math.round((received / total) * 88) + 10, 98);
        updateProgress(pct, `Downloading… ${fmtBytes(received)} / ${fmtBytes(total)}`);
      } else {
        // Unknown total — pulse the bar
        const pct = Math.min(10 + Math.round(received / 1_000_000) * 5, 90);
        updateProgress(pct, `Downloading… ${fmtBytes(received)}`);
      }
    }

    updateProgress(99, 'Preparing file…');

    // Combine chunks into a Blob and trigger Save dialog
    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

    updateProgress(100, '✅ Done!');
    setTimeout(() => {
      $progressCard.classList.add('hidden');
      state.activeDownload = null;
      showToast('success', '🎉 File saved to Downloads!');
      addToHistory({ title: media.title, platform: media.platformName, thumbnail: media.thumbnail, url: media.url });
    }, 1000);

  } catch (err) {
    state.activeDownload = null;
    $progressCard.classList.add('hidden');
    if (err.name === 'AbortError') {
      showToast('warning', 'Download cancelled.');
    } else {
      showToast('error', err.message || 'Download failed.');
    }
  }
}

function showProgressCard(link) {
  $progressCard.classList.remove('hidden');
  $('progress-title').textContent = `Downloading ${link.quality} ${link.format.toUpperCase()}`;
  updateProgress(0, 'Initializing…');
}

function updateProgress(pct, msg) {
  $('progress-bar').style.width   = pct + '%';
  $('progress-glow').style.width  = pct + '%';
  $('progress-pct').textContent   = pct + '%';
  if (msg) $('progress-sub').textContent = msg;
}

function cancelDownload() {
  if (state.activeDownload) {
    state.activeDownload.abort();
    state.activeDownload = null;
  }
  $progressCard.classList.add('hidden');
  showToast('warning', 'Download cancelled.');
}

// ─── History ──────────────────────────────────────────────────────────────────
function addToHistory(item) {
  state.history.unshift({ ...item, completedAt: new Date().toISOString(), status: 'completed' });
  if (state.history.length > 50) state.history.pop();
  localStorage.setItem('nexload_history', JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  const list = $('history-list');
  if (!state.history.length) {
    list.innerHTML = `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>No downloads yet</p></div>`;
    return;
  }
  list.innerHTML = state.history.slice(0, 20).map(item => `
    <div class="history-item">
      ${item.thumbnail ? `<img class="history-item__thumb" src="${escHtml(item.thumbnail)}" alt="" onerror="this.style.display='none'" loading="lazy">` : '<div class="history-item__thumb"></div>'}
      <div class="history-item__info">
        <div class="history-item__title">${escHtml(item.title || 'Unknown')}</div>
        <div class="history-item__meta">${escHtml(item.platform || '')} · ${timeAgo(item.completedAt)}</div>
      </div>
      <span class="history-item__badge badge--completed">done</span>
    </div>`).join('');
}

function toggleHistory() {
  $historyCard.classList.toggle('hidden');
  if (!$historyCard.classList.contains('hidden')) { renderHistory(); $historyCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function clearHistory() {
  state.history.length = 0;
  localStorage.removeItem('nexload_history');
  renderHistory();
  showToast('info', 'History cleared.');
}

// ─── Platforms ────────────────────────────────────────────────────────────────
function renderPlatforms() {
  $('platforms-grid').innerHTML = PLATFORMS.map(p => `
    <div class="platform-chip">
      <span class="platform-chip__dot" style="background:${p.color};box-shadow:0 0 8px ${p.color}60"></span>
      <span>${p.name}</span>
    </div>`).join('');

  $('modal-platforms-list').innerHTML = `<div class="modal-platforms-grid">` +
    PLATFORMS.map(p => `
      <div class="modal-platform-item">
        <span class="modal-platform-dot" style="background:${p.color};box-shadow:0 0 8px ${p.color}60"></span>
        <div class="modal-platform-info">
          <div class="modal-platform-name">${p.icon} ${p.name}</div>
          <div class="modal-platform-formats">${p.formats.join(' · ')}</div>
        </div>
      </div>`).join('') + `</div>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal()  { $('modal-overlay').classList.remove('hidden'); }
function closeModal() { $('modal-overlay').classList.add('hidden'); }

// ─── Toast ────────────────────────────────────────────────────────────────────
const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
function showToast(type, msg, ms = 4500) {
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = `<span class="toast__icon">${ICONS[type]}</span><span class="toast__msg">${escHtml(msg)}</span>`;
  c.appendChild(t);
  const rm = () => { t.classList.add('removing'); t.addEventListener('animationend', () => t.remove()); };
  const timer = setTimeout(rm, ms);
  t.addEventListener('click', () => { clearTimeout(timer); rm(); });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function timeAgo(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtBytes(b) {
  if (b >= 1e9) return `${(b/1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b/1e6).toFixed(1)} MB`;
  return `${(b/1e3).toFixed(0)} KB`;
}
function slugify(s) {
  return String(s||'nexload').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
