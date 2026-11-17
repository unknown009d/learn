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
  clearAllData
} from './db.js';
import { MODULES, BONUS_MODULE, getModuleById } from './course-data.js';
import { getQuizByModule } from './quiz-data.js';
import { LABS, getLabById, getLabsByModule } from './labs-data.js';
import { LabIDEController, composeSrcDoc } from './ide.js';
import { renderLessonWidgetHtml, hydrateLessonWidget, runJsInSandbox } from './lesson-widgets.js';
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
  lessons: new Set(),
  activeIDE: null,
  cleanupSplitResizers: null,
  quizSession: null, // holds shuffled quiz state during active attempt
  shortcutContext: null // { onRunAdvance?: Function, onSave?: Function }
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
  const nameOk = /\.json$/i.test(file.name) || file.type === 'application/json';
  if (!nameOk) {
    showBackupDropzoneError('Please choose a .json progress file.');
    return;
  }
  if (file.size > BACKUP_MAX_BYTES) {
    showBackupDropzoneError(`File is too large (${(file.size / 1048576).toFixed(1)}MB). Maximum size is 2MB.`);
    return;
  }
  try {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('This file is not valid JSON.');
    }
    assertValidBackupState(parsed);
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
    status.textContent = 'Backup text not recognized. Paste the full text exactly as copied.';
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
      await refreshStateFromDB();
      renderSidebarAndProgress();
      modal.close();
      showToast(`Welcome back, ${state.profile.fullName}! Your progress is loaded.`, 'success');
      handleRoute();
    } catch (err) {
      showToast('Could not load saved progress: ' + err.message, 'error');
      updateBackupImportButton();
    }
  });

  // Save Backup: download
  document.getElementById('modal-export-json-btn')?.addEventListener('click', async () => {
    const state = await exportFullState();
    const safeRoll = (state.profile?.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeRoll}_druba-web.json`;
    downloadFile(filename, JSON.stringify(state, null, 2));
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

function renderSidebarAndProgress() {
  const prog = computeOverallProgress();
  const navBar = document.getElementById('nav-progress-bar');
  const navLbl = document.getElementById('nav-progress-label');
  if (navBar) navBar.value = prog.percent;
  if (navLbl) navLbl.textContent = `${prog.done}/${prog.totalSteps} · ${prog.percent}%`;

  const profileCard = document.getElementById('sidebar-profile-card');
  if (profileCard) {
    if (isRegistered()) {
      const initial = escapeHtml(appState.profile.fullName.charAt(0).toUpperCase());
      profileCard.innerHTML = `
        <div class="rail-expanded-only p-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full m3-primary-container flex items-center justify-center font-bold text-xs shrink-0">
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
    const isLessonRoute = currentHash === modHash || currentHash.startsWith(`${modHash}/lesson/`);
    const activeLessonNum = currentHash.startsWith(`${modHash}/lesson/`)
      ? Number(currentHash.split('/')[4] || 1)
      : (currentHash === modHash ? 1 : 0);
    const isAnyInModActive =
      isLessonRoute ||
      currentHash === quizHash ||
      mod.labIds.some((lid) => currentHash === `#/lab/${lid}`);

    html += `
      <!-- Expanded Drawer Module Block -->
      <div class="rail-expanded-only rounded-2xl p-2 ${gate.unlocked ? 'm3-surface-container' : 'm3-surface-container-low opacity-75'} border m3-border-subtle">
        <a href="${modHash}" class="m3-nav-item ${isLessonRoute ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-sm">
          <span class="material-symbols-outlined icon-20 mt-0.5 shrink-0 ${modComplete ? 'filled m3-text-primary' : ''}">
            ${modComplete ? 'check_circle' : gate.unlocked ? mod.icon : 'lock'}
          </span>
          <div class="min-w-0 flex-1">
            <span class="font-bold text-[10px] font-mono tracking-wide uppercase opacity-70 block">${mod.code}</span>
            <div class="font-semibold text-[13px] rail-module-title">${escapeHtml(mod.title)}</div>
          </div>
        </a>

        <div class="mt-1 pl-3 flex flex-col gap-0.5 border-l-2 m3-border-subtle ml-4">
          ${gate.unlocked && isAnyInModActive ? mod.sections.map((sec, idx) => {
            const stepNum = idx + 1;
            const secDone = isLessonCompleted(mod.id, sec.id);
            const secActive = isLessonRoute && activeLessonNum === stepNum;
            return `
              <a href="#/module/${mod.id}/lesson/${stepNum}" class="m3-nav-item ${secActive ? 'is-active' : ''} flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] min-w-0" title="${escapeHtml(sec.title)}">
                <span class="material-symbols-outlined shrink-0 ${secDone ? 'm3-text-primary' : 'opacity-60'}" style="font-size:15px;">
                  ${secDone ? 'check_circle' : secActive ? 'play_circle' : 'radio_button_unchecked'}
                </span>
                <span class="truncate">${stepNum}. ${escapeHtml(sec.title)}</span>
              </a>
            `;
          }).join('') : ''}
          <a href="${quizHash}" class="m3-nav-item ${currentHash === quizHash ? 'is-active' : ''} ${!gate.unlocked ? 'is-locked' : ''} flex items-center justify-between px-2.5 py-1.5 rounded-full text-xs gap-2">
            <span class="flex items-center gap-1.5 min-w-0">
              <span class="material-symbols-outlined icon-18 shrink-0">quiz</span>
              <span class="truncate">Graded Quiz</span>
            </span>
            ${quizPassed
              ? `<span class="material-symbols-outlined m3-text-primary shrink-0" style="font-size:15px;">check_circle</span>`
              : ''
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
    openBackupModal('load');
  });
}

// ============================================================================
// Single-Topic Full-Viewport Lesson Workspace (#/module/:id & #/module/:id/lesson/:n)
// ============================================================================

function renderLessonPaneOneHtml(mod, sec, currentStep, totalLessons) {
  const isLastLesson = currentStep >= totalLessons;
  const checks = Array.isArray(sec.widget?.checks) ? sec.widget.checks : [];

  return `
    <div id="pane-instructions" class="ide-pane">
      <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        <div>
          <div id="lesson-step-label" class="text-xs font-medium m3-text-muted">
            Module ${mod.id} &middot; Lesson ${currentStep} of ${totalLessons}
          </div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">${escapeHtml(sec.title)}</h1>
          <p class="text-sm m3-text-muted mt-2 leading-relaxed m-0">${escapeHtml(sec.lead)}</p>
        </div>

        ${sec.points ? `
          <ul class="space-y-2 text-sm pl-4 list-disc m-0">
            ${sec.points.map((pt) => `
              <li>
                <strong class="font-semibold">${escapeHtml(pt.heading)}:</strong>
                <span class="m3-text-muted">${escapeHtml(pt.text)}</span>
              </li>
            `).join('')}
          </ul>
        ` : ''}

        ${sec.widget?.task ? `
          <div class="pt-3 border-t m3-border-subtle">
            <div class="text-xs font-semibold uppercase tracking-wider m3-text-primary mb-1">Try It in the Editor</div>
            <p class="text-xs m3-text-muted m-0">${escapeHtml(sec.widget.task)}</p>
            ${checks.length ? `
              <div class="flex flex-wrap gap-1.5 mt-2.5" data-me-checks>
                ${checks.map((chk, idx) => `
                  <span class="badge badge-sm m3-surface-container border m3-border-subtle gap-1 font-medium" data-me-check="${idx}">
                    <span class="material-symbols-outlined" style="font-size:14px">radio_button_unchecked</span>
                    <span>${escapeHtml(chk.label)}</span>
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${(sec.analogy || sec.takeaway) ? `
          <details class="m3-accordion rounded-2xl border m3-border-subtle">
            <summary class="m3-accordion-trigger px-3.5 py-2.5 text-xs font-semibold">
              <span>Extra Tips &amp; Examples</span>
              <span class="material-symbols-outlined icon-18 m3-accordion-chevron" aria-hidden="true">expand_more</span>
            </summary>
            <div class="m3-accordion-body px-3.5 py-3 text-xs space-y-2 m3-text-muted">
              ${sec.analogy ? `<div><strong class="text-[var(--m3-text)]">${escapeHtml(sec.analogy.title)}:</strong> ${escapeHtml(sec.analogy.text)}</div>` : ''}
              ${sec.takeaway ? `<div><strong class="text-[var(--m3-text)]">Takeaway:</strong> ${escapeHtml(sec.takeaway.text)}</div>` : ''}
            </div>
          </details>
        ` : ''}

        ${sec.microCheck ? `
          <details class="m3-accordion rounded-2xl border m3-border-subtle" id="lesson-micro-check">
            <summary class="m3-accordion-trigger px-3.5 py-2.5 text-xs font-semibold">
              <span>Quick Check (Optional)</span>
              <span class="material-symbols-outlined icon-18 m3-accordion-chevron" aria-hidden="true">expand_more</span>
            </summary>
            <div class="m3-accordion-body px-3.5 py-3">
              <p class="text-xs sm:text-sm font-medium mb-2.5 mt-0">${escapeHtml(sec.microCheck.question)}</p>
              <div class="flex flex-col gap-1.5">
                ${sec.microCheck.options.map((opt, oIdx) => `
                  <button type="button" class="btn btn-xs h-auto min-h-[32px] py-1.5 px-3 justify-start text-left font-normal btn-ghost border m3-border-subtle rounded-xl" data-mc-opt="${oIdx}">
                    <span class="font-mono font-semibold mr-2 opacity-70">${['A', 'B', 'C'][oIdx]}.</span>
                    <span>${escapeHtml(opt)}</span>
                  </button>
                `).join('')}
              </div>
              <p id="micro-check-feedback" class="hidden text-xs mt-2.5 leading-relaxed m-0"></p>
            </div>
          </details>
        ` : ''}
      </div>

      <!-- Anchored Bottom Lesson Footer inside Pane 1 -->
      <footer class="border-t m3-border-subtle m3-surface-container-low px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-1.5">
          ${currentStep > 1 ? `
            <a href="#/module/${mod.id}/lesson/${currentStep - 1}" id="lesson-prev-btn" class="btn btn-xs sm:btn-sm btn-ghost border m3-border-subtle rounded-full px-3" title="Previous Lesson (Alt+Left)">
              Previous
            </a>
          ` : ''}
          <a href="#/quiz/${mod.id}" class="btn btn-xs sm:btn-sm btn-ghost rounded-full px-3" title="Jump to Module ${mod.id} Quiz">
            Take Quiz
          </a>
        </div>

        <button id="lesson-complete-next-btn" type="button" class="btn btn-xs sm:btn-sm btn-primary rounded-full px-4 gap-1.5" title="${isLastLesson ? 'Start Quiz' : 'Next Lesson'} (Ctrl+Enter)">
          <span>${isLastLesson ? 'Start Quiz' : 'Next'}</span>
          <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
          <span class="material-symbols-outlined" style="font-size:16px">arrow_forward</span>
        </button>
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
                  <span class="material-symbols-outlined" style="font-size:15px">play_arrow</span>
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
    view.innerHTML = `
      <section class="ide-workspace-root" data-micro-lesson="${escapeHtml(sec.id)}">
        <!-- Mobile 2-Tab Switcher (< 1024px) -->
        <div class="p-2 border-b m3-border-subtle m3-surface-container-low lg:hidden">
          <div class="tabs tabs-boxed rounded-full p-1 m3-surface-container grid grid-cols-2" id="mobile-pane-tabs">
            <button type="button" class="tab tab-sm rounded-full tab-active" data-pane="instructions">Lesson</button>
            <button type="button" class="tab tab-sm rounded-full" data-pane="simulator">Interactive Lab</button>
          </div>
        </div>

        <div id="ide-split-container" class="ide-split-container">
          ${renderLessonPaneOneHtml(mod, sec, currentStep, totalLessons)}

          <div id="resizer-1" class="ide-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Lesson and Simulator"></div>

          <div id="pane-simulator" class="ide-pane">
            <div class="flex-1 overflow-y-auto p-5 sm:p-8 flex flex-col justify-center">
              <div class="w-full max-w-2xl mx-auto">
                ${renderLessonWidgetHtml(sec.widget)}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

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

    const mobileTabs = document.getElementById('mobile-pane-tabs');
    if (mobileTabs) {
      const panes = {
        instructions: document.getElementById('pane-instructions'),
        simulator: document.getElementById('pane-simulator')
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
      };
      mobileTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pane]');
        if (btn) syncMobilePanes(btn.dataset.pane);
      });
      syncMobilePanes('instructions');
    }
  }

  // Hydrate Quick Check accordion in Pane 1
  if (sec.microCheck) {
    const mcRoot = document.getElementById('lesson-micro-check');
    const fbEl = document.getElementById('micro-check-feedback');
    mcRoot?.querySelectorAll('[data-mc-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = Number(btn.dataset.mcOpt);
        const ok = picked === sec.microCheck.correctIndex;
        mcRoot.querySelectorAll('[data-mc-opt]').forEach((b) => {
          const idx = Number(b.dataset.mcOpt);
          b.classList.remove('btn-primary', 'm3-btn-tonal', 'btn-ghost');
          if (idx === picked) {
            b.classList.add(ok ? 'btn-primary' : 'm3-btn-tonal');
          } else {
            b.classList.add('btn-ghost');
          }
        });
        fbEl.classList.remove('hidden', 'm3-text-primary', 'text-error');
        fbEl.classList.add(ok ? 'm3-text-primary' : 'text-error');
        fbEl.textContent = `${ok ? 'Correct.' : 'Not quite.'} ${sec.microCheck.explanation}`;
      });
    });
  }

  // Save micro-lesson completion in IndexedDB and advance
  document.getElementById('lesson-complete-next-btn')?.addEventListener('click', async () => {
    await markLessonCompleted(mod.id, sec.id, currentStep);
    appState.lessons.add(`${mod.id}:${sec.id}`);
    renderSidebarAndProgress();
    if (isLastLesson) {
      window.location.hash = `#/quiz/${mod.id}`;
    } else {
      window.location.hash = `#/module/${mod.id}/lesson/${currentStep + 1}`;
    }
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
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
                </button>
              ` : labs.length ? `
                <a id="quiz-continue-btn" href="#/lab/${labs[0].id}" class="btn btn-primary rounded-full px-5 gap-1.5" title="Continue (Ctrl+Enter)">
                  <span>Start ${labs[0].code}</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              ` : mod.id < 5 ? `
                <a id="quiz-continue-btn" href="#/module/${mod.id + 1}" class="btn btn-primary rounded-full px-5 gap-1.5" title="Continue (Ctrl+Enter)">
                  <span>Continue to Module ${mod.id + 1}</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              ` : `
                <a id="quiz-continue-btn" href="#/certificate" class="btn btn-primary rounded-full px-5 gap-1.5" title="View Your Certificate (Ctrl+Enter)">
                  <span class="material-symbols-outlined text-[18px]">workspace_premium</span>
                  View Your Certificate
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
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
            <button type="submit" class="btn btn-primary btn-lg rounded-full px-8 gap-2" title="Submit Quiz (Ctrl+Enter)">
              <span class="material-symbols-outlined">task_alt</span>
              <span>Submit Quiz &amp; Check Mastery</span>
              <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
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

          <button id="ide-preview-btn" type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full gap-1" title="Run Preview (Ctrl+S)">
            <span class="material-symbols-outlined icon-18">play_arrow</span>
            <span>Run</span>
          </button>

          ${!isBonus ? `
            <button id="ide-verify-btn" type="button" class="btn btn-xs sm:btn-sm btn-primary rounded-full px-3.5 gap-1.5" title="Run Automatic Code Check & Advance (Ctrl+Enter)">
              <span class="material-symbols-outlined icon-18">verified</span>
              <span>Check My Code</span>
              <kbd class="m3-kbd-on-primary hidden md:inline-flex">Ctrl+Enter</kbd>
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

            <div id="ide-next-cta" class="${savedRec?.completed ? '' : 'hidden'} pt-2 border-t m3-border-subtle">
              ${nextLab ? `
                <a href="#/lab/${nextLab.id}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5" title="Next Lab (Ctrl+Enter)">
                  <span>Next: ${escapeHtml(nextLab.code)}</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
                  <span class="material-symbols-outlined icon-18">arrow_forward</span>
                </a>
              ` : mod && mod.id < 5 ? `
                <a href="#/module/${mod.id + 1}" class="btn btn-primary btn-sm rounded-full w-full gap-1.5" title="Proceed to Next Module (Ctrl+Enter)">
                  <span>Proceed to Module ${mod.id + 1}</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
                  <span class="material-symbols-outlined icon-18">arrow_forward</span>
                </a>
              ` : !isBonus && mod && mod.id === 5 ? `
                <a href="#/certificate" class="btn btn-primary btn-sm rounded-full w-full gap-1.5" title="View Your Certificate (Ctrl+Enter)">
                  <span class="material-symbols-outlined icon-18">workspace_premium</span>
                  <span>View Certificate</span>
                  <kbd class="m3-kbd-on-primary hidden sm:inline-flex">Ctrl+Enter</kbd>
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
    onShortcutSave: async (ctrl) => {
      for (const tabKey of lab.tabs || []) {
        if (ctrl.editors[tabKey]) ctrl.code[tabKey] = ctrl.editors[tabKey].getValue();
      }
      await ctrl.persistDraft();
      ctrl.runPreviewOnly();
      showToast('Code saved & preview updated', 'success');
    },
    onShortcutRunAdvance: async (ctrl) => {
      for (const tabKey of lab.tabs || []) {
        if (ctrl.editors[tabKey]) ctrl.code[tabKey] = ctrl.editors[tabKey].getValue();
      }
      if (isBonus) {
        ctrl.runPreviewOnly();
        showToast('Preview updated.', 'info');
        return;
      }
      ctrl.pendingShortcutAdvance = true;
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
        await refreshStateFromDB();
        renderSidebarAndProgress();
        document.getElementById('ide-verified-badge')?.classList.remove('hidden');
        document.getElementById('ide-verified-badge')?.classList.add('inline-flex');
        document.getElementById('ide-next-cta')?.classList.remove('hidden');
        showToast(`Nice work! All ${res.totalAssertions} checks passed for ${lab.code}.`, 'success');

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
            `Your work is saved in this browser, and ${unlockedMod} is now unlocked.`,
            `M${lab.moduleId}`
          );
        }
      } else {
        showToast(`Almost there! ${res.passedAssertions} of ${res.totalAssertions} checks passed. Check the tips on the left.`, 'error');
      }
    }
  });

  appState.shortcutContext = {
    onRunAdvance: () => ide.onShortcutRunAdvance?.(ide),
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

function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const key = e.key;
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

    // 3. Ctrl+S / Cmd+S (outside CodeMirror/fallback textarea which handle it natively)
    if (modKey && !e.altKey && (key === 's' || key === 'S')) {
      if (inEditor) return;
      e.preventDefault();
      if (appState.shortcutContext?.onSave) {
        appState.shortcutContext.onSave();
      } else {
        showToast('All progress is saved automatically in your browser.', 'info');
      }
      return;
    }

    // 4. Ctrl+Enter / Cmd+Enter (outside CodeMirror/fallback textarea which handle it natively)
    if (modKey && !e.altKey && key === 'Enter') {
      if (inEditor) return;
      if (appState.shortcutContext?.onRunAdvance) {
        e.preventDefault();
        appState.shortcutContext.onRunAdvance();
      }
      return;
    }

    // 5. Alt+ArrowLeft / Alt+ArrowRight (works everywhere, including CodeMirror)
    if (e.altKey && !modKey && !e.shiftKey && (key === 'ArrowRight' || key === 'ArrowLeft')) {
      e.preventDefault();
      navigateCourseStep(key === 'ArrowRight' ? 1 : -1);
      return;
    }

    // 6. Ctrl+ArrowLeft / Ctrl+ArrowRight (only outside text inputs & CodeMirror)
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !inEditable && (key === 'ArrowRight' || key === 'ArrowLeft')) {
      e.preventDefault();
      navigateCourseStep(key === 'ArrowRight' ? 1 : -1);
    }
  });
}

async function handleRoute() {
  appState.shortcutContext = null;
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
  } finally {
    await fontsReadyPromise;
    dismissBootLoader();
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
