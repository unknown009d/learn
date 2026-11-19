/**
 * Full-viewport IDE layout: resizable panes and layout mode.
 */

const SPLITS_STORAGE_KEY = 'druba_web_pane_splits';

function loadPaneSplits(defaults = [32, 34, 34]) {
  try {
    const raw = JSON.parse(localStorage.getItem(SPLITS_STORAGE_KEY) || 'null');
    if (Array.isArray(raw) && raw.length === 3 && raw.every((n) => typeof n === 'number' && n >= 15)) {
      return raw;
    }
  } catch {}
  return defaults;
}

function savePaneSplits(splits) {
  if (!Array.isArray(splits) || splits.length !== 3) return;
  try {
    localStorage.setItem(SPLITS_STORAGE_KEY, JSON.stringify(splits.map((n) => Number(n.toFixed(2)))));
  } catch {}
}

export function initSplitResizers(container, pane1, pane2, pane3, resizer1, resizer2, ide = null) {
  const isTwoPane = !pane3;
  let splits = isTwoPane ? [36, 64] : loadPaneSplits([32, 34, 34]);

  const applySplits = () => {
    if (window.innerWidth < 1024) {
      pane1.style.flex = '';
      pane2.style.flex = '';
      if (pane3) pane3.style.flex = '';
      return;
    }
    if (isTwoPane) {
      pane1.style.flex = `0 0 calc(${splits[0]}% - 3px)`;
      pane2.style.flex = `0 0 calc(${splits[1]}% - 3px)`;
    } else {
      pane1.style.flex = `0 0 calc(${splits[0]}% - 4px)`;
      pane2.style.flex = `0 0 calc(${splits[1]}% - 4px)`;
      pane3.style.flex = `0 0 calc(${splits[2]}% - 4px)`;
    }
  };

  let activeDrag = null;

  const startDrag = (which, e) => {
    if (window.innerWidth < 1024) return;
    e.preventDefault();
    const resizerPixels = isTwoPane ? 6 : 12;
    const totalWidth = container.getBoundingClientRect().width - resizerPixels;
    if (totalWidth <= 0) return;

    activeDrag = {
      which,
      startX: e.clientX,
      startSplits: splits.slice(),
      totalWidth,
      resizerEl: which === 1 ? resizer1 : resizer2
    };
    document.body.classList.add('is-resizing');
    activeDrag.resizerEl?.classList.add('is-dragging');
  };

  const onMouseMove = (e) => {
    if (!activeDrag) return;
    const minPct = (240 / activeDrag.totalWidth) * 100;
    const deltaPct = ((e.clientX - activeDrag.startX) / activeDrag.totalWidth) * 100;

    if (isTwoPane) {
      let next0 = Math.max(minPct, Math.min(100 - minPct, activeDrag.startSplits[0] + deltaPct));
      splits = [next0, 100 - next0];
    } else if (activeDrag.which === 1) {
      const combined = activeDrag.startSplits[0] + activeDrag.startSplits[1];
      let next0 = Math.max(minPct, Math.min(combined - minPct, activeDrag.startSplits[0] + deltaPct));
      let next1 = combined - next0;
      splits = [next0, next1, activeDrag.startSplits[2]];
    } else {
      const combined = activeDrag.startSplits[1] + activeDrag.startSplits[2];
      let next1 = Math.max(minPct, Math.min(combined - minPct, activeDrag.startSplits[1] + deltaPct));
      let next2 = combined - next1;
      splits = [activeDrag.startSplits[0], next1, next2];
    }

    applySplits();
    ide?.refreshEditors();
  };

  const onMouseUp = () => {
    if (!activeDrag) return;
    document.body.classList.remove('is-resizing');
    activeDrag.resizerEl?.classList.remove('is-dragging');
    savePaneSplits(splits);
    activeDrag = null;
    ide?.refreshEditors();
  };

  const onWindowResize = () => {
    applySplits();
    ide?.refreshEditors();
  };

  resizer1?.addEventListener('mousedown', (e) => startDrag(1, e));
  resizer2?.addEventListener('mousedown', (e) => startDrag(2, e));
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', onWindowResize);

  applySplits();

  return () => {
    document.body.classList.remove('is-resizing');
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('resize', onWindowResize);
  };
}

export function setWorkspaceLayoutMode(isIDE) {
  const view = document.getElementById('app-view');
  if (!view) return;
  if (isIDE) {
    view.className = 'flex-1 min-w-0 h-full overflow-hidden p-0';
  } else {
    view.className = 'flex-1 min-w-0 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20';
  }
}

// ----------------------------------------------------------------------------
// Shared IDE chrome used by both the lesson workspace and the lab IDE
// ----------------------------------------------------------------------------

const EMMET_EXAMPLES = [
  ['!', 'HTML5 page'],
  ['div+p', 'Sibling tags'],
  ['ul&gt;li*3', 'List items'],
  ['.card&gt;h3+p', 'Class card'],
  ['table&gt;tr*2&gt;td*3', 'Table grid']
];

const EDITOR_SYMBOLS = ['<', '>', '/', '=', '"', '{', '}', ';', '(', ')', ':', '.', '#', '!'];

export function emmetCheatsheetHtml() {
  return `
    <div class="dropdown dropdown-end ide-emmet-dropdown">
      <button type="button" tabindex="0" class="btn btn-xs btn-ghost btn-circle" title="Emmet Cheatsheet" aria-label="Emmet Cheatsheet">
        <span class="material-symbols-outlined icon-18" aria-hidden="true">bolt</span>
      </button>
      <div tabindex="0" class="dropdown-content z-50 w-64 p-3 rounded-2xl shadow-xl border m3-border-subtle m3-modal-box text-xs">
        <div class="font-bold mb-1.5 flex items-center gap-1.5">
          <span class="material-symbols-outlined icon-18 m3-text-primary" aria-hidden="true">bolt</span>
          <span>Emmet Shortcuts (Press Tab)</span>
        </div>
        <div class="space-y-1 font-mono text-[11px]">
          ${EMMET_EXAMPLES.map(([abbr, desc]) => `<div class="flex justify-between"><code>${abbr}</code><span class="m3-text-muted">${desc}</span></div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

/** Touch-friendly row of code symbols under the editor (hidden on desktop). */
export function symbolBarHtml() {
  const escape = (c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `
    <div id="ide-symbol-bar" class="m3-symbol-bar lg:hidden" aria-label="Code Symbol Toolbar">
      <button type="button" tabindex="-1" class="m3-symbol-pill is-emmet" data-action="emmet" aria-label="Expand Emmet abbreviation">
        <span class="material-symbols-outlined icon-18" aria-hidden="true">bolt</span>
        <span>Emmet</span>
      </button>
      ${EDITOR_SYMBOLS.map((sym) => `<button type="button" tabindex="-1" class="m3-symbol-pill" data-symbol="${escape(sym)}">${escape(sym)}</button>`).join('')}
    </div>
  `;
}

export function consoleDrawerHtml() {
  return `
    <div id="ide-console-drawer" class="border-t m3-border-subtle m3-surface-container-low shrink-0">
      <div id="ide-console-toggle" class="h-9 px-3 flex items-center justify-between cursor-pointer select-none">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider m3-text-muted">
          <span class="material-symbols-outlined icon-18" aria-hidden="true">terminal</span>
          <span>Console</span>
          <span id="ide-console-count" class="badge badge-xs m3-tonal-badge font-mono">0</span>
        </div>
        <div class="flex items-center gap-1">
          <button id="ide-console-clear-btn" type="button" class="btn btn-xs btn-ghost rounded-full text-[11px]">Clear</button>
          <span id="ide-console-chevron" class="material-symbols-outlined icon-18" aria-hidden="true">expand_less</span>
        </div>
      </div>
      <div id="ide-console-body" class="hidden max-h-32 overflow-y-auto px-3 py-2 m3-surface-container-lowest border-t m3-border-subtle">
        <div id="ide-console-output" class="text-xs font-mono"></div>
      </div>
    </div>
  `;
}

/** Expand / collapse the console drawer and wire its Clear button. */
export function bindConsoleDrawer() {
  const body = document.getElementById('ide-console-body');
  const chevron = document.getElementById('ide-console-chevron');
  document.getElementById('ide-console-toggle')?.addEventListener('click', (e) => {
    if (e.target.closest('#ide-console-clear-btn')) return;
    const isHidden = body?.classList.toggle('hidden');
    if (chevron) chevron.textContent = isHidden ? 'expand_less' : 'expand_more';
  });
  document.getElementById('ide-console-clear-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const out = document.getElementById('ide-console-output');
    const count = document.getElementById('ide-console-count');
    if (out) out.innerHTML = '';
    if (count) count.textContent = '0';
  });
}

const isMobileLayout = () => window.innerWidth < 1024;

/**
 * Below 1024px the three panes become tabs (Lesson / Editor / Preview).
 * Hidden panes get `is-pane-hidden`, which only takes effect in the mobile media
 * query, so resizing to desktop always shows all three panes again.
 * Any element with `data-mobile-show="<pane>"` (e.g. Run) switches tabs on mobile.
 */
export function bindMobilePaneTabs(ide) {
  const tabs = document.getElementById('mobile-pane-tabs');
  if (!tabs) return null;
  const panes = {
    instructions: document.getElementById('pane-instructions'),
    editor: document.getElementById('pane-editor'),
    preview: document.getElementById('pane-preview')
  };
  const show = (active) => {
    Object.entries(panes).forEach(([k, p]) => p?.classList.toggle('is-pane-hidden', k !== active));
    tabs.querySelectorAll('[data-pane]').forEach((b) => {
      const selected = b.dataset.pane === active;
      b.classList.toggle('tab-active', selected);
      b.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    if (active !== 'editor') {
      // Leaving the editor: drop the keyboard so the next pane is fully visible.
      const focused = document.activeElement;
      if (focused && focused.closest?.('.CodeMirror, .ide-fallback-textarea')) focused.blur();
    }
    if (active === 'editor') {
      ide.syncTheme();
      requestAnimationFrame(() => ide.refreshEditors());
    }
  };
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pane]');
    if (btn) show(btn.dataset.pane);
  });
  const root = tabs.closest('.ide-workspace-root') || document;
  root.querySelectorAll('[data-mobile-show]').forEach((el) => {
    el.addEventListener('click', () => {
      if (isMobileLayout()) show(el.dataset.mobileShow);
    });
  });
  show('instructions');
  return show;
}

let mobileEditingBound = false;

/**
 * Mobile-only helpers, bound once at boot:
 *  - `--app-vh` tracks the visible viewport height (shrinks when the on-screen
 *    keyboard opens) so the code workspace always fits on screen.
 *  - `body.is-mobile-editing` is set while the code editor has focus, so extra
 *    chrome can step aside and leave room for the code.
 */
export function initMobileEditingHelpers() {
  if (mobileEditingBound) return;
  mobileEditingBound = true;

  const root = document.documentElement;
  const vv = window.visualViewport;
  const syncViewportHeight = () => {
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--app-vh', `${Math.round(h)}px`);
  };
  syncViewportHeight();
  vv?.addEventListener('resize', syncViewportHeight);
  window.addEventListener('resize', syncViewportHeight);

  const EDITOR = '.CodeMirror, .ide-fallback-textarea';
  let blurTimer = null;
  document.addEventListener('focusin', (e) => {
    if (!isMobileLayout() || !e.target.closest?.(EDITOR)) return;
    clearTimeout(blurTimer);
    document.body.classList.add('is-mobile-editing');
  });
  document.addEventListener('focusout', () => {
    clearTimeout(blurTimer);
    // Wait a beat: focus may just be moving within the editor.
    blurTimer = setTimeout(() => {
      if (!document.activeElement?.closest?.(EDITOR)) document.body.classList.remove('is-mobile-editing');
    }, 120);
  });
  window.addEventListener('hashchange', () => document.body.classList.remove('is-mobile-editing'));
}
