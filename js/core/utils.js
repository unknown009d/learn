/**
 * Small DOM, formatting and clipboard helpers shared by every view.
 */

const PLATFORM = navigator.userAgentData?.platform || navigator.platform || '';
const IS_MAC = /mac|iphone|ipad|ipod/i.test(PLATFORM);
/** Label for the primary modifier key: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';
export const ALT_KEY = IS_MAC ? '⌥' : 'Alt';

/** Small keyboard hint shown inside primary buttons, e.g. "Ctrl+Enter". */
export function modKbd(key = 'Enter', extraClass = '') {
  return `<kbd class="m3-kbd-on-primary hidden sm:inline-flex ${extraClass}">${MOD_KEY}+${key}</kbd>`;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export function formatDuration(sec) {
  const s = Number(sec || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
}

export function scrollViewToTop() {
  const view = document.getElementById('app-view');
  if (view) {
    view.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const alertClass =
    type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : 'alert-info';
  const toast = document.createElement('div');
  toast.className = `alert ${alertClass} shadow-lg rounded-2xl py-2.5 px-4 text-sm font-medium max-w-sm w-auto whitespace-normal break-words text-left`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

export async function copyToClipboard(text, label = 'Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label, 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(label, 'success');
  }
}

let internalDispatchDepth = 0;

/**
 * Click an element on the app's own behalf (keyboard shortcuts, mobile proxies, downloads).
 * Clicks made through here are not reported as scripted input on the inspection trail.
 */
export function appClick(el) {
  if (!el) return;
  internalDispatchDepth += 1;
  try {
    el.click();
  } finally {
    internalDispatchDepth -= 1;
  }
}

export function isInternalDispatch() {
  return internalDispatchDepth > 0;
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  appClick(a);
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(filename, content, mime = 'application/json') {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

const scriptLoads = new Map();
/** Load a classic script once, on demand (used for the QR and image-export libraries). */
export function loadScript(src) {
  if (!scriptLoads.has(src)) {
    scriptLoads.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => {
        scriptLoads.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(el);
    }));
  }
  return scriptLoads.get(src);
}

export function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
