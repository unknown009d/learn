/**
 * Hash router: tears down the previous view and renders the next one.
 */

import { appState } from './core/state.js';
import { renderSidebarAndProgress, closeMobileDrawer } from './ui/sidebar.js';
import { setWorkspaceLayoutMode } from './ui/workspace.js';
import { renderHomeView } from './views/home.js';
import { renderModuleView } from './views/lesson.js';
import { renderQuizView } from './views/quiz.js';
import { renderLabView } from './views/lab.js';
import { renderCertificateView } from './views/certificate.js';
import { renderVerifyView } from './views/verify.js';
import { renderManualView } from './views/manual.js';

export async function handleRoute() {
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

  // Every route starts at the top. On phones the window scrolls (not #app-view),
  // so without this a new page opens at the previous page's scroll depth.
  window.scrollTo(0, 0);
  const appView = document.getElementById('app-view');
  if (appView) appView.scrollTop = 0;

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
