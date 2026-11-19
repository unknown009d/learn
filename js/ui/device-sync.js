/**
 * Device-to-device progress transfer inside the Save or Load Progress dialog.
 *
 * Send:  this screen loops an animated QR (one numbered piece of the backup per frame).
 * Scan:  the other device's camera collects pieces in any order, rebuilds the backup text,
 *        and hands it to the same parser/import path as a pasted backup. No server involved.
 */

import { encodeFrames, createAssembler } from '../sync/qr-frames.js';
import { loadScript } from '../core/utils.js';

const SPEEDS = { normal: 200, slow: 450 };
const LARGE_FRAME_COUNT = 60;
const STALL_HINT_MS = 12000;
const LOST_AFTER_MS = 1500;
const RING_SETTLE_MS = 380;
const DECODE_INTERVAL_MS = 60;
const QR_PIXELS = 640;
const SCAN_INTRO_HTML =
  'On the other device, open <strong>Save Backup</strong>' +
  '<span class="material-symbols-outlined bk-inline-chevron" aria-hidden="true">chevron_right</span>' +
  '<span class="bk-sr-only"> then </span>' +
  '<strong>Send to Another Device</strong>.';

const canScan = () => !!navigator.mediaDevices?.getUserMedia && window.isSecureContext !== false;

let deps = null; // { modal, setTab, buildToken, parseBackup, summarize, applyState }

const send = { frames: [], canvases: [], idx: 0, timer: null, speed: 'normal', seq: 0 };
const scan = {
  stream: null,
  raf: 0,
  detector: null,
  canvas: null,
  ctx: null,
  asm: null,
  state: null,
  lastSeenAt: 0,
  locked: false,
  everLocked: false,
  lockTimer: null,
  stallTimer: null,
  seq: 0
};

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ views */

function showView(view) {
  const { modal } = deps;
  const syncing = view === 'send' || view === 'scan';
  modal.classList.toggle('is-syncing', syncing);
  $('bk-panel-send').hidden = view !== 'send';
  $('bk-panel-scan').hidden = view !== 'scan';
  if (!syncing) return;
  $('bk-panel-load').hidden = true;
  $('bk-panel-save').hidden = true;
  setTimeout(() => modal.querySelector(`#bk-panel-${view} .bk-sync-back`)?.focus(), 0);
}

/** Stop any running transfer and return to the normal tabs. */
export function exitDeviceSync(returnTab) {
  stopSending();
  stopScanning();
  if (!deps) return;
  const wasSyncing = deps.modal.classList.contains('is-syncing');
  showView(null);
  if (returnTab && wasSyncing) deps.setTab(returnTab);
}

/* ------------------------------------------------------------------- send */

function renderRawFrame(value) {
  const c = document.createElement('canvas');
  new window.QRious({ element: c, value, size: QR_PIXELS, padding: 0, level: 'L', background: '#ffffff', foreground: '#000000' });
  return c;
}

/**
 * QRious draws whole-pixel modules, so the code covers less than the canvas and the spare
 * pixels pile up on the right and bottom, pushing it off-centre. Find the code's real bounds
 * (every frame has the same QR version, so the first frame is enough) and crop all frames to it.
 */
function findQrBounds(canvas) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4] < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, size: w };
  return { x: minX, y: minY, size: Math.max(maxX - minX, maxY - minY) + 1 };
}

function renderFrameCanvases(frames) {
  const raw = frames.map(renderRawFrame);
  const { x, y, size } = findQrBounds(raw[0]);
  return raw.map((src) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.getContext('2d').drawImage(src, x, y, size, size, 0, 0, size, size);
    return c;
  });
}

function drawSendFrame() {
  const target = $('bk-send-canvas');
  const src = send.canvases[send.idx];
  if (!target || !src) return;
  if (target.width !== src.width) {
    target.width = src.width;
    target.height = src.height;
  }
  // One drawImage per tick: the whole code swaps at once, never a half-drawn frame.
  target.getContext('2d').drawImage(src, 0, 0);
  $('bk-send-frame').textContent = `Piece ${send.idx + 1} of ${send.frames.length} · looping`;
}

function restartSendTimer() {
  clearInterval(send.timer);
  if (send.canvases.length < 2) return;
  send.timer = setInterval(() => {
    send.idx = (send.idx + 1) % send.canvases.length;
    drawSendFrame();
  }, SPEEDS[send.speed]);
}

function setSpeed(speed) {
  send.speed = speed;
  deps.modal.querySelectorAll('.bk-speed-opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.speed === speed)));
  restartSendTimer();
}

async function startSending() {
  const seq = ++send.seq;
  stopSending();
  showView('send');
  $('bk-send-url').textContent = `${location.host}${location.pathname}`.replace(/\/index\.html$/, '/').replace(/\/$/, '') || 'this site';
  $('bk-send-loading').hidden = false;
  $('bk-send-loading').textContent = 'Preparing code…';
  $('bk-send-frame').innerHTML = '&nbsp;';
  $('bk-send-canvas').getContext('2d').clearRect(0, 0, 9999, 9999);

  try {
    const [token] = await Promise.all([deps.buildToken(), loadScript('./vendor/qrious.min.js')]);
    if (seq !== send.seq) return;
    if (typeof window.QRious !== 'function') throw new Error('The QR generator could not load. Check your connection and try again.');
    send.frames = encodeFrames(token);
    send.canvases = renderFrameCanvases(send.frames);
    send.idx = 0;
    $('bk-send-loading').hidden = true;
    $('bk-send-large').hidden = send.frames.length <= LARGE_FRAME_COUNT;
    setSpeed(send.speed);
    drawSendFrame();
  } catch (err) {
    if (seq !== send.seq) return;
    $('bk-send-loading').textContent = err.message || 'Could not prepare the code.';
  }
}

function stopSending() {
  clearInterval(send.timer);
  send.timer = null;
  send.canvases = [];
  send.frames = [];
}

/* ------------------------------------------------------------------- scan */

function setScanState(state) {
  $('bk-scan-frame').dataset.state = state;
}

function setScanStatus(text) {
  const el = $('bk-scan-status');
  if (el.textContent !== text) el.textContent = text;
}

function setLock(on) {
  scan.locked = on;
  $('bk-scan-frame').dataset.lock = on ? 'on' : 'off';
}

const scanPct = () => (scan.asm.total ? Math.round((scan.asm.have / scan.asm.total) * 100) : 0);

/** The status line while reading, picked from progress so screen readers hear milestones only. */
function readingStatus() {
  const pct = scanPct();
  if (pct >= 85) return 'Almost there…';
  if (pct >= 50) return 'Halfway there. Keep holding steady.';
  return 'Found it. Hold steady…';
}

function renderScanProgress() {
  const pct = scanPct();
  // Units are path-length units (pathLength="100"); CSS needs them written as px.
  $('bk-ring-progress').style.strokeDashoffset = `${100 - pct}px`;
  const label = $('bk-scan-progress');
  label.setAttribute('aria-valuenow', String(pct));
  label.textContent = scan.asm.total ? `${pct}%` : 'Waiting for the code…';
}

function resetScanUi() {
  scan.asm = createAssembler();
  scan.state = null;
  scan.everLocked = false;
  setLock(false);
  renderScanProgress();
  $('bk-scan-result').hidden = true;
  $('bk-scan-progress').hidden = false;
  $('bk-scan-load').disabled = true;
  $('bk-scan-status').innerHTML = SCAN_INTRO_HTML;
}

function armStallHint() {
  clearTimeout(scan.stallTimer);
  scan.stallTimer = setTimeout(() => {
    if (!scan.stream) return;
    setScanStatus(
      scan.asm.total
        ? 'Still missing a few pieces. Hold steady, move a little closer, or choose Slower on the other screen.'
        : 'No code found yet. Fill the frame with the code, or choose Slower on the other screen.'
    );
  }, STALL_HINT_MS);
}

/** Called for every readable transfer frame, new or repeated: the code is in view. */
function markSeen() {
  scan.lastSeenAt = performance.now();
  if (scan.locked) return;
  setLock(true);
  if (!scan.everLocked) {
    scan.everLocked = true;
    navigator.vibrate?.(15);
  }
  setScanStatus(readingStatus());
}

function watchLock() {
  clearInterval(scan.lockTimer);
  scan.lockTimer = setInterval(() => {
    if (!scan.stream || !scan.locked) return;
    if (performance.now() - scan.lastSeenAt > LOST_AFTER_MS) {
      setLock(false);
      setScanStatus('Lost the code. Point back at the other screen.');
    }
  }, 250);
}

async function finishScan() {
  const token = scan.asm.token();
  stopCamera();
  setScanState('completing');
  try {
    const [state] = await Promise.all([deps.parseBackup(token), new Promise((r) => setTimeout(r, RING_SETTLE_MS))]);
    scan.state = state;
    setScanState('done');
    navigator.vibrate?.([30, 60, 40]);
    $('bk-scan-summary').textContent = deps.summarize(state);
    $('bk-scan-result').hidden = false;
    $('bk-scan-load').disabled = false;
    $('bk-scan-progress').hidden = true;
    setScanStatus(
      deps.canSend() ? 'Loading replaces the progress on this device.' : 'Load it to continue here.'
    );
    $('bk-scan-load').focus();
  } catch (err) {
    // Only happens if something slipped past the per-piece checks: start over cleanly.
    scan.asm.reset();
    renderScanProgress();
    startCamera();
    setScanStatus(`${err.message || 'That backup could not be read.'} Scanning again…`);
  }
}

function handleDecoded(raw) {
  const before = readingStatus();
  const outcome = scan.asm.accept(raw);
  if (outcome === 'ignored') {
    if (!scan.locked) setScanStatus("That QR code isn't a progress transfer. Scan the code from Send to Another Device.");
    return;
  }
  markSeen();
  if (outcome === 'corrupt' || outcome === 'duplicate') return;
  armStallHint();
  renderScanProgress();
  if (outcome === 'restarted') {
    setScanStatus('That code changed, so scanning started over. Keep holding steady.');
  } else if (readingStatus() !== before || /^(Still|No code)/.test($('bk-scan-status').textContent)) {
    setScanStatus(readingStatus());
  }
  if (scan.asm.complete) finishScan();
}

async function decodeOnce(video) {
  if (scan.detector) {
    try {
      const codes = await scan.detector.detect(video);
      return codes?.[0]?.rawValue || '';
    } catch {
      scan.detector = null;
    }
  }
  if (typeof window.jsQR !== 'function') return '';
  // Crop the centre square (where the reticle is) and cap its size: much faster than
  // decoding the whole frame, and the code is there anyway.
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const side = Math.floor(Math.min(vw, vh) * 0.85);
  const out = Math.min(side, 720);
  if (!scan.canvas) {
    scan.canvas = document.createElement('canvas');
    scan.ctx = scan.canvas.getContext('2d', { willReadFrequently: true });
  }
  if (scan.canvas.width !== out) {
    scan.canvas.width = out;
    scan.canvas.height = out;
  }
  scan.ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, out, out);
  const img = scan.ctx.getImageData(0, 0, out, out);
  return window.jsQR(img.data, out, out, { inversionAttempts: 'dontInvert' })?.data || '';
}

// A timer loop, not requestAnimationFrame: rAF gets throttled hard in some embedded or
// low-power contexts, and decoding pace should follow the camera, not page painting.
async function scanLoop() {
  if (!scan.stream) return;
  const video = $('bk-scan-video');
  const started = performance.now();
  if (video.readyState >= 2 && video.videoWidth) {
    const raw = await decodeOnce(video).catch(() => '');
    if (!scan.stream) return;
    if (raw) handleDecoded(raw);
  }
  if (!scan.stream) return;
  scan.raf = setTimeout(scanLoop, Math.max(0, DECODE_INTERVAL_MS - (performance.now() - started)));
}

async function startCamera() {
  const seq = ++scan.seq;
  stopCamera();
  setScanState('starting');
  setLock(false);
  const video = $('bk-scan-video');

  if (!canScan()) {
    $('bk-scan-denied-text').textContent = 'This browser cannot use the camera here. Use a progress file or backup text instead.';
    setScanState('denied');
    $('bk-scan-retry').hidden = true;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (seq !== scan.seq || deps.modal.querySelector('#bk-panel-scan').hidden) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    scan.stream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});

    if (!scan.detector && 'BarcodeDetector' in window) {
      try {
        const formats = (await window.BarcodeDetector.getSupportedFormats?.()) || ['qr_code'];
        if (formats.includes('qr_code')) scan.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        scan.detector = null;
      }
    }
    if (!scan.detector) await loadScript('./vendor/jsQR.min.js').catch(() => {});

    setScanState('scanning');
    armStallHint();
    watchLock();
    scan.raf = setTimeout(scanLoop, 0);
  } catch (err) {
    if (seq !== scan.seq) return;
    const blocked = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
    $('bk-scan-denied-text').textContent = blocked
      ? 'Camera access is blocked. Allow it from the camera or lock icon in the address bar, then try again.'
      : err?.name === 'NotFoundError'
        ? 'No camera was found on this device.'
        : 'The camera could not start. Close other apps using it, then try again.';
    $('bk-scan-retry').hidden = err?.name === 'NotFoundError';
    setScanState('denied');
  }
}

function stopCamera() {
  clearTimeout(scan.raf);
  clearTimeout(scan.stallTimer);
  clearInterval(scan.lockTimer);
  scan.raf = 0;
  if (scan.stream) {
    scan.stream.getTracks().forEach((t) => t.stop());
    scan.stream = null;
  }
  const video = $('bk-scan-video');
  if (video) video.srcObject = null;
}

function startScanning() {
  showView('scan');
  resetScanUi();
  $('bk-scan-retry').hidden = false;
  startCamera();
}

function stopScanning() {
  scan.seq++;
  stopCamera();
}

/* ------------------------------------------------------------------- bind */

export function bindDeviceSync(options) {
  deps = options;
  const { modal } = deps;

  if (!canScan()) modal.classList.add('no-camera');

  $('bk-send-btn')?.addEventListener('click', () => {
    if (!deps.canSend()) {
      deps.notify('There is no progress to send yet. Start a lesson on this device first.', 'info');
      return;
    }
    startSending();
  });
  $('bk-scan-btn')?.addEventListener('click', startScanning);

  $('bk-panel-send').querySelector('.bk-sync-back').addEventListener('click', () => exitDeviceSync('save'));
  $('bk-panel-scan').querySelector('.bk-sync-back').addEventListener('click', () => exitDeviceSync('load'));
  $('bk-scan-fallback').addEventListener('click', () => exitDeviceSync('load'));
  $('bk-scan-retry').addEventListener('click', startCamera);

  modal.querySelectorAll('.bk-speed-opt').forEach((btn) => {
    btn.addEventListener('click', () => setSpeed(btn.dataset.speed));
    btn.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const next = btn.dataset.speed === 'normal' ? 'slow' : 'normal';
      setSpeed(next);
      modal.querySelector(`.bk-speed-opt[data-speed="${next}"]`).focus();
    });
  });

  $('bk-scan-load').addEventListener('click', async (e) => {
    if (!scan.state) return;
    e.currentTarget.disabled = true;
    const ok = await deps.applyState(scan.state);
    if (!ok) e.currentTarget.disabled = false;
  });

  // Escape inside a sync view goes back one step instead of closing the whole dialog.
  // Handled on the dialog so it runs before the app-wide Escape shortcut on window.
  const stepBack = (e) => {
    if (!modal.classList.contains('is-syncing')) return;
    e.preventDefault();
    e.stopPropagation();
    exitDeviceSync($('bk-panel-send').hidden ? 'load' : 'save');
  };
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stepBack(e);
  });
  modal.addEventListener('cancel', stepBack);
  modal.addEventListener('close', () => exitDeviceSync());

  // Don't keep the camera running in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && scan.stream) {
      stopCamera();
      setScanState('paused');
    } else if (!document.hidden && $('bk-scan-frame')?.dataset.state === 'paused') {
      startCamera();
    }
  });
}
