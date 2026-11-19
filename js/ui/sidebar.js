/**
 * Navigation rail / drawer and the module stepper inside it.
 */

import { MODULES } from '../course-data.js';
import { getLabById } from '../labs-data.js';
import { escapeHtml } from '../core/utils.js';
import {
  appState,
  isLessonCompleted,
  isRegistered,
  isQuizPassed,
  isLabCompleted,
  isModuleCompleted,
  getModuleGateStatus,
  getQuizGateStatus,
  getLabGateStatus,
  isCertificateUnlocked,
  computeOverallProgress
} from '../core/state.js';

const RAIL_STORAGE_KEY = 'druba_web_rail_collapsed';

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

export function initRailState() {
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

export function toggleCourseSidebar() {
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

export function renderSidebarAndProgress() {
  const prog = computeOverallProgress();
  const navBar = document.getElementById('nav-progress-bar');
  const navLbl = document.getElementById('nav-progress-label');
  if (navBar) navBar.value = prog.percent;
  if (navLbl) navLbl.textContent = `${prog.done}/${prog.totalSteps} · ${prog.percent}%`;
  const navLblCompact = document.getElementById('nav-progress-label-compact');
  if (navLblCompact) navLblCompact.textContent = `${prog.percent}%`;

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
    const quizGate = getQuizGateStatus(mod.id);
    const modComplete = isModuleCompleted(mod.id);
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

          <a href="${quizHash}" class="m3-nav-item ${currentHash === quizHash ? 'is-active' : ''} ${!quizGate.unlocked ? 'is-locked' : ''} flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium">
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

export function closeMobileDrawer() {
  document.getElementById('nav-drawer')?.classList.remove('is-open');
  document.getElementById('drawer-backdrop')?.classList.add('hidden');
}

export function openMobileDrawer() {
  document.getElementById('nav-drawer')?.classList.add('is-open');
  document.getElementById('drawer-backdrop')?.classList.remove('hidden');
}
