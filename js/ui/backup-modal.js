/**
 * Save / Load Progress dialog (.vwfd backups).
 */

import { exportFullState, importFullState, clearAllData } from '../db.js';
import { MODULES } from '../course-data.js';
import { LABS } from '../labs-data.js';
import { encodeBackupToken, decodeBackupTokenDetailed } from '../crypto-key.js';
import { showToast, downloadFile, appClick } from '../core/utils.js';
import { recordTrail, reloadTrail } from '../integrity/trail.js';
import { appState, refreshStateFromDB, isRegistered, computeOverallProgress } from '../core/state.js';
import { renderSidebarAndProgress } from './sidebar.js';
import { invalidateInMemoryCertCache, prefetchCertificateInBackground } from '../views/certificate.js';
import { handleRoute } from '../router.js';
import { bindDeviceSync, exitDeviceSync } from './device-sync.js';

const BACKUP_MAX_BYTES = 2 * 1024 * 1024;

/** Parsed backups whose integrity seal was missing or wrong (see decodeBackupTokenDetailed). */
const craftedBackups = new WeakSet();

/** Drop the open lab editor without saving, so its old code can't overwrite replaced progress. */
function discardActiveEditor() {
  appState.activeIDE?.destroy({ persist: false });
  appState.activeIDE = null;
}

async function parseBackup(text) {
  const { payload, crafted } = await decodeBackupTokenDetailed(text);
  const state = assertValidBackupState(payload);
  if (crafted) craftedBackups.add(state);
  return state;
}

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
  const totalSteps = MODULES.length + LABS.length;
  const passedQuizzes = new Set(
    (Array.isArray(state?.quizzes) ? state.quizzes : [])
      .filter((q) => q && q.passed && MODULES.some((m) => m.id === Number(q.moduleId)))
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
  if (modal.classList.contains('is-syncing')) exitDeviceSync();
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
    const parsed = await parseBackup(text);
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
    const parsed = await parseBackup(raw);
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
  btn.querySelector('.bk-copy-label').textContent = 'Copy backup text';
  btn.title = 'Copy backup text';
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

/** Replace this browser's progress with a parsed backup. Resolves true on success. */
async function applyBackupState(state, where) {
  const modal = document.getElementById('backup-modal');
  try {
    discardActiveEditor();
    await importFullState(state);
    await reloadTrail();
    if (craftedBackups.has(state)) {
      recordTrail('backup-crafted', { where, detail: 'Signature valid, integrity seal missing or wrong' });
    }
    invalidateInMemoryCertCache();
    await refreshStateFromDB();
    renderSidebarAndProgress();
    modal.close();
    showToast(`Welcome back, ${state.profile.fullName}! Your progress is loaded.`, 'success');
    handleRoute();
    prefetchCertificateInBackground();
    return true;
  } catch (err) {
    showToast('Could not load saved progress: ' + err.message, 'error');
    return false;
  }
}

export function openBackupModal(tab) {
  const modal = document.getElementById('backup-modal');
  if (!modal) return;
  exitDeviceSync();
  resetBackupModalState();
  refreshBackupSaveSummary();
  setBackupTab(tab || (isRegistered() ? 'save' : 'load'));
  if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
}

export function bindBackupModal() {
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
  const openPicker = () => appClick(input);

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
    if (!(await applyBackupState(state, 'Backup import'))) updateBackupImportButton();
  });

  bindDeviceSync({
    modal,
    setTab: setBackupTab,
    canSend: isRegistered,
    buildToken: async () => encodeBackupToken(await exportFullState()),
    parseBackup,
    summarize: summarizeBackupState,
    applyState: (state) => applyBackupState(state, 'Device transfer'),
    notify: showToast
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
      btn.querySelector('.bk-copy-label').textContent = 'Copied';
      btn.title = 'Copied';
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
    discardActiveEditor();
    await clearAllData();
    await reloadTrail();
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
