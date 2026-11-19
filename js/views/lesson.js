/**
 * Lesson workspace (#/module/:id/lesson/:n).
 */

import { markLessonCompleted } from '../db.js';
import { getModuleById } from '../course-data.js';
import { LabIDEController } from '../ide.js';
import { renderLessonWidgetHtml, hydrateLessonWidget, runJsInSandbox } from '../lesson-widgets.js';
import { escapeHtml, showToast, appClick, MOD_KEY } from '../core/utils.js';
import { appState, isLessonCompleted, getModuleGateStatus, getQuizGateStatus } from '../core/state.js';
import { toggleCourseSidebar, renderSidebarAndProgress } from '../ui/sidebar.js';
import { openQuickCheckModal } from '../ui/quick-check.js';
import { renderLessonAudioGistHtml, initLessonAudioGist } from '../ui/lesson-audio.js';
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

function renderLessonPaneOneHtml(mod, sec, currentStep, totalLessons) {
  const isLastLesson = currentStep >= totalLessons;
  const checks = Array.isArray(sec.widget?.checks) ? sec.widget.checks : [];
  const modSymbol = MOD_KEY;
  const quizOpen = getQuizGateStatus(mod.id).unlocked;

  return `
    <div id="pane-instructions" class="ide-pane">
      <div class="flex-1 overflow-y-auto p-5 sm:p-7 flex flex-col gap-6">
        <div>
          <div class="flex items-center gap-1.5 mb-3 lg:hidden" role="progressbar" aria-label="Module ${mod.id} lesson progress" aria-valuenow="${currentStep}" aria-valuemin="1" aria-valuemax="${totalLessons}">
            ${(mod.sections || []).map((s, idx) => {
              const stepNum = idx + 1;
              const done = isLessonCompleted(mod.id, s.id);
              const isCurrent = stepNum === currentStep;
              return `<a href="#/module/${mod.id}/lesson/${stepNum}" class="h-1.5 flex-1 rounded-full transition-opacity ${
                isCurrent
                  ? 'm3-dot-primary'
                  : done || stepNum < currentStep
                    ? 'm3-dot-primary opacity-45'
                    : 'm3-surface-container-highest'
              }" title="Lesson ${stepNum}: ${escapeHtml(s.title)}" aria-label="Lesson ${stepNum}: ${escapeHtml(s.title)}"></a>`;
            }).join('')}
          </div>
          <div id="lesson-step-label" class="text-[11px] font-bold uppercase tracking-wider m3-text-primary">
            MODULE ${mod.id} &middot; LESSON ${currentStep} OF ${totalLessons}
          </div>
          <h1 class="text-2xl sm:text-[26px] font-bold tracking-tight mt-1">${escapeHtml(sec.title)}</h1>
          <p class="text-sm sm:text-[15px] leading-relaxed m3-text-muted mt-2.5 m-0">${escapeHtml(sec.lead)}</p>
          ${renderLessonAudioGistHtml(sec)}
        </div>

        ${sec.points ? `
          <ul class="space-y-3.5 text-sm sm:text-[15px] mt-1 pl-0 list-none m-0">
            ${sec.points.map((pt) => `
              <li class="flex items-start gap-3">
                <span class="w-1.5 h-1.5 rounded-full m3-dot-primary mt-2.5 shrink-0"></span>
                <div class="leading-relaxed">
                  <strong class="font-bold">${escapeHtml(pt.heading)}:</strong>
                  <span class="m3-text-muted ml-1">${escapeHtml(pt.text)}</span>
                </div>
              </li>
            `).join('')}
          </ul>
        ` : ''}

        ${sec.widget?.task ? `
          <div class="pt-4 border-t m3-border-subtle">
            <div class="text-xs font-semibold uppercase tracking-wider m3-text-primary mb-1">Try It in the Editor</div>
            <p class="text-xs m3-text-muted m-0 leading-relaxed">${escapeHtml(sec.widget.task)}</p>
            ${checks.length ? `
              <div class="flex flex-wrap gap-1.5 mt-3" data-me-checks>
                ${checks.map((chk, idx) => `
                  <span class="badge badge-sm h-auto whitespace-normal text-left rounded-full py-1.5 px-2.5 m3-surface-container border m3-border-subtle gap-1.5 font-medium text-xs" data-me-check="${idx}">
                    <span class="material-symbols-outlined text-sm">radio_button_unchecked</span>
                    <span>${escapeHtml(chk.label)}</span>
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${(sec.analogy || sec.takeaway) ? `
          <details class="m3-accordion m3-surface-container-low rounded-2xl border m3-border-subtle">
            <summary class="m3-accordion-trigger px-4 py-3 text-xs font-semibold">
              <span class="flex items-center gap-2 min-w-0">
                <span class="material-symbols-outlined icon-18 m3-text-primary shrink-0" aria-hidden="true">lightbulb</span>
                <span>Extra Tips &amp; Examples</span>
              </span>
              <span class="material-symbols-outlined icon-18 m3-accordion-chevron" aria-hidden="true">expand_more</span>
            </summary>
            <div class="m3-accordion-body px-4 py-3.5 text-xs space-y-2 m3-text-muted">
              ${sec.analogy ? `<div><strong class="text-[var(--m3-text)]">${escapeHtml(sec.analogy.title)}:</strong> ${escapeHtml(sec.analogy.text)}</div>` : ''}
              ${sec.takeaway ? `<div><strong class="text-[var(--m3-text)]">Takeaway:</strong> ${escapeHtml(sec.takeaway.text)}</div>` : ''}
            </div>
          </details>
        ` : ''}
      </div>

      <!-- Anchored Bottom Lesson Footer inside Pane 1 -->
      <footer class="m3-mobile-sticky-bar m3-border-subtle lg:border-t lg:m3-surface-container-low lg:px-4 lg:py-3 lg:flex lg:items-center lg:justify-between lg:gap-3 shrink-0">
        <div class="m3-mobile-split-actions lg:contents">
          <div class="m3-mobile-prev-wrap lg:flex lg:items-center lg:gap-2">
            ${currentStep > 1 ? `
              <a href="#/module/${mod.id}/lesson/${currentStep - 1}" id="lesson-prev-btn" class="btn btn-sm btn-circle m3-btn-tonal shrink-0" title="Previous" aria-label="Previous">
                <span class="material-symbols-outlined icon-18">arrow_back</span>
              </a>
            ` : ''}
            ${quizOpen ? `
              <a href="#/quiz/${mod.id}" class="hidden lg:inline-flex btn btn-sm btn-ghost rounded-full px-3 text-xs m3-text-muted" title="Jump to Module ${mod.id} Quiz">
                Take Quiz
              </a>
            ` : ''}
          </div>

          <button id="lesson-complete-next-btn" type="button" class="btn btn-sm btn-primary rounded-full px-4 gap-2 font-medium" title="${isLastLesson ? 'Take Quiz' : 'Next Lesson'} (Ctrl+Enter)">
            <span>${isLastLesson ? 'Take Quiz' : 'Next'}</span>
            <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${modSymbol}+Enter</kbd>
            <span class="material-symbols-outlined icon-18">arrow_forward</span>
          </button>
        </div>
      </footer>
    </div>
  `;
}

export function renderModuleView(moduleId, lessonStep = 1) {
  const mod = getModuleById(moduleId);
  if (!mod) {
    setWorkspaceLayoutMode(false);
    renderLockedView('Module', 'Module not found.', '#/');
    return;
  }
  const gate = getModuleGateStatus(mod.id);
  if (!gate.unlocked) {
    setWorkspaceLayoutMode(false);
    renderLockedView(`Module ${mod.id}: ${mod.title}`, gate.reason, gate.targetHash || '#/');
    return;
  }

  setWorkspaceLayoutMode(true);

  const lessons = mod.sections || [];
  const totalLessons = lessons.length;
  const currentStep = Math.min(totalLessons, Math.max(1, Number(lessonStep) || 1));
  const sec = lessons[currentStep - 1];
  const isLastLesson = currentStep >= totalLessons;
  const widgetType = sec.widget?.type || '';
  const isHtmlCodeLesson = widgetType === 'mini-editor';
  const isJsCodeLesson = widgetType === 'js-sandbox';
  const isCodeWorkspace = isHtmlCodeLesson || isJsCodeLesson;
  const view = document.getElementById('app-view');

  if (isCodeWorkspace) {
    const presets = isJsCodeLesson && Array.isArray(sec.widget?.presets) ? sec.widget.presets : [];
    const starterHtml = isHtmlCodeLesson ? (sec.widget?.starterHtml || '') : '';
    const starterJs = isJsCodeLesson ? (presets[0]?.code || 'console.log("Hello JS!");') : '';
    const activeTabKey = isJsCodeLesson ? 'js' : 'html';
    const fileLabel = isJsCodeLesson ? 'app.js' : 'index.html';

    view.innerHTML = `
      <section class="ide-workspace-root ide-workspace-tabbed" data-micro-lesson="${escapeHtml(sec.id)}" data-selectable>
        <!-- Mobile Segmented Tab Bar (< 1024px) -->
        <div class="p-2 border-b m3-border-subtle m3-surface-container-low lg:hidden">
          <div class="tabs tabs-boxed rounded-full p-1 m3-surface-container grid grid-cols-3" id="mobile-pane-tabs">
            <button type="button" class="tab tab-sm rounded-full tab-active" data-pane="instructions">Lesson</button>
            <button type="button" class="tab tab-sm rounded-full" data-pane="editor">Editor</button>
            <button type="button" class="tab tab-sm rounded-full" data-pane="preview">${isJsCodeLesson ? 'Console' : 'Preview'}</button>
          </div>
        </div>

        <!-- 3-Pane Draggable Split Container -->
        <div id="ide-split-container" class="ide-split-container">
          <!-- Pane 1: Clean Lesson Guide (~32%) -->
          ${renderLessonPaneOneHtml(mod, sec, currentStep, totalLessons)}

          <div id="resizer-1" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Lesson and Editor"></div>

          <!-- Pane 2: Full CodeMirror 5 Editor (~34%) -->
          <div id="pane-editor" class="ide-pane">
            <div class="ide-editor-toolbar relative h-10 px-2.5 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between gap-1.5 shrink-0">
              <div class="min-w-0 flex-1 overflow-x-auto no-scrollbar">
                <div role="tablist" class="tabs tabs-boxed rounded-full p-0.5 m3-surface-container inline-flex flex-nowrap w-max">
                  <button id="tab-btn-${activeTabKey}" type="button" role="tab" class="tab tab-xs rounded-full tab-active font-mono text-[11px] px-2.5 whitespace-nowrap">${fileLabel}</button>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                ${emmetCheatsheetHtml()}

                <button id="editor-hint-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Autocomplete (Ctrl+Space)" aria-label="Autocomplete">
                  <span class="material-symbols-outlined icon-18">code_blocks</span>
                </button>
                <button id="lesson-reset-btn" type="button" class="btn btn-xs btn-ghost rounded-full gap-1" title="Reset Starter Code" aria-label="Reset Starter Code">
                  <span class="material-symbols-outlined icon-18">restart_alt</span>
                  <span class="hidden sm:inline">Reset</span>
                </button>
                <button id="lesson-run-btn" type="button" class="btn btn-xs btn-primary rounded-full px-3 gap-1" title="Run Code" data-mobile-show="preview">
                  <span class="material-symbols-outlined text-[15px]">play_arrow</span>
                  <span>Run</span>
                </button>
              </div>
            </div>

            ${isHtmlCodeLesson && Array.isArray(sec.widget?.checks) && sec.widget.checks.length ? `
              <div class="ide-goal-strip lg:hidden" aria-label="Goals for this task">
                <span class="ide-goal-strip-label">Goals</span>
                ${sec.widget.checks.map((chk, idx) => `
                  <span class="ide-goal-chip m3-surface-container" data-me-check="${idx}">
                    <span class="material-symbols-outlined" aria-hidden="true">radio_button_unchecked</span>
                    <span>${escapeHtml(chk.label)}</span>
                  </span>
                `).join('')}
              </div>
            ` : ''}

            ${presets.length ? `
              <div class="px-2.5 py-1.5 border-b m3-border-subtle m3-surface-container-low flex flex-wrap gap-1.5 shrink-0">
                ${presets.map((p, idx) => `
                  <button type="button" class="btn btn-xs ${idx === 0 ? 'm3-btn-tonal font-semibold' : 'btn-ghost border m3-border-subtle'} rounded-full" data-js-preset="${idx}">
                    ${escapeHtml(p.label)}
                  </button>
                `).join('')}
              </div>
            ` : ''}

            <div class="ide-editor-wrap">
              ${isHtmlCodeLesson
                ? '<div id="editor-wrap-html"><div id="editor-html"></div></div>'
                : '<div id="editor-wrap-js"><div id="editor-js"></div></div>'}
            </div>

            ${symbolBarHtml()}
          </div>

          <div id="resizer-2" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Editor and Output"></div>

          <!-- Pane 3: Full-Height Browser Output / Console (~34%) -->
          <div id="pane-preview" class="ide-pane">
            ${isHtmlCodeLesson ? `
              <div class="h-10 px-3 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between shrink-0">
                <span class="text-xs font-bold uppercase tracking-wider m3-text-muted flex items-center gap-1.5">
                  <span class="material-symbols-outlined icon-18">preview</span>
                  <span>Live Preview</span>
                </span>
                <button id="preview-refresh-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Refresh Preview" aria-label="Refresh Preview">
                  <span class="material-symbols-outlined icon-18">refresh</span>
                </button>
              </div>
              <iframe id="ide-preview-iframe" class="ide-preview-frame" sandbox="allow-scripts allow-modals" title="Browser Output Preview"></iframe>
              ${consoleDrawerHtml()}
            ` : `
              <div class="h-10 px-3 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between shrink-0">
                <span class="text-xs font-bold uppercase tracking-wider m3-text-muted flex items-center gap-1.5">
                  <span class="material-symbols-outlined icon-18">terminal</span>
                  <span>Sandbox Console &amp; Variables</span>
                </span>
                <button id="ide-console-clear-btn" type="button" class="btn btn-xs btn-ghost rounded-full text-[11px]">Clear</button>
              </div>
              <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div class="m3-code-block p-3.5 font-mono text-xs space-y-1 min-h-[160px]" id="ide-console-output">
                  <div class="opacity-60">Click Run to execute JavaScript...</div>
                </div>
                <div class="m3-surface-container-low rounded-2xl p-3.5 border m3-border-subtle">
                  <div class="text-[11px] font-bold uppercase tracking-wider m3-text-muted mb-2">Variable &amp; Return Inspector</div>
                  <div class="flex flex-wrap gap-1.5 text-xs font-mono" id="lesson-js-vars">
                    <span class="m3-text-muted">Add <code>return { ... }</code> to inspect variables.</span>
                  </div>
                </div>
              </div>
            `}
          </div>
        </div>
      </section>
    `;

    const checks = Array.isArray(sec.widget?.checks) ? sec.widget.checks : [];
    const syncMiniChecks = (codeText) => {
      checks.forEach((chk, idx) => {
        let ok = false;
        try { ok = Boolean(chk.test(codeText)); } catch { ok = false; }
        // Each goal is shown twice: in the lesson pane and in the editor's goal strip (mobile).
        view.querySelectorAll(`[data-me-check="${idx}"]`).forEach((badge) => {
          const icon = badge.querySelector('.material-symbols-outlined');
          if (icon) icon.textContent = ok ? 'check_circle' : 'radio_button_unchecked';
          badge.classList.toggle('m3-primary-container', ok);
          badge.classList.toggle('m3-surface-container', !ok);
        });
      });
    };

    const ide = new LabIDEController({
      lab: {
        id: 0,
        tabs: [activeTabKey],
        starterHtml,
        starterCss: '',
        starterJs
      },
      isBonus: true,
      initialTab: activeTabKey,
      onCodeChange: isHtmlCodeLesson
        ? (codeObj) => {
            syncMiniChecks(codeObj.html || '');
            ide.runPreviewOnly();
          }
        : null,
      customRunner: isJsCodeLesson
        ? async (codeObj) => {
            const outEl = document.getElementById('ide-console-output');
            const varsEl = document.getElementById('lesson-js-vars');
            const result = await runJsInSandbox(codeObj.js || '');
            if (outEl) {
              const lines = [];
              for (const p of result.popups || []) {
                lines.push(`<div class="text-amber-300">[${escapeHtml(p.kind)}] "${escapeHtml(p.text)}" &rarr; ${escapeHtml(p.result)}</div>`);
              }
              for (const l of result.logs || []) {
                const cls = l.level === 'error' ? 'text-rose-300' : 'text-emerald-200';
                lines.push(`<div class="${cls}">&gt; ${escapeHtml(l.text)}</div>`);
              }
              outEl.innerHTML = lines.length ? lines.join('') : '<div class="opacity-60">(No console output)</div>';
            }
            if (varsEl) {
              if (result.returned && typeof result.returned === 'object') {
                varsEl.innerHTML = Object.entries(result.returned).map(([k, v]) => `
                  <span class="badge badge-sm m3-primary-container font-mono">${escapeHtml(k)}: ${escapeHtml(JSON.stringify(v))}</span>
                `).join('');
              } else if (result.returned !== null && result.returned !== undefined) {
                varsEl.innerHTML = `<span class="badge badge-sm m3-primary-container font-mono">return: ${escapeHtml(String(result.returned))}</span>`;
              } else {
                varsEl.innerHTML = '<span class="m3-text-muted">Add <code>return { ... }</code> to inspect variables.</span>';
              }
            }
          }
        : null,
      onShortcutSave: async () => {
        if (isHtmlCodeLesson) {
          const currentHtml = ide.editors.html ? ide.editors.html.getValue() : (ide.code.html || '');
          ide.code.html = currentHtml;
          syncMiniChecks(currentHtml);
        } else if (isJsCodeLesson && ide.editors.js) {
          ide.code.js = ide.editors.js.getValue();
        }
        await ide.runPreviewOnly();
        showToast('Code saved & preview updated', 'success');
      },
      onShortcutRunPreview: async () => {
        if (isHtmlCodeLesson) {
          const currentHtml = ide.editors.html ? ide.editors.html.getValue() : (ide.code.html || '');
          ide.code.html = currentHtml;
          syncMiniChecks(currentHtml);
        } else if (isJsCodeLesson && ide.editors.js) {
          ide.code.js = ide.editors.js.getValue();
        }
        await ide.runPreviewOnly();
        showToast('Preview updated.', 'info');
      },
      onShortcutReset: () => {
        if (confirm('Reset this lesson back to starter code?')) {
          ide.resetStarterCode();
          if (isHtmlCodeLesson) syncMiniChecks(starterHtml);
          showToast('Starter code restored.', 'info');
        }
      },
      onShortcutToggleSidebar: () => toggleCourseSidebar(),
      onShortcutRunAdvance: async () => {
        if (isHtmlCodeLesson) {
          const currentHtml = ide.editors.html ? ide.editors.html.getValue() : (ide.code.html || '');
          ide.code.html = currentHtml;
          ide.runPreviewOnly();
          syncMiniChecks(currentHtml);
          const allChecksPass = checks.length === 0 || checks.every((chk) => {
            try { return Boolean(chk.test(currentHtml)); } catch { return false; }
          });
          if (!allChecksPass) {
            showToast('Preview updated — finish the Goal checks in Pane 1 to advance.', 'error');
            return;
          }
        } else if (isJsCodeLesson) {
          if (ide.editors.js) ide.code.js = ide.editors.js.getValue();
          await ide.runPreviewOnly();
        }
        appClick(document.getElementById('lesson-complete-next-btn'));
      }
    });

    appState.shortcutContext = {
      onRunAdvance: ide.onShortcutRunAdvance,
      onRunPreview: ide.onShortcutRunPreview,
      onReset: ide.onShortcutReset,
      onSave: ide.onShortcutSave
    };

    appState.activeIDE = ide;
    ide.mount({
      htmlEl: document.getElementById('editor-html'),
      jsEl: document.getElementById('editor-js'),
      htmlWrap: document.getElementById('editor-wrap-html'),
      jsWrap: document.getElementById('editor-wrap-js'),
      htmlTabBtn: document.getElementById('tab-btn-html'),
      jsTabBtn: document.getElementById('tab-btn-js'),
      symbolBar: document.getElementById('ide-symbol-bar'),
      iframe: document.getElementById('ide-preview-iframe'),
      consoleEl: document.getElementById('ide-console-output'),
      consoleCountEl: document.getElementById('ide-console-count')
    });

    if (isHtmlCodeLesson) syncMiniChecks(starterHtml);

    appState.cleanupSplitResizers = initSplitResizers(
      document.getElementById('ide-split-container'),
      document.getElementById('pane-instructions'),
      document.getElementById('pane-editor'),
      document.getElementById('pane-preview'),
      document.getElementById('resizer-1'),
      document.getElementById('resizer-2'),
      ide
    );

    const runLessonPreview = () => {
      ide.runPreviewOnly();
      if (isHtmlCodeLesson) syncMiniChecks(ide.code.html || '');
    };
    document.getElementById('lesson-run-btn')?.addEventListener('click', runLessonPreview);
    document.getElementById('preview-refresh-btn')?.addEventListener('click', runLessonPreview);
    document.getElementById('lesson-reset-btn')?.addEventListener('click', () => {
      ide.resetStarterCode();
      if (isHtmlCodeLesson) syncMiniChecks(starterHtml);
    });
    document.getElementById('editor-hint-btn')?.addEventListener('click', () => {
      const cm = ide.editors[ide.activeTab];
      if (cm) {
        cm.focus();
        ide.triggerAutocomplete(cm, ide.activeTab, true);
      }
    });

    // JS Sandbox preset chips
    view.querySelectorAll('[data-js-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = presets[Number(btn.dataset.jsPreset)];
        if (!p) return;
        view.querySelectorAll('[data-js-preset]').forEach((b) => {
          b.classList.toggle('m3-btn-tonal', b === btn);
          b.classList.toggle('font-semibold', b === btn);
          b.classList.toggle('btn-ghost', b !== btn);
        });
        ide.setCode('js', p.code);
      });
    });
    bindConsoleDrawer();
    bindMobilePaneTabs(ide);
  } else {
    // Full-Viewport 2-Pane Simulator Workspace (M1L1-4, M4L1-4, M5L1-4)
    // Desktop: side-by-side resizable split. Mobile (< 1024px): single vertical flow with inline simulator.
    view.innerHTML = `
      <section class="ide-workspace-root ide-workspace-inline-mobile" data-micro-lesson="${escapeHtml(sec.id)}" data-selectable>
        <div id="ide-split-container" class="ide-split-container">
          ${renderLessonPaneOneHtml(mod, sec, currentStep, totalLessons)}

          <div id="resizer-1" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Lesson and Simulator"></div>

          <div id="pane-simulator" class="ide-pane border-t m3-border-subtle lg:border-t-0">
            <div class="flex-1 lg:overflow-y-auto p-5 sm:p-7 flex flex-col">
              <div class="w-full max-w-2xl mx-auto">
                ${renderLessonWidgetHtml(sec.widget)}
              </div>
            </div>
          </div>
        </div>

        <!-- Single Mobile Sticky Action Bar (< 1024px) -->
        <div class="lg:hidden m3-mobile-sticky-bar shrink-0">
          <div class="m3-mobile-split-actions">
            ${currentStep > 1 ? `
              <a href="#/module/${mod.id}/lesson/${currentStep - 1}" class="btn btn-circle m3-btn-tonal shrink-0" title="Previous" aria-label="Previous">
                <span class="material-symbols-outlined icon-18">arrow_back</span>
              </a>
            ` : ''}
            <button type="button" class="btn btn-primary gap-1.5 js-mobile-lesson-next">
              <span>${isLastLesson ? 'Take Quiz' : 'Next'}</span>
              <span class="material-symbols-outlined icon-18">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>
    `;

    view.querySelectorAll('.js-mobile-lesson-next').forEach((btn) => {
      btn.addEventListener('click', () => appClick(document.getElementById('lesson-complete-next-btn')));
    });

    hydrateLessonWidget(view, sec.widget);

    appState.cleanupSplitResizers = initSplitResizers(
      document.getElementById('ide-split-container'),
      document.getElementById('pane-instructions'),
      document.getElementById('pane-simulator'),
      null,
      document.getElementById('resizer-1'),
      null,
      null
    );
  }

  // Hydrate optional Lesson Audio Summary player and register cleanup on route exit
  const audioCtrl = initLessonAudioGist(view, sec);
  appState.stopLessonAudio = audioCtrl ? audioCtrl.pauseOnly : null;
  if (audioCtrl) {
    const prevCleanup = appState.cleanupRouteView;
    appState.cleanupRouteView = () => {
      audioCtrl.cleanup();
      appState.stopLessonAudio = null;
      if (typeof prevCleanup === 'function') prevCleanup();
    };
  }

  // Save micro-lesson completion in IndexedDB and advance
  const advanceToNextStep = async () => {
    await markLessonCompleted(mod.id, sec.id, currentStep);
    appState.lessons.add(`${mod.id}:${sec.id}`);
    renderSidebarAndProgress();
    if (isLastLesson) {
      window.location.hash = `#/quiz/${mod.id}`;
    } else {
      window.location.hash = `#/module/${mod.id}/lesson/${currentStep + 1}`;
    }
  };

  document.getElementById('lesson-complete-next-btn')?.addEventListener('click', () => {
    if (sec.microCheck && !isLessonCompleted(mod.id, sec.id)) {
      openQuickCheckModal({ mod, sec, currentStep, totalLessons, isLastLesson, onAdvance: advanceToNextStep });
      return;
    }
    advanceToNextStep();
  });

  if (!isCodeWorkspace) {
    appState.shortcutContext = {
      onRunAdvance: () => {
        appClick(document.getElementById('lesson-complete-next-btn'));
      }
    };
  }
}
