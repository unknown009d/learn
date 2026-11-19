/**
 * Keyboard shortcuts and previous / next step navigation.
 */

import { MODULES } from '../course-data.js';
import { getLabsByModule } from '../labs-data.js';
import { showToast, appClick, MOD_KEY, ALT_KEY } from '../core/utils.js';
import { appState, getModuleGateStatus, getQuizGateStatus, getLabGateStatus, isCertificateUnlocked } from '../core/state.js';
import { toggleCourseSidebar, closeMobileDrawer } from './sidebar.js';

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
      unlocked: getQuizGateStatus(mod.id).unlocked
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
  document.querySelectorAll('[data-mod-key]').forEach((el) => {
    el.textContent = MOD_KEY;
  });
  document.querySelectorAll('[data-alt-key]').forEach((el) => {
    el.textContent = ALT_KEY;
  });
  const railBtn = document.getElementById('rail-toggle-btn');
  if (railBtn) railBtn.title = `Toggle Sidebar (${MOD_KEY}+B)`;
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

export function initKeyboardShortcuts() {
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
          appClick(continueBtn);
        } else {
          appClick(skipBtn);
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
