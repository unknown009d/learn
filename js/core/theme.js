/**
 * Light / dark theme resolution and persistence.
 */

import { appState } from './state.js';

const THEME_STORAGE_KEY = 'druba_web_theme';

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

export function applyTheme(theme, { persist = true } = {}) {
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

export function initTheme() {
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
