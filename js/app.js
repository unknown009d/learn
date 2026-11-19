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
  getAllLessonProgress,
  markLessonCompleted,
  exportFullState,
  importFullState,
  getCachedCertificate,
  saveCachedCertificate,
  clearCachedCertificate,
  clearAllData
} from './db.js';
import { MODULES, BONUS_MODULE, getModuleById } from './course-data.js';
import { getQuizByModule } from './quiz-data.js';
import { LABS, getLabById, getLabsByModule } from './labs-data.js';
import { LabIDEController, composeSrcDoc } from './ide.js';
import { renderLessonWidgetHtml, hydrateLessonWidget, runJsInSandbox } from './lesson-widgets.js';
import {
  issueSignedCertificate,
  validateCachedCertificate,
  verifyCompletionKey,
  verifyCompactQrToken,
  encodeBackupToken,
  decodeBackupToken
} from './crypto-key.js';

const THEME_STORAGE_KEY = 'druba_web_theme';
const RAIL_STORAGE_KEY = 'druba_web_rail_collapsed';
const SPLITS_STORAGE_KEY = 'druba_web_pane_splits';

const appState = {
  profile: null,
  quizzes: new Map(),
  practicals: new Map(),
  lessons: new Set(),
  activeIDE: null,
  cleanupSplitResizers: null,
  cleanupRouteView: null,
  quizSession: null, // holds shuffled quiz state during active attempt
  shortcutContext: null, // { onRunAdvance?: Function, onSave?: Function }
  certCache: null, // L1 in-memory validated signed certificate
  certIssuePromise: null, // deduplicates background prefetch & route fetch
  certIssueGeneration: 0, // invalidates in-flight fetches on reset / backup import
  certRenderToken: 0, // guards async render if user navigates away
  audioManifest: null, // { voice, lessons: { [id]: { file, duration, voice } } }
  stopLessonAudio: null
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

function scrollViewToTop() {
  const view = document.getElementById('app-view');
  if (view) {
    view.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const [profile, quizzes, practicals, lessons] = await Promise.all([
    getProfile(),
    getAllQuizzes(),
    getAllPracticals(),
    getAllLessonProgress()
  ]);
  appState.profile = profile;
  appState.quizzes = new Map(quizzes.map((q) => [Number(q.moduleId), q]));
  appState.practicals = new Map(practicals.map((p) => [Number(p.labId), p]));
  appState.lessons = new Set((lessons || []).filter((l) => l.completed).map((l) => l.lessonKey));
}

function isLessonCompleted(moduleId, lessonId) {
  return appState.lessons.has(`${Number(moduleId)}:${lessonId}`);
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

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'm3-dark' || saved === 'm3-light' ? saved : null;
  } catch {
    return null;
  }
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'm3-dark'
    : 'm3-light';
}

function applyTheme(theme, { persist = true } = {}) {
  const normalized = theme === 'm3-dark' ? 'm3-dark' : 'm3-light';
  document.documentElement.setAttribute('data-theme', normalized);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {}
  }
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.textContent = normalized === 'm3-dark' ? 'light_mode' : 'dark_mode';
  }
  document.querySelectorAll('.js-theme-toggle-icon').forEach((el) => {
    el.textContent = normalized === 'm3-dark' ? 'light_mode' : 'dark_mode';
  });
  const label = document.getElementById('theme-toggle-label');
  if (label) {
    label.textContent = normalized === 'm3-dark' ? 'Light Mode' : 'Dark Mode';
  }
  if (appState.activeIDE) {
    appState.activeIDE.syncTheme();
  }
}

function initTheme() {
  const saved = getSavedTheme();
  applyTheme(saved || getSystemTheme(), { persist: false });

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = (e) => {
      if (!getSavedTheme()) {
        applyTheme(e.matches ? 'm3-dark' : 'm3-light', { persist: false });
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onSystemThemeChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onSystemThemeChange);
    }
  }
}

// ============================================================================
// Checkpoint Saved Modal & Backup Modal
// ============================================================================

function launchCheckpointBurst() {
  const modal = document.getElementById('checkpoint-modal');
  const box = modal?.querySelector('.modal-box');
  const layer = document.getElementById('checkpoint-burst-layer');
  if (!box || !layer) return;

  layer.innerHTML = '';

  const isDark = document.documentElement.getAttribute('data-theme') === 'm3-dark';
  const palette = isDark
    ? ['#34d375', '#6ee7b7', '#b9f3c6', '#a2ced7', '#ffb870', '#fde047']
    : ['#0e7a3a', '#16a34a', '#0284c7', '#d97706', '#e11d48', '#7c3aed'];

  requestAnimationFrame(() => {
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const origins = [
      { x: rect.left + rect.width * 0.14, y: rect.top + rect.height * 0.14, count: 18 },
      { x: rect.right - rect.width * 0.14, y: rect.top + rect.height * 0.14, count: 18 },
      { x: rect.left + rect.width * 0.5, y: rect.top + 8, count: 14 }
    ];

    origins.forEach((origin, oIdx) => {
      for (let i = 0; i < origin.count; i++) {
        const p = document.createElement('span');
        p.className = 'ck-particle';

        const angle = (Math.PI * 2 * i) / origin.count + (Math.random() - 0.5) * 0.35;
        const dist = 55 + Math.random() * 95;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist + 18;
        const size = 6 + Math.round(Math.random() * 5);
        const isRibbon = i % 3 === 0;

        p.style.setProperty('--sx', `${origin.x.toFixed(1)}px`);
        p.style.setProperty('--sy', `${origin.y.toFixed(1)}px`);
        p.style.setProperty('--tx', `${tx.toFixed(1)}px`);
        p.style.setProperty('--ty', `${ty.toFixed(1)}px`);
        p.style.setProperty('--size', `${size}px`);
        p.style.setProperty('--radius', isRibbon ? '3px' : '9999px');
        p.style.setProperty('--color', palette[(i + oIdx) % palette.length]);
        p.style.setProperty('--dur', `${900 + Math.round(Math.random() * 450)}ms`);
        p.style.setProperty('--delay', `${oIdx * 110 + Math.round(Math.random() * 80)}ms`);
        p.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 360)}deg`);

        if (isRibbon) {
          p.style.width = `${size + 6}px`;
          p.style.height = `${Math.max(4, size - 3)}px`;
        }

        layer.appendChild(p);
      }
    });
  });
}

async function triggerCheckpointModal(title, description, moduleCode = 'M1') {
  const modal = document.getElementById('checkpoint-modal');
  if (!modal) return;

  const fullState = await exportFullState();
  const token = await encodeBackupToken(fullState);
  const safeRoll = (fullState.profile?.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeRoll}_druba-web_${moduleCode}.vwfd`;

  // Extract percentage score (e.g. "Module 1 Quiz Passed (100%)" -> "100%")
  const scoreMatch = String(title || '').match(/(\d+%)/);
  const cleanHeading = String(title || 'Milestone Unlocked').replace(/\s*\(\d+%\)/, '').trim();

  const scoreVal = document.getElementById('checkpoint-score-value');
  const scoreLbl = document.getElementById('checkpoint-score-label');
  if (scoreVal && scoreLbl) {
    scoreVal.textContent = scoreMatch ? scoreMatch[1] : '100%';
    scoreLbl.textContent = scoreMatch ? 'Quiz Score' : 'Labs Verified';
  }

  const badgeEl = document.getElementById('checkpoint-modal-badge');
  if (badgeEl) badgeEl.textContent = `${moduleCode.replace('_', ' ')} Milestone`;

  const titleEl = document.getElementById('checkpoint-modal-title');
  if (titleEl) titleEl.textContent = cleanHeading;

  const descEl = document.getElementById('checkpoint-modal-desc');
  if (descEl) {
    descEl.textContent = description || 'Your progress is saved automatically in this browser.';
  }

  const prog = computeOverallProgress();
  const progText = document.getElementById('checkpoint-progress-text');
  if (progText) {
    progText.textContent = `${prog.done} of ${prog.totalSteps} Milestones Completed (${prog.percent}%)`;
  }

  // Always start collapsed
  const backupAccordion = document.getElementById('checkpoint-backup-accordion');
  if (backupAccordion) backupAccordion.open = false;

  document.getElementById('checkpoint-token-preview').value = token;
  document.getElementById('checkpoint-filename-badge').textContent = filename;
  document.getElementById('checkpoint-download-name').textContent = 'Download .vwfd';

  const copyBtn = document.getElementById('checkpoint-copy-token-btn');
  copyBtn.onclick = () => copyToClipboard(token, 'Backup text copied! Save it in your notes or messages.');

  const dlBtn = document.getElementById('checkpoint-download-btn');
  dlBtn.onclick = () => {
    downloadFile(filename, token);
    showToast(`Downloaded ${filename}`, 'success');
  };

  if (typeof modal.showModal === 'function') {
    modal.showModal();
    launchCheckpointBurst();
  }
}

function bindGlobalModals() {
  const settingsBtn = document.getElementById('nav-settings-btn');
  const settingsMenu = document.getElementById('nav-settings-menu');
  const closeSettingsMenu = () => {
    settingsMenu?.classList.add('hidden');
    settingsBtn?.setAttribute('aria-expanded', 'false');
  };
  if (settingsBtn && settingsMenu) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = settingsMenu.classList.contains('hidden');
      settingsMenu.classList.toggle('hidden', !willOpen);
      settingsBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    settingsMenu.addEventListener('click', () => {
      closeSettingsMenu();
    });
    document.addEventListener('click', (e) => {
      if (!settingsMenu.classList.contains('hidden') && !e.target.closest('#nav-settings-dropdown')) {
        closeSettingsMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSettingsMenu();
    });
  }

  bindBackupModal();
  document.querySelectorAll('.js-open-backup').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeSettingsMenu();
      closeMobileDrawer();
      openBackupModal();
    });
  });

  const shortcutsModal = document.getElementById('shortcuts-modal');
  if (shortcutsModal) {
    document.querySelectorAll('.js-open-shortcuts').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeSettingsMenu();
        closeMobileDrawer();
        if (typeof shortcutsModal.showModal === 'function') shortcutsModal.showModal();
      });
    });
  }
}

// ----------------------------------------------------------------------------
// Save or Load Progress — Single-Column Tabbed Dialog Controller
// ----------------------------------------------------------------------------

const BACKUP_MAX_BYTES = 2 * 1024 * 1024;

const backupUi = {
  bound: false,
  fileState: null, // parsed state from dropped / selected file
  textState: null, // parsed state from pasted backup text
  activeSource: null, // 'file' | 'text'
  textValidationSeq: 0,
  copyTimer: null,
  resetTimer: null,
  resetArmed: false
};

function summarizeBackupState(state) {
  const totalSteps = 5 + LABS.length;
  const passedQuizzes = new Set(
    (Array.isArray(state?.quizzes) ? state.quizzes : [])
      .filter((q) => q && q.passed && Number(q.moduleId) >= 1 && Number(q.moduleId) <= 5)
      .map((q) => Number(q.moduleId))
  );
  const labIds = new Set(LABS.map((l) => Number(l.id)));
  const doneLabs = new Set(
    (Array.isArray(state?.practicals) ? state.practicals : [])
      .filter((p) => p && p.completed && labIds.has(Number(p.labId)))
      .map((p) => Number(p.labId))
  );
  const done = Math.min(totalSteps, passedQuizzes.size + doneLabs.size);
  return `${state?.profile?.fullName || 'Student'} · ${done}/${totalSteps} Steps Completed`;
}

function assertValidBackupState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('This file does not contain saved progress.');
  }
  if (!state.profile || !state.profile.fullName || !state.profile.rollNo) {
    throw new Error('This backup is missing the student name or ID.');
  }
  return state;
}

function setBackupTab(tab) {
  const modal = document.getElementById('backup-modal');
  if (!modal) return;
  modal.querySelectorAll('.bk-tab').forEach((btn) => {
    const selected = btn.dataset.bkTab === tab;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.tabIndex = selected ? 0 : -1;
  });
  document.getElementById('bk-panel-load').hidden = tab !== 'load';
  document.getElementById('bk-panel-save').hidden = tab !== 'save';
}

function updateBackupImportButton() {
  const btn = document.getElementById('modal-restore-btn');
  if (!btn) return;
  const ready =
    (backupUi.activeSource === 'file' && backupUi.fileState) ||
    (backupUi.activeSource === 'text' && backupUi.textState);
  btn.disabled = !ready;
}

function resetBackupDropzone() {
  backupUi.fileState = null;
  if (backupUi.activeSource === 'file') {
    backupUi.activeSource = backupUi.textState ? 'text' : null;
  }
  const zone = document.getElementById('bk-dropzone');
  zone?.classList.remove('has-file', 'has-error', 'is-dragover');
  const input = document.getElementById('modal-restore-file');
  if (input) input.value = '';
  updateBackupImportButton();
}

function showBackupDropzoneError(message) {
  backupUi.fileState = null;
  if (backupUi.activeSource === 'file') backupUi.activeSource = backupUi.textState ? 'text' : null;
  const zone = document.getElementById('bk-dropzone');
  zone?.classList.remove('has-file', 'is-dragover');
  zone?.classList.add('has-error');
  document.getElementById('bk-file-error').textContent = message;
  updateBackupImportButton();
}

async function handleBackupFile(file) {
  if (!file) return;
  const isVwfd = /\.vwfd$/i.test(file.name);
  if (!isVwfd) {
    showBackupDropzoneError('Only .vwfd backup files are accepted. JSON files are not supported.');
    return;
  }
  if (file.size > BACKUP_MAX_BYTES) {
    showBackupDropzoneError(`File is too large (${(file.size / 1048576).toFixed(1)}MB). Maximum size is 2MB.`);
    return;
  }
  try {
    const text = await file.text();
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      throw new Error('Raw JSON files are not allowed. Please select an authentic .vwfd backup file.');
    }
    const parsed = assertValidBackupState(await decodeBackupToken(text));
    backupUi.fileState = parsed;
    backupUi.activeSource = 'file';
    const zone = document.getElementById('bk-dropzone');
    zone.classList.remove('has-error', 'is-dragover');
    zone.classList.add('has-file');
    document.getElementById('bk-file-name').textContent = file.name;
    document.getElementById('bk-file-name').title = file.name;
    document.getElementById('bk-file-summary').textContent = summarizeBackupState(parsed);
    updateBackupImportButton();
  } catch (err) {
    showBackupDropzoneError(err.message || 'Could not read this file.');
  }
}

async function validateBackupText() {
  const ta = document.getElementById('modal-restore-token');
  const status = document.getElementById('bk-paste-status');
  const raw = ta?.value.trim() || '';
  const seq = ++backupUi.textValidationSeq;
  status.classList.remove('is-valid', 'is-invalid');

  if (!raw) {
    backupUi.textState = null;
    status.textContent = '';
    if (backupUi.activeSource === 'text') backupUi.activeSource = backupUi.fileState ? 'file' : null;
    updateBackupImportButton();
    return;
  }

  try {
    const parsed = assertValidBackupState(await decodeBackupToken(raw));
    if (seq !== backupUi.textValidationSeq) return;
    backupUi.textState = parsed;
    backupUi.activeSource = 'text';
    status.textContent = `✓ ${summarizeBackupState(parsed)}`;
    status.classList.add('is-valid');
  } catch (err) {
    if (seq !== backupUi.textValidationSeq) return;
    backupUi.textState = null;
    if (backupUi.activeSource === 'text') backupUi.activeSource = backupUi.fileState ? 'file' : null;
    status.textContent = err.message || 'Backup text not recognized. Paste the full text exactly as copied.';
    status.classList.add('is-invalid');
  }
  updateBackupImportButton();
}

function setPasteAccordion(open) {
  const toggle = document.getElementById('bk-paste-toggle');
  const region = document.getElementById('bk-paste-region');
  if (!toggle || !region) return;
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  region.hidden = !open;
  if (open) setTimeout(() => document.getElementById('modal-restore-token')?.focus(), 0);
}

function disarmBackupReset() {
  backupUi.resetArmed = false;
  clearTimeout(backupUi.resetTimer);
  const btn = document.getElementById('modal-reset-progress-btn');
  if (!btn) return;
  btn.classList.remove('is-confirming');
  btn.querySelector('.bk-reset-label').textContent = 'Reset Progress';
}

function resetCopyButton() {
  clearTimeout(backupUi.copyTimer);
  const btn = document.getElementById('modal-copy-token-btn');
  if (!btn) return;
  btn.classList.remove('is-copied');
  btn.querySelector('.bk-copy-icon').textContent = 'content_copy';
  btn.querySelector('.bk-copy-label').textContent = 'Copy Backup Text';
}

function resetBackupModalState() {
  backupUi.textState = null;
  backupUi.activeSource = null;
  resetBackupDropzone();
  const ta = document.getElementById('modal-restore-token');
  if (ta) ta.value = '';
  const status = document.getElementById('bk-paste-status');
  if (status) {
    status.textContent = '';
    status.classList.remove('is-valid', 'is-invalid');
  }
  setPasteAccordion(false);
  disarmBackupReset();
  resetCopyButton();
  updateBackupImportButton();
}

function refreshBackupSaveSummary() {
  const el = document.getElementById('bk-save-summary');
  if (!el) return;
  if (!isRegistered()) {
    el.textContent = 'No saved progress yet';
    return;
  }
  const prog = computeOverallProgress();
  el.textContent = `${appState.profile.fullName} · ${prog.done}/${prog.totalSteps} Steps Completed`;
}

function openBackupModal(tab) {
  const modal = document.getElementById('backup-modal');
  if (!modal) return;
  resetBackupModalState();
  refreshBackupSaveSummary();
  setBackupTab(tab || (isRegistered() ? 'save' : 'load'));
  if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
}

function bindBackupModal() {
  const modal = document.getElementById('backup-modal');
  if (!modal || backupUi.bound) return;
  backupUi.bound = true;

  // Tabs (click + arrow-key roving focus)
  const tabs = Array.from(modal.querySelectorAll('.bk-tab'));
  tabs.forEach((btn, idx) => {
    btn.addEventListener('click', () => setBackupTab(btn.dataset.bkTab));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      setBackupTab(next.dataset.bkTab);
      next.focus();
    });
  });

  // Dropzone
  const zone = document.getElementById('bk-dropzone');
  const input = document.getElementById('modal-restore-file');
  const openPicker = () => input?.click();

  zone.addEventListener('click', (e) => {
    if (zone.classList.contains('has-file')) return;
    if (e.target.closest('#bk-file-reset')) return;
    openPicker();
  });
  zone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) {
      e.preventDefault();
      openPicker();
    }
  });
  document.getElementById('bk-file-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetBackupDropzone();
    zone.focus();
  });
  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleBackupFile(file);
    input.value = '';
  });

  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  ['dragenter', 'dragover'].forEach((type) => {
    zone.addEventListener(type, (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('is-dragover');
    });
  });
  zone.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && zone.contains(e.relatedTarget)) return;
    zone.classList.remove('is-dragover');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleBackupFile(file);
  });
  // Never let a stray drop inside the dialog navigate the browser away
  ['dragover', 'drop'].forEach((type) => modal.addEventListener(type, (e) => e.preventDefault()));

  // Backup text accordion
  document.getElementById('bk-paste-toggle')?.addEventListener('click', () => {
    const open = document.getElementById('bk-paste-toggle').getAttribute('aria-expanded') !== 'true';
    setPasteAccordion(open);
  });
  let pasteDebounce = null;
  document.getElementById('modal-restore-token')?.addEventListener('input', () => {
    clearTimeout(pasteDebounce);
    pasteDebounce = setTimeout(validateBackupText, 200);
  });

  // Import
  document.getElementById('modal-restore-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const state = backupUi.activeSource === 'file' ? backupUi.fileState : backupUi.textState;
    if (!state) return;
    btn.disabled = true;
    try {
      await importFullState(state);
      invalidateInMemoryCertCache();
      await refreshStateFromDB();
      renderSidebarAndProgress();
      modal.close();
      showToast(`Welcome back, ${state.profile.fullName}! Your progress is loaded.`, 'success');
      handleRoute();
      prefetchCertificateInBackground();
    } catch (err) {
      showToast('Could not load saved progress: ' + err.message, 'error');
      updateBackupImportButton();
    }
  });

  // Save Backup: download
  document.getElementById('modal-export-json-btn')?.addEventListener('click', async () => {
    const state = await exportFullState();
    const token = await encodeBackupToken(state);
    const safeRoll = (state.profile?.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeRoll}_druba-web.vwfd`;
    downloadFile(filename, token);
    showToast(`Downloaded ${filename}`, 'success');
  });

  // Save Backup: copy text (button label feedback for 2s)
  document.getElementById('modal-copy-token-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      const token = await encodeBackupToken(await exportFullState());
      try {
        await navigator.clipboard.writeText(token);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = token;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        modal.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      clearTimeout(backupUi.copyTimer);
      btn.classList.add('is-copied');
      btn.querySelector('.bk-copy-icon').textContent = 'check';
      btn.querySelector('.bk-copy-label').textContent = 'Copied!';
      backupUi.copyTimer = setTimeout(resetCopyButton, 2000);
    } catch (err) {
      showToast('Could not copy backup text: ' + err.message, 'error');
    }
  });

  // Reset Progress (two-click confirmation)
  document.getElementById('modal-reset-progress-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!backupUi.resetArmed) {
      backupUi.resetArmed = true;
      btn.classList.add('is-confirming');
      btn.querySelector('.bk-reset-label').textContent = 'Confirm Reset?';
      backupUi.resetTimer = setTimeout(disarmBackupReset, 4000);
      return;
    }
    disarmBackupReset();
    await clearAllData();
    invalidateInMemoryCertCache();
    await refreshStateFromDB();
    renderSidebarAndProgress();
    modal.close();
    window.location.hash = '#/';
    handleRoute();
    showToast('Saved progress cleared.', 'info');
  });

  modal.addEventListener('close', () => {
    disarmBackupReset();
    resetCopyButton();
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
  let collapsed = window.innerWidth < 1280;
  try {
    const saved = localStorage.getItem(RAIL_STORAGE_KEY);
    if (saved === 'true' || saved === 'false') {
      collapsed = saved === 'true';
    }
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

function toggleCourseSidebar() {
  if (window.innerWidth >= 1024) {
    const drawer = document.getElementById('nav-drawer');
    const isCurrentlyCollapsed = drawer?.classList.contains('is-rail-collapsed');
    setRailCollapsed(!isCurrentlyCollapsed);
  } else {
    const drawer = document.getElementById('nav-drawer');
    const isOpen = drawer && !drawer.classList.contains('-translate-x-full');
    if (isOpen) closeMobileDrawer();
    else openMobileDrawer();
  }
}

function renderSidebarAndProgress() {
  const prog = computeOverallProgress();
  const navBar = document.getElementById('nav-progress-bar');
  const navLbl = document.getElementById('nav-progress-label');
  if (navBar) navBar.value = prog.percent;
  if (navLbl) navLbl.textContent = `${prog.done}/${prog.totalSteps} · ${prog.percent}%`;

  const topVerifyLink = document.getElementById('nav-verify-link');
  if (topVerifyLink) {
    topVerifyLink.classList.toggle('hidden', isRegistered());
  }

  const profileCard = document.getElementById('sidebar-profile-card');
  if (profileCard) {
    if (isRegistered()) {
      const initial = escapeHtml(appState.profile.fullName.charAt(0).toUpperCase());
      profileCard.innerHTML = `
        <div class="rail-expanded-only p-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full m3-avatar-primary flex items-center justify-center font-bold text-xs shrink-0">
              ${initial}
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm truncate">${escapeHtml(appState.profile.fullName)}</div>
              <div class="text-xs font-mono m3-text-muted truncate">${escapeHtml(appState.profile.rollNo)}</div>
            </div>
            <a href="#/" class="btn btn-xs btn-ghost btn-circle shrink-0 m3-text-muted" title="Course Overview" aria-label="Course Overview">
              <span class="material-symbols-outlined icon-18">home</span>
            </a>
          </div>
        </div>
        <div class="rail-collapsed-only p-1.5 justify-center">
          <a href="#/" class="w-9 h-9 rounded-full m3-avatar-primary flex items-center justify-center font-bold text-sm" title="${escapeHtml(appState.profile.fullName)} (${escapeHtml(appState.profile.rollNo)})">
            ${initial}
          </a>
        </div>
      `;
    } else {
      profileCard.innerHTML = `
        <div class="rail-expanded-only p-3">
          <div class="flex items-center gap-2 text-sm font-semibold">
            <span class="material-symbols-outlined icon-20 m3-text-primary">person_add</span>
            <span>Welcome Guest</span>
          </div>
          <p class="text-xs m3-text-muted mt-1">Enter your name and ID to have your account locally.</p>
        </div>
        <div class="rail-collapsed-only p-1.5 justify-center">
          <button class="btn btn-sm btn-ghost btn-circle" title="Enter your details to create an account"
                  onclick="document.querySelector('#reg-fullname').focus()">
            <span class="material-symbols-outlined icon-20 m3-text-primary">person_add</span>
          </button>
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
    const isLessonRoute = currentHash === modHash || currentHash.startsWith(`${modHash}/lesson/`);
    const activeLessonNum = currentHash.startsWith(`${modHash}/lesson/`)
      ? Number(currentHash.split('/')[4] || 1)
      : (currentHash === modHash ? 1 : 0);
    const isAnyInModActive =
      isLessonRoute ||
      currentHash === quizHash ||
      mod.labIds.some((lid) => currentHash === `#/lab/${lid}`);

    html += `
      <!-- Expanded Drawer Module Accordion -->
      <details class="rail-expanded-only m3-accordion m3-sidebar-mod rounded-2xl border m3-border-subtle ${!gate.unlocked ? 'opacity-75' : ''}" ${isAnyInModActive ? 'open' : ''}>
        <summary class="m3-accordion-trigger p-2.5 text-xs font-semibold">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="w-5 h-5 rounded-full m3-sidebar-code ${!gate.unlocked ? 'is-locked' : ''} font-bold text-[10px] font-mono flex items-center justify-center shrink-0">
              ${mod.code}
            </span>
            <span class="truncate">${escapeHtml(mod.title)}</span>
          </div>
          <span class="material-symbols-outlined icon-18 m3-accordion-chevron shrink-0">expand_more</span>
        </summary>

        <div class="px-2 pb-2.5 pt-1 flex flex-col gap-1">
          ${mod.sections.map((sec, idx) => {
            const stepNum = idx + 1;
            const secDone = isLessonCompleted(mod.id, sec.id);
            const secActive = isLessonRoute && activeLessonNum === stepNum;
            return `
              <a href="#/module/${mod.id}/lesson/${stepNum}" class="m3-nav-item ${secActive ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium min-w-0" title="${escapeHtml(sec.title)}">
                <span class="material-symbols-outlined shrink-0 text-base ${secActive ? '' : secDone ? 'm3-text-primary' : 'm3-text-muted'}">
                  ${secActive ? 'radio_button_checked' : secDone ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span class="truncate">${stepNum}. ${escapeHtml(sec.title)}</span>
              </a>
            `;
          }).join('')}

          <a href="${quizHash}" class="m3-nav-item ${currentHash === quizHash ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium">
            <span class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-base shrink-0">quiz</span>
              <span class="truncate">Graded Quiz</span>
            </span>
            ${quizPassed ? '<span class="material-symbols-outlined m3-text-primary text-base shrink-0">check_circle</span>' : ''}
          </a>

          ${mod.labIds.map((lid) => {
            const lab = getLabById(lid);
            const labGate = getLabGateStatus(lid);
            const labDone = isLabCompleted(lid);
            const labActive = currentHash === `#/lab/${lid}`;
            return `
              <a href="#/lab/${lid}" class="m3-nav-item ${labActive ? 'is-active' : ''} ${!labGate.unlocked ? 'is-locked' : ''} flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium" title="${escapeHtml(lab.code)}: ${escapeHtml(lab.title)}">
                <span class="flex items-center gap-2 min-w-0">
                  <span class="material-symbols-outlined text-base shrink-0 ${labDone && !labActive ? 'm3-text-primary' : ''}">${labDone ? 'check_circle' : labGate.unlocked ? 'code' : 'lock'}</span>
                  <span class="truncate">${escapeHtml(lab.code)}: ${escapeHtml(lab.title)}</span>
                </span>
                ${labDone ? '<span class="material-symbols-outlined m3-text-primary text-base shrink-0">check_circle</span>' : ''}
              </a>
            `;
          }).join('')}
        </div>
      </details>

      <!-- Collapsed M3 Rail Item -->
      <a href="${modHash}" class="rail-collapsed-only m3-nav-item ${isAnyInModActive ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex-col items-center justify-center py-2 px-1 rounded-2xl border m3-border-subtle gap-0.5" title="${mod.code}: ${escapeHtml(mod.title)}">
        <span class="material-symbols-outlined icon-20 ${modComplete && !isAnyInModActive ? 'filled m3-text-primary' : ''}">
          ${modComplete ? 'check_circle' : gate.unlocked ? mod.icon : 'lock'}
        </span>
        <span class="text-[10px] font-mono font-bold leading-none">${mod.code}</span>
      </a>
    `;
  }

  const certUnlocked = isCertificateUnlocked();
  html += `
    <div class="mt-2 flex flex-col gap-1 pt-2 border-t m3-border-subtle">
      <a href="#/certificate" class="m3-nav-item rail-link ${currentHash === '#/certificate' ? 'is-active' : ''} ${!certUnlocked ? 'is-locked' : ''} flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold" title="Certificate">
        <span class="material-symbols-outlined icon-20 shrink-0">${certUnlocked ? 'workspace_premium' : 'lock'}</span>
        <span class="rail-expanded-only truncate">Certificate</span>
      </a>
      <a href="#/manual" class="m3-nav-item rail-link ${currentHash === '#/manual' ? 'is-active' : ''} flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium" title="Printable Lab Manual">
        <span class="material-symbols-outlined icon-20 shrink-0">menu_book</span>
        <span class="rail-expanded-only truncate">Lab Manual</span>
      </a>
      <a href="#/verify" class="m3-nav-item rail-link ${currentHash === '#/verify' ? 'is-active' : ''} flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium" title="Check Certificate">
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
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="max-w-2xl">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="badge m3-primary-container font-mono font-bold px-3 py-2.5">Free course</span>
              <span class="badge m3-tonal-badge font-medium px-3 py-2.5">Self-Paced Learning</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
              Learn to build for the Web, step by step
            </h1>
            <p class="m3-text-muted mt-2.5 text-sm sm:text-base">
              Start from how websites work and build real pages using HTML, CSS, and JavaScript. Read each short lesson, pass a quick 60% quiz, and complete 8 hands-on coding labs right in your browser. Finish all modules to download your verified certificate.
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
            ${!registered ? 
            `
              <span class="material-symbols-outlined codeicon text-primary">code_xml</span>  
            `:
            `
              <div class="radial-progress text-primary font-bold text-xl" style="--value:${prog.percent}; --size:5.25rem; --thickness:7px;" role="progressbar">
                ${prog.percent}%
              </div>
              <div class="font-bold text-sm mt-3">${prog.done} / ${prog.totalSteps} Steps</div>
              <div class="text-xs m3-text-muted mt-0.5">5 Quizzes &middot; 8 Coding Labs</div>
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
                  Already an user?
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
                
                ${!isRegistered() ? ``:
                  `
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t m3-border-subtle text-xs">
                      <div class="flex items-center gap-2">
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
                        <a href="#/module/${mod.id}" class="btn btn-sm rounded-full px-3.5">
                          Open Module <span class="material-symbols-outlined icon-18">arrow_forward</span>
                        </a>
                      ` : `
                        <span class="text-[11px] m3-text-muted">Complete the previous module to unlock</span>
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

// ============================================================================
// Single-Topic Full-Viewport Lesson Workspace (#/module/:id & #/module/:id/lesson/:n)
// ============================================================================

function openQuickCheckModal({ mod, sec, currentStep, totalLessons, isLastLesson, onAdvance }) {
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

  if (optsEl) {
    optsEl.innerHTML = mc.options.map((opt, oIdx) => `
      <button type="button" class="btn h-auto min-h-[46px] py-2.5 px-4 justify-start items-center flex-nowrap whitespace-normal text-left font-normal btn-ghost border m3-border-subtle rounded-2xl gap-3 text-xs sm:text-sm" data-qc-opt="${oIdx}">
        <span class="w-6 h-6 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0" style="background:color-mix(in srgb, currentColor 12%, transparent);">${['A', 'B', 'C'][oIdx]}</span>
        <span class="min-w-0 break-words leading-snug">${escapeHtml(opt)}</span>
      </button>
    `).join('');

    optsEl.querySelectorAll('[data-qc-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = Number(btn.dataset.qcOpt);
        const ok = picked === mc.correctIndex;

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
            <span><strong>${ok ? 'Correct!' : 'Not quite.'}</strong> ${escapeHtml(mc.explanation)}</span>
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

const AUDIO_SPEED_STORAGE_KEY = 'druba_web_audio_speed';
const AUDIO_SPEEDS = [1, 1.25, 1.5];

async function loadAudioManifest() {
  try {
    const res = await fetch('./audio/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return { lessons: {} };
    const data = await res.json();
    appState.audioManifest = data && typeof data === 'object' ? data : { lessons: {} };
    return appState.audioManifest;
  } catch {
    appState.audioManifest = { lessons: {} };
    return appState.audioManifest;
  }
}

function formatAudioTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function renderLessonAudioGistHtml(sec) {
  const entry = appState.audioManifest?.lessons?.[sec.id];
  if (!entry || !entry.file) return '';
  const durLabel = entry.duration ? formatAudioTime(entry.duration) : '';

  return `
    <div class="m3-audio-gist no-print" data-audio-gist="${escapeHtml(sec.id)}">
      <button type="button" class="m3-audio-gist-trigger" data-ag-open aria-label="Listen to lesson summary">
        <span class="m3-audio-gist-play-dot" aria-hidden="true">
          <span class="material-symbols-outlined text-[16px]">play_arrow</span>
        </span>
        <span>Listen to Summary</span>
        ${durLabel ? `<span class="m3-audio-gist-dur">&middot; ${durLabel}</span>` : ''}
      </button>

      <div class="m3-audio-gist-bar hidden" data-ag-bar>
        <button type="button" class="m3-audio-gist-ctrl" data-ag-toggle aria-label="Play or pause lesson summary">
          <span class="material-symbols-outlined icon-18" data-ag-icon>pause</span>
        </button>

        <div class="m3-audio-gist-track">
          <div class="m3-audio-gist-meta">
            <span class="m3-audio-gist-label">
              <span class="m3-audio-gist-eq" aria-hidden="true"><span></span><span></span><span></span></span>
              <span>Lesson Summary</span>
            </span>
            <span class="m3-audio-gist-time" data-ag-time>0:00 / ${durLabel || '0:00'}</span>
          </div>
          <input type="range" class="m3-audio-gist-range" min="0" max="${entry.duration || 100}" step="0.1" value="0" aria-label="Audio summary progress" data-ag-seek>
        </div>

        <button type="button" class="m3-audio-gist-speed" data-ag-speed title="Playback speed" aria-label="Change playback speed">1&times;</button>
      </div>
    </div>
  `;
}

function initLessonAudioGist(view, sec) {
  const root = view.querySelector('[data-audio-gist]');
  const entry = appState.audioManifest?.lessons?.[sec.id];
  if (!root || !entry?.file) return null;

  const openBtn = root.querySelector('[data-ag-open]');
  const barEl = root.querySelector('[data-ag-bar]');
  const toggleBtn = root.querySelector('[data-ag-toggle]');
  const iconEl = root.querySelector('[data-ag-icon]');
  const timeEl = root.querySelector('[data-ag-time]');
  const seekEl = root.querySelector('[data-ag-seek]');
  const speedBtn = root.querySelector('[data-ag-speed]');

  let audio = null;
  let isSeeking = false;
  let isDisposed = false;
  let savedSpeed = 1;
  try {
    const raw = Number(localStorage.getItem(AUDIO_SPEED_STORAGE_KEY));
    if (AUDIO_SPEEDS.includes(raw)) savedSpeed = raw;
  } catch {}

  const updateSpeedUi = () => {
    if (speedBtn) speedBtn.textContent = `${savedSpeed}×`;
    if (audio) audio.playbackRate = savedSpeed;
  };
  updateSpeedUi();

  const updateSeekTrack = (cur, total) => {
    if (!seekEl) return;
    const pct = total > 0 ? Math.min(100, Math.max(0, (cur / total) * 100)) : 0;
    seekEl.style.background = `linear-gradient(to right, var(--m3-primary) ${pct}%, var(--m3-surface-container-highest) ${pct}%)`;
  };

  const updateTimeUi = () => {
    if (!audio || isDisposed) return;
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (entry.duration || 0);
    const cur = audio.currentTime || 0;
    if (timeEl) timeEl.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(total)}`;
    if (seekEl && !isSeeking && total > 0) {
      seekEl.max = String(total);
      seekEl.value = String(cur);
      updateSeekTrack(cur, total);
    }
  };

  const setPlayingState = (playing) => {
    root.classList.toggle('is-playing', playing);
    if (iconEl) iconEl.textContent = playing ? 'pause' : 'play_arrow';
    if (toggleBtn) toggleBtn.setAttribute('aria-label', playing ? 'Pause lesson summary' : 'Play lesson summary');
  };

  const ensureAudio = () => {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.src = entry.file;
    audio.playbackRate = savedSpeed;

    audio.addEventListener('loadedmetadata', updateTimeUi);
    audio.addEventListener('timeupdate', updateTimeUi);
    audio.addEventListener('play', () => {
      if (!isDisposed) setPlayingState(true);
    });
    audio.addEventListener('pause', () => {
      if (!isDisposed) setPlayingState(false);
    });
    audio.addEventListener('ended', () => {
      if (isDisposed) return;
      setPlayingState(false);
      if (seekEl) seekEl.value = '0';
      if (audio) audio.currentTime = 0;
      updateSeekTrack(0, audio?.duration || entry.duration || 0);
      updateTimeUi();
    });
    audio.addEventListener('error', () => {
      if (isDisposed || !audio || !audio.getAttribute('src')) return;
      setPlayingState(false);
      showToast('Could not load audio summary for this lesson.', 'error');
    });
    return audio;
  };

  const togglePlay = async () => {
    const a = ensureAudio();
    if (a.paused) {
      try {
        await a.play();
      } catch {
        setPlayingState(false);
      }
    } else {
      a.pause();
    }
  };

  openBtn?.addEventListener('click', () => {
    openBtn.classList.add('hidden');
    barEl?.classList.remove('hidden');
    togglePlay();
  });

  toggleBtn?.addEventListener('click', togglePlay);

  seekEl?.addEventListener('input', () => {
    isSeeking = true;
    const a = ensureAudio();
    const val = Number(seekEl.value) || 0;
    const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : (entry.duration || 0);
    if (timeEl) timeEl.textContent = `${formatAudioTime(val)} / ${formatAudioTime(total)}`;
    updateSeekTrack(val, total);
  });

  const commitSeek = () => {
    if (!isSeeking) return;
    isSeeking = false;
    if (audio) {
      audio.currentTime = Number(seekEl.value) || 0;
    }
  };
  seekEl?.addEventListener('change', commitSeek);
  seekEl?.addEventListener('pointerup', commitSeek);

  speedBtn?.addEventListener('click', () => {
    const idx = AUDIO_SPEEDS.indexOf(savedSpeed);
    savedSpeed = AUDIO_SPEEDS[(idx + 1) % AUDIO_SPEEDS.length];
    try {
      localStorage.setItem(AUDIO_SPEED_STORAGE_KEY, String(savedSpeed));
    } catch {}
    updateSpeedUi();
  });

  const pauseOnly = () => {
    if (audio && !audio.paused) {
      audio.pause();
    }
  };

  const cleanup = () => {
    isDisposed = true;
    if (audio) {
      const ref = audio;
      audio = null;
      ref.pause();
      ref.removeAttribute('src');
      ref.load();
    }
    setPlayingState(false);
  };

  return { pauseOnly, cleanup };
}

function renderLessonPaneOneHtml(mod, sec, currentStep, totalLessons) {
  const isLastLesson = currentStep >= totalLessons;
  const checks = Array.isArray(sec.widget?.checks) ? sec.widget.checks : [];
  const modSymbol = /mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl';

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
            <a href="#/quiz/${mod.id}" class="hidden lg:inline-flex btn btn-sm btn-ghost rounded-full px-3 text-xs m3-text-muted" title="Jump to Module ${mod.id} Quiz">
              Take Quiz
            </a>
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

function renderModuleView(moduleId, lessonStep = 1) {
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
      <section class="ide-workspace-root" data-micro-lesson="${escapeHtml(sec.id)}">
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
            <div class="h-10 px-2.5 border-b m3-border-subtle m3-surface-container-low flex items-center justify-between gap-1.5 shrink-0">
              <div class="min-w-0 flex-1 overflow-x-auto no-scrollbar">
                <div role="tablist" class="tabs tabs-boxed rounded-full p-0.5 m3-surface-container inline-flex flex-nowrap w-max">
                  <button id="tab-btn-${activeTabKey}" type="button" role="tab" class="tab tab-xs rounded-full tab-active font-mono text-[11px] px-2.5 whitespace-nowrap">${fileLabel}</button>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
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
                    </div>
                  </div>
                </div>

                <button id="editor-hint-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Autocomplete (Ctrl+Space)" aria-label="Autocomplete">
                  <span class="material-symbols-outlined icon-18">code_blocks</span>
                </button>
                <button id="lesson-reset-btn" type="button" class="btn btn-xs btn-ghost rounded-full gap-1" title="Reset Starter Code">
                  <span class="material-symbols-outlined icon-18">restart_alt</span>
                  <span>Reset</span>
                </button>
                <button id="lesson-run-btn" type="button" class="btn btn-xs btn-primary rounded-full px-3 gap-1" title="Run Code">
                  <span class="material-symbols-outlined text-[15px]">play_arrow</span>
                  <span>Run</span>
                </button>
              </div>
            </div>

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
        const badge = view.querySelector(`[data-me-check="${idx}"]`);
        if (!badge) return;
        let ok = false;
        try { ok = Boolean(chk.test(codeText)); } catch { ok = false; }
        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = ok ? 'check_circle' : 'radio_button_unchecked';
        badge.classList.toggle('m3-primary-container', ok);
        badge.classList.toggle('m3-surface-container', !ok);
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
        document.getElementById('lesson-complete-next-btn')?.click();
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

    // Console drawer / clear
    const consoleBody = document.getElementById('ide-console-body');
    const consoleChevron = document.getElementById('ide-console-chevron');
    document.getElementById('ide-console-toggle')?.addEventListener('click', (e) => {
      if (e.target.closest('#ide-console-clear-btn')) return;
      const isHidden = consoleBody?.classList.toggle('hidden');
      if (consoleChevron) consoleChevron.textContent = isHidden ? 'expand_less' : 'expand_more';
    });
    document.getElementById('ide-console-clear-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const out = document.getElementById('ide-console-output');
      const cnt = document.getElementById('ide-console-count');
      if (out) out.innerHTML = '';
      if (cnt) cnt.textContent = '0';
    });

    // Mobile 3-pane switcher (< 1024px)
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
        if (btn) syncMobilePanes(btn.dataset.pane);
      });
      syncMobilePanes('instructions');
    }
  } else {
    // Full-Viewport 2-Pane Simulator Workspace (M1L1-4, M4L1-4, M5L1-4)
    // Desktop: side-by-side resizable split. Mobile (< 1024px): single vertical flow with inline simulator.
    view.innerHTML = `
      <section class="ide-workspace-root ide-workspace-inline-mobile" data-micro-lesson="${escapeHtml(sec.id)}">
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
      btn.addEventListener('click', () => document.getElementById('lesson-complete-next-btn')?.click());
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
        document.getElementById('lesson-complete-next-btn')?.click();
      }
    };
  }
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
                <button id="retake-quiz-btn" type="button" class="btn btn-primary rounded-full px-5 gap-1.5" title="Try Quiz Again (Ctrl+Enter)">
                  <span class="material-symbols-outlined text-[18px]">shuffle</span>
                  Try Quiz Again
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${/mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'}+Enter</kbd>
                </button>
              ` : labs.length ? `
                <a id="quiz-continue-btn" href="#/lab/${labs[0].id}" class="btn btn-primary rounded-full px-5 gap-1.5" title="Continue (Ctrl+Enter)">
                  <span>Start ${labs[0].code}</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${/mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'}+Enter</kbd>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              ` : mod.id < 5 ? `
                <a id="quiz-continue-btn" href="#/module/${mod.id + 1}" class="btn btn-primary rounded-full px-5 gap-1.5" title="Continue (Ctrl+Enter)">
                  <span>Continue to Module ${mod.id + 1}</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${/mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'}+Enter</kbd>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              ` : `
                <a id="quiz-continue-btn" href="#/certificate" class="btn btn-primary rounded-full px-5 gap-1.5" title="View Your Certificate (Ctrl+Enter)">
                  <span class="material-symbols-outlined text-[18px]">workspace_premium</span>
                  View Your Certificate
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${/mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'}+Enter</kbd>
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
          <div class="m3-quiz-mobile-bar flex justify-end gap-3 mt-2">
            <button type="submit" class="btn btn-primary rounded-full px-8 gap-2" title="Submit Quiz (Ctrl+Enter)">
              <span class="material-symbols-outlined">task_alt</span>
              <span>Submit Quiz</span>
              <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${/mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'}+Enter</kbd>
            </button>
          </div>
        ` : `
          <div class="m3-quiz-mobile-bar flex justify-end gap-3 mt-2">
            <button id="retake-quiz-bottom-btn" type="button" class="btn m3-btn-tonal rounded-full px-6 gap-2">
              <span class="material-symbols-outlined text-[18px]">shuffle</span>
              Retake Quiz
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

      const card = e.target.closest('.m3-surface-container-lowest');
      card?.querySelectorAll('.m3-quiz-option').forEach((lbl) => {
        const input = lbl.querySelector('input[type="radio"]');
        lbl.classList.toggle('is-selected', Boolean(input?.checked));
      });
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
    if (passed) {
      prefetchCertificateInBackground();
    }

    session.submittedResult = { correctCount, total, scorePercent, passed };
    drawQuizSession(mod, quiz, updated);
    scrollViewToTop();
    
    if (passed) {
      const labCodes = labs.map((l) => l.code).join(', ');
      const nextMsg = labs.length
        ? `${labCodes} ${labs.length === 1 ? 'is' : 'are'} now unlocked.`
        : mod.id === 5
          ? 'Finish any remaining labs to unlock your Final Certificate.'
          : 'Module 2 is now unlocked.';
      await triggerCheckpointModal(`Module ${mod.id} Quiz Passed (${scorePercent}%)`, nextMsg, `M${mod.id}_Quiz`);
    }
  });

  const handleRetake = () => {
    appState.quizSession = buildShuffledQuizSession(quiz, true);
    drawQuizSession(mod, quiz, appState.quizzes.get(mod.id));
    scrollViewToTop();
  };
  document.getElementById('retake-quiz-btn')?.addEventListener('click', handleRetake);
  document.getElementById('retake-quiz-bottom-btn')?.addEventListener('click', handleRetake);

  appState.shortcutContext = {
    onRunAdvance: () => {
      if (!session.submittedResult) {
        const form = document.getElementById('quiz-form');
        if (form) {
          if (typeof form.requestSubmit === 'function') form.requestSubmit();
          else form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
        return;
      }
      if (session.submittedResult.passed) {
        const nextLink = document.getElementById('quiz-continue-btn');
        if (nextLink) {
          window.location.hash = nextLink.getAttribute('href') || '#/';
        }
      } else {
        handleRetake();
      }
    }
  };
}

// ============================================================================
// Practical Lab IDE View (Full-Viewport 3-Pane Draggable Workspace)
// ============================================================================

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

function initSplitResizers(container, pane1, pane2, pane3, resizer1, resizer2, ide = null) {
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
  const modSymbol = /mac|iphone|ipad|ipod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl';

  view.innerHTML = `
    <section class="ide-workspace-root">
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
                      <span class="badge badge-xs badge-success font-mono font-bold">PASSED</span>
                    </div>
                    <div id="ide-lab-complete-meta" class="text-xs opacity-85 mt-0.5">
                      ${savedRec?.completed
                        ? `${savedRec.passedAssertions || lab.checksDescription.length}/${savedRec.totalAssertions || lab.checksDescription.length} checks verified · Time: ${formatDuration(savedRec.activeTypingSeconds || 0)}`
                        : 'All checks verified · Ready for the next step'}
                    </div>
                  </div>
                </div>

                ${nextLab ? `
                  <a id="ide-next-step-link" href="#/lab/${nextLab.id}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5 font-bold" title="Next Lab (${modSymbol}+Enter)">
                    <span>Continue to ${escapeHtml(nextLab.code)}</span>
                    <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${modSymbol}+Enter</kbd>
                    <span class="material-symbols-outlined icon-18">arrow_forward</span>
                  </a>
                ` : mod && mod.id < 5 ? `
                  <a id="ide-next-step-link" href="#/module/${mod.id + 1}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5 font-bold" title="Proceed to Next Module (${modSymbol}+Enter)">
                    <span>Proceed to Module ${mod.id + 1}</span>
                    <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${modSymbol}+Enter</kbd>
                    <span class="material-symbols-outlined icon-18">arrow_forward</span>
                  </a>
                ` : !isBonus && mod && mod.id === 5 ? `
                  <a id="ide-next-step-link" href="#/certificate" class="btn btn-primary btn-sm rounded-full w-full gap-1.5 font-bold" title="View Your Certificate (${modSymbol}+Enter)">
                    <span class="material-symbols-outlined icon-18">workspace_premium</span>
                    <span>View Your Certificate</span>
                    <kbd class="m3-kbd-on-primary hidden sm:inline-flex">${modSymbol}+Enter</kbd>
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
              <button id="editor-reset-icon-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Reset Starter Code (Alt+Backspace)" aria-label="Reset Starter Code">
                <span class="material-symbols-outlined icon-18">restart_alt</span>
              </button>
              <button id="editor-run-icon-btn" type="button" class="btn btn-xs btn-ghost btn-circle" title="Run Code Preview (Alt+R)" aria-label="Run Preview">
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
            <button id="mobile-ide-preview-btn" type="button" class="btn btn-primary gap-1.5">
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
          document.querySelector('#mobile-pane-tabs [data-pane="instructions"]')?.click();
        }

        const moduleCompleted = areModuleLabsCompleted(lab.moduleId);
        if (shouldAdvance) {
          const nextHash = nextLab
            ? `#/lab/${nextLab.id}`
            : mod && mod.id < 5
              ? `#/module/${mod.id + 1}`
              : '#/certificate';
          window.location.hash = nextHash;
        }
        if (moduleCompleted) {
          const unlockedMod = lab.moduleId < 5 ? `Module ${lab.moduleId + 1}` : 'your Certificate';
          await triggerCheckpointModal(
            `Module ${lab.moduleId} Complete`,
            `All labs in Module ${lab.moduleId} are verified, and ${unlockedMod} is now unlocked.`,
            `M${lab.moduleId}`
          );
        } else {
          // Single-lab accomplishment modal so the user gets clear celebratory feedback before advancing
          const nextStepDesc = nextLab
            ? `All ${res.totalAssertions} checks passed. Next up: ${nextLab.code} (${nextLab.title}).`
            : `All ${res.totalAssertions} checks passed.`;
          await triggerCheckpointModal(
            `${lab.code} Completed (100%)`,
            nextStepDesc,
            lab.code.replace(/\s+/g, '_')
          );
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

function invalidateInMemoryCertCache() {
  appState.certCache = null;
  appState.certIssuePromise = null;
  appState.certIssueGeneration += 1;
}

async function getValidatedCachedCert(fullState) {
  const candidate = appState.certCache || (await getCachedCertificate());
  if (!candidate) return null;

  const check = await validateCachedCertificate(candidate, fullState);
  if (check.valid) {
    appState.certCache = candidate;
    return { generated: candidate, isStale: check.isStale };
  }

  // Discard corrupted, tampered, or mismatched cached certificate
  appState.certCache = null;
  await clearCachedCertificate().catch(() => {});
  return null;
}

async function issueAndCacheCertificate(fullState, { forceRefresh = false } = {}) {
  if (!forceRefresh && appState.certIssuePromise) {
    return appState.certIssuePromise;
  }

  const generation = appState.certIssueGeneration;
  const promise = (async () => {
    const generated = await issueSignedCertificate(fullState);
    if (generation === appState.certIssueGeneration) {
      const saved = await saveCachedCertificate(generated);
      appState.certCache = saved;
      return saved;
    }
    return generated;
  })();

  appState.certIssuePromise = promise;
  promise.finally(() => {
    if (appState.certIssuePromise === promise) {
      appState.certIssuePromise = null;
    }
  });
  return promise;
}

function prefetchCertificateInBackground() {
  if (!isCertificateUnlocked()) return;
  if (appState.certCache || appState.certIssuePromise) return;

  (async () => {
    try {
      const fullState = await exportFullState();
      const cached = await getValidatedCachedCert(fullState);
      if (cached) return; // Already validly cached in IndexedDB; L1 is now warm
      await issueAndCacheCertificate(fullState);
    } catch {
      // Silent background prefetch; route view handles retries if offline
    }
  })();
}

function renderCertificateSkeleton(view) {
  view.innerHTML = `
    <section class="max-w-6xl mx-auto flex flex-col gap-5" aria-busy="true" aria-live="polite" aria-label="Preparing your certificate">
      <!-- Top Action Bar Skeleton -->
      <div class="m3-card rounded-3xl p-4 sm:p-5 border m3-border-subtle flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-[220px]">
          <div class="m3-skeleton h-7 w-64 rounded-full"></div>
          <div class="m3-skeleton h-4 w-80 max-w-full rounded-full"></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="m3-skeleton h-10 w-28 rounded-full"></div>
          <div class="m3-skeleton h-10 w-36 rounded-full"></div>
        </div>
      </div>

      <!-- A4 Landscape Certificate Frame Skeleton -->
      <div class="m3-surface-container-lowest rounded-3xl p-6 sm:p-10 border m3-border-subtle flex flex-col justify-between min-h-[420px] sm:min-h-[540px] gap-8">
        <!-- Header Row -->
        <div class="flex items-center justify-between">
          <div class="m3-skeleton h-5 w-24 rounded-full"></div>
          <div class="m3-skeleton h-4 w-44 rounded-full"></div>
        </div>

        <!-- Centerpiece Typography Skeleton -->
        <div class="flex flex-col items-center text-center gap-3.5 my-auto py-4">
          <div class="m3-skeleton h-10 w-64 rounded-2xl"></div>
          <div class="m3-skeleton h-4 w-32 rounded-full mt-1"></div>
          <div class="m3-skeleton h-9 w-72 sm:w-80 rounded-2xl"></div>
          <div class="m3-skeleton h-4 w-40 rounded-full"></div>
          <div class="m3-skeleton h-4 w-96 max-w-full rounded-full mt-2"></div>
          <div class="m3-skeleton h-6 w-80 max-w-full rounded-xl"></div>
          <div class="m3-skeleton h-5 w-72 max-w-full rounded-full mt-2"></div>
        </div>

        <!-- Footer 3-Column Skeleton (Authority, QR Box, Credential ID) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 items-end gap-6 pt-4 border-t m3-border-subtle">
          <div class="flex flex-col gap-2">
            <div class="m3-skeleton h-4 w-40 rounded-full"></div>
            <div class="m3-skeleton h-3.5 w-36 rounded-full"></div>
            <div class="m3-skeleton h-3 w-28 rounded-full"></div>
          </div>
          <div class="flex flex-col items-center gap-2">
            <div class="m3-skeleton w-[104px] h-[104px] rounded-2xl"></div>
            <div class="m3-skeleton h-3 w-20 rounded-full"></div>
          </div>
          <div class="flex flex-col sm:items-end gap-2">
            <div class="m3-skeleton h-3.5 w-32 rounded-full"></div>
            <div class="m3-skeleton h-3 w-44 rounded-full"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Verification Code Drawer Skeleton -->
      <div class="m3-surface-container-lowest rounded-3xl px-5 py-4 border m3-border-subtle flex items-center justify-between">
        <div class="m3-skeleton h-4 w-72 max-w-[80%] rounded-full"></div>
        <div class="m3-skeleton h-5 w-5 rounded-full"></div>
      </div>
    </section>
  `;
}

async function renderCertificateView({ forceRefresh = false } = {}) {
  if (!isCertificateUnlocked()) {
    const nextHash = getNextRecommendedRoute();
    renderLockedView(
      'Certificate of Completion',
      'Pass all 5 module quizzes (60% or higher) and complete all 8 coding labs to unlock your Certificate of Completion.',
      nextHash
    );
    return;
  }

  const view = document.getElementById('app-view');
  const renderToken = ++appState.certRenderToken;
  const fullState = await exportFullState();

  let generated = null;
  let isStale = false;

  if (!forceRefresh) {
    const cachedHit = await getValidatedCachedCert(fullState);
    if (cachedHit) {
      generated = cachedHit.generated;
      isStale = cachedHit.isStale;
    }
  }

  if (!generated) {
    // Only show skeleton when an actual Cloudflare Worker signing request is needed
    renderCertificateSkeleton(view);
    try {
      generated = await issueAndCacheCertificate(fullState, { forceRefresh });
    } catch (err) {
      if (renderToken !== appState.certRenderToken) return;
      view.innerHTML = `
        <section class="max-w-xl mx-auto mt-8">
          <div class="m3-card rounded-3xl p-6 border m3-border-subtle text-center flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-[40px] text-error">cloud_off</span>
            <h1 class="text-xl font-bold">Could Not Issue Signed Certificate</h1>
            <p class="text-sm m3-text-muted">${escapeHtml(err.message || 'Certificate signing server is unreachable. Check your internet connection and try again.')}</p>
            <button id="cert-retry-btn" type="button" class="btn btn-primary rounded-full px-6 mt-2">Retry</button>
          </div>
        </section>
      `;
      document.getElementById('cert-retry-btn')?.addEventListener('click', () => renderCertificateView({ forceRefresh }));
      return;
    }
  }

  if (renderToken !== appState.certRenderToken || !window.location.hash.startsWith('#/certificate')) {
    return;
  }

  const qrInfo = { token: generated.qrToken, verifyId: generated.verifyId };
  const signedPayload = generated.payload || {};
  const signedStudent = signedPayload.student || fullState.profile || {};

  const quizScores = [1, 2, 3, 4, 5].map((m) => {
    const q = (signedPayload.quizzes || fullState.quizzes || []).find((x) => Number(x.moduleId) === m);
    return Number(q?.bestScorePercent || 0);
  });
  const avgQuiz = Math.round(quizScores.reduce((a, b) => a + b, 0) / 5);
  const completionDate = new Date(signedPayload.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const baseUrl = window.location.origin + window.location.pathname;
  const qrPayload = `${baseUrl}#/verify?v=${encodeURIComponent(qrInfo.token)}`;
  const safeRoll = (signedStudent.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');

  view.innerHTML = `
    <section class="max-w-6xl mx-auto flex flex-col gap-5">
      <!-- Certificate Action Bar (Hidden in Print) -->
      <div class="m3-card rounded-3xl p-4 sm:p-5 border m3-border-subtle flex flex-wrap items-center justify-between gap-3 no-print">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-bold">Certificate of Completion</h1>
          <p class="text-xs sm:text-sm m3-text-muted">Printable A4 landscape credential with digitally signed QR verification.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div id="cert-export-dropdown" class="relative">
            <button id="cert-export-btn" type="button" class="btn btn-sm sm:btn-md btn-primary rounded-full gap-1.5 px-4" aria-expanded="false" aria-haspopup="menu" aria-controls="cert-export-menu">
              <span class="material-symbols-outlined icon-18">download</span>
              <span>Export</span>
              <span class="material-symbols-outlined icon-18">expand_more</span>
            </button>
            <div id="cert-export-menu" role="menu" class="cert-export-menu hidden">
              <button id="cert-print-btn" type="button" role="menuitem" class="cert-export-item">
                <span class="material-symbols-outlined icon-18 m3-text-primary">print</span>
                <span>Print / Save as PDF</span>
              </button>
              <button id="cert-download-png-btn" type="button" role="menuitem" class="cert-export-item">
                <span class="material-symbols-outlined icon-18 m3-text-primary">image</span>
                <span>Download as PNG</span>
              </button>
              <button id="cert-download-jpg-btn" type="button" role="menuitem" class="cert-export-item">
                <span class="material-symbols-outlined icon-18 m3-text-primary">photo</span>
                <span>Download as JPG</span>
              </button>
            </div>
          </div>
          <button id="cert-copy-key-btn" type="button" class="btn btn-sm sm:btn-md m3-btn-tonal rounded-full gap-1.5 px-4">
            <span class="material-symbols-outlined icon-18">content_copy</span>
            <span>Copy Code Key</span>
          </button>
        </div>
      </div>

      ${isStale ? `
        <div id="cert-stale-banner" class="m3-surface-container-low rounded-2xl px-4 py-3 border m3-border-subtle flex flex-wrap items-center justify-between gap-3 no-print">
          <div class="flex items-center gap-2.5 text-xs sm:text-sm min-w-0">
            <span class="material-symbols-outlined icon-20 m3-text-primary shrink-0">update</span>
            <span>Your quiz scores or lab code changed since this certificate was issued.</span>
          </div>
          <button id="cert-reissue-btn" type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full gap-1.5 px-4 shrink-0">
            <span class="material-symbols-outlined icon-18">refresh</span>
            <span>Re-issue Certificate</span>
          </button>
        </div>
      ` : ''}

      <!-- Responsive A4 Landscape Stage (Scales 1122x794 Proportionally) -->
      <div id="certificate-stage">
        <article id="certificate-sheet" class="m3-a4-certificate" aria-label="A4 Landscape Certificate of Completion">
          <div class="m3-a4-certificate-inner">
            <!-- Minimal Top Header -->
            <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span id="cert-brand-dot" style="display:block;width:10px;height:10px;border-radius:50%;background:#146C43;flex-shrink:0;" aria-hidden="true"></span>
                <span style="display:inline-block;font-size:18px;font-weight:700;letter-spacing:-0.015em;color:#111827;line-height:1.2;">druba.in</span>
              </div>
              <div class="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#64748B]" style="line-height:1.2;">
                CERTIFICATE OF COMPLETION
              </div>
            </header>

            <!-- Centerpiece Typography -->
            <div class="text-center flex flex-col items-center justify-center px-4" style="padding-top:18px;">
              <h2 class="text-[40px] font-bold tracking-tight text-[#111827] leading-tight">
                Congratulations
              </h2>

              <p class="text-[14px] text-[#4B5563] mt-3">This certifies that</p>

              <div class="text-[36px] font-bold tracking-tight text-[#146C43] leading-tight mt-1.5">
                ${escapeHtml(signedStudent.fullName)}
              </div>

              <div class="font-mono text-[13px] font-medium text-[#4B5563] mt-1.5">
                Student ID: ${escapeHtml(signedStudent.rollNo)}
              </div>

              <p class="text-[14px] text-[#4B5563] max-w-[680px] mx-auto mt-4 leading-relaxed">
                has successfully completed all lessons, graded assessments, and 8 hands-on front-end labs for
              </p>

              <div class="text-[21px] font-bold text-[#111827] mt-1.5">
                Learning the Web with Basics of Vanilla Front-End Tools
              </div>

              <!-- Minimal Inline Summary (No Pill Boxes) -->
              <div class="text-[13px] text-[#4B5563] mt-5 font-medium whitespace-nowrap" style="display:inline-flex;align-items:center;justify-content:center;line-height:1.4;">
                <span>Quiz Score: <strong class="font-mono font-semibold text-[#111827]">${avgQuiz}%</strong></span>
                <span class="cert-stat-divider" style="display:inline-block;width:1px;height:14px;background:#cbd5e1;flex-shrink:0;margin:0 14px;" aria-hidden="true"></span>
                <span>Labs Completed: <strong class="font-mono font-semibold text-[#111827]">8 / 8</strong></span>
                <span class="cert-stat-divider" style="display:inline-block;width:1px;height:14px;background:#cbd5e1;flex-shrink:0;margin:0 14px;" aria-hidden="true"></span>
                <span>Issued: <strong class="font-mono font-semibold text-[#111827]">${escapeHtml(completionDate)}</strong></span>
              </div>
            </div>

            <!-- Bottom 3-Column Digitally Signed Footer -->
            <footer class="cert-footer-grid">
              <!-- Left Column: Digital Authority & Seal -->
              <div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;">
                <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:6px;">
                  <svg id="cert-seal-svg" width="18" height="18" viewBox="0 0 24 24" fill="#146C43" style="display:block;flex-shrink:0;" aria-hidden="true">
                    <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/>
                  </svg>
                  <span style="display:inline-block;color:#146C43;font-size:12px;font-weight:700;letter-spacing:-0.01em;line-height:1.4;">Digitally Signed Credential</span>
                </div>
                <div style="font-size:12px;font-weight:600;color:#111827;line-height:1.4;">Issued by Drubajyoti Debnath</div>
                <div style="font-size:11px;color:#64748B;line-height:1.3;">Course Author &middot; druba.in</div>
              </div>

              <!-- Center Column: High-Scannability QR Code (104x104, 8px white quiet zone) -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="background:#ffffff;padding:8px;display:inline-flex;align-items:center;justify-content:center;">
                  <canvas id="cert-qr-canvas" width="208" height="208" style="width:104px;height:104px;display:block;image-rendering:pixelated;"></canvas>
                  <div id="cert-qr-fallback" class="hidden"></div>
                </div>
                <div style="font-size:11px;font-weight:500;color:#64748B;line-height:1.3;">Scan to verify</div>
              </div>

              <!-- Right Column: Clean Credential ID -->
              <div class="font-mono" style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;font-size:11px;">
                <div style="font-weight:600;color:#111827;line-height:1.4;">ID: ${escapeHtml(qrInfo.verifyId)}</div>
                <div style="color:#4B5563;line-height:1.3;">Verify at: druba.in/learn/#/verify</div>
              </div>
            </footer>
          </div>
        </article>
      </div>

      <!-- Collapsible Certificate Verification Code Drawer (Hidden in Print) -->
      <details class="m3-accordion m3-surface-container-lowest rounded-3xl border m3-border-subtle no-print">
        <summary class="m3-accordion-trigger px-5 py-3.5 font-bold text-sm">
          <span class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-outlined icon-18 m3-text-primary shrink-0">key</span>
            <span>Certificate Verification Code (share to verify your completed labs)</span>
          </span>
          <span class="material-symbols-outlined icon-20 m3-accordion-chevron" aria-hidden="true">expand_more</span>
        </summary>
        <div class="m3-accordion-body px-5 py-4 flex flex-col gap-3">
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

  // Render QR Code via QRious, scaled edge-to-edge into the 104x104 (208x208 retina) canvas
  const qrCanvas = document.getElementById('cert-qr-canvas');
  const qrFallback = document.getElementById('cert-qr-fallback');
  if (typeof window.QRious === 'function' && qrCanvas) {
    try {
      const tmpCanvas = document.createElement('canvas');
      new window.QRious({
        element: tmpCanvas,
        value: qrPayload,
        size: 400,
        padding: 0,
        level: 'L',
        background: '#FFFFFF',
        foreground: '#111827'
      });
      const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });
      const { width: tw, height: th } = tmpCanvas;
      const img = tmpCtx.getImageData(0, 0, tw, th).data;
      let minX = tw;
      let minY = th;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const i = (y * tw + x) * 4;
          if (img[i] < 128) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      const dstCtx = qrCanvas.getContext('2d');
      dstCtx.fillStyle = '#FFFFFF';
      dstCtx.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
      dstCtx.imageSmoothingEnabled = false;
      if (maxX >= minX && maxY >= minY) {
        dstCtx.drawImage(
          tmpCanvas,
          minX,
          minY,
          maxX - minX + 1,
          maxY - minY + 1,
          0,
          0,
          qrCanvas.width,
          qrCanvas.height
        );
      } else {
        dstCtx.drawImage(tmpCanvas, 0, 0, qrCanvas.width, qrCanvas.height);
      }
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

  // Proportional A4 landscape scaling on any viewport
  const stage = document.getElementById('certificate-stage');
  const sheet = document.getElementById('certificate-sheet');
  const updateCertificateScale = () => {
    if (!stage || !sheet) return;
    const avail = stage.clientWidth;
    if (!avail) return;
    const scale = Math.min(1, avail / 1122);
    const offsetX = Math.max(0, (avail - 1122 * scale) / 2);
    sheet.style.transform = `translateX(${offsetX}px) scale(${scale})`;
    stage.style.height = `${Math.round(794 * scale)}px`;
  };
  updateCertificateScale();

  let resizeObserver = null;
  if (typeof ResizeObserver === 'function' && stage) {
    resizeObserver = new ResizeObserver(updateCertificateScale);
    resizeObserver.observe(stage);
  }
  window.addEventListener('resize', updateCertificateScale);

  // Export dropdown menu controller
  const exportBtn = document.getElementById('cert-export-btn');
  const exportMenu = document.getElementById('cert-export-menu');
  const closeExportMenu = () => {
    exportMenu?.classList.add('hidden');
    exportBtn?.setAttribute('aria-expanded', 'false');
  };
  const onDocClick = (e) => {
    if (exportMenu && !exportMenu.classList.contains('hidden') && !e.target.closest('#cert-export-dropdown')) {
      closeExportMenu();
    }
  };
  const onDocKeydown = (e) => {
    if (e.key === 'Escape' && exportMenu && !exportMenu.classList.contains('hidden')) {
      closeExportMenu();
      exportBtn?.focus();
    }
  };
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = exportMenu?.classList.contains('hidden');
    exportMenu?.classList.toggle('hidden', !willOpen);
    exportBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKeydown);

  appState.cleanupRouteView = () => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', updateCertificateScale);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKeydown);
  };

  // Image export helper (PNG / JPG at full 1122x794 @ 2x retina via off-screen clone)
  const exportCertificateImage = async (format, btn) => {
    if (typeof window.html2canvas !== 'function') {
      showToast('Image export library is still loading or unavailable offline. Use Print / Save PDF instead.', 'error');
      return;
    }
    if (!sheet) return;
    const origDisabled = btn.disabled;
    btn.disabled = true;
    let offscreenHost = null;
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      offscreenHost = document.createElement('div');
      offscreenHost.style.cssText = 'position:fixed;left:-99999px;top:0;width:1122px;height:794px;overflow:visible;pointer-events:none;z-index:-1;';
      const clonedSheet = sheet.cloneNode(true);
      clonedSheet.style.transform = 'none';
      clonedSheet.style.margin = '0';
      clonedSheet.style.boxShadow = 'none';

      // Preserve QR canvas bitmap inside cloned node
      const srcQr = sheet.querySelector('#cert-qr-canvas');
      const dstQr = clonedSheet.querySelector('#cert-qr-canvas');
      if (srcQr && dstQr && !srcQr.classList.contains('hidden')) {
        const ctx = dstQr.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(srcQr, 0, 0, dstQr.width, dstQr.height);
        }
      }

      offscreenHost.appendChild(clonedSheet);
      document.body.appendChild(offscreenHost);

      const canvas = await window.html2canvas(clonedSheet, {
        scale: 2,
        width: 1122,
        height: 794,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('#cert-brand-dot').forEach((dot) => {
            if (dot.parentElement) dot.parentElement.style.alignItems = 'flex-start';
            dot.style.marginTop = '15px';
          });
          clonedDoc.querySelectorAll('.cert-stat-divider').forEach((el) => {
            if (el.parentElement) el.parentElement.style.alignItems = 'flex-start';
            el.style.marginTop = '6px';
          });
          clonedDoc.querySelectorAll('#cert-seal-svg').forEach((seal) => {
            if (seal.parentElement) seal.parentElement.style.alignItems = 'flex-start';
            seal.style.marginTop = '7px';
          });
        }
      });
      const ext = format === 'jpg' ? 'jpg' : 'png';
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const filename = `${safeRoll}_druba-web_Certificate.${ext}`;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.95));
      if (!blob) throw new Error('Could not encode image.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      showToast(`Image export failed: ${err.message}`, 'error');
    } finally {
      offscreenHost?.remove();
      btn.disabled = origDisabled;
    }
  };

  document.getElementById('cert-print-btn')?.addEventListener('click', () => {
    closeExportMenu();
    window.print();
  });
  document.getElementById('cert-download-png-btn')?.addEventListener('click', () => {
    closeExportMenu();
    if (exportBtn) exportCertificateImage('png', exportBtn);
  });
  document.getElementById('cert-download-jpg-btn')?.addEventListener('click', () => {
    closeExportMenu();
    if (exportBtn) exportCertificateImage('jpg', exportBtn);
  });
  document.getElementById('cert-copy-key-btn')?.addEventListener('click', () => {
    closeExportMenu();
    copyToClipboard(generated.key, 'Certificate Verification Code copied.');
  });
  document.getElementById('cert-reissue-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="loading loading-spinner loading-xs"></span><span>Updating...</span>`;
    try {
      const latestState = await exportFullState();
      await issueAndCacheCertificate(latestState, { forceRefresh: true });
      await renderCertificateView();
      showToast('Certificate re-issued with your latest progress.', 'success');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      showToast(err.message || 'Could not update certificate right now. Showing your cached certificate.', 'error');
    }
  });
}

// ============================================================================
// Certificate Checker & Submission Inspector (#/verify)
// ============================================================================

function extractVerificationToken(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return { type: 'empty', value: '' };

  const extractFromQuery = (queryStr) => {
    try {
      const params = new URLSearchParams(queryStr);
      const v = params.get('v');
      if (v) return { type: 'qr', value: v.trim() };
      const key = params.get('key');
      if (key) return { type: 'key', value: key.trim() };
    } catch {}
    return null;
  };

  if (trimmed.startsWith('?')) {
    const hit = extractFromQuery(trimmed.slice(1).split('#')[0]);
    if (hit) return hit;
  }

  // Handle full URLs or hash URLs (e.g. https://druba.in/learn/#/verify?v=... or ?v=...#/verify)
  const qIdx = trimmed.indexOf('?');
  if (qIdx !== -1) {
    const afterQ = trimmed.slice(qIdx + 1);
    const hit = extractFromQuery(afterQ.split('#')[0]) || extractFromQuery(afterQ);
    if (hit) return hit;
  }

  if (trimmed.startsWith('druba-web-v1.') || trimmed.startsWith('druba-web-v1r.')) {
    return { type: 'key', value: trimmed };
  }

  return { type: 'qr', value: trimmed };
}

async function renderVerifyView(queryParams = null) {
  const view = document.getElementById('app-view');
  const searchParams = new URLSearchParams(window.location.search || '');
  const qrParam = (queryParams && queryParams.get('v')) || searchParams.get('v') || null;
  const keyParam = (queryParams && queryParams.get('key')) || searchParams.get('key') || null;

  view.innerHTML = `
    <section class="flex flex-col gap-5 max-w-5xl mx-auto">
      <!-- Verified Results Area (Takes Center Stage First) -->
      <div id="verify-results-container" class="flex flex-col gap-5"></div>

      <!-- Check a Certificate Card (Auto-Collapses When Results Are Shown) -->
      <div id="verify-input-card" class="m3-card rounded-3xl border m3-border-subtle overflow-hidden">
        <!-- Collapsed Single-Row Header -->
        <button id="verify-expand-bar" type="button" class="m3-menu-item hidden w-full px-5 py-4 flex items-center justify-between gap-3 text-left" aria-expanded="false" aria-controls="verify-input-body">
          <span class="flex items-center gap-2.5 font-semibold text-sm sm:text-base">
            <span class="material-symbols-outlined icon-20 m3-text-primary">verified_user</span>
            <span>Check Another Certificate</span>
          </span>
          <span class="material-symbols-outlined icon-20 m3-text-muted">expand_more</span>
        </button>

        <!-- Expanded Scanner + Paste Body -->
        <div id="verify-input-body" class="p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <span class="material-symbols-outlined icon-24 m3-text-primary">verified_user</span>
                <span>Check a Certificate</span>
              </h1>
              <p class="text-sm m3-text-muted mt-1">
                Scan a certificate QR code with your camera, or paste a Verification Code or URL below.
              </p>
            </div>
            <button id="verify-scan-qr-btn" type="button" class="btn btn-sm sm:btn-md m3-btn-tonal rounded-full gap-2 shrink-0">
              <span class="material-symbols-outlined icon-20">qr_code_scanner</span>
              <span>Scan QR with Camera</span>
            </button>
          </div>

          <!-- Inline Camera QR Viewfinder -->
          <div id="verify-scanner-panel" class="hidden mt-4 p-4 rounded-2xl m3-surface-container-low border m3-border-subtle flex flex-col items-center gap-3">
            <div class="verify-scanner-frame">
              <video id="verify-scanner-video" class="verify-scanner-video" playsinline muted autoplay></video>
              <div class="verify-scanner-reticle" aria-hidden="true"></div>
            </div>
            <p id="verify-scanner-status" class="text-xs m3-text-muted text-center" aria-live="polite">
              Point your camera at the certificate QR code...
            </p>
            <button id="verify-stop-camera-btn" type="button" class="btn btn-sm btn-outline rounded-full gap-1.5">
              <span class="material-symbols-outlined icon-18">videocam_off</span>
              <span>Stop Camera</span>
            </button>
          </div>

          <!-- Single-Box Verification Code / URL Paste Input -->
          <div class="mt-4">
            <textarea id="verify-key-input" rows="3" spellcheck="false" autocomplete="off" placeholder="Paste Verification Code or certificate URL (?v=... or ?key=...)" class="textarea textarea-bordered w-full font-mono text-xs rounded-2xl"></textarea>
            <div class="flex flex-wrap gap-2 mt-3 justify-end">
              <button id="verify-clear-btn" type="button" class="btn btn-sm btn-ghost rounded-full">Clear</button>
              <button id="verify-inspect-btn" type="button" class="btn btn-sm btn-primary rounded-full px-6 gap-1.5">
                <span class="material-symbols-outlined icon-18">search_check</span>
                <span>Check Certificate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const resultsContainer = document.getElementById('verify-results-container');
  const expandBar = document.getElementById('verify-expand-bar');
  const inputBody = document.getElementById('verify-input-body');
  const scannerPanel = document.getElementById('verify-scanner-panel');
  const scannerVideo = document.getElementById('verify-scanner-video');
  const scannerStatus = document.getElementById('verify-scanner-status');
  const scanBtn = document.getElementById('verify-scan-qr-btn');

  const setInputCollapsed = (collapsed) => {
    if (!expandBar || !inputBody) return;
    expandBar.classList.toggle('hidden', !collapsed);
    expandBar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    inputBody.classList.toggle('hidden', collapsed);
  };

  expandBar?.addEventListener('click', () => {
    setInputCollapsed(false);
    document.getElementById('verify-key-input')?.focus();
  });

  // Camera QR Scanner state
  let mediaStream = null;
  let scanRafId = null;
  let scanCanvas = null;
  let scanCtx = null;
  let barcodeDetector = null;
  let lastDecodeAt = 0;

  const stopCamera = () => {
    if (scanRafId !== null) {
      cancelAnimationFrame(scanRafId);
      scanRafId = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (scannerVideo) {
      scannerVideo.srcObject = null;
    }
    scannerPanel?.classList.add('hidden');
    if (scanBtn) scanBtn.disabled = false;
  };

  appState.cleanupRouteView = stopCamera;

  const renderQrResult = async (tokenStr) => {
    const qrRes = await verifyCompactQrToken(tokenStr);
    if (qrRes.valid && qrRes.payload) {
      const p = qrRes.payload;
      const scores = Array.isArray(p.quizScores) ? p.quizScores : [];
      resultsContainer.innerHTML = `
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
      resultsContainer.innerHTML = `
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
    setInputCollapsed(true);
  };

  const runInspection = async (rawInput) => {
    const parsed = extractVerificationToken(rawInput);
    if (parsed.type === 'empty') {
      resultsContainer.innerHTML = `
        <div class="rounded-3xl p-5 border-2 border-error m3-error-container flex items-center gap-3">
          <span class="material-symbols-outlined text-[30px]">gpp_bad</span>
          <div>
            <div class="font-bold">Verification Code Required</div>
            <div class="text-sm">Scan a certificate QR code or paste a Verification Code to check.</div>
          </div>
        </div>
      `;
      return;
    }

    if (parsed.type === 'qr') {
      await renderQrResult(parsed.value);
      return;
    }

    const res = await verifyCompletionKey(parsed.value);

    if (!res.payload) {
      resultsContainer.innerHTML = `
        <div class="rounded-3xl p-5 border-2 border-error m3-error-container flex items-center gap-3">
          <span class="material-symbols-outlined text-[30px]">gpp_bad</span>
          <div>
            <div class="font-bold">Could Not Check Certificate</div>
            <div class="text-sm">${escapeHtml(res.error)}</div>
          </div>
        </div>
      `;
      setInputCollapsed(true);
      return;
    }

    const p = res.payload;
    const avgQuiz = p.quizzes?.length
      ? Math.round(p.quizzes.reduce((s, q) => s + Number(q.bestScorePercent || 0), 0) / p.quizzes.length)
      : 0;
    const labsList = p.practicals || [];

    resultsContainer.innerHTML = `
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
            <div class="tabs tabs-boxed rounded-full p-1 m3-surface-container inline-flex flex-nowrap max-w-full overflow-x-auto no-scrollbar" id="verify-lab-tabs">
              ${LABS.map((l, idx) => `
                <button type="button" class="tab tab-sm rounded-full shrink-0 ${idx === 0 ? 'tab-active font-bold' : ''}" data-inspect-lab="${l.id}">
                  ${l.code}
                </button>
              `).join('')}
            </div>
          </div>

          <div id="verify-lab-detail"></div>
        </div>
      </div>
    `;

    setInputCollapsed(true);

    const showInspectLab = (labId) => {
      const labMeta = getLabById(labId);
      const prac = labsList.find((item) => Number(item.labId) === Number(labId)) || {
        labId, htmlCode: '', cssCode: '', jsCode: '', activeTypingSeconds: 0, pasteCount: 0
      };
      resultsContainer.querySelectorAll('[data-inspect-lab]').forEach((b) => {
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

    resultsContainer.querySelectorAll('[data-inspect-lab]').forEach((btn) => {
      btn.addEventListener('click', () => showInspectLab(btn.dataset.inspectLab));
    });
    showInspectLab(1);
  };

  // Start WebRTC camera QR scanner (BarcodeDetector with jsQR fallback)
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera access is not supported in this browser.', 'error');
      return;
    }
    stopCamera();
    if (scanBtn) scanBtn.disabled = true;
    scannerPanel?.classList.remove('hidden');
    if (scannerStatus) scannerStatus.textContent = 'Starting camera...';

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      if (!scannerVideo) {
        stopCamera();
        return;
      }
      scannerVideo.srcObject = mediaStream;
      await scannerVideo.play();

      if ('BarcodeDetector' in window) {
        try {
          const formats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
            ? await window.BarcodeDetector.getSupportedFormats()
            : ['qr_code'];
          if (formats.includes('qr_code')) {
            barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
          }
        } catch {
          barcodeDetector = null;
        }
      }

      if (scannerStatus) {
        scannerStatus.textContent = 'Point your camera at the certificate QR code...';
      }

      const decodeFrame = async (now) => {
        if (!mediaStream || !scannerVideo) return;
        if (now - lastDecodeAt >= 120 && scannerVideo.readyState >= 2 && scannerVideo.videoWidth > 0) {
          lastDecodeAt = now;
          let detectedRaw = '';

          if (barcodeDetector) {
            try {
              const codes = await barcodeDetector.detect(scannerVideo);
              if (codes && codes.length && codes[0].rawValue) {
                detectedRaw = codes[0].rawValue;
              }
            } catch {
              barcodeDetector = null;
            }
          }

          if (!detectedRaw && typeof window.jsQR === 'function') {
            if (!scanCanvas) {
              scanCanvas = document.createElement('canvas');
              scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
            }
            const w = scannerVideo.videoWidth;
            const h = scannerVideo.videoHeight;
            if (scanCanvas.width !== w || scanCanvas.height !== h) {
              scanCanvas.width = w;
              scanCanvas.height = h;
            }
            scanCtx.drawImage(scannerVideo, 0, 0, w, h);
            const imgData = scanCtx.getImageData(0, 0, w, h);
            const code = window.jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              detectedRaw = code.data;
            }
          }

          if (detectedRaw) {
            stopCamera();
            const keyInput = document.getElementById('verify-key-input');
            if (keyInput) keyInput.value = detectedRaw;
            await runInspection(detectedRaw);
            return;
          }
        }
        scanRafId = requestAnimationFrame(decodeFrame);
      };

      scanRafId = requestAnimationFrame(decodeFrame);
    } catch (err) {
      stopCamera();
      showToast(`Could not access camera: ${err.message}`, 'error');
    }
  };

  scanBtn?.addEventListener('click', startCamera);
  document.getElementById('verify-stop-camera-btn')?.addEventListener('click', stopCamera);

  document.getElementById('verify-inspect-btn')?.addEventListener('click', () => {
    stopCamera();
    runInspection(document.getElementById('verify-key-input').value);
  });
  document.getElementById('verify-clear-btn')?.addEventListener('click', () => {
    stopCamera();
    document.getElementById('verify-key-input').value = '';
    resultsContainer.innerHTML = '';
    setInputCollapsed(false);
  });

  if (qrParam) {
    const parsed = extractVerificationToken(qrParam);
    await renderQrResult(parsed.value);
  } else if (keyParam) {
    const parsed = extractVerificationToken(keyParam);
    const keyInput = document.getElementById('verify-key-input');
    if (keyInput) keyInput.value = parsed.value;
    await runInspection(parsed.value);
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

// ============================================================================
// Centralized Keyboard Shortcuts & Sequential Step Navigation
// ============================================================================

function buildCourseSequence() {
  const sequence = [];
  for (const mod of MODULES) {
    const unlockedMod = getModuleGateStatus(mod.id).unlocked;
    const lessonCount = (mod.sections || []).length;
    for (let step = 1; step <= lessonCount; step += 1) {
      sequence.push({
        hash: `#/module/${mod.id}/lesson/${step}`,
        unlocked: unlockedMod
      });
    }
    sequence.push({
      hash: `#/quiz/${mod.id}`,
      unlocked: unlockedMod
    });
    for (const lab of getLabsByModule(mod.id)) {
      sequence.push({
        hash: `#/lab/${lab.id}`,
        unlocked: getLabGateStatus(lab.id).unlocked
      });
    }
  }
  sequence.push({
    hash: '#/certificate',
    unlocked: isCertificateUnlocked()
  });
  return sequence;
}

function normalizeRouteHash(rawHash) {
  const clean = (rawHash || '#/').split('?')[0];
  const parts = clean.replace(/^#/, '').split('/').filter(Boolean);
  if (parts.length === 0) return '#/';
  if (parts[0] === 'module' && parts[1]) {
    const step = parts[2] === 'lesson' && parts[3] ? Number(parts[3]) : 1;
    return `#/module/${Number(parts[1])}/lesson/${step}`;
  }
  if (parts[0] === 'quiz' && parts[1]) return `#/quiz/${Number(parts[1])}`;
  if (parts[0] === 'lab' && parts[1]) return `#/lab/${Number(parts[1])}`;
  return `#/${parts[0]}`;
}

function navigateCourseStep(delta) {
  const current = normalizeRouteHash(window.location.hash);
  const sequence = buildCourseSequence();

  if (current === '#/' && delta > 0) {
    window.location.hash = sequence[0]?.hash || '#/module/1/lesson/1';
    return;
  }

  const idx = sequence.findIndex((item) => item.hash === current);
  if (idx < 0) return;

  const target = sequence[idx + delta];
  if (!target) return;

  if (!target.unlocked) {
    showToast('Complete the current quiz or lab checks to unlock the next step.', 'info');
    return;
  }

  window.location.hash = target.hash;
}

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.closest('.CodeMirror, .ide-fallback-textarea')) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return true;
  return false;
}

function syncShortcutPlatformLabels() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const isMac = /mac|iphone|ipad|ipod/i.test(platform);
  const modLabel = isMac ? '⌘' : 'Ctrl';
  const altLabel = isMac ? '⌥' : 'Alt';
  document.querySelectorAll('[data-mod-key]').forEach((el) => {
    el.textContent = modLabel;
  });
  document.querySelectorAll('[data-alt-key]').forEach((el) => {
    el.textContent = altLabel;
  });
  const railBtn = document.getElementById('rail-toggle-btn');
  if (railBtn) railBtn.title = `Toggle Sidebar (${modLabel}+B)`;
}

// ============================================================================
// Keyboard shortcut show only when Ctrl is pressed
// ============================================================================

function initCtrlHintReveal(delayMs = 300) {
  let revealTimer = null;

  const setModHeld = (held) => {
    clearTimeout(revealTimer);
    if (held) {
      if (document.documentElement.classList.contains('is-mod-key-held')) return;
      revealTimer = setTimeout(() => {
        document.documentElement.classList.add('is-mod-key-held');
      }, delayMs);
    } else {
      document.documentElement.classList.remove('is-mod-key-held');
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Ignore auto-repeat keydown events while holding Ctrl
    if (e.key === 'Control' || e.key === 'Meta' || e.ctrlKey || e.metaKey) {
      setModHeld(true);
    }
  }, { passive: true });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta' || (!e.ctrlKey && !e.metaKey)) {
      setModHeld(false);
    }
  }, { passive: true });

  window.addEventListener('blur', () => setModHeld(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setModHeld(false);
  });
}

function initKeyboardShortcuts() {
  syncShortcutPlatformLabels();
  initCtrlHintReveal();

  window.addEventListener('keydown', (e) => {
    const key = e.key;
    const lower = key.toLowerCase();
    const modKey = e.ctrlKey || e.metaKey;
    const inEditor = Boolean(e.target instanceof Element && e.target.closest('.CodeMirror, .ide-fallback-textarea'));
    const inEditable = isEditableTarget(e.target);

    // 1. Escape closes open modals, popovers, dropdowns, and mobile drawer
    if (key === 'Escape') {
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog && typeof openDialog.close === 'function') {
        openDialog.close();
      }
      const settingsMenu = document.getElementById('nav-settings-menu');
      if (settingsMenu && !settingsMenu.classList.contains('hidden')) {
        settingsMenu.classList.add('hidden');
        document.getElementById('nav-settings-btn')?.setAttribute('aria-expanded', 'false');
      }
      if (document.activeElement && document.activeElement.closest('.dropdown')) {
        document.activeElement.blur();
      }
      closeMobileDrawer();
      return;
    }

    // Ctrl+Enter / Cmd+Enter inside Quick Check modal directly continues or skips
    if (modKey && !e.altKey && key === 'Enter') {
      const qcModal = document.getElementById('quick-check-modal');
      if (qcModal?.open) {
        e.preventDefault();
        const continueBtn = document.getElementById('qc-continue-btn');
        const skipBtn = document.getElementById('qc-skip-btn');
        if (continueBtn && !continueBtn.classList.contains('hidden')) {
          continueBtn.click();
        } else {
          skipBtn?.click();
        }
        return;
      }
    }

    // Do not run route/lesson shortcuts while a modal dialog is open
    const hasOpenModal = Boolean(document.querySelector('dialog[open]'));
    if (hasOpenModal) return;

    // 2. ? Opens Shortcuts Cheatsheet Modal (outside editors & inputs)
    if (key === '?' && !modKey && !e.altKey && !inEditable) {
      e.preventDefault();
      const modal = document.getElementById('shortcuts-modal');
      if (modal && typeof modal.showModal === 'function') modal.showModal();
      return;
    }

    // 3. Ctrl+B / Cmd+B — Toggle Left Sidebar (outside CodeMirror/fallback textarea which handle it via extraKeys)
    if (modKey && !e.altKey && !e.shiftKey && lower === 'b') {
      if (inEditor) return;
      e.preventDefault();
      toggleCourseSidebar();
      return;
    }

    // 4. Alt+R or Ctrl+Shift+R — Run Code Preview (without advancing)
    if ((e.altKey && !modKey && !e.shiftKey && lower === 'r') || (modKey && e.shiftKey && !e.altKey && lower === 'r')) {
      if (inEditor) return;
      if (appState.shortcutContext?.onRunPreview) {
        e.preventDefault();
        appState.shortcutContext.onRunPreview();
      }
      return;
    }

    // 5. Alt+Backspace or Ctrl+Shift+X — Reset Starter Code
    if ((e.altKey && !modKey && !e.shiftKey && key === 'Backspace') || (modKey && e.shiftKey && !e.altKey && lower === 'x')) {
      if (inEditor) return;
      if (appState.shortcutContext?.onReset) {
        e.preventDefault();
        appState.shortcutContext.onReset();
      }
      return;
    }

    // 6. Ctrl+S / Cmd+S (outside CodeMirror/fallback textarea which handle it via extraKeys)
    if (modKey && !e.altKey && lower === 's') {
      if (inEditor) return;
      e.preventDefault();
      if (appState.shortcutContext?.onSave) {
        appState.shortcutContext.onSave();
      } else {
        showToast('All progress is saved automatically in your browser.', 'info');
      }
      return;
    }

    // 7. Ctrl+Enter / Cmd+Enter (outside CodeMirror/fallback textarea which handle it via extraKeys)
    if (modKey && !e.altKey && key === 'Enter') {
      if (inEditor) return;
      if (appState.shortcutContext?.onRunAdvance) {
        e.preventDefault();
        appState.shortcutContext.onRunAdvance();
      }
      return;
    }

    // 8. Alt+ArrowLeft / Alt+ArrowRight (works everywhere without colliding with Ctrl+Arrow cursor jump)
    if (e.altKey && !modKey && !e.shiftKey && (key === 'ArrowRight' || key === 'ArrowLeft')) {
      e.preventDefault();
      navigateCourseStep(key === 'ArrowRight' ? 1 : -1);
    }
  });
}

async function handleRoute() {
  const qcModal = document.getElementById('quick-check-modal');
  if (qcModal?.open) qcModal.close();
  appState.shortcutContext = null;
  if (appState.cleanupSplitResizers) {
    appState.cleanupSplitResizers();
    appState.cleanupSplitResizers = null;
  }
  if (appState.cleanupRouteView) {
    appState.cleanupRouteView();
    appState.cleanupRouteView = null;
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
    const lessonStep = parts[2] === 'lesson' && parts[3] ? Number(parts[3]) : 1;
    renderModuleView(Number(parts[1]), lessonStep);
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
    await loadAudioManifest();
    bindGlobalModals();
    initKeyboardShortcuts();

    document.querySelectorAll('.js-theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'm3-dark' ? 'm3-light' : 'm3-dark');
      });
    });

    document.getElementById('drawer-toggle-btn')?.addEventListener('click', openMobileDrawer);
    document.getElementById('drawer-close-btn')?.addEventListener('click', closeMobileDrawer);
    document.getElementById('drawer-backdrop')?.addEventListener('click', closeMobileDrawer);

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();
    prefetchCertificateInBackground();
  } finally {
    await fontsReadyPromise;
    dismissBootLoader();
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);