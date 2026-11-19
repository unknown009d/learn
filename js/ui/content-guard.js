/**
 * Content guard: decides what text can be selected and copied, and stops pinch / double-tap
 * zoom on touch screens.
 *
 *   editable    inputs, textareas, code editors, backup / verification code boxes
 *               → always selectable and copyable.
 *   selectable  lessons and the home page ([data-selectable]) → normal select and copy.
 *   exam        quizzes and graded labs ([data-protected-content])
 *               → desktop: selectable, but copying puts "Psych!" on the clipboard;
 *               → touch:   not selectable at all, so a long-press never opens the
 *                          browser's "Search with Google" sheet over a question.
 *               (Code editors inside a lab stay editable and copyable.)
 *   everything else (app chrome, certificate) → not selectable or copyable.
 *
 * Exam pages also get a best-effort screenshot decoy: a full-screen "Psych!" (see below).
 *
 * CSS sets the matching user-select rules (style.css, "Content protection"); these listeners
 * cover what CSS can't: keyboard copy, context menus, drag-out and iOS Safari pinch zoom.
 */

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .CodeMirror, .allow-select';
const SELECTABLE = '[data-selectable]';
const EXAM = '[data-protected-content]';
const EXAM_DECOY = 'Psych!';

/** Mouse or trackpad with hover: treat as desktop. Touch-first devices are not. */
const desktopQuery = window.matchMedia?.('(hover: hover) and (pointer: fine)');
const isDesktop = () => Boolean(desktopQuery?.matches);

function toElement(node) {
  return node instanceof Element ? node : node?.parentElement || null;
}
const within = (node, selector) => Boolean(toElement(node)?.closest(selector));

/** Where a copy / cut is coming from: the selection if there is one, else the focused element. */
function copySource(event) {
  const sel = document.getSelection();
  if (sel && !sel.isCollapsed && sel.anchorNode) return sel.anchorNode;
  return event.target;
}

function onCopy(event) {
  const source = copySource(event);
  if (within(source, EDITABLE) || within(document.activeElement, EDITABLE)) return;
  if (within(source, EXAM)) {
    event.preventDefault();
    if (isDesktop()) event.clipboardData?.setData('text/plain', EXAM_DECOY);
    return;
  }
  if (within(source, SELECTABLE)) return;
  event.preventDefault();
}

/** Selecting text and the right-click menu follow the same rules as copying. */
function canSelectAt(node) {
  return within(node, EDITABLE) || within(node, SELECTABLE) || (within(node, EXAM) && isDesktop());
}

function onSelectOrMenu(event) {
  if (!canSelectAt(event.target) && !within(document.activeElement, EDITABLE)) event.preventDefault();
}

function onDragStart(event) {
  if (!within(event.target, EDITABLE)) event.preventDefault();
}

// ----------------------------------------------------------------------------
// Screenshot decoy (exam pages only)
//
// Browsers can't truly block screenshots, and an OS capture tool freezes the screen the
// moment its shortcut fires, so the decoy has to be up *before* that. Best effort:
//   - Win+Shift+S and ⌘⇧3/4/5 all start with Win/⌘ + Shift, which the page does see before
//     the final key. The decoy goes up as soon as both are held, and stays a while after.
//   - Print Screen (Windows): only the keyup reaches the page, after the capture, so instead
//     the clipboard is overwritten with "Psych!" (a plain PrtSc lands in the clipboard).
//   - Phones: three or more fingers on the screen usually means a screenshot swipe; the
//     capture fires after the swipe, by which time the decoy is up.
//   - Leaving the page (other window, app switcher, capture apps): decoy on blur / hidden,
//     which also puts "Psych!" in the phone's app-switcher preview.
//   - Printing: style.css swaps the exam for "Psych!" in print.
// Power + volume screenshots on phones give the page no signal at all.
// ----------------------------------------------------------------------------

const DECOY_LINGER_MS = 2500; // how long the decoy stays after the trigger lets go
const DECOY_AFTER_FOCUS_MS = 1200; // after coming back to the page

let decoyEl = null;
let decoyTimer = null;

const examOnScreen = () => Boolean(document.querySelector(EXAM));

/** Show the decoy. With autoHideMs it hides itself; without, it waits for hideDecoySoon(). */
function showDecoy(autoHideMs = 0) {
  if (!examOnScreen()) return;
  if (!decoyEl) {
    decoyEl = document.createElement('div');
    decoyEl.className = 'psych-overlay';
    decoyEl.setAttribute('aria-hidden', 'true');
    decoyEl.textContent = EXAM_DECOY;
    decoyEl.addEventListener('pointerdown', hideDecoy);
  }
  if (!decoyEl.isConnected) document.body.appendChild(decoyEl);
  clearTimeout(decoyTimer);
  if (autoHideMs) decoyTimer = setTimeout(hideDecoy, autoHideMs);
}

function hideDecoySoon(ms) {
  if (!decoyEl?.isConnected) return;
  clearTimeout(decoyTimer);
  decoyTimer = setTimeout(hideDecoy, ms);
}

function hideDecoy() {
  clearTimeout(decoyTimer);
  decoyEl?.remove();
}

/** Win/⌘ + Shift held together: the opening of every desktop screenshot shortcut. */
const captureChordHeld = (e) => (e.metaKey || e.key === 'Meta' || e.key === 'OS') && (e.shiftKey || e.key === 'Shift');

function initScreenshotDecoy() {
  window.addEventListener('keydown', (e) => {
    if (captureChordHeld(e) || e.key === 'PrintScreen') showDecoy();
  }, true);

  window.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen' && examOnScreen()) {
      showDecoy(DECOY_LINGER_MS);
      navigator.clipboard?.writeText(EXAM_DECOY).catch(() => {});
      return;
    }
    if (['Meta', 'OS', 'Shift'].includes(e.key) && document.hasFocus()) hideDecoySoon(DECOY_LINGER_MS);
  }, true);

  // Phones: a three-finger touch is most often the screenshot swipe.
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length >= 3) showDecoy(DECOY_LINGER_MS);
  }, { passive: true, capture: true });

  // Capture tools, other windows and the app switcher take the page out of focus / view.
  // Clicking into a lab's live preview also blurs the window, but focus stays on the
  // page (it moves to the <iframe>), so that case is skipped.
  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement?.tagName === 'IFRAME' && document.visibilityState === 'visible') return;
      showDecoy();
    }, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') showDecoy();
  });
  window.addEventListener('focus', () => hideDecoySoon(DECOY_AFTER_FOCUS_MS));
  window.addEventListener('hashchange', hideDecoy);
}

function syncDesktopClass() {
  document.documentElement.classList.toggle('is-desktop-pointer', isDesktop());
}

function blockPinchZoom() {
  const prevent = (e) => e.preventDefault();
  // iOS Safari gesture events (pinch).
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => document.addEventListener(type, prevent, { passive: false }));
  // Two-finger touch moves everywhere else. (Double-tap zoom is off via `touch-action` in CSS.)
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

export function initContentGuard() {
  syncDesktopClass();
  desktopQuery?.addEventListener?.('change', syncDesktopClass);

  document.addEventListener('copy', onCopy, true);
  document.addEventListener('cut', onCopy, true);
  document.addEventListener('selectstart', onSelectOrMenu, true);
  document.addEventListener('contextmenu', onSelectOrMenu, true);
  document.addEventListener('dragstart', onDragStart, true);

  // Ctrl/⌘+A selects the whole page; only allow it inside editable fields.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a' && !within(e.target, EDITABLE)) {
      e.preventDefault();
    }
  }, true);

  initScreenshotDecoy();
  blockPinchZoom();
}
