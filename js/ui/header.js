/**
 * Top bar overflow menu and the global dialogs it opens.
 */

import { openBackupModal, bindBackupModal } from './backup-modal.js';
import { closeMobileDrawer } from './sidebar.js';

export function bindGlobalModals() {
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
