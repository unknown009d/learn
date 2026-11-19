/**
 * Inspection trail — vocabulary and compact encodings (pure, no DOM).
 *
 * The trail is attached to certificates as an unsigned sidecar: the certificate signature
 * still proves the learning record, and the trail tells the story of how the learner
 * poked at the app along the way. Stripping it is possible — that is a DevTools move too.
 */

/**
 * Every signal the app can notice. `code` is a single letter used in QR links;
 * `mastery` marks hands-on signals that turn a verified certificate into "Impeccable!".
 */
export const TRAIL_TYPES = {
  'devtools-shortcut': {
    icon: 'keyboard',
    code: 'K',
    mastery: false,
    label: 'DevTools shortcut pressed',
    how: 'Pressed a DevTools / View Source shortcut (F12, Ctrl+Shift+I/J/C, ⌘⌥I, Ctrl+U).'
  },
  'devtools-open': {
    icon: 'dock_to_right',
    code: 'O',
    mastery: false,
    label: 'DevTools panel opened',
    how: 'The browser window suddenly gave a big strip of space to a docked panel — almost always DevTools.'
  },
  'scripted-input': {
    icon: 'smart_button',
    code: 'S',
    mastery: true,
    label: 'Drove the UI with JavaScript',
    how: 'Clicks, key presses or answer changes arrived with event.isTrusted === false, i.e. dispatched from code instead of a person.'
  },
  'editor-injection': {
    icon: 'code_blocks',
    code: 'E',
    mastery: true,
    label: 'Injected code into the editor',
    how: 'The lab editor changed without any keystroke, paste or tap — written straight into CodeMirror from the console.'
  },
  'lab-check-forged': {
    icon: 'rule',
    code: 'F',
    mastery: true,
    label: 'Forged an automatic code check',
    how: 'A lab-check result reached the app that the real checker did not send (missing or wrong per-run nonce, or a duplicate result).'
  },
  'storage-edited': {
    icon: 'database',
    code: 'I',
    mastery: true,
    label: 'Edited saved progress in IndexedDB',
    how: 'Saved progress changed outside the app, so it no longer matched the seal the app keeps after every save.'
  },
  'backup-crafted': {
    icon: 'inventory_2',
    code: 'B',
    mastery: true,
    label: 'Hand-crafted a backup file',
    how: 'Imported a .vwfd backup whose signature checks out but whose integrity seal was missing or wrong — built by hand, not exported.'
  }
};

const TYPE_ORDER = Object.keys(TRAIL_TYPES);
const TYPE_BY_CODE = Object.fromEntries(TYPE_ORDER.map((t) => [TRAIL_TYPES[t].code, t]));

export function isMasteryTrail(events) {
  return (events || []).some((e) => TRAIL_TYPES[e.type]?.mastery && Number(e.count) > 0);
}

/** Totals per type, in vocabulary order: [{ type, count, seconds }] */
export function summarizeTrail(events) {
  const totals = new Map();
  for (const e of events || []) {
    if (!TRAIL_TYPES[e.type]) continue;
    const t = totals.get(e.type) || { type: e.type, count: 0, seconds: 0 };
    t.count += Number(e.count) || 0;
    t.seconds += Number(e.seconds) || 0;
    totals.set(e.type, t);
  }
  return TYPE_ORDER.filter((t) => totals.has(t)).map((t) => totals.get(t));
}

// ----------------------------------------------------------------------------
// QR form: "K2O1S10" — letter + count per type. Short enough to keep the QR scannable.
// ----------------------------------------------------------------------------

export function encodeTrailForQr(events) {
  return summarizeTrail(events)
    .filter((t) => t.count > 0)
    .map((t) => `${TRAIL_TYPES[t.type].code}${Math.min(t.count, 9999)}`)
    .join('');
}

export function decodeTrailFromQr(str) {
  const events = [];
  for (const [, code, count] of String(str || '').matchAll(/([A-Z])(\d{1,4})/g)) {
    const type = TYPE_BY_CODE[code];
    if (type) events.push({ type, count: Number(count), where: '', detail: '' });
  }
  return events;
}

// ----------------------------------------------------------------------------
// Verification-code form: base64url(JSON) appended after "~" — full detail per event.
// ----------------------------------------------------------------------------

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeTrailForKey(events) {
  const rows = (events || [])
    .filter((e) => TRAIL_TYPES[e.type])
    .map((e) => [TRAIL_TYPES[e.type].code, Number(e.count) || 0, e.where || '', e.detail || '', e.firstAt || '', e.lastAt || '', Number(e.seconds) || 0]);
  return rows.length ? toBase64Url(JSON.stringify([1, rows])) : '';
}

export function decodeTrailFromKey(str) {
  if (!str) return [];
  try {
    const [version, rows] = JSON.parse(fromBase64Url(str));
    if (version !== 1 || !Array.isArray(rows)) return [];
    return rows
      .filter((r) => Array.isArray(r) && TYPE_BY_CODE[r[0]])
      .map(([code, count, where, detail, firstAt, lastAt, seconds]) => ({
        type: TYPE_BY_CODE[code],
        count: Number(count) || 0,
        where: String(where || ''),
        detail: String(detail || ''),
        firstAt: String(firstAt || ''),
        lastAt: String(lastAt || ''),
        seconds: Number(seconds) || 0
      }));
  } catch {
    return [];
  }
}

/** Split "druba-web-v1.<signed>~<trail>" into its two halves. */
export function splitKeyAndTrail(raw) {
  const [key, trail = ''] = String(raw || '').trim().split('~');
  return { key: key.trim(), trail: trail.trim() };
}

// ----------------------------------------------------------------------------
// DevSec — a parody honour for learners who bent the app.
// The certificate itself proves nothing about it (that's rather the point); the badge
// is a wink from one tinkerer to another.
//
// DevSec is a pun on DedSec, the hacker collective from the Watch Dogs games, with "Dev" as
// in developer — which is what the DEV on the badge stands for.
// ----------------------------------------------------------------------------

export const ORDER = {
  name: 'DevSec',
  motto: 'Read the source. Bend the system.',
  signoff: 'We are DevSec.',
  headline: 'Impeccable. You didn’t take the course — you took it apart.',
  subline: 'Signature verified. This learner skipped the tutorial, opened the hood and rewired the engine while it was running. Nobody taught them that. The trail below shows exactly how.'
};

/** Ranks by how many different hands-on tricks appear in the trail (there are five). */
const RANKS = [
  { min: 4, title: 'Root', blurb: 'Bent the storage, the checker and the UI. Has root on this course, and probably on your Wi-Fi.' },
  { min: 2, title: 'Hacktivist', blurb: 'More than one trick up the sleeve, all for a good cause. Probably.' },
  { min: 1, title: 'Script Kiddie', blurb: 'First exploit landed. Everyone in DevSec started right here.' }
];

/** @returns {null | { title: string, fullTitle: string, blurb: string, tricks: number }} */
export function getMasteryRank(events) {
  const tricks = new Set((events || []).filter((e) => TRAIL_TYPES[e.type]?.mastery && Number(e.count) > 0).map((e) => e.type)).size;
  const rank = RANKS.find((r) => tricks >= r.min);
  return rank ? { ...rank, fullTitle: `${rank.title} of ${ORDER.name}`, tricks } : null;
}
