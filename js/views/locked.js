/**
 * Shared "this step is locked" view.
 */

import { escapeHtml } from '../core/utils.js';

export function renderLockedView(title, reason, targetHash = '#/') {
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
