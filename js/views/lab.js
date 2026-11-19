/**
 * Practical lab IDE (#/lab/:id and #/bonus).
 */

import { getPractical } from '../db.js';
import { BONUS_MODULE, getModuleById, getNextModule } from '../course-data.js';
import { getLabById, getLabsByModule } from '../labs-data.js';
import { LabIDEController } from '../ide.js';
import { escapeHtml, formatDuration, showToast, appClick, modKbd, MOD_KEY } from '../core/utils.js';
import { appState, refreshStateFromDB, areModuleLabsCompleted, getLabGateStatus } from '../core/state.js';
import { triggerCheckpointModal } from '../ui/checkpoint-modal.js';
import { toggleCourseSidebar, renderSidebarAndProgress } from '../ui/sidebar.js';
import {
  initSplitResizers,
  setWorkspaceLayoutMode,
  emmetCheatsheetHtml,
  symbolBarHtml,
  consoleDrawerHtml,
  bindConsoleDrawer,
  bindMobilePaneTabs
} from '../ui/workspace.js';
import { renderLockedView } from './locked.js';
import { prefetchCertificateInBackground } from './certificate.js';

export async function renderLabView(labId, isBonus = false) {
  const lab = isBonus
    ? {
        id: 0,
        moduleId: 0,
        code: 'Bonus Sandbox',
        title: BONUS_MODULE.title,
        syllabusRef: BONUS_MODULE.subtitle,
        tabs: ['html', 'css', 'js'],
        instructions: BONUS_MODULE.sections[0].points,
        hint: 'Try modifying Bootstrap grid classes like col-12 col-md-6 col-lg-3 or button variants (btn-primary, btn-warning).',
        starterHtml: BONUS_MODULE.sections[0].starterHtml,
        starterCss: '/* Optional custom CSS overrides after Bootstrap */',
        starterJs: '// Optional JS interactivity',
        checksDescription: []
      }
    : getLabById(labId);

  if (!lab) {
    setWorkspaceLayoutMode(false);
    renderLockedView('Practical Lab', 'Practical lab not found.', '#/');
    return;
  }

  if (!isBonus) {
    const gate = getLabGateStatus(lab.id);
    if (!gate.unlocked) {
      setWorkspaceLayoutMode(false);
      renderLockedView(`${lab.code}: ${lab.title}`, gate.reason, gate.targetHash || '#/');
      return;
    }
  }

  setWorkspaceLayoutMode(true);

  const savedRec = isBonus ? null : await getPractical(lab.id);
  const view = document.getElementById('app-view');
  const mod = getModuleById(lab.moduleId);
  const siblingLabs = isBonus ? [] : getLabsByModule(lab.moduleId);
  const currentIdx = siblingLabs.findIndex((l) => l.id === lab.id);
  const nextLab = currentIdx >= 0 && currentIdx + 1 < siblingLabs.length ? siblingLabs[currentIdx + 1] : null;
  const nextModule = isBonus ? null : getNextModule(lab.moduleId);
  const nextStep = isBonus
    ? null
    : nextLab
      ? { href: `#/lab/${nextLab.id}`, label: `Continue to ${nextLab.code}`, icon: 'arrow_forward' }
      : nextModule
        ? { href: `#/module/${nextModule.id}`, label: `Proceed to Module ${nextModule.id}`, icon: 'arrow_forward' }
        : { href: '#/certificate', label: 'View Your Certificate', icon: 'workspace_premium' };
  const modSymbol = MOD_KEY;

  view.innerHTML = `
    <section class="ide-workspace-root ide-workspace-tabbed" ${isBonus ? '' : 'data-protected-content'}>
      <!-- Compact IDE Action Bar -->
      <div class="ide-toolbar">
        <div class="w-full sm:w-auto sm:flex-1 flex items-center gap-2 min-w-0">
          <span class="badge m3-primary-container font-mono font-bold shrink-0">${escapeHtml(lab.code)}</span>
          ${!isBonus ? `<span class="badge m3-tonal-badge font-mono text-xs hidden md:inline-flex shrink-0">${mod.code}</span>` : `<span class="badge m3-tonal-badge text-xs shrink-0">Optional</span>`}
          <h1 class="text-sm sm:text-base font-bold truncate min-w-0 flex-1">${escapeHtml(lab.title)}</h1>
          <span id="ide-verified-badge" class="${savedRec?.completed ? 'inline-flex' : 'hidden'} badge badge-success gap-1 text-xs font-bold shrink-0">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            Verified
          </span>
        </div>

        <div class="w-full sm:w-auto flex items-center justify-end gap-1.5 shrink-0">
          <div id="ide-telemetry-pill" class="badge m3-tonal-badge font-mono text-xs py-2.5 px-2.5 gap-1 hidden md:inline-flex">
            <span class="material-symbols-outlined text-[15px]">timer</span>
            <span>${formatDuration(savedRec?.activeTypingSeconds || 0)}</span>
          </div>

          <button id="ide-reset-btn" type="button" class="btn btn-xs sm:btn-sm btn-ghost rounded-full gap-1" title="Reset Starter Code (Alt+Backspace)">
            <span class="material-symbols-outlined icon-18">restart_alt</span>
            <span class="hidden md:inline">Reset</span>
          </button>

          <button id="ide-preview-btn" type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full gap-1" title="Run Code Preview (Alt+R)">
            <span class="material-symbols-outlined icon-18">play_arrow</span>
            <span>Run</span>
          </button>

          ${!isBonus ? `
            <button id="ide-verify-btn" type="button" class="btn btn-xs sm:btn-sm ${savedRec?.completed ? 'm3-btn-tonal' : 'btn-primary'} rounded-full px-3.5 gap-1.5" title="Run Automatic Code Check (${modSymbol}+Enter)">
              <span class="material-symbols-outlined icon-18">verified</span>
              <span>Check My Code</span>
              <kbd id="ide-verify-kbd" class="m3-kbd-on-primary ${savedRec?.completed ? 'hidden' : 'hidden md:inline-flex'}">${modSymbol}+Enter</kbd>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Mobile Segmented Tab Bar (< 1024px) -->
      <div class="p-2 border-b m3-border-subtle m3-surface-container-low lg:hidden">
        <div class="tabs tabs-boxed rounded-full p-1 m3-surface-container grid grid-cols-3" id="mobile-pane-tabs">
          <button type="button" class="tab tab-sm rounded-full tab-active" data-pane="instructions">Instructions</button>
          <button type="button" class="tab tab-sm rounded-full" data-pane="editor">Editor</button>
          <button type="button" class="tab tab-sm rounded-full" data-pane="preview">Preview</button>
        </div>
      </div>

      <!-- 3-Pane Draggable Split Container -->
      <div id="ide-split-container" class="ide-split-container">
        <!-- Pane 1: Instructions & Automatic Code Check -->
        <div id="pane-instructions" class="ide-pane">
          <div id="pane-instructions-scroll" class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <div class="text-[11px] font-mono font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
                <span class="material-symbols-outlined icon-18">assignment</span>
                <span>What to build in this lab</span>
              </div>
              <p class="text-xs m3-text-muted mt-1">${escapeHtml(lab.syllabusRef)}</p>
              <ol class="list-decimal pl-5 text-xs sm:text-sm space-y-2 mt-2.5">
                ${lab.instructions.map((ins) => `<li>${escapeHtml(ins)}</li>`).join('')}
              </ol>
            </div>

            <details class="m3-accordion m3-surface-container-low rounded-2xl border m3-border-subtle">
              <summary class="m3-accordion-trigger px-3.5 py-2.5 text-xs font-bold">
                <span>Need a Hint? View Example Code</span>
                <span class="material-symbols-outlined icon-18 m3-accordion-chevron" aria-hidden="true">expand_more</span>
              </summary>
              <div class="m3-accordion-body px-3.5 py-2.5">
                <pre class="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">${escapeHtml(lab.hint)}</pre>
              </div>
            </details>

            ${!isBonus ? `
              <div>
                <h2 class="font-bold text-xs uppercase tracking-wider m3-text-muted mb-2">Automatic Code Check</h2>
                <div id="ide-assertions-box" class="flex flex-col gap-2">
                  ${lab.checksDescription.map((desc) => `
                    <div class="flex items-start gap-2 text-xs p-2.5 rounded-xl m3-surface-container border m3-border-subtle">
                      <span class="material-symbols-outlined icon-18 opacity-50 shrink-0">radio_button_unchecked</span>
                      <span>${escapeHtml(desc)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Accomplishment Card & Next Step CTA -->
            <div id="ide-next-cta" class="${savedRec?.completed ? '' : 'hidden'} pt-2 border-t m3-border-subtle flex flex-col gap-3">
              <div id="ide-lab-complete-card" class="rounded-2xl p-4 m3-primary-container border border-primary/30 flex flex-col gap-3 shadow-sm">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary text-primary-content flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined filled icon-20">emoji_events</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-sm leading-tight">${escapeHtml(lab.code)} Completed!</span>
                      <span class="badge badge-sm badge-success font-mono font-bold text-[10px]">PASSED</span>
                    </div>
                    <div id="ide-lab-complete-meta" class="text-xs opacity-85 mt-0.5">
                      ${savedRec?.completed
                        ? `${savedRec.passedAssertions || lab.checksDescription.length}/${savedRec.totalAssertions || lab.checksDescription.length} checks verified · Time: ${formatDuration(savedRec.activeTypingSeconds || 0)}`
                        : 'All checks verified · Ready for the next step'}
                    </div>
                  </div>
                </div>

                ${nextStep ? `
                  <a id="ide-next-step-link" href="${nextStep.href}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5 font-bold" title="${escapeHtml(nextStep.label)} (${modSymbol}+Enter)">
                    <span>${escapeHtml(nextStep.label)}</span>
                    ${modKbd()}
                    <span class="material-symbols-outlined icon-18" aria-hidden="true">${nextStep.icon}</span>
                  </a>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Vertical Splitter 1 -->
        <div id="resizer-1" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Instructions and Editor"></div>

        <!-- Pane 2: Code Editor -->
        <div id="pane-editor" class="ide-pane">
          <div class="ide-editor-toolbar relative h-10 px-2 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between gap-1.5 shrink-0">
            <div class="min-w-0 flex-1 overflow-x-auto no-scrollbar">
              <div role="tablist" class="tabs tabs-boxed rounded-full p-0.5 m3-surface-container inline-flex flex-nowrap w-max">
                ${lab.tabs.includes('html') ? `<button id="tab-btn-html" type="button" role="tab" class="tab tab-xs rounded-full tab-active font-mono text-[11px] px-2 whitespace-nowrap">index.html</button>` : ''}
                ${lab.tabs.includes('css') ? `<button id="tab-btn-css" type="button" role="tab" class="tab tab-xs rounded-full font-mono text-[11px] px-2 whitespace-nowrap">style.css</button>` : ''}
                ${lab.tabs.includes('js') ? `<button id="tab-btn-js" type="button" role="tab" class="tab tab-xs rounded-full font-mono text-[11px] px-2 whitespace-nowrap">app.js</button>` : ''}
              </div>
            </div>

            <div class="flex items-center gap-0.5 shrink-0">
              ${emmetCheatsheetHtml()}

              <button id="editor-hint-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Autocomplete (Ctrl+Space)" aria-label="Autocomplete">
                <span class="material-symbols-outlined icon-18">code_blocks</span>
              </button>
              <button id="editor-reset-icon-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Reset Starter Code (Alt+Backspace)" aria-label="Reset Starter Code">
                <span class="material-symbols-outlined icon-18">restart_alt</span>
              </button>
              <button id="editor-run-icon-btn" type="button" data-mobile-show="preview" class="btn btn-xs btn-ghost btn-circle" title="Run Code Preview (Alt+R)" aria-label="Run Preview">
                <span class="material-symbols-outlined icon-18">play_arrow</span>
              </button>
            </div>
          </div>

          <div class="ide-editor-wrap">
            <div id="editor-wrap-html"><div id="editor-html"></div></div>
            <div id="editor-wrap-css" class="hidden"><div id="editor-css"></div></div>
            <div id="editor-wrap-js" class="hidden"><div id="editor-js"></div></div>
          </div>

          ${symbolBarHtml()}
        </div>

        <!-- Vertical Splitter 2 -->
        <div id="resizer-2" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Editor and Preview"></div>

        <!-- Pane 3: Live Preview & Collapsible Console -->
        <div id="pane-preview" class="ide-pane">
          <div class="h-10 px-3 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between shrink-0">
            <span class="text-xs font-bold uppercase tracking-wider m3-text-muted flex items-center gap-1.5">
              <span class="material-symbols-outlined icon-18">preview</span>
              <span>Live Page Preview</span>
            </span>
            <button id="preview-refresh-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Refresh Page Preview" aria-label="Refresh Page Preview">
              <span class="material-symbols-outlined icon-18">refresh</span>
            </button>
          </div>

          <iframe id="ide-preview-iframe" class="ide-preview-frame" sandbox="allow-scripts allow-modals" title="Live Page Preview"></iframe>

          ${consoleDrawerHtml()}
        </div>
      </div>

      <!-- Mobile Sticky Bottom Bar (< 1024px) -->
      <div class="lg:hidden m3-mobile-sticky-bar shrink-0">
        <div class="m3-mobile-split-actions">
          <button id="mobile-ide-reset-btn" type="button" class="btn m3-btn-tonal gap-1.5">
            <span class="material-symbols-outlined icon-18">restart_alt</span>
            <span>Reset</span>
          </button>
          ${!isBonus ? `
            <button id="mobile-ide-verify-btn" type="button" class="btn btn-primary gap-1.5">
              <span class="material-symbols-outlined icon-18">verified</span>
              <span>Run &amp; Check</span>
            </button>
          ` : `
            <button id="mobile-ide-preview-btn" type="button" data-mobile-show="preview" class="btn btn-primary gap-1.5">
              <span class="material-symbols-outlined icon-18">play_arrow</span>
              <span>Run</span>
            </button>
          `}
        </div>
      </div>
    </section>
  `;

  // Initialize IDE Controller
  const ide = new LabIDEController({
    lab,
    isBonus,
    initialState: savedRec || {},
    onTelemetryUpdate: (tel) => {
      const pill = document.getElementById('ide-telemetry-pill');
      if (pill) {
        pill.innerHTML = `
          <span class="material-symbols-outlined text-[15px]">timer</span>
          <span>${formatDuration(tel.activeTypingSeconds)}</span>
        `;
      }
    },
    onShortcutSave: async (ctrl) => {
      for (const tabKey of lab.tabs || []) {
        if (ctrl.editors[tabKey]) ctrl.code[tabKey] = ctrl.editors[tabKey].getValue();
      }
      await ctrl.persistDraft();
      ctrl.runPreviewOnly();
      showToast('Code saved & preview updated', 'success');
    },
    onShortcutRunPreview: (ctrl) => {
      for (const tabKey of lab.tabs || []) {
        if (ctrl.editors[tabKey]) ctrl.code[tabKey] = ctrl.editors[tabKey].getValue();
      }
      ctrl.runPreviewOnly();
      showToast('Preview updated.', 'info');
    },
    onShortcutReset: (ctrl) => {
      if (confirm('Reset this lab back to starter code?')) {
        ctrl.resetStarterCode();
        showToast('Starter code restored.', 'info');
      }
    },
    onShortcutToggleSidebar: () => toggleCourseSidebar(),
    onShortcutRunAdvance: async (ctrl) => {
      if (isBonus) {
        for (const tabKey of lab.tabs || []) {
          if (ctrl.editors[tabKey]) ctrl.code[tabKey] = ctrl.editors[tabKey].getValue();
        }
        ctrl.runPreviewOnly();
        showToast('Preview updated.', 'info');
        return;
      }

      // If lab is already verified and user hasn't edited code since passing, advance immediately
      const nextLink = document.getElementById('ide-next-step-link');
      const nextCta = document.getElementById('ide-next-cta');
      if (nextLink && nextCta && !nextCta.classList.contains('hidden') && !ctrl.dirtySinceVerify) {
        window.location.hash = nextLink.getAttribute('href') || '#/';
        return;
      }

      for (const tabKey of lab.tabs || []) {
        if (ctrl.editors[tabKey]) ctrl.code[tabKey] = ctrl.editors[tabKey].getValue();
      }
      // First press of Ctrl+Enter verifies & reveals the accomplishment card;
      // second press (when already verified) advances to the next step.
      ctrl.pendingShortcutAdvance = false;
      ctrl.runAndVerify();
    },
    onVerifyComplete: async (res) => {
      const shouldAdvance = Boolean(ide.pendingShortcutAdvance);
      ide.pendingShortcutAdvance = false;

      const box = document.getElementById('ide-assertions-box');
      if (box) {
        box.innerHTML = res.results.map((r) => `
          <div class="flex items-start gap-2 text-xs p-2.5 rounded-xl border ${r.pass ? 'm3-success-container border-success/40' : 'm3-error-container border-error/40'}">
            <span class="material-symbols-outlined icon-18 shrink-0 mt-0.5">${r.pass ? 'check_circle' : 'cancel'}</span>
            <div>
              <div class="font-bold">${escapeHtml(r.name)}</div>
              <div class="opacity-85">${escapeHtml(r.detail)}</div>
            </div>
          </div>
        `).join('');
      }

      if (res.allPassed) {
        ide.dirtySinceVerify = false;
        const firstCompletion = !appState.practicals.get(Number(lab.id))?.completed;
        await refreshStateFromDB();
        renderSidebarAndProgress();
        prefetchCertificateInBackground();

        document.getElementById('ide-verified-badge')?.classList.remove('hidden');
        document.getElementById('ide-verified-badge')?.classList.add('inline-flex');

        // Transfer primary CTA & Ctrl+Enter ownership from "Check My Code" to "Continue"
        const verifyBtn = document.getElementById('ide-verify-btn');
        const verifyKbd = document.getElementById('ide-verify-kbd');
        if (verifyBtn) {
          verifyBtn.classList.remove('btn-primary');
          verifyBtn.classList.add('m3-btn-tonal');
        }
        if (verifyKbd) {
          verifyKbd.classList.add('hidden');
          verifyKbd.classList.remove('md:inline-flex');
        }

        const nextCta = document.getElementById('ide-next-cta');
        const completeCard = document.getElementById('ide-lab-complete-card');
        const completeMeta = document.getElementById('ide-lab-complete-meta');
        const latestRec = appState.practicals.get(Number(lab.id));
        if (completeMeta) {
          const timeStr = latestRec?.activeTypingSeconds ? ` · Time: ${formatDuration(latestRec.activeTypingSeconds)}` : '';
          completeMeta.textContent = `${res.passedAssertions}/${res.totalAssertions} checks verified${timeStr}`;
        }
        nextCta?.classList.remove('hidden');
        completeCard?.classList.remove('m3-dom-flash');
        void completeCard?.offsetWidth;
        completeCard?.classList.add('m3-dom-flash');

        // Scroll Pane 1 smoothly to reveal the accomplishment card
        const paneScroll = document.getElementById('pane-instructions-scroll');
        if (paneScroll) {
          paneScroll.scrollTo({ top: paneScroll.scrollHeight, behavior: 'smooth' });
        }

        // On mobile (< 1024px), switch back to Instructions tab so the learner sees the accomplishment card
        if (window.innerWidth < 1024) {
          appClick(document.querySelector('#mobile-pane-tabs [data-pane="instructions"]'));
        }

        if (shouldAdvance && nextStep) window.location.hash = nextStep.href;
        if (!firstCompletion) return; // re-checking an already verified lab: no second celebration

        const checksStat = { statValue: `${res.passedAssertions}/${res.totalAssertions}`, statLabel: 'Checks Passed' };
        if (areModuleLabsCompleted(lab.moduleId)) {
          const unlocked = nextModule ? `Module ${nextModule.id}` : 'your Certificate';
          await triggerCheckpointModal({
            title: `Module ${lab.moduleId} Complete`,
            description: `All labs in Module ${lab.moduleId} are verified, and ${unlocked} is now unlocked.`,
            code: `M${lab.moduleId}`,
            ...checksStat
          });
        } else {
          await triggerCheckpointModal({
            title: `${lab.code} Completed`,
            description: nextLab
              ? `All ${res.totalAssertions} checks passed. Next up: ${nextLab.code} (${nextLab.title}).`
              : `All ${res.totalAssertions} checks passed.`,
            code: lab.code.replace(/\s+/g, '_'),
            ...checksStat
          });
        }
      } else {
        showToast(`Almost there! ${res.passedAssertions} of ${res.totalAssertions} checks passed. Check the tips on the left.`, 'error');
      }
    }
  });

  appState.shortcutContext = {
    onRunAdvance: () => ide.onShortcutRunAdvance?.(ide),
    onRunPreview: () => ide.onShortcutRunPreview?.(ide),
    onReset: () => ide.onShortcutReset?.(ide),
    onSave: () => ide.onShortcutSave?.(ide)
  };

  appState.activeIDE = ide;
  ide.mount({
    htmlEl: document.getElementById('editor-html'),
    cssEl: document.getElementById('editor-css'),
    jsEl: document.getElementById('editor-js'),
    htmlWrap: document.getElementById('editor-wrap-html'),
    cssWrap: document.getElementById('editor-wrap-css'),
    jsWrap: document.getElementById('editor-wrap-js'),
    htmlTabBtn: document.getElementById('tab-btn-html'),
    cssTabBtn: document.getElementById('tab-btn-css'),
    jsTabBtn: document.getElementById('tab-btn-js'),
    symbolBar: document.getElementById('ide-symbol-bar'),
    iframe: document.getElementById('ide-preview-iframe'),
    consoleEl: document.getElementById('ide-console-output'),
    consoleCountEl: document.getElementById('ide-console-count')
  });

  if (!isBonus) {
    Object.values(ide.editors || {}).forEach((cm) => {
      cm?.on('change', () => {
        if (ide.dirtySinceVerify) return;
        ide.dirtySinceVerify = true;
        const verifyBtn = document.getElementById('ide-verify-btn');
        const verifyKbd = document.getElementById('ide-verify-kbd');
        if (verifyBtn) {
          verifyBtn.classList.add('btn-primary');
          verifyBtn.classList.remove('m3-btn-tonal');
        }
        if (verifyKbd) {
          verifyKbd.classList.remove('hidden');
          verifyKbd.classList.add('md:inline-flex');
        }
      });
    });
  }

  // Resizable 3-Pane Split Controller
  appState.cleanupSplitResizers = initSplitResizers(
    document.getElementById('ide-split-container'),
    document.getElementById('pane-instructions'),
    document.getElementById('pane-editor'),
    document.getElementById('pane-preview'),
    document.getElementById('resizer-1'),
    document.getElementById('resizer-2'),
    ide
  );

  // Tab bindings
  document.getElementById('tab-btn-html')?.addEventListener('click', () => ide.switchTab('html'));
  document.getElementById('tab-btn-css')?.addEventListener('click', () => ide.switchTab('css'));
  document.getElementById('tab-btn-js')?.addEventListener('click', () => ide.switchTab('js'));

  const runPreviewAction = () => {
    ide.runPreviewOnly();
    showToast('Preview updated.', 'info');
  };
  const resetAction = () => {
    if (confirm('Reset this lab back to starter code?')) {
      ide.resetStarterCode();
    }
  };

  document.getElementById('ide-preview-btn')?.addEventListener('click', runPreviewAction);
  document.getElementById('mobile-ide-preview-btn')?.addEventListener('click', runPreviewAction);
  document.getElementById('editor-run-icon-btn')?.addEventListener('click', runPreviewAction);
  document.getElementById('preview-refresh-btn')?.addEventListener('click', runPreviewAction);
  document.getElementById('ide-reset-btn')?.addEventListener('click', resetAction);
  document.getElementById('mobile-ide-reset-btn')?.addEventListener('click', resetAction);
  document.getElementById('editor-reset-icon-btn')?.addEventListener('click', resetAction);
  document.getElementById('ide-verify-btn')?.addEventListener('click', () => ide.runAndVerify());
  document.getElementById('mobile-ide-verify-btn')?.addEventListener('click', () => ide.runAndVerify());

  document.getElementById('editor-hint-btn')?.addEventListener('click', () => {
    const cm = ide.editors[ide.activeTab];
    if (cm) {
      cm.focus();
      ide.triggerAutocomplete(cm, ide.activeTab, true);
    }
  });
  bindConsoleDrawer();
  bindMobilePaneTabs(ide);
}
