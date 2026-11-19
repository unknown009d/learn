/**
 * Content guard: course text (lessons, quiz questions and options) can't be selected, copied,
 * cut, dragged or right-clicked, and touch screens can't pinch or double-tap zoom.
 *
 * Editors, inputs and the read-only code boxes (backup text, verification code) stay usable —
 * learners still need to copy their own backup and certificate codes.
 *
 * CSS does most of the work (user-select / touch-action in style.css); these listeners close
 * the gaps CSS can't: keyboard copy, context menus, drag-out and iOS Safari, which ignores
 * `user-scalable=no`.
 */

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .CodeMirror, .allow-select';

function isEditable(node) {
  const el = node instanceof Element ? node : node?.parentElement;
  return Boolean(el?.closest(EDITABLE));
}

function blockOutsideEditable(event) {
  if (!isEditable(event.target) && !isEditable(document.activeElement)) event.preventDefault();
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
  ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach((type) => {
    document.addEventListener(type, blockOutsideEditable, true);
  });

  // Ctrl/⌘+A would otherwise select a whole quiz in browsers that ignore user-select on some nodes.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a' && !isEditable(e.target)) {
      e.preventDefault();
    }
  }, true);

  blockPinchZoom();
}
