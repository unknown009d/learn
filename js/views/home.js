/**
 * Home / onboarding view (#/).
 */

import { saveProfile } from '../db.js';
import { MODULES } from '../course-data.js';
import { LABS, getLabsByModule } from '../labs-data.js';
import { escapeHtml, showToast } from '../core/utils.js';
import {
  appState,
  refreshStateFromDB,
  isRegistered,
  isLabCompleted,
  isModuleCompleted,
  countCompletedLessons,
  getModuleGateStatus,
  computeOverallProgress,
  getNextRecommendedRoute,
  PASSING_PERCENT
} from '../core/state.js';
import { openBackupModal } from '../ui/backup-modal.js';
import { renderSidebarAndProgress } from '../ui/sidebar.js';

export function renderHomeView() {
  const view = document.getElementById('app-view');
  const registered = isRegistered();
  const prog = computeOverallProgress();
  const nextRoute = getNextRecommendedRoute();

  view.innerHTML = `
    <section class="max-w-6xl mx-auto flex flex-col gap-6">
      <!-- Course Overview Header -->
      <div class="m3-card rounded-3xl p-6 sm:p-8 border m3-border-subtle">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="max-w-2xl">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="badge m3-primary-container font-semibold px-3 py-2.5">Free course</span>
              <span class="badge m3-tonal-badge font-semibold px-3 py-2.5">Self-Paced Learning</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
              Learn to build for the Web, step by step
            </h1>
            <p class="m3-text-muted mt-2.5 text-sm sm:text-base">
              Start from how websites work and build real pages using HTML, CSS, and JavaScript. Read each short lesson, pass a quick ${PASSING_PERCENT}% quiz, and complete ${LABS.length} hands-on coding labs right in your browser. Finish all modules to download your verified certificate.
            </p>
            ${registered ? `
              <div class="mt-5 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:items-center">
                <a href="${nextRoute}" class="btn btn-primary rounded-full px-6 gap-2 w-full sm:w-auto">
                  <span class="material-symbols-outlined icon-18">play_arrow</span>
                  ${prog.done === prog.totalSteps ? 'View Your Certificate' : 'Continue Course'}
                </a>
                <a href="#/manual" class="btn m3-btn-tonal rounded-full px-6 gap-1.5 w-full sm:w-auto">
                  <span class="material-symbols-outlined icon-18">print</span>
                  Lab Manual
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Progress Summary -->
          <div class="m3-surface-container-low rounded-3xl p-5 border m3-border-subtle min-w-[220px] flex flex-col items-center text-center shrink-0">
            ${!registered ? 
            `
              <span class="material-symbols-outlined codeicon text-primary">code_xml</span>  
            `:
            `
              <div class="radial-progress text-primary font-bold text-xl" style="--value:${prog.percent}; --size:5.25rem; --thickness:7px;" role="progressbar">
                ${prog.percent}%
              </div>
              <div class="font-bold text-sm mt-3">${prog.done} / ${prog.totalSteps} Steps</div>
              <div class="text-xs m3-text-muted mt-0.5">${MODULES.length} Quizzes &middot; ${LABS.length} Coding Labs</div>
            `}
          </div>
        </div>
      </div>

      ${!registered ? `
        <!-- Student Onboarding Gate -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-3 m3-surface-container-lowest rounded-3xl p-6 sm:p-8 border-2 border-primary/40">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-11 h-11 rounded-2xl m3-primary-container flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined icon-24">badge</span>
              </div>
              <div>
                <h2 class="text-xl font-bold">Start Your Course</h2>
                <p class="text-xs m3-text-muted">Enter your details below to unlock Module 1. Your progress saves automatically on this device.</p>
              </div>
            </div>

            <form id="onboarding-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <label class="form-control w-full">
                <span class="label-text font-semibold text-sm mb-1.5">Your Full Name</span>
                <input id="reg-fullname" type="text" required minlength="2" placeholder="e.g., Drubajyoti Debnath" class="input input-bordered rounded-2xl w-full">
              </label>
              <label class="form-control w-full">
                <span class="label-text font-semibold text-sm mb-1.5">Student ID / Roll Number</span>
                <input id="reg-rollno" type="text" required minlength="2" placeholder="e.g., WEB25-014" class="input input-bordered rounded-2xl w-full font-mono">
              </label>
              <div class="sm:col-span-2 flex flex-wrap items-center gap-3 mt-2">
                <button type="submit" class="btn btn-primary rounded-full px-7 gap-2">
                  <span class="material-symbols-outlined icon-18">lock_open</span>
                  Start Learning
                </button>
                <button id="home-open-restore-btn" type="button" class="btn m3-btn-tonal rounded-full gap-2">
                  <span class="material-symbols-outlined icon-18">cloud_sync</span>
                  Already a user?
                </button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- Module Roadmap Cards -->
      <details class="m3-accordion m3-surface-container-lowest border m3-border-subtle rounded-2xl" name="my-accordion-det-1" ${isRegistered()?`open`:``}>
        <summary class="m3-accordion-trigger px-5 py-4 text-lg font-bold">
          <span class="flex items-center gap-3 min-w-0">
            <span class="material-symbols-outlined icon-24 m3-text-primary">route</span>
            <span>${isRegistered() ? 'Course Modules' : 'Get an overview of the course'}</span>
          </span>
          <span class="material-symbols-outlined icon-24 m3-accordion-chevron">expand_more</span>
        </summary>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 m3-accordion-body p-5">
          ${MODULES.map((mod) => {
            const gate = getModuleGateStatus(mod.id);
            const q = appState.quizzes.get(mod.id);
            const labs = getLabsByModule(mod.id);
            const labsDoneCount = labs.filter((l) => isLabCompleted(l.id)).length;
            const modComplete = isModuleCompleted(mod.id);
            const lessonsDone = countCompletedLessons(mod.id);

            return `
              <div class="m3-surface-container-lowest rounded-3xl p-5 border m3-border-subtle flex flex-col justify-between gap-4 ${!gate.unlocked ? 'opacity-75' : ''}">
                <div>
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-11 h-11 rounded-2xl ${modComplete ? 'm3-success-container' : 'm3-surface-container-high'} flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined icon-20">${modComplete ? 'check_circle' : gate.unlocked ? mod.icon : 'lock'}</span>
                      </div>
                      <div class="min-w-0">
                        <span class="text-xs font-mono font-bold uppercase m3-text-primary">${mod.code}</span>
                        <h3 class="font-bold text-base">${escapeHtml(mod.title)}</h3>
                      </div>
                    </div>
                    <span class="badge ${modComplete ? 'badge-success' : gate.unlocked ? 'm3-tonal-badge' : 'badge-ghost'} text-xs font-semibold shrink-0">
                      ${modComplete ? 'Completed' : gate.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p class="text-xs m3-text-muted mt-3">${escapeHtml(mod.summary)}</p>
                </div>
                
                ${!isRegistered() ? ``:
                  `
                    <div class="flex items-center justify-between gap-2 pt-3 border-t m3-border-subtle text-xs">
                      <div class="flex flex-wrap items-center gap-2 min-w-0">
                        <span class="badge badge-outline font-mono">
                          Lessons: ${lessonsDone}/${mod.sections.length}
                        </span>
                        <span class="badge badge-outline font-mono gap-1">
                          Quiz: ${q?.passed ? `${q.bestScorePercent}% <span class="material-symbols-outlined text-sm">check</span>` : q ? `${q.bestScorePercent}%` : 'Pending'}
                        </span>
                        ${labs.length ? `
                          <span class="badge badge-outline font-mono">
                            Labs: ${labsDoneCount}/${labs.length}
                          </span>
                        ` : ''}
                      </div>
                      ${gate.unlocked ? `
                        <a href="#/module/${mod.id}" class="btn btn-sm btn-circle shrink-0" title="Open Module ${mod.id}" aria-label="Open Module ${mod.id}: ${escapeHtml(mod.title)}">
                          <span class="material-symbols-outlined icon-18" aria-hidden="true">arrow_forward</span>
                        </a>
                      ` : `
                        <span class="btn btn-sm btn-circle btn-disabled shrink-0" role="img" title="${escapeHtml(gate.reason)}" aria-label="Locked. ${escapeHtml(gate.reason)}">
                          <span class="material-symbols-outlined icon-18" aria-hidden="true">lock</span>
                        </span>
                      `}
                    </div>
                  `
                }
              </div>
            `;
          }).join('')}
        </div>
      </details>
    </section>
  `;

  document.getElementById('onboarding-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('reg-fullname').value.trim();
    const rollNo = document.getElementById('reg-rollno').value.trim();
    if (!fullName || !rollNo) return;

    await saveProfile({ fullName, rollNo });
    await refreshStateFromDB();
    renderSidebarAndProgress();
    showToast(`Welcome, ${fullName}! Module 1 is ready.`, 'success');
    window.location.hash = '#/module/1';
  });

  document.getElementById('home-open-restore-btn')?.addEventListener('click', () => {
    openBackupModal('load');
  });
}
