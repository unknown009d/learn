/**
 * Graded module quiz (#/quiz/:id).
 *
 * - Questions and their options are shuffled on every attempt (including a page refresh),
 *   so answer positions carry no signal.
 * - A failed attempt shows the score and which questions were missed, but never the right
 *   answers or explanations: those are the reward for passing.
 */

import { saveQuizAttempt } from '../db.js';
import { MODULES, getModuleById } from '../course-data.js';
import { getQuizByModule } from '../quiz-data.js';
import { getLabsByModule } from '../labs-data.js';
import { escapeHtml, scrollViewToTop, showToast, shuffleArray, modKbd, MOD_KEY } from '../core/utils.js';
import { appState, refreshStateFromDB, getQuizGateStatus, PASSING_PERCENT } from '../core/state.js';
import { triggerCheckpointModal } from '../ui/checkpoint-modal.js';
import { renderSidebarAndProgress } from '../ui/sidebar.js';
import { renderLockedView } from './locked.js';
import { prefetchCertificateInBackground } from './certificate.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/** The in-progress attempt. Kept across navigation so half-answered quizzes survive a detour. */
let session = null;

function buildSession(quiz) {
  return {
    moduleId: quiz.moduleId,
    questions: shuffleArray(quiz.questions).map((q) => {
      const options = shuffleArray(q.options.map((text, idx) => ({ text, isCorrect: idx === q.correctIndex })));
      return { ...q, options, correctIndex: options.findIndex((o) => o.isCorrect) };
    }),
    answers: new Map(),
    result: null
  };
}

function describeUnlock(mod) {
  const labs = getLabsByModule(mod.id);
  if (labs.length) return `${labs.map((l) => l.code).join(', ')} ${labs.length === 1 ? 'is' : 'are'} now unlocked.`;
  const next = MODULES[MODULES.findIndex((m) => m.id === mod.id) + 1];
  return next ? `Module ${next.id} is now unlocked.` : 'Finish any remaining labs to unlock your Certificate of Completion.';
}

function nextStepAfterPass(mod) {
  const labs = getLabsByModule(mod.id);
  if (labs.length) return { href: `#/lab/${labs[0].id}`, label: `Start ${labs[0].code}`, icon: 'arrow_forward' };
  const next = MODULES[MODULES.findIndex((m) => m.id === mod.id) + 1];
  if (next) return { href: `#/module/${next.id}`, label: `Continue to Module ${next.id}`, icon: 'arrow_forward' };
  return { href: '#/certificate', label: 'View Your Certificate', icon: 'workspace_premium' };
}

export function renderQuizView(moduleId) {
  const mod = getModuleById(moduleId);
  const quiz = getQuizByModule(moduleId);
  if (!mod || !quiz) {
    renderLockedView('Quiz', 'Quiz not found.', '#/');
    return;
  }
  const gate = getQuizGateStatus(mod.id);
  if (!gate.unlocked) {
    renderLockedView(`Module ${mod.id} Quiz`, gate.reason, gate.targetHash || '#/');
    return;
  }

  if (!session || session.moduleId !== mod.id) session = buildSession(quiz);
  drawQuiz(mod, quiz);
}

function renderResultBanner(mod, result) {
  const next = nextStepAfterPass(mod);
  const missed = result.total - result.correctCount;
  return `
    <div class="rounded-3xl p-6 border-2 ${result.passed ? 'border-success m3-success-container' : 'border-error m3-error-container'}">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <span class="material-symbols-outlined text-[38px]" aria-hidden="true">${result.passed ? 'celebration' : 'error_outline'}</span>
          <div>
            <h2 class="text-xl font-extrabold">
              Score: ${result.correctCount}/${result.total} (${result.scorePercent}%) — ${result.passed ? 'Quiz Passed!' : `Need ${PASSING_PERCENT}% or Higher to Pass`}
            </h2>
            <p class="text-sm opacity-90 mt-0.5">
              ${result.passed
                ? `Great job! ${describeUnlock(mod)} Review the explanations below.`
                : `You missed ${missed} question${missed === 1 ? '' : 's'}. Revisit the lessons on those topics, then try again — the questions and options reshuffle every attempt.`}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${result.passed ? `
            <a id="quiz-continue-btn" href="${next.href}" class="btn btn-primary rounded-full px-5 gap-1.5" title="${next.label} (${MOD_KEY}+Enter)">
              <span>${next.label}</span>
              ${modKbd()}
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">${next.icon}</span>
            </a>
          ` : `
            <a href="#/module/${mod.id}/lesson/1" class="btn m3-btn-tonal rounded-full px-5 gap-1.5">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">menu_book</span>
              Review Lessons
            </a>
            <button id="retake-quiz-btn" type="button" class="btn btn-primary rounded-full px-5 gap-1.5" title="Try Quiz Again (${MOD_KEY}+Enter)">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">shuffle</span>
              Try Quiz Again
              ${modKbd()}
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderQuestion(q, qIdx, chosen, result) {
  const reveal = Boolean(result?.passed);
  const isCorrect = result && chosen === q.correctIndex;
  return `
    <div class="m3-surface-container-lowest rounded-3xl p-5 sm:p-6 border m3-border-subtle" data-quiz-card data-question-id="${escapeHtml(String(q.id))}">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-bold text-base leading-snug">
          <span class="m3-text-primary font-mono mr-1.5">Q${qIdx + 1}.</span>
          ${escapeHtml(q.question)}
        </h3>
        <span class="m3-quiz-unanswered-note">Answer this question</span>
        ${result ? `<span class="badge ${isCorrect ? 'badge-success' : 'badge-error'} shrink-0">${isCorrect ? 'Correct' : 'Missed'}</span>` : ''}
      </div>

      ${q.code ? `
        <div class="m3-code-block mt-3">
          <pre class="m3-code-pre"><code>${escapeHtml(q.code)}</code></pre>
        </div>
      ` : ''}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
        ${q.options.map((opt, optIdx) => {
          const selected = chosen === optIdx;
          let stateClass = selected ? 'is-selected' : '';
          if (result) {
            if (reveal && optIdx === q.correctIndex) stateClass = 'is-correct';
            else if (selected) stateClass = optIdx === q.correctIndex ? 'is-correct' : 'is-wrong';
          }
          return `
            <label class="m3-quiz-option ${stateClass}">
              <input type="radio" name="q_${q.id}" value="${optIdx}" ${selected ? 'checked' : ''} ${result ? 'disabled' : ''} class="radio radio-primary radio-sm mt-0.5 shrink-0">
              <span class="text-sm leading-snug">
                <strong class="font-mono mr-1">${LETTERS[optIdx]}.</strong> ${escapeHtml(opt.text)}
              </span>
            </label>
          `;
        }).join('')}
      </div>

      ${reveal ? `
        <div class="mt-3 p-3 rounded-2xl m3-surface-container text-xs sm:text-sm border m3-border-subtle flex gap-2 items-start">
          <span class="material-symbols-outlined text-[18px] ${isCorrect ? 'm3-text-primary' : 'text-error'} shrink-0 mt-0.5" aria-hidden="true">lightbulb</span>
          <div><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function drawQuiz(mod, quiz) {
  const prevRecord = appState.quizzes.get(mod.id);
  const { result } = session;
  const view = document.getElementById('app-view');

  view.innerHTML = `
    <section class="flex flex-col gap-5 max-w-4xl mx-auto" data-protected-content>
      <div class="m3-card rounded-3xl p-6 border m3-border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <a href="#/module/${mod.id}" class="btn btn-xs btn-ghost rounded-full gap-1 pl-1">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
              Module ${mod.id} Notes
            </a>
            <span class="badge m3-tonal-badge font-mono text-xs">Passing Score: &ge; ${PASSING_PERCENT}%</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-extrabold">${escapeHtml(quiz.title)}</h1>
          <p class="text-xs m3-text-muted mt-1">
            ${quiz.questions.length} Active-Recall Questions · Best Score: <strong>${prevRecord ? `${prevRecord.bestScorePercent}%` : 'Not attempted'}</strong> · Attempts: <strong>${prevRecord ? prevRecord.attempts : 0}</strong>
          </p>
        </div>
        ${prevRecord?.passed ? `
          <span class="badge badge-success badge-lg rounded-full gap-1.5 px-4 font-bold">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">verified</span>
            Passed (${prevRecord.bestScorePercent}%)
          </span>
        ` : ''}
      </div>

      ${result ? renderResultBanner(mod, result) : ''}

      <form id="quiz-form" class="flex flex-col gap-4">
        ${session.questions.map((q, idx) => renderQuestion(q, idx, session.answers.get(q.id), result)).join('')}

        <div class="m3-quiz-mobile-bar flex justify-end gap-3 mt-2">
          ${!result ? `
            <button type="submit" class="btn btn-primary rounded-full px-8 gap-2" title="Submit Quiz (${MOD_KEY}+Enter)">
              <span class="material-symbols-outlined" aria-hidden="true">task_alt</span>
              <span>Submit Quiz</span>
              ${modKbd()}
            </button>
          ` : `
            <button id="retake-quiz-bottom-btn" type="button" class="btn m3-btn-tonal rounded-full px-6 gap-2">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">shuffle</span>
              Retake Quiz
            </button>
          `}
        </div>
      </form>
    </section>
  `;

  view.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      session.answers.set(e.target.name.slice(2), Number(e.target.value));
      e.target.closest('[data-quiz-card]')?.classList.remove('is-unanswered');
      e.target.closest('[data-quiz-card]')?.querySelectorAll('.m3-quiz-option').forEach((lbl) => {
        lbl.classList.toggle('is-selected', Boolean(lbl.querySelector('input')?.checked));
      });
    });
  });

  document.getElementById('quiz-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuiz(mod, quiz);
  });

  const retake = () => {
    session = buildSession(quiz);
    drawQuiz(mod, quiz);
    scrollViewToTop();
  };
  document.getElementById('retake-quiz-btn')?.addEventListener('click', retake);
  document.getElementById('retake-quiz-bottom-btn')?.addEventListener('click', retake);

  appState.shortcutContext = {
    onRunAdvance: () => {
      if (!session.result) {
        document.getElementById('quiz-form')?.requestSubmit();
      } else if (session.result.passed) {
        const nextLink = document.getElementById('quiz-continue-btn');
        if (nextLink) window.location.hash = nextLink.getAttribute('href') || '#/';
      } else {
        retake();
      }
    }
  };
}

/** Outline every unanswered question and bring the first one into view. */
function flagUnansweredQuestions() {
  let first = null;
  document.querySelectorAll('[data-quiz-card]').forEach((card) => {
    const missing = !session.answers.has(card.dataset.questionId);
    card.classList.remove('is-unanswered');
    if (!missing) return;
    void card.offsetWidth; // restart the attention pulse on repeat submits
    card.classList.add('is-unanswered');
    if (!first) first = card;
  });
  if (!first) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  first.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  first.querySelector('input[type="radio"]')?.focus({ preventScroll: true });
}

async function submitQuiz(mod, quiz) {
  const total = session.questions.length;
  if (session.answers.size < total) {
    flagUnansweredQuestions();
    const missing = total - session.answers.size;
    showToast(`${missing} question${missing === 1 ? '' : 's'} still unanswered — highlighted for you.`, 'error');
    return;
  }

  const correctCount = session.questions.filter((q) => session.answers.get(q.id) === q.correctIndex).length;
  const scorePercent = Math.round((correctCount / total) * 100);
  const passed = scorePercent >= (quiz.passingPercent ?? PASSING_PERCENT);

  await saveQuizAttempt(mod.id, scorePercent, passed);
  await refreshStateFromDB();
  renderSidebarAndProgress();
  if (passed) prefetchCertificateInBackground();

  session.result = { correctCount, total, scorePercent, passed };
  drawQuiz(mod, quiz);
  scrollViewToTop();

  if (passed) {
    await triggerCheckpointModal({
      title: `Module ${mod.id} Quiz Passed`,
      description: describeUnlock(mod),
      code: `M${mod.id}_Quiz`,
      statValue: `${scorePercent}%`,
      statLabel: 'Quiz Score'
    });
  }
}
