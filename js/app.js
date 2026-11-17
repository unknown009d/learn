/**
 * Vanilla Web Foundations — Learning the Web with Basics of Vanilla Front-End Tools (druba.in)
 * Hash Router, Sequential Mastery Gating, Quiz Engine, Certificate,
 * Printable Lab Manual, Checkpoint Backups & Key Inspector.
 */

import {
  getProfile,
  saveProfile,
  getAllQuizzes,
  saveQuizAttempt,
  getPractical,
  getAllPracticals,
  exportFullState,
  importFullState,
  clearAllData
} from './db.js';
import { MODULES, BONUS_MODULE, getModuleById } from './course-data.js';
import { getQuizByModule } from './quiz-data.js';
import { LABS, getLabById, getLabsByModule } from './labs-data.js';
import { LabIDEController, composeSrcDoc } from './ide.js';
import {
  generateCompletionKey,
  verifyCompletionKey,
  generateCompactQrToken,
  verifyCompactQrToken,
  encodeBackupToken,
  decodeBackupToken,
  generateDemoKey
} from './crypto-key.js';

const THEME_STORAGE_KEY = 'druba_web_theme';
const RAIL_STORAGE_KEY = 'druba_web_rail_collapsed';
const SPLITS_STORAGE_KEY = 'druba_web_pane_splits';

const appState = {
  profile: null,
  quizzes: new Map(),
  practicals: new Map(),
  activeIDE: null,
  cleanupSplitResizers: null,
  quizSession: null // holds shuffled quiz state during active attempt
};

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
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

function formatDuration(sec) {
  const s = Number(sec || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
}

function showToast(message, type = 'info') {
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

async function copyToClipboard(text, label = 'Copied to clipboard!') {
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

function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ============================================================================
// State Loading & Sequential Mastery Gating
// ============================================================================

async function refreshStateFromDB() {
  const [profile, quizzes, practicals] = await Promise.all([
    getProfile(),
    getAllQuizzes(),
    getAllPracticals()
  ]);
  appState.profile = profile;
  appState.quizzes = new Map(quizzes.map((q) => [Number(q.moduleId), q]));
  appState.practicals = new Map(practicals.map((p) => [Number(p.labId), p]));
}

function isRegistered() {
  return Boolean(appState.profile && appState.profile.fullName && appState.profile.rollNo);
}

function isQuizPassed(moduleId) {
  return Boolean(appState.quizzes.get(Number(moduleId))?.passed);
}

function isLabCompleted(labId) {
  return Boolean(appState.practicals.get(Number(labId))?.completed);
}

function areModuleLabsCompleted(moduleId) {
  const mod = getModuleById(moduleId);
  if (!mod || !mod.labIds.length) return true;
  return mod.labIds.every((id) => isLabCompleted(id));
}

function getModuleGateStatus(moduleId) {
  if (!isRegistered()) {
    return { unlocked: false, reason: 'Enter your full name and ID on the Home page to start Module 1.' };
  }
  const id = Number(moduleId);
  if (id === 1) return { unlocked: true, reason: '' };

  if (id === 2) {
    if (!isQuizPassed(1)) {
      return { unlocked: false, reason: 'Pass the Module 1 Quiz (60% or higher) to unlock Module 2.', targetHash: '#/quiz/1' };
    }
    return { unlocked: true, reason: '' };
  }

  if (id === 3) {
    if (!isQuizPassed(2)) {
      return { unlocked: false, reason: 'Pass the Module 2 Quiz (60% or higher) first.', targetHash: '#/quiz/2' };
    }
    if (!areModuleLabsCompleted(2)) {
      return { unlocked: false, reason: 'Finish Labs 1, 2, and 3 in Module 2 to unlock Module 3.', targetHash: '#/lab/1' };
    }
    return { unlocked: true, reason: '' };
  }

  if (id === 4) {
    if (!isQuizPassed(3)) {
      return { unlocked: false, reason: 'Pass the Module 3 Quiz (60% or higher) first.', targetHash: '#/quiz/3' };
    }
    if (!areModuleLabsCompleted(3)) {
      return { unlocked: false, reason: 'Finish Labs 5 and 6 in Module 3 to unlock Module 4.', targetHash: '#/lab/5' };
    }
    return { unlocked: true, reason: '' };
  }

  if (id === 5) {
    if (!isQuizPassed(4)) {
      return { unlocked: false, reason: 'Pass the Module 4 Quiz (60% or higher) first.', targetHash: '#/quiz/4' };
    }
    if (!areModuleLabsCompleted(4)) {
      return { unlocked: false, reason: 'Finish Labs 4, 7, and 8 in Module 4 to unlock Module 5.', targetHash: '#/lab/4' };
    }
    return { unlocked: true, reason: '' };
  }

  return { unlocked: false, reason: 'Module not found.' };
}

function getLabGateStatus(labId) {
  const lab = getLabById(labId);
  if (!lab) return { unlocked: false, reason: 'Lab not found.' };
  const modGate = getModuleGateStatus(lab.moduleId);
  if (!modGate.unlocked) return modGate;
  if (!isQuizPassed(lab.moduleId)) {
    return {
      unlocked: false,
      reason: `Pass the Module ${lab.moduleId} Quiz (60% or higher) to unlock ${lab.code}.`,
      targetHash: `#/quiz/${lab.moduleId}`
    };
  }
  return { unlocked: true, reason: '' };
}

function isCertificateUnlocked() {
  if (!isRegistered()) return false;
  const allQuizzesOk = [1, 2, 3, 4, 5].every((id) => isQuizPassed(id));
  const allLabsOk = LABS.every((l) => isLabCompleted(l.id));
  return allQuizzesOk && allLabsOk;
}

function computeOverallProgress() {
  const totalSteps = 5 + LABS.length; // 5 quizzes + 8 practicals = 13 milestones
  let done = 0;
  for (let m = 1; m <= 5; m++) {
    if (isQuizPassed(m)) done += 1;
  }
  for (const l of LABS) {
    if (isLabCompleted(l.id)) done += 1;
  }
  return { done, totalSteps, percent: Math.round((done / totalSteps) * 100) };
}

function getNextRecommendedRoute() {
  if (!isRegistered()) return '#/';
  for (const mod of MODULES) {
    if (!isQuizPassed(mod.id)) return `#/module/${mod.id}`;
    for (const lid of mod.labIds) {
      if (!isLabCompleted(lid)) return `#/lab/${lid}`;
    }
  }
  return '#/certificate';
}

// ============================================================================
// Theme Management
// ============================================================================

function applyTheme(theme) {
  const normalized = theme === 'm3-dark' ? 'm3-dark' : 'm3-light';
  document.documentElement.setAttribute('data-theme', normalized);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {}
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.textContent = normalized === 'm3-dark' ? 'light_mode' : 'dark_mode';
  }
  if (appState.activeIDE) {
    appState.activeIDE.syncTheme();
  }
}

function initTheme() {
  let saved = 'm3-light';
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY) || 'm3-light';
  } catch {}
  applyTheme(saved);
}

// ============================================================================
// Checkpoint Saved Modal & Backup Modal
// ============================================================================

async function triggerCheckpointModal(title, _description, moduleCode = 'M1') {
  const modal = document.getElementById('checkpoint-modal');
  if (!modal) return;

  const fullState = await exportFullState();
  const token = await encodeBackupToken(fullState);
  const safeRoll = (fullState.profile?.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeRoll}_druba-web_${moduleCode}.json`;

  const badgeEl = document.getElementById('checkpoint-modal-badge');
  if (badgeEl) badgeEl.textContent = title || 'Progress Saved';
  document.getElementById('checkpoint-modal-title').textContent = 'Module Complete — Save a Copy of Your Progress';
  document.getElementById('checkpoint-modal-desc').textContent =
    'Your work is saved in this browser, but downloading a backup file lets you restore your progress if you switch computers or clear your browser data.';
  document.getElementById('checkpoint-token-preview').value = token;
  document.getElementById('checkpoint-filename-badge').textContent = filename;
  document.getElementById('checkpoint-download-name').textContent = filename;

  const copyBtn = document.getElementById('checkpoint-copy-token-btn');
  copyBtn.onclick = () => copyToClipboard(token, 'Backup text copied! Save it in your notes or messages.');

  const dlBtn = document.getElementById('checkpoint-download-btn');
  dlBtn.onclick = () => {
    downloadFile(filename, JSON.stringify(fullState, null, 2));
    showToast(`Downloaded ${filename}`, 'success');
  };

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  }
}

function bindGlobalModals() {
  const backupModal = document.getElementById('backup-modal');
  const openBtn = document.getElementById('open-backup-btn');
  if (openBtn && backupModal) {
    openBtn.addEventListener('click', () => {
      if (typeof backupModal.showModal === 'function') backupModal.showModal();
    });
  }

  document.getElementById('modal-export-json-btn')?.addEventListener('click', async () => {
    const state = await exportFullState();
    const safeRoll = (state.profile?.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(`${safeRoll}_druba-web_checkpoint.json`, JSON.stringify(state, null, 2));
    showToast('Saved progress file downloaded!', 'success');
  });

  document.getElementById('modal-copy-token-btn')?.addEventListener('click', async () => {
    const state = await exportFullState();
    const token = await encodeBackupToken(state);
    await copyToClipboard(token, 'Backup text copied!');
  });

  document.getElementById('modal-restore-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      document.getElementById('modal-restore-token').value = text;
      showToast('Saved progress file loaded. Click "Load Saved Progress" to continue.', 'info');
    } catch (err) {
      showToast('Could not read file: ' + err.message, 'error');
    }
  });

  document.getElementById('modal-restore-btn')?.addEventListener('click', async () => {
    const raw = document.getElementById('modal-restore-token')?.value || '';
    try {
      const parsed = await decodeBackupToken(raw);
      await importFullState(parsed);
      await refreshStateFromDB();
      renderSidebarAndProgress();
      backupModal?.close();
      showToast(`Welcome back, ${parsed.profile.fullName}! Your progress is loaded.`, 'success');
      handleRoute();
    } catch (err) {
      showToast('Could not load saved progress: ' + err.message, 'error');
    }
  });

  document.getElementById('modal-reset-progress-btn')?.addEventListener('click', async () => {
    if (!confirm('Clear all saved progress from this browser? Download a saved progress file first if you want a backup.')) return;
    await clearAllData();
    await refreshStateFromDB();
    renderSidebarAndProgress();
    backupModal?.close();
    window.location.hash = '#/';
    handleRoute();
    showToast('Saved progress cleared.', 'info');
  });
}

// ============================================================================
// Shrinkable Navigation Rail & Sidebar Progress Chrome
// ============================================================================

function setRailCollapsed(collapsed) {
  const drawer = document.getElementById('nav-drawer');
  const icon = document.getElementById('rail-toggle-icon');
  if (drawer) {
    drawer.classList.toggle('is-rail-collapsed', collapsed);
  }
  if (icon) {
    icon.textContent = collapsed ? 'menu_open' : 'dock_to_left';
  }
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, collapsed ? 'true' : 'false');
  } catch {}
  if (appState.activeIDE) {
    setTimeout(() => appState.activeIDE?.refreshEditors(), 215);
  }
}

function initRailState() {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(RAIL_STORAGE_KEY) === 'true';
  } catch {}
  setRailCollapsed(collapsed);

  const drawer = document.getElementById('nav-drawer');
  drawer?.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'width') {
      appState.activeIDE?.refreshEditors();
    }
  });

  document.getElementById('rail-toggle-btn')?.addEventListener('click', () => {
    const isCurrentlyCollapsed = drawer?.classList.contains('is-rail-collapsed');
    setRailCollapsed(!isCurrentlyCollapsed);
  });
}

function renderSidebarAndProgress() {
  const prog = computeOverallProgress();
  const navBar = document.getElementById('nav-progress-bar');
  const navLbl = document.getElementById('nav-progress-label');
  if (navBar) navBar.value = prog.percent;
  if (navLbl) navLbl.textContent = `${prog.done}/${prog.totalSteps} (${prog.percent}%)`;

  const profileCard = document.getElementById('sidebar-profile-card');
  if (profileCard) {
    if (isRegistered()) {
      const initial = escapeHtml(appState.profile.fullName.charAt(0).toUpperCase());
      profileCard.innerHTML = `
        <div class="rail-expanded-only p-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-full m3-primary-container flex items-center justify-center font-bold text-sm shrink-0">
              ${initial}
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm truncate">${escapeHtml(appState.profile.fullName)}</div>
              <div class="text-xs font-mono m3-text-muted truncate">${escapeHtml(appState.profile.rollNo)}</div>
            </div>
            <a href="#/" class="btn btn-xs btn-ghost btn-circle shrink-0" title="Course Overview">
              <span class="material-symbols-outlined icon-18">home</span>
            </a>
          </div>
          <div class="mt-2.5">
            <div class="flex justify-between text-[11px] font-semibold mb-1">
              <span>Mastery</span>
              <span class="font-mono">${prog.percent}%</span>
            </div>
            <progress class="progress progress-primary h-1.5 w-full" value="${prog.percent}" max="100"></progress>
          </div>
        </div>
        <div class="rail-collapsed-only p-1.5 justify-center">
          <a href="#/" class="w-9 h-9 rounded-full m3-primary-container flex items-center justify-center font-bold text-sm" title="${escapeHtml(appState.profile.fullName)} (${escapeHtml(appState.profile.rollNo)})">
            ${initial}
          </a>
        </div>
      `;
    } else {
      profileCard.innerHTML = `
        <div class="rail-expanded-only p-3">
          <div class="flex items-center gap-2 text-sm font-semibold">
            <span class="material-symbols-outlined icon-20 m3-text-primary">person_add</span>
            <span>Start Your Course</span>
          </div>
          <p class="text-xs m3-text-muted mt-1">Enter your name and ID to unlock Module 1.</p>
          <a href="#/" class="btn btn-xs btn-primary rounded-full mt-2.5 w-full">Start Learning</a>
        </div>
        <div class="rail-collapsed-only p-1.5 justify-center">
          <a href="#/" class="btn btn-sm btn-ghost btn-circle" title="Start Your Course">
            <span class="material-symbols-outlined icon-20 m3-text-primary">person_add</span>
          </a>
        </div>
      `;
    }
  }

  const navEl = document.getElementById('sidebar-nav');
  if (!navEl) return;

  const currentHash = (window.location.hash || '#/').split('?')[0];
  let html = '';

  for (const mod of MODULES) {
    const gate = getModuleGateStatus(mod.id);
    const quizPassed = isQuizPassed(mod.id);
    const labsDone = areModuleLabsCompleted(mod.id);
    const modComplete = quizPassed && labsDone;
    const modHash = `#/module/${mod.id}`;
    const quizHash = `#/quiz/${mod.id}`;
    const isAnyInModActive =
      currentHash === modHash ||
      currentHash === quizHash ||
      mod.labIds.some((lid) => currentHash === `#/lab/${lid}`);

    html += `
      <!-- Expanded Drawer Module Block -->
      <div class="rail-expanded-only rounded-2xl p-2 ${gate.unlocked ? 'm3-surface-container' : 'm3-surface-container-low opacity-75'} border m3-border-subtle">
        <a href="${modHash}" class="m3-nav-item ${currentHash === modHash ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-sm">
          <span class="material-symbols-outlined icon-20 mt-0.5 shrink-0 ${modComplete ? 'filled m3-text-primary' : ''}">
            ${modComplete ? 'check_circle' : gate.unlocked ? mod.icon : 'lock'}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-1">
              <span class="font-bold text-[11px] font-mono tracking-wide uppercase opacity-75">${mod.code}</span>
              ${!gate.unlocked ? '<span class="badge badge-xs">Locked</span>' : ''}
            </div>
            <div class="font-semibold text-[13px] rail-module-title">${escapeHtml(mod.title)}</div>
          </div>
        </a>

        <div class="mt-1.5 pl-3 flex flex-col gap-1 border-l-2 m3-border-subtle ml-4">
          <a href="${quizHash}" class="m3-nav-item ${currentHash === quizHash ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex items-center justify-between px-2.5 py-1.5 rounded-full text-xs gap-2">
            <span class="flex items-center gap-1.5 min-w-0">
              <span class="material-symbols-outlined icon-18 shrink-0">quiz</span>
              <span class="truncate">Graded Quiz</span>
            </span>
            ${quizPassed
              ? `<span class="badge badge-xs badge-success font-mono shrink-0">${appState.quizzes.get(mod.id).bestScorePercent}%</span>`
              : `<span class="text-[10px] font-mono opacity-70 shrink-0">&ge;60%</span>`
            }
          </a>
    `;

    for (const lid of mod.labIds) {
      const lab = getLabById(lid);
      const labGate = getLabGateStatus(lid);
      const labDone = isLabCompleted(lid);
      const labHash = `#/lab/${lid}`;
      html += `
          <a href="${labHash}" class="m3-nav-item ${currentHash === labHash ? 'is-active' : ''} ${!labGate.unlocked ? 'is-locked' : ''} flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs min-w-0" title="${escapeHtml(lab.code)}: ${escapeHtml(lab.title)}">
            <span class="material-symbols-outlined icon-18 shrink-0 ${labDone ? 'm3-text-primary' : ''}">${labDone ? 'check_circle' : labGate.unlocked ? 'code' : 'lock'}</span>
            <span class="truncate">${escapeHtml(lab.code)}: ${escapeHtml(lab.title)}</span>
          </a>
      `;
    }

    html += `</div></div>`;

    // Collapsed M3 Rail Item
    html += `
      <a href="${modHash}" class="rail-collapsed-only m3-nav-item ${isAnyInModActive ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex-col items-center justify-center py-2 px-1 rounded-2xl border m3-border-subtle gap-0.5" title="${mod.code}: ${escapeHtml(mod.title)}">
        <span class="material-symbols-outlined icon-20 ${modComplete ? 'filled m3-text-primary' : ''}">
          ${modComplete ? 'check_circle' : gate.unlocked ? mod.icon : 'lock'}
        </span>
        <span class="text-[10px] font-mono font-bold leading-none">${mod.code}</span>
      </a>
    `;
  }

  const certUnlocked = isCertificateUnlocked();
  html += `
    <div class="mt-1 flex flex-col gap-1">
      <a href="#/certificate" class="m3-nav-item rail-link ${currentHash === '#/certificate' ? 'is-active' : ''} ${!certUnlocked ? 'is-locked' : ''} flex items-center gap-2.5 px-2.5 py-2 rounded-2xl border m3-border-subtle text-sm font-semibold" title="Certificate">
        <span class="material-symbols-outlined icon-20 shrink-0">${certUnlocked ? 'workspace_premium' : 'lock'}</span>
        <span class="rail-expanded-only truncate">Certificate</span>
      </a>
      <a href="#/manual" class="m3-nav-item rail-link ${currentHash === '#/manual' ? 'is-active' : ''} flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm font-medium" title="Printable Lab Manual">
        <span class="material-symbols-outlined icon-20 shrink-0">menu_book</span>
        <span class="rail-expanded-only truncate">Lab Manual</span>
      </a>
      <a href="#/verify" class="m3-nav-item rail-link ${currentHash === '#/verify' ? 'is-active' : ''} flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm font-medium" title="Check Certificate">
        <span class="material-symbols-outlined icon-20 shrink-0">verified_user</span>
        <span class="rail-expanded-only truncate">Check Certificate</span>
      </a>
    </div>
  `;

  navEl.innerHTML = html;
}

// ============================================================================
// View Renderers
// ============================================================================

function renderLockedView(title, reason, targetHash = '#/') {
  const view = document.getElementById('app-view');
  view.innerHTML = `
    <div class="max-w-xl mx-auto mt-8 m3-card rounded-3xl p-6 sm:p-8 border m3-border-subtle text-center">
      <div class="w-14 h-14 rounded-2xl m3-error-container mx-auto flex items-center justify-center mb-4">
        <span class="material-symbols-outlined icon-24">lock</span>
      </div>
      <span class="badge m3-tonal-badge font-semibold mb-2">Step Locked</span>
      <h1 class="text-2xl font-bold">${escapeHtml(title)} is Locked</h1>
      <p class="m3-text-muted mt-2 text-sm sm:text-base">${escapeHtml(reason)}</p>
      <div class="mt-6 flex flex-wrap gap-3 justify-center">
        <a href="${targetHash}" class="btn btn-primary rounded-full px-6 gap-2">
          <span class="material-symbols-outlined icon-18">arrow_forward</span>
          Go to Current Step
        </a>
        <a href="#/" class="btn m3-btn-tonal rounded-full px-5">Course Overview</a>
      </div>
    </div>
  `;
}

function renderHomeView() {
  const view = document.getElementById('app-view');
  const registered = isRegistered();
  const prog = computeOverallProgress();
  const nextRoute = getNextRecommendedRoute();

  view.innerHTML = `
    <section class="max-w-6xl mx-auto flex flex-col gap-6">
      <!-- Course Overview Header -->
      <div class="m3-card rounded-3xl p-6 sm:p-8 border m3-border-subtle">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div class="max-w-2xl">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="badge m3-primary-container font-mono font-bold px-3 py-2.5">Vanilla Web Foundations</span>
              <span class="badge m3-tonal-badge font-medium px-3 py-2.5">Self-Paced Track</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
              Learn to Build for the Web, Step by Step
            </h1>
            <p class="m3-text-muted mt-2.5 text-sm sm:text-base">
              Start from how websites work and build real pages using HTML, CSS, and JavaScript. Read each short lesson, pass a quick 60% quiz, and complete 8 hands-on coding labs right in your browser—no setup required. Finish all modules to download your verified certificate.
            </p>
            ${registered ? `
              <div class="mt-5 flex flex-wrap gap-3 items-center">
                <a href="${nextRoute}" class="btn btn-primary rounded-full px-6 gap-2">
                  <span class="material-symbols-outlined icon-18">play_arrow</span>
                  ${prog.done === prog.totalSteps ? 'View Your Certificate' : 'Continue Course'}
                </a>
                <a href="#/manual" class="btn m3-btn-tonal rounded-full gap-1.5">
                  <span class="material-symbols-outlined icon-18">print</span>
                  Lab Manual
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Progress Summary -->
          <div class="m3-surface-container-low rounded-3xl p-5 border m3-border-subtle min-w-[220px] flex flex-col items-center text-center shrink-0">
            <div class="radial-progress text-primary font-bold text-xl" style="--value:${prog.percent}; --size:5.25rem; --thickness:7px;" role="progressbar">
              ${prog.percent}%
            </div>
            <div class="font-bold text-sm mt-3">${prog.done} / ${prog.totalSteps} Steps</div>
            <div class="text-xs m3-text-muted mt-0.5">5 Quizzes &middot; 8 Coding Labs</div>
          </div>
        </div>
      </div>

      ${!registered ? `
        <!-- Student Onboarding Gate -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 m3-surface-container-lowest rounded-3xl p-6 sm:p-8 border-2 border-primary/40">
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
                <input id="reg-fullname" type="text" required minlength="2" placeholder="e.g., Ananya Das" class="input input-bordered rounded-2xl w-full">
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
              </div>
            </form>
          </div>

          <div class="m3-card rounded-3xl p-6 border m3-border-subtle flex flex-col justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 font-bold text-base">
                <span class="material-symbols-outlined icon-20 m3-text-primary">settings_backup_restore</span>
                Switching Devices?
              </div>
              <p class="text-xs m3-text-muted mt-2">
                Already started on another computer or phone? Upload your saved progress file (<code class="font-mono">.json</code>) or paste your backup code to pick up right where you left off.
              </p>
            </div>
            <button id="home-open-restore-btn" type="button" class="btn m3-btn-tonal rounded-full gap-2 w-full">
              <span class="material-symbols-outlined icon-18">cloud_sync</span>
              Load Saved Progress
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Module Roadmap Cards -->
      <div>
        <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined icon-24 m3-text-primary">route</span>
          Course Modules
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${MODULES.map((mod) => {
            const gate = getModuleGateStatus(mod.id);
            const q = appState.quizzes.get(mod.id);
            const labs = getLabsByModule(mod.id);
            const labsDoneCount = labs.filter((l) => isLabCompleted(l.id)).length;
            const modComplete = Boolean(q?.passed) && labsDoneCount === labs.length;

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

                <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t m3-border-subtle text-xs">
                  <div class="flex items-center gap-2">
                    <span class="badge badge-outline font-mono gap-1">
                      Quiz: ${q?.passed ? `${q.bestScorePercent}% <span class="material-symbols-outlined" style="font-size:14px">check</span>` : q ? `${q.bestScorePercent}%` : 'Pending'}
                    </span>
                    ${labs.length ? `
                      <span class="badge badge-outline font-mono">
                        Labs: ${labsDoneCount}/${labs.length}
                      </span>
                    ` : ''}
                  </div>
                  ${gate.unlocked ? `
                    <a href="#/module/${mod.id}" class="btn btn-xs btn-primary rounded-full px-3.5">
                      Open Module
                    </a>
                  ` : `
                    <span class="text-[11px] m3-text-muted">Complete the previous module to unlock</span>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
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
    document.getElementById('backup-modal')?.showModal();
  });
}

// ============================================================================
// Module Lesson View + Interactive Widgets
// ============================================================================

function renderLessonWidgetHtml(widgetType) {
  if (widgetType === 'url-anatomy') {
    return `
      <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle mt-4" data-widget="url-anatomy">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider m3-text-primary mb-2">
          <span class="material-symbols-outlined text-[17px]">science</span>
          Interactive URL Dissector
        </div>
        <input type="text" class="url-input input input-sm input-bordered w-full font-mono text-xs rounded-full mb-3"
          value="https://www.example.in/courses/web-design.html?batch=morning#fees">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs url-parts"></div>
      </div>
    `;
  }

  if (widgetType === 'http-cycle') {
    return `
      <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle mt-4" data-widget="http-cycle">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider m3-text-primary">
            <span class="material-symbols-outlined text-[17px]">swap_horiz</span>
            Interactive Request / Response Simulator
          </div>
          <div class="flex gap-1.5">
            <button type="button" class="btn btn-xs btn-primary rounded-full" data-http-url="/index.html">Request /index.html</button>
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-http-url="/missing.html">Request /missing.html</button>
          </div>
        </div>
        <div class="http-sim-out text-xs font-mono m3-code-block p-3">
          Click a request button above to trace DNS → Server → HTTP Status Response.
        </div>
      </div>
    `;
  }

  if (widgetType === 'box-model') {
    return `
      <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle mt-4" data-widget="box-model">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider m3-text-primary">
            <span class="material-symbols-outlined text-[17px]">crop_square</span>
            Interactive CSS Box Model Calculator (Slide 113)
          </div>
          <label class="label cursor-pointer gap-2 py-0">
            <span class="label-text text-xs font-semibold">box-sizing: border-box</span>
            <input type="checkbox" class="toggle toggle-xs toggle-primary bm-border-box">
          </label>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
          <label>Width: <strong class="bm-val-w">200px</strong><input type="range" min="120" max="300" value="200" class="range range-xs range-primary bm-w"></label>
          <label>Padding: <strong class="bm-val-p">20px</strong><input type="range" min="0" max="40" value="20" class="range range-xs range-primary bm-p"></label>
          <label>Border: <strong class="bm-val-b">5px</strong><input type="range" min="0" max="15" value="5" class="range range-xs range-primary bm-b"></label>
          <label>Margin: <strong class="bm-val-m">15px</strong><input type="range" min="0" max="40" value="15" class="range range-xs range-primary bm-m"></label>
        </div>
        <div class="bm-summary font-mono text-xs p-3 rounded-xl m3-surface-container border m3-border-subtle"></div>
      </div>
    `;
  }

  if (widgetType === 'security-checklist') {
    return `
      <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle mt-4" data-widget="security-checklist">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider m3-text-primary mb-2">
          <span class="material-symbols-outlined text-[17px]">security</span>
          Interactive Security Audit Mini-Check
        </div>
        <p class="text-xs m3-text-muted mb-2.5">Click each rule to toggle its protection impact:</p>
        <div class="flex flex-wrap gap-2 sec-checks">
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="https">HTTPS Enabled</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="waf">Firewall / WAF Active</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="text">Use textContent (not unsafe innerHTML)</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="hash">Salted Password Hashing</button>
        </div>
        <div class="sec-status text-xs mt-3 font-medium"></div>
      </div>
    `;
  }

  return '';
}

function hydrateLessonWidgets(rootEl) {
  // URL Anatomy Widget
  const urlW = rootEl.querySelector('[data-widget="url-anatomy"]');
  if (urlW) {
    const inp = urlW.querySelector('.url-input');
    const out = urlW.querySelector('.url-parts');
    const update = () => {
      try {
        const u = new URL(inp.value.trim());
        const items = [
          ['Protocol', u.protocol + '//'],
          ['Domain Name', u.hostname],
          ['Path', u.pathname],
          ['Query', u.search || '(none)'],
          ['Fragment', u.hash || '(none)']
        ];
        out.innerHTML = items.map(([k, v]) => `
          <div class="p-2 rounded-xl m3-surface-container border m3-border-subtle">
            <div class="text-[10px] font-bold uppercase opacity-70">${k}</div>
            <div class="font-mono text-xs break-all mt-0.5">${escapeHtml(v)}</div>
          </div>
        `).join('');
      } catch {
        out.innerHTML = `<div class="col-span-full text-xs text-error">Enter a complete URL starting with http:// or https://</div>`;
      }
    };
    inp.addEventListener('input', update);
    update();
  }

  // HTTP Cycle Simulator
  const httpW = rootEl.querySelector('[data-widget="http-cycle"]');
  if (httpW) {
    const out = httpW.querySelector('.http-sim-out');
    httpW.querySelectorAll('[data-http-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.httpUrl;
        const ok = path === '/index.html';
        out.innerHTML = `
          <div>1. Browser → DNS Lookup for <strong>www.example.in</strong> → <code>203.0.113.42</code></div>
          <div>2. Browser → HTTPS Request: <code>GET ${escapeHtml(path)} HTTP/1.1</code></div>
          <div>3. Server → Status: <strong class="${ok ? 'text-success' : 'text-error'}">${ok ? '200 OK' : '404 Not Found'}</strong></div>
          <div>4. Browser → ${ok ? 'Parses HTML, CSS & JS and renders page!' : 'Displays friendly 404 Not Found error page.'}</div>
        `;
      });
    });
  }

  // Box Model Calculator
  const bmW = rootEl.querySelector('[data-widget="box-model"]');
  if (bmW) {
    const wEl = bmW.querySelector('.bm-w');
    const pEl = bmW.querySelector('.bm-p');
    const bEl = bmW.querySelector('.bm-b');
    const mEl = bmW.querySelector('.bm-m');
    const bbEl = bmW.querySelector('.bm-border-box');
    const sumEl = bmW.querySelector('.bm-summary');

    const updateBM = () => {
      const w = Number(wEl.value);
      const p = Number(pEl.value);
      const b = Number(bEl.value);
      const m = Number(mEl.value);
      const bb = bbEl.checked;
      bmW.querySelector('.bm-val-w').textContent = `${w}px`;
      bmW.querySelector('.bm-val-p').textContent = `${p}px`;
      bmW.querySelector('.bm-val-b').textContent = `${b}px`;
      bmW.querySelector('.bm-val-m').textContent = `${m}px`;
      const renderedBoxWidth = bb ? w : w + p * 2 + b * 2;
      const contentWidth = bb ? Math.max(0, w - p * 2 - b * 2) : w;
      sumEl.innerHTML = `
        <div><strong>Total Rendered Box Width (Content + 2×Padding + 2×Border):</strong> <span class="m3-text-primary font-bold">${renderedBoxWidth}px</span></div>
        <div class="opacity-80 mt-0.5">Inner Content Width: ${contentWidth}px · Outer Space with Margins: ${renderedBoxWidth + m * 2}px</div>
      `;
    };
    [wEl, pEl, bEl, mEl, bbEl].forEach((el) => el.addEventListener('input', updateBM));
    updateBM();
  }

  // Security Audit Mini-Check
  const secW = rootEl.querySelector('[data-widget="security-checklist"]');
  if (secW) {
    const active = new Set(['https', 'waf']);
    const status = secW.querySelector('.sec-status');
    const renderSec = () => {
      secW.querySelectorAll('[data-sec]').forEach((b) => {
        const on = active.has(b.dataset.sec);
        b.classList.toggle('btn-primary', on);
        b.classList.toggle('m3-btn-tonal', !on);
      });
      const score = active.size;
      status.textContent = `Active Defences: ${score}/4 — ${score === 4 ? 'Strong defence-in-depth!' : 'Enable all 4 layers to prevent eavesdropping, XSS, and credential leaks.'}`;
    };
    secW.querySelectorAll('[data-sec]').forEach((b) => {
      b.addEventListener('click', () => {
        if (active.has(b.dataset.sec)) active.delete(b.dataset.sec);
        else active.add(b.dataset.sec);
        renderSec();
      });
    });
    renderSec();
  }
}

function renderModuleView(moduleId) {
  const mod = getModuleById(moduleId);
  if (!mod) {
    renderLockedView('Module', 'Module not found.', '#/');
    return;
  }
  const gate = getModuleGateStatus(mod.id);
  if (!gate.unlocked) {
    renderLockedView(`Module ${mod.id}: ${mod.title}`, gate.reason, gate.targetHash || '#/');
    return;
  }

  const quizRec = appState.quizzes.get(mod.id);
  const labs = getLabsByModule(mod.id);
  const view = document.getElementById('app-view');

  view.innerHTML = `
    <article class="flex flex-col gap-6">
      <!-- Module Header -->
      <div class="m3-card rounded-3xl p-6 border m3-border-subtle">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="badge m3-primary-container font-mono font-bold">${mod.code}</span>
              <span class="badge m3-tonal-badge text-xs">${escapeHtml(mod.slideRefs)}</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold">${escapeHtml(mod.title)}</h1>
            <p class="text-sm m3-text-muted mt-1">${escapeHtml(mod.subtitle)}</p>
            <div class="text-xs font-medium mt-2 opacity-85">${escapeHtml(mod.co)}</div>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <a href="#/quiz/${mod.id}" class="btn btn-primary rounded-full gap-2 px-5">
              <span class="material-symbols-outlined text-[19px]">quiz</span>
              ${quizRec?.passed ? `Retake Quiz (${quizRec.bestScorePercent}%)` : 'Take Graded Quiz'}
            </a>
          </div>
        </div>
      </div>

      <!-- Lesson Sections -->
      <div class="flex flex-col gap-5">
        ${mod.sections.map((sec, idx) => `
          <section class="m3-surface-container-lowest rounded-3xl p-5 sm:p-7 border m3-border-subtle">
            <div class="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase m3-text-primary mb-1.5">
              <span>Lesson ${idx + 1}</span>
              <span>·</span>
              <span>${escapeHtml(sec.badge)}</span>
            </div>
            <h2 class="text-xl font-bold">${escapeHtml(sec.title)}</h2>
            <p class="text-sm sm:text-base m3-text-muted mt-1.5 leading-relaxed">${escapeHtml(sec.lead)}</p>

            ${sec.points ? `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
                ${sec.points.map((pt) => `
                  <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle flex gap-3">
                    <div class="w-9 h-9 rounded-xl m3-primary-container flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-[19px]">${pt.icon || 'check'}</span>
                    </div>
                    <div>
                      <div class="font-bold text-sm">${escapeHtml(pt.heading)}</div>
                      <p class="text-xs sm:text-sm m3-text-muted mt-1 leading-relaxed">${escapeHtml(pt.text)}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${sec.steps ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4">
                ${sec.steps.map((st) => `
                  <div class="m3-surface-container rounded-2xl p-3 border m3-border-subtle text-xs sm:text-sm font-medium">
                    ${escapeHtml(st)}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${sec.comparison ? `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle">
                  <h3 class="font-bold text-sm m3-text-primary mb-2">${escapeHtml(sec.comparison.leftTitle)}</h3>
                  <ul class="list-disc pl-5 text-xs sm:text-sm m3-text-muted space-y-1.5">
                    ${sec.comparison.leftPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
                  </ul>
                </div>
                <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle">
                  <h3 class="font-bold text-sm m3-text-primary mb-2">${escapeHtml(sec.comparison.rightTitle)}</h3>
                  <ul class="list-disc pl-5 text-xs sm:text-sm m3-text-muted space-y-1.5">
                    ${sec.comparison.rightPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}

            ${sec.callout ? `
              <div class="alert ${sec.callout.type === 'warning' ? 'alert-warning' : 'm3-surface-container'} rounded-2xl mt-4 border m3-border-subtle text-xs sm:text-sm">
                <span class="material-symbols-outlined text-[20px]">${sec.callout.type === 'warning' ? 'warning' : 'lightbulb'}</span>
                <span>${escapeHtml(sec.callout.text)}</span>
              </div>
            ` : ''}

            ${sec.codeExamples ? sec.codeExamples.map((ex) => `
              <div class="m3-code-block mt-4">
                <div class="m3-code-header">
                  <span class="font-mono font-semibold">${escapeHtml(ex.filename)}</span>
                  <button type="button" class="btn btn-ghost btn-xs text-xs text-emerald-300 copy-code-btn" data-copy="${escapeHtml(ex.code)}">
                    Copy
                  </button>
                </div>
                <pre class="m3-code-pre"><code>${escapeHtml(ex.code)}</code></pre>
              </div>
            `).join('') : ''}

            ${sec.widget ? renderLessonWidgetHtml(sec.widget) : ''}
          </section>
        `).join('')}
      </div>

      <!-- Module Action Footer -->
      <div class="m3-card rounded-3xl p-6 border m3-border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 class="font-bold text-lg">Ready for the Module ${mod.id} Quiz?</h3>
          <p class="text-xs sm:text-sm m3-text-muted mt-0.5">
            Score <strong>60% or higher</strong> on the quiz to ${labs.length ? `unlock ${labs.map((l) => l.code).join(', ')}` : mod.id === 5 ? 'unlock your Certificate of Completion' : 'unlock Module 2'}.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="#/quiz/${mod.id}" class="btn btn-primary rounded-full px-6 gap-2">
            <span class="material-symbols-outlined text-[20px]">quiz</span>
            Start Module Quiz (10 Questions)
          </a>
          ${quizRec?.passed && labs.length ? `
            <a href="#/lab/${labs[0].id}" class="btn m3-btn-tonal rounded-full px-5 gap-2">
              <span class="material-symbols-outlined text-[19px]">code</span>
              Go to ${labs[0].code}
            </a>
          ` : ''}
        </div>
      </div>
    </article>
  `;

  view.querySelectorAll('.copy-code-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copy, 'Code snippet copied!'));
  });
  hydrateLessonWidgets(view);
}

// ============================================================================
// Graded MCQ Quiz Engine (60% Pass Rule + Shuffled Retakes)
// ============================================================================

function buildShuffledQuizSession(quiz, shouldShuffle) {
  const rawQuestions = shouldShuffle ? shuffleArray(quiz.questions) : quiz.questions.slice();
  const questions = rawQuestions.map((q) => {
    const indexedOpts = q.options.map((text, idx) => ({ text, isCorrect: idx === q.correctIndex }));
    const finalOpts = shouldShuffle ? shuffleArray(indexedOpts) : indexedOpts;
    return {
      ...q,
      shuffledOptions: finalOpts,
      shuffledCorrectIndex: finalOpts.findIndex((o) => o.isCorrect)
    };
  });
  return {
    moduleId: quiz.moduleId,
    questions,
    answers: new Map(),
    submittedResult: null
  };
}

function renderQuizView(moduleId) {
  const mod = getModuleById(moduleId);
  const quiz = getQuizByModule(moduleId);
  if (!mod || !quiz) {
    renderLockedView('Quiz', 'Quiz not found.', '#/');
    return;
  }
  const gate = getModuleGateStatus(mod.id);
  if (!gate.unlocked) {
    renderLockedView(`Module ${mod.id} Quiz`, gate.reason, gate.targetHash || '#/');
    return;
  }

  const prevRecord = appState.quizzes.get(mod.id);
  const shouldShuffle = Boolean(prevRecord && prevRecord.attempts > 0 && !prevRecord.passed);

  if (!appState.quizSession || appState.quizSession.moduleId !== mod.id) {
    appState.quizSession = buildShuffledQuizSession(quiz, shouldShuffle);
  }

  drawQuizSession(mod, quiz, prevRecord);
}

function drawQuizSession(mod, quiz, prevRecord) {
  const session = appState.quizSession;
  const result = session.submittedResult;
  const view = document.getElementById('app-view');
  const labs = getLabsByModule(mod.id);

  view.innerHTML = `
    <section class="flex flex-col gap-5 max-w-4xl mx-auto">
      <div class="m3-card rounded-3xl p-6 border m3-border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <a href="#/module/${mod.id}" class="btn btn-xs btn-ghost rounded-full gap-1 pl-1">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              Module ${mod.id} Notes
            </a>
            <span class="badge m3-tonal-badge font-mono text-xs">Passing Score: &ge; 60%</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-extrabold">${escapeHtml(quiz.title)}</h1>
          <p class="text-xs m3-text-muted mt-1">
            10 Active-Recall Questions · Best Score: <strong>${prevRecord ? prevRecord.bestScorePercent + '%' : 'Not attempted'}</strong> · Attempts: <strong>${prevRecord ? prevRecord.attempts : 0}</strong>
          </p>
        </div>
        ${prevRecord?.passed ? `
          <span class="badge badge-success badge-lg rounded-full gap-1.5 px-4 font-bold">
            <span class="material-symbols-outlined text-[18px]">verified</span>
            Passed (${prevRecord.bestScorePercent}%)
          </span>
        ` : ''}
      </div>

      ${result ? `
        <div class="rounded-3xl p-6 border-2 ${result.passed ? 'border-success m3-success-container' : 'border-error m3-error-container'}">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <span class="material-symbols-outlined text-[38px]">${result.passed ? 'celebration' : 'error_outline'}</span>
              <div>
                <h2 class="text-xl font-extrabold">
                  Score: ${result.correctCount}/${result.total} (${result.scorePercent}%) — ${result.passed ? 'Quiz Passed!' : 'Need 60% or Higher to Pass'}
                </h2>
                <p class="text-sm opacity-90 mt-0.5">
                  ${result.passed
                    ? (labs.length
                        ? `Great job! ${labs.map((l) => l.code).join(', ')} unlocked.`
                        : mod.id === 5
                          ? 'Congratulations! You passed all 5 modules—view your Certificate of Completion!'
                          : 'Great job! Module 2 is now unlocked.')
                    : 'Check the explanations below for any questions you missed, then try the quiz again to score 60% or higher.'
                  }
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              ${!result.passed ? `
                <button id="retake-quiz-btn" type="button" class="btn btn-primary rounded-full px-5 gap-1.5">
                  <span class="material-symbols-outlined text-[18px]">shuffle</span>
                  Try Quiz Again
                </button>
              ` : labs.length ? `
                <a href="#/lab/${labs[0].id}" class="btn btn-primary rounded-full px-5 gap-1.5">
                  <span>Start ${labs[0].code}</span>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              ` : mod.id < 5 ? `
                <a href="#/module/${mod.id + 1}" class="btn btn-primary rounded-full px-5 gap-1.5">
                  <span>Continue to Module ${mod.id + 1}</span>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              ` : `
                <a href="#/certificate" class="btn btn-primary rounded-full px-5 gap-1.5">
                  <span class="material-symbols-outlined text-[18px]">workspace_premium</span>
                  View Your Certificate
                </a>
              `}
            </div>
          </div>
        </div>
      ` : ''}

      <form id="quiz-form" class="flex flex-col gap-4">
        ${session.questions.map((q, qIdx) => {
          const chosen = session.answers.get(q.id);
          const isCorrect = result && chosen === q.shuffledCorrectIndex;
          const isWrong = result && chosen !== q.shuffledCorrectIndex;
          return `
            <div class="m3-surface-container-lowest rounded-3xl p-5 sm:p-6 border m3-border-subtle">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-bold text-base leading-snug">
                  <span class="m3-text-primary font-mono mr-1.5">Q${qIdx + 1}.</span>
                  ${escapeHtml(q.question)}
                </h3>
                ${result ? `
                  <span class="badge ${isCorrect ? 'badge-success' : 'badge-error'} shrink-0">
                    ${isCorrect ? 'Correct' : 'Missed'}
                  </span>
                ` : ''}
              </div>

              ${q.code ? `
                <div class="m3-code-block mt-3">
                  <pre class="m3-code-pre"><code>${escapeHtml(q.code)}</code></pre>
                </div>
              ` : ''}

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                ${q.shuffledOptions.map((opt, optIdx) => {
                  const selected = chosen === optIdx;
                  let stateClass = selected ? 'is-selected' : '';
                  if (result) {
                    if (optIdx === q.shuffledCorrectIndex) stateClass = 'is-correct';
                    else if (selected && optIdx !== q.shuffledCorrectIndex) stateClass = 'is-wrong';
                  }
                  const letter = ['A', 'B', 'C', 'D'][optIdx];
                  return `
                    <label class="m3-quiz-option ${stateClass}">
                      <input type="radio" name="q_${q.id}" value="${optIdx}" ${selected ? 'checked' : ''} ${result ? 'disabled' : ''} class="radio radio-primary radio-sm mt-0.5 shrink-0">
                      <span class="text-sm leading-snug">
                        <strong class="font-mono mr-1">${letter}.</strong> ${escapeHtml(opt.text)}
                      </span>
                    </label>
                  `;
                }).join('')}
              </div>

              ${result ? `
                <div class="mt-3 p-3 rounded-2xl m3-surface-container text-xs sm:text-sm border m3-border-subtle flex gap-2 items-start">
                  <span class="material-symbols-outlined text-[18px] ${isWrong ? 'text-error' : 'm3-text-primary'} shrink-0 mt-0.5">lightbulb</span>
                  <div><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}

        ${!result ? `
          <div class="flex justify-end gap-3 mt-2">
            <button type="submit" class="btn btn-primary btn-lg rounded-full px-8 gap-2">
              <span class="material-symbols-outlined">task_alt</span>
              Submit Quiz &amp; Check Mastery
            </button>
          </div>
        ` : `
          <div class="flex justify-end gap-3 mt-2">
            <button id="retake-quiz-bottom-btn" type="button" class="btn m3-btn-tonal rounded-full px-6 gap-2">
              <span class="material-symbols-outlined text-[18px]">shuffle</span>
              Retake Quiz (Shuffled)
            </button>
          </div>
        `}
      </form>
    </section>
  `;

  view.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const qId = e.target.name.slice(2);
      session.answers.set(qId, Number(e.target.value));
      drawQuizSession(mod, quiz, prevRecord);
    });
  });

  document.getElementById('quiz-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (session.answers.size < session.questions.length) {
      showToast(`Please answer all ${session.questions.length} questions before submitting (${session.answers.size}/${session.questions.length} answered).`, 'error');
      return;
    }

    let correctCount = 0;
    for (const q of session.questions) {
      if (session.answers.get(q.id) === q.shuffledCorrectIndex) {
        correctCount += 1;
      }
    }
    const total = session.questions.length;
    const scorePercent = Math.round((correctCount / total) * 100);
    const passed = scorePercent >= quiz.passingPercent;

    const updated = await saveQuizAttempt(mod.id, scorePercent, passed);
    await refreshStateFromDB();
    renderSidebarAndProgress();

    session.submittedResult = { correctCount, total, scorePercent, passed };
    drawQuizSession(mod, quiz, updated);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (passed) {
      const nextMsg = labs.length
        ? `You scored ${scorePercent}% on Module ${mod.id}! Practical ${labs.map((l) => l.code).join(', ')} are now unlocked.`
        : mod.id === 5
          ? `You scored ${scorePercent}% on Module 5! Check if all labs are done to claim your Final Certificate.`
          : `You scored ${scorePercent}% on Module 1! Module 2 is now unlocked.`;
      await triggerCheckpointModal(`Module ${mod.id} Quiz Passed (${scorePercent}%)`, nextMsg, `M${mod.id}_Quiz`);
    }
  });

  const handleRetake = () => {
    appState.quizSession = buildShuffledQuizSession(quiz, true);
    drawQuizSession(mod, quiz, appState.quizzes.get(mod.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.getElementById('retake-quiz-btn')?.addEventListener('click', handleRetake);
  document.getElementById('retake-quiz-bottom-btn')?.addEventListener('click', handleRetake);
}

// ============================================================================
// Practical Lab IDE View (Full-Viewport 3-Pane Draggable Workspace)
// ============================================================================

function loadPaneSplits() {
  const defaults = [26, 40, 34];
  try {
    const raw = JSON.parse(localStorage.getItem(SPLITS_STORAGE_KEY) || 'null');
    if (Array.isArray(raw) && raw.length === 3 && raw.every((n) => typeof n === 'number' && n >= 15)) {
      return raw;
    }
  } catch {}
  return defaults;
}

function savePaneSplits(splits) {
  try {
    localStorage.setItem(SPLITS_STORAGE_KEY, JSON.stringify(splits.map((n) => Number(n.toFixed(2)))));
  } catch {}
}

function initSplitResizers(container, pane1, pane2, pane3, resizer1, resizer2, ide) {
  let splits = loadPaneSplits();

  const applySplits = () => {
    if (window.innerWidth < 1024) {
      pane1.style.flex = '';
      pane2.style.flex = '';
      pane3.style.flex = '';
      return;
    }
    pane1.style.flex = `0 0 calc(${splits[0]}% - 4px)`;
    pane2.style.flex = `0 0 calc(${splits[1]}% - 4px)`;
    pane3.style.flex = `0 0 calc(${splits[2]}% - 4px)`;
  };

  let activeDrag = null;

  const startDrag = (which, e) => {
    if (window.innerWidth < 1024) return;
    e.preventDefault();
    const totalWidth = container.getBoundingClientRect().width - 12; // subtract two 6px resizers
    if (totalWidth <= 0) return;

    activeDrag = {
      which,
      startX: e.clientX,
      startSplits: splits.slice(),
      totalWidth,
      resizerEl: which === 1 ? resizer1 : resizer2
    };
    document.body.classList.add('is-resizing');
    activeDrag.resizerEl.classList.add('is-dragging');
  };

  const onMouseMove = (e) => {
    if (!activeDrag) return;
    const minPct = (240 / activeDrag.totalWidth) * 100;
    const deltaPct = ((e.clientX - activeDrag.startX) / activeDrag.totalWidth) * 100;

    if (activeDrag.which === 1) {
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
    ide.refreshEditors();
  };

  const onMouseUp = () => {
    if (!activeDrag) return;
    document.body.classList.remove('is-resizing');
    activeDrag.resizerEl.classList.remove('is-dragging');
    savePaneSplits(splits);
    activeDrag = null;
    ide.refreshEditors();
  };

  const onWindowResize = () => {
    applySplits();
    ide.refreshEditors();
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

async function renderLabView(labId, isBonus = false) {
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

  view.innerHTML = `
    <section class="ide-workspace-root">
      <!-- Compact IDE Action Bar -->
      <div class="ide-toolbar">
        <div class="w-full sm:w-auto sm:flex-1 flex items-center gap-2 min-w-0">
          <span class="badge m3-primary-container font-mono font-bold shrink-0">${escapeHtml(lab.code)}</span>
          ${!isBonus ? `<span class="badge m3-tonal-badge font-mono text-xs hidden md:inline-flex shrink-0">${mod.code}</span>` : `<span class="badge m3-tonal-badge text-xs shrink-0">Optional</span>`}
          <h1 class="text-sm sm:text-base font-bold truncate min-w-0 flex-1">${escapeHtml(lab.title)}</h1>
          <span id="ide-verified-badge" class="${savedRec?.completed ? 'inline-flex' : 'hidden'} badge badge-success gap-1 text-xs font-bold shrink-0">
            <span class="material-symbols-outlined" style="font-size:14px">check_circle</span>
            Verified
          </span>
        </div>

        <div class="w-full sm:w-auto flex items-center justify-end gap-1.5 shrink-0">
          <div id="ide-telemetry-pill" class="badge m3-tonal-badge font-mono text-xs py-2.5 px-2.5 gap-1 hidden md:inline-flex">
            <span class="material-symbols-outlined" style="font-size:15px">timer</span>
            <span>${formatDuration(savedRec?.activeTypingSeconds || 0)}</span>
          </div>

          <button id="ide-reset-btn" type="button" class="btn btn-xs sm:btn-sm btn-ghost rounded-full gap-1" title="Reset Starter Code">
            <span class="material-symbols-outlined icon-18">restart_alt</span>
            <span class="hidden md:inline">Reset</span>
          </button>

          <button id="ide-preview-btn" type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full gap-1" title="Run Preview">
            <span class="material-symbols-outlined icon-18">play_arrow</span>
            <span>Run</span>
          </button>

          ${!isBonus ? `
            <button id="ide-verify-btn" type="button" class="btn btn-xs sm:btn-sm btn-primary rounded-full px-3.5 gap-1.5" title="Run Automatic Code Check">
              <span class="material-symbols-outlined icon-18">verified</span>
              <span>Check My Code</span>
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
          <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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

            <details class="collapse collapse-arrow m3-surface-container-low rounded-2xl border m3-border-subtle">
              <summary class="collapse-title text-xs font-bold py-2.5 min-h-0">Need a Hint? View Example Code</summary>
              <div class="collapse-content">
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

            <div id="ide-next-cta" class="${savedRec?.completed ? '' : 'hidden'} pt-2 border-t m3-border-subtle">
              ${nextLab ? `
                <a href="#/lab/${nextLab.id}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5">
                  <span>Next: ${escapeHtml(nextLab.code)}</span>
                  <span class="material-symbols-outlined icon-18">arrow_forward</span>
                </a>
              ` : mod && mod.id < 5 ? `
                <a href="#/module/${mod.id + 1}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5">
                  <span>Proceed to Module ${mod.id + 1}</span>
                  <span class="material-symbols-outlined icon-18">arrow_forward</span>
                </a>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Vertical Splitter 1 -->
        <div id="resizer-1" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Instructions and Editor"></div>

        <!-- Pane 2: Code Editor -->
        <div id="pane-editor" class="ide-pane">
          <div class="h-10 px-2 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between gap-1.5 shrink-0">
            <div class="min-w-0 flex-1 overflow-x-auto no-scrollbar">
              <div role="tablist" class="tabs tabs-boxed rounded-full p-0.5 m3-surface-container inline-flex flex-nowrap w-max">
                ${lab.tabs.includes('html') ? `<button id="tab-btn-html" type="button" role="tab" class="tab tab-xs rounded-full tab-active font-mono text-[11px] px-2 whitespace-nowrap">index.html</button>` : ''}
                ${lab.tabs.includes('css') ? `<button id="tab-btn-css" type="button" role="tab" class="tab tab-xs rounded-full font-mono text-[11px] px-2 whitespace-nowrap">style.css</button>` : ''}
                ${lab.tabs.includes('js') ? `<button id="tab-btn-js" type="button" role="tab" class="tab tab-xs rounded-full font-mono text-[11px] px-2 whitespace-nowrap">app.js</button>` : ''}
              </div>
            </div>

            <div class="flex items-center gap-0.5 shrink-0">
              <div class="dropdown dropdown-end">
                <button type="button" tabindex="0" class="btn btn-xs btn-ghost btn-circle" title="Emmet Cheatsheet" aria-label="Emmet Cheatsheet">
                  <span class="material-symbols-outlined icon-18">bolt</span>
                </button>
                <div tabindex="0" class="dropdown-content z-50 w-64 p-3 rounded-2xl shadow-xl border m3-border-subtle m3-modal-box text-xs">
                  <div class="font-bold mb-1.5 flex items-center gap-1.5">
                    <span class="material-symbols-outlined icon-18 m3-text-primary">bolt</span>
                    <span>Emmet Shortcuts (Press Tab)</span>
                  </div>
                  <div class="space-y-1 font-mono text-[11px]">
                    <div class="flex justify-between"><code>!</code><span class="m3-text-muted">HTML5 page</span></div>
                    <div class="flex justify-between"><code>div+p</code><span class="m3-text-muted">Sibling tags</span></div>
                    <div class="flex justify-between"><code>ul&gt;li*3</code><span class="m3-text-muted">List items</span></div>
                    <div class="flex justify-between"><code>.card&gt;h3+p</code><span class="m3-text-muted">Class card</span></div>
                    <div class="flex justify-between"><code>table&gt;tr*2&gt;td*3</code><span class="m3-text-muted">Table grid</span></div>
                  </div>
                </div>
              </div>

              <button id="editor-hint-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Autocomplete (Ctrl+Space)" aria-label="Autocomplete">
                <span class="material-symbols-outlined icon-18">code_blocks</span>
              </button>
              <button id="editor-reset-icon-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Reset Starter Code" aria-label="Reset Starter Code">
                <span class="material-symbols-outlined icon-18">restart_alt</span>
              </button>
              <button id="editor-run-icon-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Run Preview" aria-label="Run Preview">
                <span class="material-symbols-outlined icon-18">play_arrow</span>
              </button>
            </div>
          </div>

          <div class="ide-editor-wrap">
            <div id="editor-wrap-html"><div id="editor-html"></div></div>
            <div id="editor-wrap-css" class="hidden"><div id="editor-css"></div></div>
            <div id="editor-wrap-js" class="hidden"><div id="editor-js"></div></div>
          </div>

          <!-- Sticky Symbol Bar (Strictly Mobile / Touch Viewports) -->
          <div id="ide-symbol-bar" class="m3-symbol-bar lg:hidden" aria-label="Code Symbol Toolbar">
            <button type="button" class="m3-symbol-pill is-emmet" data-action="emmet">
              <span class="material-symbols-outlined icon-18">bolt</span>
              <span>Emmet</span>
            </button>
            ${['<', '>', '/', '=', '"', '{', '}', ';', '(', ')', ':', '.', '#', '!'].map((sym) => `
              <button type="button" class="m3-symbol-pill" data-symbol="${escapeHtml(sym)}">${escapeHtml(sym)}</button>
            `).join('')}
          </div>
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

          <!-- Collapsible Console Drawer -->
          <div id="ide-console-drawer" class="border-t m3-border-subtle m3-surface-container-low shrink-0">
            <div id="ide-console-toggle" class="h-9 px-3 flex items-center justify-between cursor-pointer select-none">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider m3-text-muted">
                <span class="material-symbols-outlined icon-18">terminal</span>
                <span>Console</span>
                <span id="ide-console-count" class="badge badge-xs m3-tonal-badge font-mono">0</span>
              </div>
              <div class="flex items-center gap-1">
                <button id="ide-console-clear-btn" type="button" class="btn btn-xs btn-ghost rounded-full text-[11px]">Clear</button>
                <span id="ide-console-chevron" class="material-symbols-outlined icon-18">expand_less</span>
              </div>
            </div>
            <div id="ide-console-body" class="hidden max-h-32 overflow-y-auto px-3 py-2 m3-surface-container-lowest border-t m3-border-subtle">
              <div id="ide-console-output" class="text-xs font-mono"></div>
            </div>
          </div>
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
          <span class="material-symbols-outlined" style="font-size:15px">timer</span>
          <span>${formatDuration(tel.activeTypingSeconds)}</span>
        `;
      }
    },
    onVerifyComplete: async (res) => {
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
        await refreshStateFromDB();
        renderSidebarAndProgress();
        document.getElementById('ide-verified-badge')?.classList.remove('hidden');
        document.getElementById('ide-verified-badge')?.classList.add('inline-flex');
        document.getElementById('ide-next-cta')?.classList.remove('hidden');
        showToast(`Nice work! All ${res.totalAssertions} checks passed for ${lab.code}.`, 'success');

        if (areModuleLabsCompleted(lab.moduleId)) {
          const unlockedMod = lab.moduleId < 5 ? `Module ${lab.moduleId + 1}` : 'your Certificate';
          await triggerCheckpointModal(
            `Module ${lab.moduleId} Complete`,
            `Your work is saved in this browser, and ${unlockedMod} is now unlocked.`,
            `M${lab.moduleId}`
          );
        }
      } else {
        showToast(`Almost there! ${res.passedAssertions} of ${res.totalAssertions} checks passed. Check the tips on the left.`, 'error');
      }
    }
  });

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
  document.getElementById('editor-run-icon-btn')?.addEventListener('click', runPreviewAction);
  document.getElementById('preview-refresh-btn')?.addEventListener('click', runPreviewAction);
  document.getElementById('ide-reset-btn')?.addEventListener('click', resetAction);
  document.getElementById('editor-reset-icon-btn')?.addEventListener('click', resetAction);
  document.getElementById('ide-verify-btn')?.addEventListener('click', () => ide.runAndVerify());

  document.getElementById('editor-hint-btn')?.addEventListener('click', () => {
    const cm = ide.editors[ide.activeTab];
    if (cm) {
      cm.focus();
      ide.triggerAutocomplete(cm, ide.activeTab, true);
    }
  });

  // Collapsible Console Drawer
  const consoleBody = document.getElementById('ide-console-body');
  const consoleChevron = document.getElementById('ide-console-chevron');
  document.getElementById('ide-console-toggle')?.addEventListener('click', (e) => {
    if (e.target.closest('#ide-console-clear-btn')) return;
    const isHidden = consoleBody?.classList.toggle('hidden');
    if (consoleChevron) {
      consoleChevron.textContent = isHidden ? 'expand_less' : 'expand_more';
    }
  });
  document.getElementById('ide-console-clear-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const out = document.getElementById('ide-console-output');
    const cnt = document.getElementById('ide-console-count');
    if (out) out.innerHTML = '';
    if (cnt) cnt.textContent = '0';
  });

  // Mobile 3-pane segmented switcher (< 1024px)
  const mobileTabs = document.getElementById('mobile-pane-tabs');
  if (mobileTabs) {
    const panes = {
      instructions: document.getElementById('pane-instructions'),
      editor: document.getElementById('pane-editor'),
      preview: document.getElementById('pane-preview')
    };
    const syncMobilePanes = (active) => {
      if (window.innerWidth >= 1024) {
        Object.values(panes).forEach((p) => p?.classList.remove('hidden'));
        return;
      }
      Object.entries(panes).forEach(([k, p]) => p?.classList.toggle('hidden', k !== active));
      mobileTabs.querySelectorAll('[data-pane]').forEach((b) => {
        b.classList.toggle('tab-active', b.dataset.pane === active);
      });
      if (active === 'editor') {
        ide.syncTheme();
        ide.refreshEditors();
      }
    };
    mobileTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pane]');
      if (!btn) return;
      syncMobilePanes(btn.dataset.pane);
    });
    syncMobilePanes('instructions');
  }
}

// ============================================================================
// A4 Landscape Certificate & Scannable QR Credential (#/certificate)
// ============================================================================

function buildOfflineQrFallbackSvg(seedText) {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const size = 21;
  const cells = [];
  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let dark = false;
      if (isFinder(r, c)) {
        const lr = r >= size - 7 ? r - (size - 7) : r;
        const lc = c >= size - 7 ? c - (size - 7) : c;
        dark = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        hash = Math.imul(hash ^ (r * 31 + c), 16777619);
        dark = (hash >>> 0) % 2 === 0;
      }
      if (dark) cells.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="#171d19"/>`);
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="104" height="104" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR Code Fallback"><rect width="${size}" height="${size}" fill="#ffffff"/>${cells.join('')}</svg>`;
}

async function renderCertificateView() {
  if (!isCertificateUnlocked()) {
    const nextHash = getNextRecommendedRoute();
    renderLockedView(
      'Certificate of Completion',
      'Pass all 5 module quizzes (60% or higher) and complete all 8 coding labs to unlock your Certificate of Completion.',
      nextHash
    );
    return;
  }

  const fullState = await exportFullState();
  const generated = await generateCompletionKey(fullState);
  const qrInfo = await generateCompactQrToken(fullState, generated.signature);

  const quizScores = [1, 2, 3, 4, 5].map((m) => {
    const q = (fullState.quizzes || []).find((x) => Number(x.moduleId) === m);
    return Number(q?.bestScorePercent || 0);
  });
  const avgQuiz = Math.round(quizScores.reduce((a, b) => a + b, 0) / 5);
  const completionDate = new Date(generated.payload.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const verifyHashHref = `#/verify?v=${qrInfo.token}`;
  const qrMinimalPayload = `?v=${qrInfo.token}`;

  const view = document.getElementById('app-view');
  view.innerHTML = `
    <section class="max-w-5xl mx-auto flex flex-col gap-5">
      <!-- Certificate Action Bar (Hidden in Print) -->
      <div class="m3-card rounded-3xl p-4 sm:p-5 border m3-border-subtle flex flex-wrap items-center justify-between gap-3 no-print">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-bold">Certificate of Completion</h1>
          <p class="text-xs sm:text-sm m3-text-muted">Printable A4 landscape credential with digitally signed QR verification.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="cert-print-btn" type="button" class="btn btn-sm sm:btn-md btn-primary rounded-full gap-1.5 px-5">
            <span class="material-symbols-outlined icon-18">print</span>
            <span>Print / Save PDF</span>
          </button>
          <button id="cert-copy-key-btn" type="button" class="btn btn-sm sm:btn-md m3-btn-tonal rounded-full gap-1.5">
            <span class="material-symbols-outlined icon-18">content_copy</span>
            <span>Copy Code Key</span>
          </button>
          <a id="cert-test-verify-btn" href="${escapeHtml(verifyHashHref)}" class="btn btn-sm sm:btn-md btn-ghost border m3-border-subtle rounded-full gap-1.5">
            <span class="material-symbols-outlined icon-18">open_in_new</span>
            <span>Test Verify Page</span>
          </a>
        </div>
      </div>

      <!-- A4 Landscape Certificate Frame (297mm x 210mm) -->
      <article class="m3-a4-certificate" aria-label="A4 Landscape Certificate of Completion">
        <div class="m3-a4-certificate-inner">
          <!-- Minimal Top Header -->
          <header class="flex items-center justify-between gap-3">
            <div class="inline-flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#146C43] inline-block" aria-hidden="true"></span>
              <span class="text-base sm:text-lg font-bold tracking-tight text-[#111827]">druba.in</span>
            </div>
            <div class="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#64748B]">
              CERTIFICATE OF COMPLETION
            </div>
          </header>

          <!-- Centerpiece Typography -->
          <div class="text-center flex flex-col items-center justify-center px-2">
            <h2 class="text-2xl sm:text-3xl lg:text-[38px] font-bold tracking-tight text-[#111827] leading-tight">
              Congratulations
            </h2>

            <p class="text-xs sm:text-sm text-[#4B5563] mt-3">This certifies that</p>

            <div class="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-[#146C43] leading-tight mt-1.5">
              ${escapeHtml(fullState.profile.fullName)}
            </div>

            <div class="font-mono text-xs sm:text-[13px] font-medium text-[#4B5563] mt-1">
              Student ID: ${escapeHtml(fullState.profile.rollNo)}
            </div>

            <p class="text-xs sm:text-sm text-[#4B5563] max-w-lg mx-auto mt-3 leading-relaxed">
              has successfully completed all lessons, graded assessments, and 8 hands-on front-end labs for
            </p>

            <div class="text-base sm:text-lg lg:text-[20px] font-bold text-[#111827] mt-1.5">
              Learning the Web with Basics of Vanilla Front-End Tools
            </div>

            <!-- Minimal Inline Summary (No Pill Boxes) -->
            <div class="text-xs sm:text-[13px] text-[#4B5563] mt-4 font-medium flex flex-wrap items-center justify-center gap-y-1">
              <span>Quiz Score: <strong class="font-mono font-semibold text-[#111827]">${avgQuiz}%</strong></span>
              <span class="mx-3 text-[#CBD5E1]" aria-hidden="true">|</span>
              <span>Labs Completed: <strong class="font-mono font-semibold text-[#111827]">8 / 8</strong></span>
              <span class="mx-3 text-[#CBD5E1]" aria-hidden="true">|</span>
              <span>Issued: <strong class="font-mono font-semibold text-[#111827]">${escapeHtml(completionDate)}</strong></span>
            </div>
          </div>

          <!-- Bottom 3-Column Digitally Signed Footer (No Divider Line, No Handwritten Signature) -->
          <footer class="grid grid-cols-1 md:grid-cols-3 items-end gap-4 pt-2">
            <!-- Left Column: Digital Authority & Seal -->
            <div class="flex flex-col items-center md:items-start text-center md:text-left">
              <div class="inline-flex items-center gap-1.5 text-[#146C43] text-xs font-bold tracking-tight mb-1">
                <span class="material-symbols-outlined filled" style="font-size:16px;color:#146C43;">verified</span>
                <span>Digitally Signed Credential</span>
              </div>
              <div class="text-xs font-semibold text-[#111827] leading-snug">Issued by Drubajyoti Debnath</div>
              <div class="text-[11px] text-[#64748B] leading-snug">Course Author &middot; druba.in</div>
            </div>

            <!-- Center Column: High-Scannability QR Code (104x104, 8px white quiet zone) -->
            <div class="flex flex-col items-center justify-center">
              <div class="bg-white inline-flex items-center justify-center" style="padding:8px;">
                <canvas id="cert-qr-canvas" width="104" height="104" style="width:104px;height:104px;display:block;"></canvas>
                <div id="cert-qr-fallback" class="hidden"></div>
              </div>
              <div class="text-[10.5px] font-medium text-[#64748B] mt-1">Scan to verify</div>
            </div>

            <!-- Right Column: Clean Credential ID (2 lines in JetBrains Mono) -->
            <div class="flex flex-col items-center md:items-end text-center md:text-right font-mono text-[11px] leading-relaxed">
              <div class="font-semibold text-[#111827]">ID: ${escapeHtml(qrInfo.verifyId)}</div>
              <div class="text-[#4B5563]">Verify at: druba.in/learn/#/verify</div>
            </div>
          </footer>
        </div>
      </article>

      <!-- Collapsible Certificate Verification Code Drawer (Hidden in Print) -->
      <details class="collapse collapse-arrow m3-surface-container-lowest rounded-3xl border m3-border-subtle no-print">
        <summary class="collapse-title font-bold text-sm flex items-center gap-2">
          <span class="material-symbols-outlined icon-18 m3-text-primary">key</span>
          <span>Certificate Verification Code (share to verify your completed labs)</span>
        </summary>
        <div class="collapse-content flex flex-col gap-3">
          <textarea id="cert-key-box" readonly rows="4" class="textarea textarea-bordered w-full font-mono text-[11px] leading-snug rounded-2xl m3-surface-container-low">${escapeHtml(generated.key)}</textarea>
          <div class="flex flex-wrap gap-2 justify-end">
            <a href="#/verify" class="btn btn-xs sm:btn-sm btn-outline rounded-full gap-1.5">
              <span class="material-symbols-outlined icon-18">verified_user</span>
              <span>Check Certificate</span>
            </a>
          </div>
        </div>
      </details>
    </section>
  `;

  // Render QR Code via QRious (or deterministic SVG fallback if offline)
  const qrCanvas = document.getElementById('cert-qr-canvas');
  const qrFallback = document.getElementById('cert-qr-fallback');
  if (typeof window.QRious === 'function' && qrCanvas) {
    try {
      new window.QRious({
        element: qrCanvas,
        value: qrMinimalPayload,
        size: 104,
        padding: 0,
        level: 'M',
        background: '#FFFFFF',
        foreground: '#111827'
      });
    } catch {
      if (qrFallback) {
        qrCanvas.classList.add('hidden');
        qrFallback.classList.remove('hidden');
        qrFallback.innerHTML = buildOfflineQrFallbackSvg(qrInfo.verifyId);
      }
    }
  } else if (qrCanvas && qrFallback) {
    qrCanvas.classList.add('hidden');
    qrFallback.classList.remove('hidden');
    qrFallback.innerHTML = buildOfflineQrFallbackSvg(qrInfo.verifyId);
  }

  document.getElementById('cert-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('cert-copy-key-btn')?.addEventListener('click', () => {
    copyToClipboard(generated.key, 'Certificate Verification Code copied.');
  });
}

// ============================================================================
// Certificate Checker & Submission Inspector (#/verify)
// ============================================================================

async function renderVerifyView(queryParams = null) {
  const view = document.getElementById('app-view');
  const qrParam = queryParams ? queryParams.get('v') : null;
  const keyParam = queryParams ? queryParams.get('key') : null;

  view.innerHTML = `
    <section class="flex flex-col gap-6 max-w-5xl mx-auto">
      <div id="verify-qr-container"></div>

      <div class="m3-card rounded-3xl p-6 border m3-border-subtle">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span class="badge m3-tonal-badge font-mono text-xs mb-1.5">Certificate Verification</span>
            <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <span class="material-symbols-outlined icon-24 m3-text-primary">verified_user</span>
              <span>Check a Certificate</span>
            </h1>
            <p class="text-sm m3-text-muted mt-1">
              Scan a certificate QR code to verify it automatically, or paste a Certificate Verification Code below to check authenticity, quiz scores, and submitted lab code.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="verify-demo-valid-btn" type="button" class="btn btn-xs m3-btn-tonal rounded-full">Load Sample Valid Code</button>
            <button id="verify-demo-tamper-btn" type="button" class="btn btn-xs btn-outline btn-error rounded-full">Load Sample Altered Code</button>
          </div>
        </div>

        <div class="mt-4">
          <textarea id="verify-key-input" rows="3" placeholder="Paste a Certificate Verification Code here to check a certificate and view submitted lab code..." class="textarea textarea-bordered w-full font-mono text-xs rounded-2xl"></textarea>
          <div class="flex flex-wrap gap-2 mt-3 justify-end">
            <button id="verify-clear-btn" type="button" class="btn btn-sm btn-ghost rounded-full">Clear</button>
            <button id="verify-inspect-btn" type="button" class="btn btn-sm btn-primary rounded-full px-6 gap-1.5">
              <span class="material-symbols-outlined icon-18">search_check</span>
              <span>Check Certificate</span>
            </button>
          </div>
        </div>
      </div>

      <div id="verify-output-container"></div>
    </section>
  `;

  const renderQrResult = async (container, tokenStr) => {
    const qrRes = await verifyCompactQrToken(tokenStr);
    if (qrRes.valid && qrRes.payload) {
      const p = qrRes.payload;
      const scores = Array.isArray(p.quizScores) ? p.quizScores : [];
      container.innerHTML = `
        <div class="m3-surface-container-lowest rounded-3xl p-6 border-2 border-success shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b m3-border-subtle">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl m3-success-container flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined filled icon-24">verified</span>
              </div>
              <div>
                <div class="text-xs font-mono font-bold uppercase tracking-wider m3-text-primary">
                  QR Code Scan &middot; Certificate Check
                </div>
                <h2 class="text-xl sm:text-2xl font-bold">Status: Authentic &amp; Verified</h2>
              </div>
            </div>
            <span class="badge badge-success badge-lg font-mono font-bold px-4">${escapeHtml(qrRes.verifyId)}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle">
              <div class="text-[11px] font-bold uppercase m3-text-muted">Student</div>
              <div class="text-lg font-bold mt-0.5">${escapeHtml(p.name)}</div>
              <div class="font-mono text-xs m3-text-primary mt-0.5">ID / Roll No: ${escapeHtml(p.rollNo)}</div>
              <div class="text-xs m3-text-muted mt-2">Course: <strong>${escapeHtml(p.course || 'Learning the Web with Basics of Vanilla Front-End Tools (druba.in)')}</strong></div>
              <div class="text-xs m3-text-muted">Issued: <span class="font-mono">${escapeHtml(p.date)}</span></div>
            </div>

            <div class="md:col-span-2 m3-surface-container-low rounded-2xl p-4 border m3-border-subtle flex flex-col justify-between gap-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-xs font-bold uppercase m3-text-muted">Quiz Scores</div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-success font-mono font-bold">Avg: ${Number(p.avgScore || 0)}%</span>
                  <span class="badge m3-primary-container font-mono font-bold">Coding Labs: ${Number(p.labsPassed || 0)} / 8</span>
                </div>
              </div>
              <div class="grid grid-cols-5 gap-2 text-center">
                ${[1, 2, 3, 4, 5].map((m, idx) => `
                  <div class="m3-surface-container-lowest rounded-xl p-2 border m3-border-subtle">
                    <div class="text-[11px] font-mono m3-text-muted">M${m}</div>
                    <div class="text-base font-bold font-mono m3-text-primary">${scores[idx] ?? 0}%</div>
                  </div>
                `).join('')}
              </div>
              <div class="text-[11px] font-mono m3-text-muted">
                Verification Ref: ${escapeHtml(p.codeHash || qrRes.signature || '—')}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="rounded-3xl p-6 border-2 border-error m3-error-container flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-3.5">
            <span class="material-symbols-outlined icon-24">gpp_bad</span>
            <div>
              <h2 class="text-xl font-bold">Status: Invalid or Altered</h2>
              <p class="text-sm mt-0.5">${escapeHtml(qrRes.error || 'This certificate link could not be verified.')}</p>
            </div>
          </div>
          <span class="badge badge-error badge-lg font-bold">INVALID</span>
        </div>
      `;
    }
  };

  if (qrParam) {
    await renderQrResult(document.getElementById('verify-qr-container'), qrParam);
  }

  const runInspection = async (keyText) => {
    const out = document.getElementById('verify-output-container');
    const trimmed = String(keyText || '').trim();
    if (trimmed.includes('?v=')) {
      await renderQrResult(out, trimmed);
      return;
    }

    const res = await verifyCompletionKey(keyText);

    if (!res.payload) {
      out.innerHTML = `
        <div class="rounded-3xl p-5 border-2 border-error m3-error-container flex items-center gap-3">
          <span class="material-symbols-outlined text-[30px]">gpp_bad</span>
          <div>
            <div class="font-bold">Could Not Check Certificate</div>
            <div class="text-sm">${escapeHtml(res.error)}</div>
          </div>
        </div>
      `;
      return;
    }

    const p = res.payload;
    const avgQuiz = p.quizzes?.length
      ? Math.round(p.quizzes.reduce((s, q) => s + Number(q.bestScorePercent || 0), 0) / p.quizzes.length)
      : 0;
    const labsList = p.practicals || [];

    out.innerHTML = `
      <div class="flex flex-col gap-5">
        <!-- Verification Status Banner -->
        <div class="rounded-3xl p-5 border-2 ${res.valid ? 'border-success m3-success-container' : 'border-error m3-error-container'} flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <span class="material-symbols-outlined text-[36px]">${res.valid ? 'verified' : 'gpp_bad'}</span>
            <div>
              <h2 class="text-lg sm:text-xl font-extrabold">
                ${res.valid ? 'Status: Authentic & Verified' : 'Status: Invalid or Altered'}
              </h2>
              <div class="text-xs font-mono opacity-90 mt-0.5">
                ${res.valid ? `Verification Ref: ${res.signature.slice(0, 16).toUpperCase()}` : escapeHtml(res.error)}
              </div>
            </div>
          </div>
          <span class="badge ${res.valid ? 'badge-success' : 'badge-error'} badge-lg font-bold">
            ${res.valid ? 'VERIFIED' : 'INVALID'}
          </span>
        </div>

        <!-- Student Summary & Quiz Scores -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="m3-surface-container-lowest rounded-3xl p-5 border m3-border-subtle">
            <h3 class="text-xs font-bold uppercase tracking-wider m3-text-muted mb-2">Student Details</h3>
            <div class="text-xl font-extrabold">${escapeHtml(p.student?.fullName)}</div>
            <div class="font-mono text-sm m3-text-primary mt-0.5">ID / Roll No: ${escapeHtml(p.student?.rollNo)}</div>
            <div class="text-xs m3-text-muted mt-3 space-y-1">
              <div>Course: <strong>${escapeHtml(p.courseName || 'Learning the Web with Basics of Vanilla Front-End Tools (druba.in)')}</strong></div>
              <div>Track Code: <span class="font-mono">${escapeHtml(p.courseCode)}</span></div>
              <div>Issued: ${escapeHtml(formatDate(p.issuedAt))}</div>
              <div>Average Quiz Score: <strong>${avgQuiz}%</strong></div>
            </div>
          </div>

          <div class="lg:col-span-2 m3-surface-container-lowest rounded-3xl p-5 border m3-border-subtle">
            <h3 class="text-xs font-bold uppercase tracking-wider m3-text-muted mb-3">Quiz Scores (60% Needed to Pass)</h3>
            <div class="overflow-x-auto">
              <table class="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Best Score</th>
                    <th>Tries</th>
                    <th>Result</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  ${(p.quizzes || []).map((q) => `
                    <tr>
                      <td class="font-semibold">Module ${q.moduleId}</td>
                      <td class="font-mono font-bold">${q.bestScorePercent}%</td>
                      <td class="font-mono">${q.attempts}</td>
                      <td><span class="badge badge-xs ${q.passed ? 'badge-success' : 'badge-error'}">${q.passed ? 'Passed' : 'Not Passed'}</span></td>
                      <td class="text-xs m3-text-muted">${escapeHtml(formatDate(q.completedAt))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Lab Completion Summary Table -->
        <div class="m3-surface-container-lowest rounded-3xl p-5 border m3-border-subtle">
          <h3 class="text-xs font-bold uppercase tracking-wider m3-text-muted mb-3">Lab Completion Summary</h3>
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead>
                <tr>
                  <th>Lab</th>
                  <th>Code Checks</th>
                  <th>Time Spent</th>
                  <th>Pasted Times</th>
                  <th>Activity Note</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                ${labsList.map((pr) => {
                  const suspicious = pr.pasteCount >= 3 || (pr.pasteCount > 0 && pr.activeTypingSeconds < 15);
                  return `
                    <tr>
                      <td class="font-bold">Lab ${pr.labId}</td>
                      <td class="font-mono">${pr.passedAssertions}/${pr.totalAssertions}</td>
                      <td class="font-mono">${formatDuration(pr.activeTypingSeconds)}</td>
                      <td class="font-mono font-bold ${pr.pasteCount > 0 ? 'text-warning' : ''}">${pr.pasteCount}</td>
                      <td>
                        <span class="badge badge-xs ${suspicious ? 'badge-warning' : 'badge-success'}">
                          ${suspicious ? 'Mostly Pasted' : 'Written Live'}
                        </span>
                      </td>
                      <td class="text-xs m3-text-muted">${escapeHtml(formatDate(pr.completedAt))}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Submitted Lab Code Viewer -->
        <div class="m3-surface-container-lowest rounded-3xl p-5 border m3-border-subtle">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 class="text-sm font-bold flex items-center gap-2">
              <span class="material-symbols-outlined m3-text-primary">code</span>
              Submitted Lab Code
            </h3>
            <div class="tabs tabs-boxed rounded-full p-1 m3-surface-container overflow-x-auto" id="verify-lab-tabs">
              ${LABS.map((l, idx) => `
                <button type="button" class="tab tab-sm rounded-full ${idx === 0 ? 'tab-active font-bold' : ''}" data-inspect-lab="${l.id}">
                  ${l.code}
                </button>
              `).join('')}
            </div>
          </div>

          <div id="verify-lab-detail"></div>
        </div>
      </div>
    `;

    const showInspectLab = (labId) => {
      const labMeta = getLabById(labId);
      const prac = labsList.find((item) => Number(item.labId) === Number(labId)) || {
        labId, htmlCode: '', cssCode: '', jsCode: '', activeTypingSeconds: 0, pasteCount: 0
      };
      out.querySelectorAll('[data-inspect-lab]').forEach((b) => {
        const active = Number(b.dataset.inspectLab) === Number(labId);
        b.classList.toggle('tab-active', active);
        b.classList.toggle('font-bold', active);
      });

      const detail = document.getElementById('verify-lab-detail');
      detail.innerHTML = `
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="font-bold text-sm">${escapeHtml(labMeta?.code)}: ${escapeHtml(labMeta?.title)}</div>
          <div class="font-mono m3-text-muted">Time Spent: ${formatDuration(prac.activeTypingSeconds)} · Pasted: ${prac.pasteCount}</div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="flex flex-col gap-3 max-h-[440px] overflow-y-auto pr-1">
            <div class="m3-code-block">
              <div class="m3-code-header"><span>index.html</span></div>
              <pre class="m3-code-pre"><code>${escapeHtml(prac.htmlCode || '(empty)')}</code></pre>
            </div>
            ${prac.cssCode ? `
              <div class="m3-code-block">
                <div class="m3-code-header"><span>style.css</span></div>
                <pre class="m3-code-pre"><code>${escapeHtml(prac.cssCode)}</code></pre>
              </div>
            ` : ''}
            ${prac.jsCode ? `
              <div class="m3-code-block">
                <div class="m3-code-header"><span>app.js</span></div>
                <pre class="m3-code-pre"><code>${escapeHtml(prac.jsCode)}</code></pre>
              </div>
            ` : ''}
          </div>
          <div>
            <div class="text-xs font-bold uppercase m3-text-muted mb-1.5">Live Page Preview</div>
            <iframe id="verify-lab-iframe" class="ide-verify-preview-frame" sandbox="allow-scripts allow-modals" title="Submitted Lab Page Preview"></iframe>
          </div>
        </div>
      `;

      const frame = document.getElementById('verify-lab-iframe');
      if (frame) {
        frame.srcdoc = composeSrcDoc(prac.htmlCode, prac.cssCode, prac.jsCode);
      }
    };

    out.querySelectorAll('[data-inspect-lab]').forEach((btn) => {
      btn.addEventListener('click', () => showInspectLab(btn.dataset.inspectLab));
    });
    showInspectLab(1);
  };

  document.getElementById('verify-inspect-btn')?.addEventListener('click', () => {
    runInspection(document.getElementById('verify-key-input').value);
  });
  document.getElementById('verify-clear-btn')?.addEventListener('click', () => {
    document.getElementById('verify-key-input').value = '';
    document.getElementById('verify-output-container').innerHTML = '';
  });
  document.getElementById('verify-demo-valid-btn')?.addEventListener('click', async () => {
    const key = await generateDemoKey(false);
    document.getElementById('verify-key-input').value = key;
    await runInspection(key);
  });
  document.getElementById('verify-demo-tamper-btn')?.addEventListener('click', async () => {
    const key = await generateDemoKey(true);
    document.getElementById('verify-key-input').value = key;
    await runInspection(key);
  });

  if (keyParam) {
    const keyInput = document.getElementById('verify-key-input');
    if (keyInput) keyInput.value = keyParam;
    await runInspection(keyParam);
  }
}

// ============================================================================
// Printable Lab Manual (#/manual)
// ============================================================================

async function renderManualView() {
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

// ============================================================================
// Hash Router & Lifecycle
// ============================================================================

function setWorkspaceLayoutMode(isIDE) {
  const view = document.getElementById('app-view');
  if (!view) return;
  if (isIDE) {
    view.className = 'flex-1 min-w-0 h-full overflow-hidden p-0';
  } else {
    view.className = 'flex-1 min-w-0 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20';
  }
}

function closeMobileDrawer() {
  document.getElementById('nav-drawer')?.classList.remove('is-open');
  document.getElementById('drawer-backdrop')?.classList.add('hidden');
}

function openMobileDrawer() {
  document.getElementById('nav-drawer')?.classList.add('is-open');
  document.getElementById('drawer-backdrop')?.classList.remove('hidden');
}

async function handleRoute() {
  if (appState.cleanupSplitResizers) {
    appState.cleanupSplitResizers();
    appState.cleanupSplitResizers = null;
  }
  if (appState.activeIDE) {
    appState.activeIDE.destroy();
    appState.activeIDE = null;
  }

  closeMobileDrawer();
  renderSidebarAndProgress();

  const rawHash = window.location.hash || '#/';
  const route = rawHash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = route.split('?');
  const queryParams = new URLSearchParams(queryPart || '');
  const parts = pathPart.split('/').filter(Boolean);

  document.body.classList.toggle('is-certificate-route', parts[0] === 'certificate');

  if (parts.length === 0) {
    setWorkspaceLayoutMode(false);
    renderHomeView();
    return;
  }

  if (parts[0] === 'module' && parts[1]) {
    setWorkspaceLayoutMode(false);
    renderModuleView(Number(parts[1]));
    return;
  }

  if (parts[0] === 'quiz' && parts[1]) {
    setWorkspaceLayoutMode(false);
    renderQuizView(Number(parts[1]));
    return;
  }

  if (parts[0] === 'lab' && parts[1]) {
    await renderLabView(Number(parts[1]), false);
    return;
  }

  if (parts[0] === 'bonus') {
    await renderLabView(0, true);
    return;
  }

  if (parts[0] === 'certificate') {
    setWorkspaceLayoutMode(false);
    await renderCertificateView();
    return;
  }

  if (parts[0] === 'verify') {
    setWorkspaceLayoutMode(false);
    await renderVerifyView(queryParams);
    return;
  }

  if (parts[0] === 'manual') {
    setWorkspaceLayoutMode(false);
    await renderManualView();
    return;
  }

  setWorkspaceLayoutMode(false);
  renderHomeView();
}

// ============================================================================
// Application Boot & Font-Readiness Gating
// ============================================================================

async function waitForFontsReady(timeoutMs = 2500) {
  if (!document.fonts) return;

  const fontLoads = Promise.all([
    document.fonts.ready.catch(() => {}),
    typeof document.fonts.load === 'function'
      ? document.fonts.load('20px "Material Symbols Outlined"').catch(() => {})
      : Promise.resolve(),
    typeof document.fonts.load === 'function'
      ? document.fonts.load('16px "Google Sans"').catch(() => {})
      : Promise.resolve()
  ]);

  const timeoutGuard = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([fontLoads, timeoutGuard]);
}

function dismissBootLoader() {
  const loader = document.getElementById('app-boot-loader');
  if (!loader) return;

  loader.classList.add('boot-loader-hidden');
  loader.style.opacity = '0';
  loader.style.pointerEvents = 'none';
  setTimeout(() => {
    loader.remove();
  }, 240);
}

async function bootstrap() {
  const fontsReadyPromise = waitForFontsReady(2500);

  try {
    initTheme();
    initRailState();
    await refreshStateFromDB();
    bindGlobalModals();

    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'm3-dark' ? 'm3-light' : 'm3-dark');
    });

    document.getElementById('drawer-toggle-btn')?.addEventListener('click', openMobileDrawer);
    document.getElementById('drawer-close-btn')?.addEventListener('click', closeMobileDrawer);
    document.getElementById('drawer-backdrop')?.addEventListener('click', closeMobileDrawer);

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();
  } finally {
    await fontsReadyPromise;
    dismissBootLoader();
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
