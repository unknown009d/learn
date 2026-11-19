/**
 * Milestone celebration dialog (confetti, score, backup shortcut).
 */

import { exportFullState } from '../db.js';
import { encodeBackupToken } from '../crypto-key.js';
import { showToast, copyToClipboard, downloadFile } from '../core/utils.js';
import { computeOverallProgress } from '../core/state.js';

const LIGHT_PALETTE = ['#0e7a3a', '#16a34a', '#0284c7', '#d97706', '#e11d48', '#7c3aed'];
const DARK_PALETTE = ['#34d375', '#6ee7b7', '#b9f3c6', '#a2ced7', '#ffb870', '#fde047'];

function launchCheckpointBurst() {
  const modal = document.getElementById('checkpoint-modal');
  const box = modal?.querySelector('.modal-box');
  const layer = document.getElementById('checkpoint-burst-layer');
  if (!box || !layer) return;

  layer.innerHTML = '';
  const isDark = document.documentElement.getAttribute('data-theme') === 'm3-dark';
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

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
        const size = 6 + Math.round(Math.random() * 5);
        const isRibbon = i % 3 === 0;

        p.style.setProperty('--sx', `${origin.x.toFixed(1)}px`);
        p.style.setProperty('--sy', `${origin.y.toFixed(1)}px`);
        p.style.setProperty('--tx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
        p.style.setProperty('--ty', `${(Math.sin(angle) * dist + 18).toFixed(1)}px`);
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

/**
 * @param {object} milestone
 * @param {string} milestone.title        Heading, e.g. "Module 1 Quiz Passed"
 * @param {string} milestone.description  One-line next step
 * @param {string} milestone.code         Short id used in the badge and backup filename, e.g. "M1_Quiz"
 * @param {string} milestone.statValue    Big number, e.g. "80%" or "4/4"
 * @param {string} milestone.statLabel    Caption under the number, e.g. "Quiz Score" or "Checks Passed"
 */
export async function triggerCheckpointModal({ title, description, code, statValue, statLabel }) {
  const modal = document.getElementById('checkpoint-modal');
  if (!modal || typeof modal.showModal !== 'function') return;

  const fullState = await exportFullState();
  const token = await encodeBackupToken(fullState);
  const safeRoll = (fullState.profile?.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeRoll}_druba-web_${code}.vwfd`;
  const prog = computeOverallProgress();

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('checkpoint-score-value', statValue);
  setText('checkpoint-score-label', statLabel);
  setText('checkpoint-modal-badge', `${code.replace(/_/g, ' ')} Milestone`);
  setText('checkpoint-modal-title', title);
  setText('checkpoint-modal-desc', description || 'Your progress is saved automatically in this browser.');
  setText('checkpoint-progress-text', `${prog.done} of ${prog.totalSteps} Milestones Completed (${prog.percent}%)`);
  setText('checkpoint-filename-badge', filename);

  const backupAccordion = document.getElementById('checkpoint-backup-accordion');
  if (backupAccordion) backupAccordion.open = false;
  document.getElementById('checkpoint-token-preview').value = token;

  document.getElementById('checkpoint-copy-token-btn').onclick = () =>
    copyToClipboard(token, 'Backup text copied! Save it in your notes or messages.');
  document.getElementById('checkpoint-download-btn').onclick = () => {
    downloadFile(filename, token);
    showToast(`Downloaded ${filename}`, 'success');
  };

  modal.showModal();
  launchCheckpointBurst();
}
