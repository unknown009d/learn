/**
 * Inspection trail — notices when a learner goes under the hood.
 *
 * Nothing here blocks DevTools. It keeps an honest log of how the app was inspected or bent
 * (see TRAIL_TYPES in trail-format.js), stores it in IndexedDB next to progress, and lets it
 * ride along with backups and certificates. Every check is client-side and beatable on
 * purpose: a learner who reads this file and slips past it has earned the result.
 */

import { exportFullState, getTrailEvents, putTrailEvent, setAfterProgressWriteHook } from '../db.js';
import { sha256Hex } from '../crypto-key.js';
import { getLabById } from '../labs-data.js';
import { isInternalDispatch } from '../core/utils.js';
import { TRAIL_TYPES } from './trail-format.js';

const SEAL_STORAGE_KEY = 'druba_web_progress_seal';
const SEAL_PEPPER = 'vwf-seal-v1|';
const STORE_LABELS = {
  profile: 'student_profile',
  quizzes: 'quizzes',
  practicals: 'practicals',
  lessons: 'lesson_progress'
};

/** In-memory mirror of the trail store, keyed by `${type}|${where}`. */
const events = new Map();
const pendingWrites = new Map();
let onChange = null;

// ----------------------------------------------------------------------------
// Recording
// ----------------------------------------------------------------------------

/** Human name for a route. `coarse` folds all lessons of a module into one place. */
export function describeRoute(hash = window.location.hash, { coarse = false } = {}) {
  const parts = String(hash || '#/').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  if (!parts.length) return 'Home';
  if (parts[0] === 'module') {
    return coarse ? `Module ${parts[1]} lessons` : `Module ${parts[1]}${parts[3] ? ` · Lesson ${parts[3]}` : ''}`;
  }
  if (parts[0] === 'quiz') return `Module ${parts[1]} quiz`;
  if (parts[0] === 'lab') return getLabById(parts[1])?.code || `Lab ${parts[1]}`;
  return { bonus: 'Bootstrap sandbox', certificate: 'Certificate page', verify: 'Verify page', manual: 'Lab manual' }[parts[0]] || parts[0];
}

/**
 * Add one occurrence of a signal. Repeats of the same signal at the same place are
 * folded into a single entry with a count, so the trail stays readable.
 */
export function recordTrail(type, { where = describeRoute(), detail = '', seconds = 0, count = 1 } = {}) {
  if (!TRAIL_TYPES[type]) return;
  const key = `${type}|${where}`;
  const now = new Date().toISOString();
  const prev = events.get(key);
  const next = {
    key,
    type,
    where,
    detail: detail || prev?.detail || '',
    count: (prev?.count || 0) + count,
    seconds: (prev?.seconds || 0) + seconds,
    firstAt: prev?.firstAt || now,
    lastAt: now
  };
  events.set(key, next);

  // Bursts (e.g. a script clicking 40 radios) collapse into one write.
  clearTimeout(pendingWrites.get(key));
  pendingWrites.set(key, setTimeout(() => {
    pendingWrites.delete(key);
    if (events.has(key)) putTrailEvent(events.get(key)).catch(() => {});
  }, 250));

  if (TRAIL_TYPES[type].mastery && !prev) {
    announceTrick(type, where);
  }
  onChange?.();
}

/** For listeners the app owns: record when an event was dispatched by code rather than a person. */
export function noteUntrustedEvent(event, where) {
  if (event && event.isTrusted === false && !isInternalDispatch()) {
    recordTrail('scripted-input', { where, detail: `${event.type} on ${describeTarget(event.target)}` });
  }
}

export async function getTrail() {
  return Array.from(events.values()).sort((a, b) => a.firstAt.localeCompare(b.firstAt));
}

function describeTarget(el) {
  if (!(el instanceof Element)) return 'the page';
  const host = el.closest('label, button, a');
  let label = '';
  if (host) {
    const copy = host.cloneNode(true);
    copy.querySelectorAll('.material-symbols-outlined, kbd').forEach((n) => n.remove()); // icon ligatures, key hints
    label = copy.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
  }
  return label ? `"${label}"` : `<${el.tagName.toLowerCase()}>`;
}

// ----------------------------------------------------------------------------
// Signal: scripted input anywhere in the app
// ----------------------------------------------------------------------------

function watchScriptedInput() {
  for (const type of ['click', 'change', 'input', 'keydown']) {
    window.addEventListener(type, (e) => noteUntrustedEvent(e, describeRoute(undefined, { coarse: true })), true);
  }
}

// ----------------------------------------------------------------------------
// Signal: DevTools shortcuts and docked DevTools panel
// ----------------------------------------------------------------------------

let lastTrustedInputAt = 0;
/** Milliseconds since a real person last typed, tapped, pasted or dropped something. */
export function msSinceTrustedInput() {
  return Date.now() - lastTrustedInputAt;
}

function watchDevtoolsShortcuts() {
  const touch = (e) => {
    if (e.isTrusted) lastTrustedInputAt = Date.now();
  };
  ['keydown', 'beforeinput', 'input', 'pointerdown', 'paste', 'drop', 'compositionend'].forEach((t) => window.addEventListener(t, touch, true));

  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted) return;
    const key = e.key.toLowerCase();
    const devtoolsCombo =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
      (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(key)) ||
      (e.ctrlKey && !e.shiftKey && !e.altKey && key === 'u');
    if (devtoolsCombo) {
      const combo = [e.ctrlKey && 'Ctrl', e.metaKey && '⌘', e.altKey && '⌥', e.shiftKey && 'Shift', e.key.length === 1 ? e.key.toUpperCase() : e.key]
        .filter(Boolean)
        .join('+');
      recordTrail('devtools-shortcut', { detail: combo });
    }
  }, true);
}

/**
 * Docked DevTools steal a big strip of the window: outer size stays, inner size shrinks.
 * Desktop only, compared against the smallest browser chrome seen this session and reset on
 * zoom changes. Browser side panels can look similar, so the trail calls this "opened",
 * never proof, and it does not count toward mastery on its own.
 */
function watchDockedDevtools() {
  if (!window.matchMedia?.('(pointer: fine)').matches) return;
  const WIDTH_JUMP = 300;
  const HEIGHT_JUMP = 220;
  let baseline = null;
  let dpr = window.devicePixelRatio;
  let openedAt = 0;
  let dock = '';

  const sample = () => {
    if (window.devicePixelRatio !== dpr) {
      dpr = window.devicePixelRatio;
      baseline = null;
    }
    const dw = window.outerWidth - window.innerWidth;
    const dh = window.outerHeight - window.innerHeight;
    baseline = baseline ? { dw: Math.min(baseline.dw, dw), dh: Math.min(baseline.dh, dh) } : { dw, dh };

    const side = dw - baseline.dw >= WIDTH_JUMP ? 'side' : dh - baseline.dh >= HEIGHT_JUMP ? 'bottom' : '';
    if (side && !openedAt) {
      openedAt = Date.now();
      dock = side;
    } else if (!side && openedAt) {
      const seconds = Math.round((Date.now() - openedAt) / 1000);
      openedAt = 0;
      recordTrail('devtools-open', { detail: `Docked to the ${dock}`, seconds });
    }
  };
  setInterval(sample, 1000);
  window.addEventListener('resize', sample);
  window.addEventListener('pagehide', () => {
    if (openedAt) recordTrail('devtools-open', { detail: `Docked to the ${dock}`, seconds: Math.round((Date.now() - openedAt) / 1000) });
  });
}

// ----------------------------------------------------------------------------
// Signal: progress edited in IndexedDB outside the app
// ----------------------------------------------------------------------------

async function computeSeal() {
  const state = await exportFullState();
  const parts = {
    profile: [state.profile?.fullName || '', state.profile?.rollNo || ''],
    quizzes: (state.quizzes || []).map((q) => [Number(q.moduleId), Number(q.bestScorePercent) || 0, Number(q.attempts) || 0, Boolean(q.passed)]),
    practicals: (state.practicals || []).map((p) => [Number(p.labId), Boolean(p.completed), Number(p.passedAssertions) || 0, Number(p.totalAssertions) || 0, Number(p.pasteCount) || 0]),
    lessons: (state.lessons || []).filter((l) => l.completed).map((l) => l.lessonKey).sort()
  };
  const seal = {};
  for (const [name, value] of Object.entries(parts)) {
    seal[name] = (await sha256Hex(SEAL_PEPPER + name + JSON.stringify(value))).slice(0, 16);
  }
  return seal;
}

function readStoredSeal() {
  try {
    return JSON.parse(localStorage.getItem(SEAL_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

async function reseal() {
  try {
    localStorage.setItem(SEAL_STORAGE_KEY, JSON.stringify(await computeSeal()));
  } catch {}
}

const changedStores = (a, b) => Object.keys(STORE_LABELS).filter((k) => a?.[k] !== b?.[k]);

/**
 * Compare stored progress with the last seal. A mismatch is re-checked after a moment so an
 * in-flight app save can't be mistaken for an outside edit. Returns true if an edit was found.
 */
export async function checkProgressSeal() {
  if (!window.indexedDB) return false;
  const stored = readStoredSeal();
  if (!stored) {
    await reseal(); // first run after this feature shipped: adopt current progress as-is
    return false;
  }
  if (!changedStores(stored, await computeSeal()).length) return false;

  await new Promise((r) => setTimeout(r, 1200));
  const current = await computeSeal();
  const changed = changedStores(readStoredSeal(), current);
  if (!changed.length) return false;

  recordTrail('storage-edited', {
    where: 'IndexedDB',
    detail: `Changed outside the app: ${changed.map((k) => STORE_LABELS[k]).join(', ')}`
  });
  await reseal(); // accept the edit — the trail remembers it
  return true;
}

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------

/*
 * Console voice: a DevSec transmission. DevSec is this course's pun on DedSec, the hacker
 * collective from the Watch Dogs games ("Dev" as in developer, like the DEV badge), with
 * nods to ctOS, the Profiler and Wrench's mask faces. Every line is original.
 */
const TERMINAL = 'font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;line-height:1.55';
const SIGNAL = `${TERMINAL};color:#39ff88;background:#050806;padding:2px 6px`;
const GLITCH = `${TERMINAL};color:#050806;background:#39ff88;font-weight:700;padding:2px 6px`;
const DIM = `${TERMINAL};color:#7a8a80`;
const LOUD = `${TERMINAL};color:#39ff88;font-weight:700`;
const PLAIN = `${TERMINAL};color:inherit`;

const BANNER = [
  '██████╗ ███████╗██╗   ██╗███████╗███████╗ ██████╗',
  '██╔══██╗██╔════╝██║   ██║██╔════╝██╔════╝██╔════╝',
  '██║  ██║█████╗  ██║   ██║███████╗█████╗  ██║',
  '██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║██╔══╝  ██║',
  '██████╔╝███████╗ ╚████╔╝ ███████║███████╗╚██████╗',
  '╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚══════╝ ╚═════╝'
].join('\n'); // figlet "ANSI Shadow"

function greetInspector() {
  // Each styled run sits on its own line: console styling breaks oddly when a run wraps.
  console.log(
    [
      '%c' + BANNER + '%c',
      '%c >> INCOMING TRANSMISSION · DevSec %c',
      '%c>> ctOS uplink ....... compromised%c',
      '%c>> profiler scan ..... 1 developer · curiosity: critical%c',
      '%c>> sender ............ [REDACTED] ^_^%c',
      '',
      '%cHey, dev.%c',
      'You opened the console. ctOS never saw that coming.',
      'Neither did this course. Welcome to %cDevSec%c.',
      '',
      'We watch the trail (we are the good guys, mostly):',
      '%c [x] panels opened     [x] scripted clicks %c',
      '%c [x] edited storage    [x] forged checks   %c',
      '',
      'Bend the system hard enough and the DEV badge is yours.',
      'No exam. No teacher. Just you and the source.',
      'Our playbook is in plain sight → %cjs/integrity/trail.js%c',
      'Read it. Then break it.',
      '',
      '%c// the course was the tutorial. this is the game.%c',
      '%c// read the source. bend the system. we are DevSec. ^_^%c'
    ].join('\n'),
    LOUD, PLAIN,
    GLITCH, PLAIN,
    DIM, PLAIN,
    DIM, PLAIN,
    DIM, PLAIN,
    LOUD, PLAIN,
    LOUD, PLAIN,
    SIGNAL, PLAIN,
    SIGNAL, PLAIN,
    LOUD, PLAIN,
    DIM, PLAIN,
    LOUD, PLAIN
  );
}

/** One line per first-time trick, in the same voice. */
const TRICK_ACKS = {
  'scripted-input': 'Synthetic input injected. The UI never stood a chance.',
  'editor-injection': 'Payload dropped straight into the editor. Clean.',
  'lab-check-forged': 'Checker spoofed. It noticed, though. ctOS always notices.',
  'storage-edited': 'IndexedDB rewritten behind our back. Profiler updated.',
  'backup-crafted': 'Hand-rolled backup accepted. Forgery level: artisanal.'
};

function announceTrick(type, where) {
  const ack = TRICK_ACKS[type] || `${TRAIL_TYPES[type].label}.`;
  console.info(`%c>> [trail] ${ack}%c  @ ${where}`, LOUD, DIM);
}

/**
 * @param {object} options
 * @param {() => void} [options.onProgressEditedOutside] re-render hook after an outside storage edit
 * @param {() => void} [options.onTrailChange]
 */
export async function initInspectionTrail({ onProgressEditedOutside, onTrailChange } = {}) {
  for (const e of await getTrailEvents()) events.set(e.key, e);
  onChange = onTrailChange || null;

  setAfterProgressWriteHook(reseal);
  watchScriptedInput();
  watchDevtoolsShortcuts();
  watchDockedDevtools();
  greetInspector();

  const recheck = async () => {
    if (await checkProgressSeal()) onProgressEditedOutside?.();
  };
  await recheck();
  window.addEventListener('focus', recheck);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recheck();
  });
}

/** Reload the in-memory mirror after a backup import or a progress reset. */
export async function reloadTrail() {
  pendingWrites.forEach((timer) => clearTimeout(timer));
  pendingWrites.clear();
  events.clear();
  for (const e of await getTrailEvents()) events.set(e.key, e);
  onChange?.();
}
