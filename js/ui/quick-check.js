/**
 * Per-lesson Quick Check dialog.
 */

import { escapeHtml, shuffleArray } from '../core/utils.js';
import { appState } from '../core/state.js';

export function openQuickCheckModal({ mod, sec, currentStep, totalLessons, isLastLesson, onAdvance }) {
  const modal = document.getElementById('quick-check-modal');
  const mc = sec.microCheck;
  if (!modal || !mc || typeof modal.showModal !== 'function') {
    onAdvance();
    return;
  }

  const metaEl = document.getElementById('qc-lesson-meta');
  const qEl = document.getElementById('qc-question');
  const optsEl = document.getElementById('qc-options');
  const fbEl = document.getElementById('qc-feedback');
  const iconEl = document.getElementById('qc-hero-icon');
  const hintEl = document.getElementById('qc-footer-hint');
  const skipBtn = document.getElementById('qc-skip-btn');
  const continueBtn = document.getElementById('qc-continue-btn');
  const continueLbl = document.getElementById('qc-continue-label');

  if (metaEl) metaEl.textContent = `Module ${mod.id} · Lesson ${currentStep} of ${totalLessons}`;
  if (qEl) qEl.textContent = mc.question;
  if (iconEl) {
    iconEl.textContent = 'quiz';
    iconEl.classList.remove('filled');
  }
  if (hintEl) hintEl.textContent = 'Optional self-check';
  if (fbEl) {
    fbEl.className = 'hidden rounded-2xl px-3.5 py-3 text-xs sm:text-[13px] mt-4 leading-relaxed flex items-start gap-2.5';
    fbEl.innerHTML = '';
  }
  if (continueLbl) continueLbl.textContent = isLastLesson ? 'Take Quiz' : 'Continue';
  skipBtn?.classList.remove('hidden');
  continueBtn?.classList.add('hidden');

  // Fresh order every time the check opens, so the answer's position means nothing.
  const options = shuffleArray(mc.options.map((text, idx) => ({ text, isCorrect: idx === mc.correctIndex })));

  if (optsEl) {
    optsEl.innerHTML = options.map((opt, oIdx) => `
      <button type="button" class="btn h-auto min-h-[46px] py-2.5 px-4 justify-start items-center flex-nowrap whitespace-normal text-left font-normal btn-ghost border m3-border-subtle rounded-2xl gap-3 text-xs sm:text-sm" data-qc-opt="${oIdx}">
        <span class="w-6 h-6 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0" style="background:color-mix(in srgb, currentColor 12%, transparent);">${'ABCD'[oIdx]}</span>
        <span class="min-w-0 break-words leading-snug">${escapeHtml(opt.text)}</span>
      </button>
    `).join('');

    optsEl.querySelectorAll('[data-qc-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = Number(btn.dataset.qcOpt);
        const ok = options[picked].isCorrect;

        optsEl.querySelectorAll('[data-qc-opt]').forEach((b) => {
          const idx = Number(b.dataset.qcOpt);
          b.classList.remove('btn-primary', 'm3-btn-tonal', 'btn-ghost');
          if (idx === picked) {
            b.classList.add(ok ? 'btn-primary' : 'm3-btn-tonal');
          } else {
            b.classList.add('btn-ghost');
          }
        });

        if (fbEl) {
          fbEl.classList.remove('hidden', 'm3-primary-container', 'm3-error-container');
          fbEl.classList.add(ok ? 'm3-primary-container' : 'm3-error-container');
          fbEl.innerHTML = `
            <span class="material-symbols-outlined text-base shrink-0 mt-0.5 filled" aria-hidden="true">${ok ? 'check_circle' : 'error'}</span>
            <span>${ok
              ? `<strong>Correct!</strong> ${escapeHtml(mc.explanation)}`
              : '<strong>Not quite.</strong> Think it through once more and try another option — the explanation unlocks when you get it right.'}</span>
          `;
        }

        if (iconEl) {
          iconEl.textContent = ok ? 'check_circle' : 'quiz';
          iconEl.classList.toggle('filled', ok);
        }

        if (ok) {
          if (hintEl) hintEl.textContent = 'Ready for the next step';
          skipBtn?.classList.add('hidden');
          continueBtn?.classList.remove('hidden');
          continueBtn?.focus();
        } else {
          if (hintEl) hintEl.textContent = 'Try another option or skip';
        }
      });
    });
  }

  let advancing = false;
  const finishAndAdvance = () => {
    if (advancing) return;
    advancing = true;
    if (modal.open) modal.close();
    onAdvance();
  };

  if (skipBtn) skipBtn.onclick = finishAndAdvance;
  if (continueBtn) continueBtn.onclick = finishAndAdvance;

  if (typeof appState.stopLessonAudio === 'function') {
    appState.stopLessonAudio();
  }
  modal.showModal();
}
