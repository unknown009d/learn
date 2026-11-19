/**
 * Printable lab record (#/manual).
 */

import { exportFullState } from '../db.js';
import { MODULES } from '../course-data.js';
import { LABS } from '../labs-data.js';
import { composeSrcDoc } from '../ide.js';
import { escapeHtml, formatDate, formatDuration } from '../core/utils.js';

export async function renderManualView() {
  const state = await exportFullState();
  const quizzes = new Map((state.quizzes || []).map((q) => [Number(q.moduleId), q]));
  const pracs = new Map((state.practicals || []).map((p) => [Number(p.labId), p]));
  const view = document.getElementById('app-view');

  view.innerHTML = `
    <section class="flex flex-col gap-6 max-w-4xl mx-auto">
      <div class="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 class="text-2xl font-extrabold">Printable Practical Lab Record</h1>
          <p class="text-xs sm:text-sm m3-text-muted">Formatted record of all 8 practicals, source code, outputs, and quiz timestamps for Learning the Web with Basics of Vanilla Front-End Tools.</p>
        </div>
        <button id="manual-print-btn" type="button" class="btn btn-primary rounded-full gap-2 px-6">
          <span class="material-symbols-outlined text-[19px]">print</span>
          Print Lab Manual
        </button>
      </div>

      <!-- Print Header -->
      <div class="m3-surface-container-lowest rounded-3xl p-6 border m3-border-subtle">
        <div class="flex flex-wrap justify-between items-start gap-4 border-b m3-border-subtle pb-4">
          <div>
            <div class="text-xs font-mono font-bold uppercase m3-text-primary">Vanilla Web Foundations &middot; Learning the Web with Basics of Vanilla Front-End Tools</div>
            <h2 class="text-2xl font-extrabold mt-1">Practical Laboratory Record</h2>
          </div>
          <div class="text-sm text-right">
            <div><strong>Name:</strong> ${escapeHtml(state.profile?.fullName || 'Not Registered')}</div>
            <div class="font-mono"><strong>Roll No:</strong> ${escapeHtml(state.profile?.rollNo || '—')}</div>
            <div class="text-xs m3-text-muted">Generated: ${escapeHtml(formatDate(new Date().toISOString()))}</div>
          </div>
        </div>

        <h3 class="text-xs font-bold uppercase tracking-wider m3-text-muted mt-4 mb-2">Quiz Scores Summary</h3>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
          ${MODULES.map((m) => {
            const q = quizzes.get(m.id);
            return `
              <div class="m3-surface-container-low rounded-xl p-2.5 border m3-border-subtle text-xs">
                <div class="font-bold">${m.code} Quiz</div>
                <div class="font-mono text-sm font-extrabold m3-text-primary">${q ? q.bestScorePercent + '%' : '—'}</div>
                <div class="text-[10px] m3-text-muted truncate">${q?.completedAt ? formatDate(q.completedAt) : 'Pending'}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- All 8 Practicals -->
      ${LABS.map((lab, idx) => {
        const p = pracs.get(lab.id) || {};
        return `
          <div class="m3-surface-container-lowest rounded-3xl p-6 border m3-border-subtle print-avoid-break ${idx > 0 && idx % 2 === 0 ? 'print-break-before' : ''}">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b m3-border-subtle">
              <div>
                <span class="badge m3-tonal-badge font-mono text-xs">${escapeHtml(lab.code)}</span>
                <h3 class="text-lg font-bold inline ml-2">${escapeHtml(lab.title)}</h3>
                <p class="text-xs m3-text-muted mt-1">${escapeHtml(lab.syllabusRef)}</p>
              </div>
              <div class="text-right text-xs font-mono">
                <div class="font-bold ${p.completed ? 'text-success' : 'opacity-60'}">
                  ${p.completed ? `Completed (${p.passedAssertions}/${p.totalAssertions} checks)` : 'Not Completed'}
                </div>
                <div class="m3-text-muted">${escapeHtml(formatDate(p.completedAt))}</div>
                <div class="m3-text-muted">Time Spent: ${formatDuration(p.activeTypingSeconds || 0)} · Pasted: ${p.pasteCount || 0}</div>
              </div>
            </div>

            <div class="flex flex-col gap-3 mt-4">
              <div class="m3-code-block">
                <div class="m3-code-header"><span>index.html</span></div>
                <pre class="m3-code-pre"><code>${escapeHtml(p.htmlCode || '<!-- Not yet written -->')}</code></pre>
              </div>
              ${p.cssCode ? `
                <div class="m3-code-block">
                  <div class="m3-code-header"><span>style.css</span></div>
                  <pre class="m3-code-pre"><code>${escapeHtml(p.cssCode)}</code></pre>
                </div>
              ` : ''}
              ${p.jsCode ? `
                <div class="m3-code-block">
                  <div class="m3-code-header"><span>app.js</span></div>
                  <pre class="m3-code-pre"><code>${escapeHtml(p.jsCode)}</code></pre>
                </div>
              ` : ''}

              ${p.htmlCode ? `
                <div>
                  <div class="text-xs font-bold uppercase tracking-wider m3-text-muted mb-1.5">Rendered Output</div>
                  <iframe class="w-full h-52 rounded-2xl border m3-border-subtle bg-white manual-preview-frame" data-lab-id="${lab.id}" sandbox="allow-scripts allow-modals" title="Output for ${escapeHtml(lab.code)}"></iframe>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;

  view.querySelectorAll('.manual-preview-frame').forEach((frame) => {
    const p = pracs.get(Number(frame.dataset.labId));
    if (p) {
      frame.srcdoc = composeSrcDoc(p.htmlCode, p.cssCode, p.jsCode);
    }
  });

  document.getElementById('manual-print-btn')?.addEventListener('click', () => window.print());
}
