/**
 * Entry point: boots theme, state, chrome and the router.
 */

import { refreshStateFromDB } from './core/state.js';
import { applyTheme, initTheme } from './core/theme.js';
import { bindGlobalModals } from './ui/header.js';
import { initRailState, closeMobileDrawer, openMobileDrawer } from './ui/sidebar.js';
import { loadAudioManifest } from './ui/lesson-audio.js';
import { prefetchCertificateInBackground, invalidateInMemoryCertCache } from './views/certificate.js';
import { initKeyboardShortcuts } from './ui/shortcuts.js';
import { initContentGuard } from './ui/content-guard.js';
import { initInspectionTrail } from './integrity/trail.js';
import { handleRoute } from './router.js';

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
    initContentGuard();
    // Not awaited: an outside edit to IndexedDB is re-checked after a short delay, and the
    // callback re-renders with the edited progress once it is confirmed.
    initInspectionTrail({
      onProgressEditedOutside: async () => {
        invalidateInMemoryCertCache();
        await refreshStateFromDB();
        handleRoute();
      }
    });
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
