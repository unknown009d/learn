/**
 * Certificate checker (#/verify).
 */

import { MODULES } from '../course-data.js';
import { LABS, getLabById } from '../labs-data.js';
import { composeSrcDoc } from '../ide.js';
import { verifyCompletionKey, verifyCompactQrToken } from '../crypto-key.js';
import { escapeHtml, formatDate, formatDuration, showToast, loadScript } from '../core/utils.js';
import { appState, PASSING_PERCENT } from '../core/state.js';
import { loadMasteryBadge, masteryBadgeHtml } from '../ui/mastery-badge.js';
import {
  ORDER,
  TRAIL_TYPES,
  getMasteryRank,
  summarizeTrail,
  decodeTrailFromQr,
  decodeTrailFromKey,
  splitKeyAndTrail
} from '../integrity/trail-format.js';

// ----------------------------------------------------------------------------
// Status banner & DevTools trail
// ----------------------------------------------------------------------------

/**
 * @param {{ valid: boolean, rank?: object | null, error?: string, reference?: string, source?: string }} status
 *   `rank` comes from getMasteryRank(): present when the trail shows hands-on DevTools work.
 */
function renderStatusBanner({ valid, rank = null, badgeMarkup = '', error, reference, source }) {
  if (!valid) {
    return `
      <div class="rounded-3xl p-5 border-2 border-error m3-error-container flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <span class="material-symbols-outlined text-[36px]" aria-hidden="true">gpp_bad</span>
          <div>
            <h2 class="text-lg sm:text-xl font-extrabold">Status: Invalid or Altered</h2>
            <div class="text-xs font-mono opacity-90 mt-0.5">${escapeHtml(error || 'This certificate could not be verified.')}</div>
          </div>
        </div>
        <span class="badge badge-error badge-lg font-bold">INVALID</span>
      </div>
    `;
  }

  if (rank) {
    return `
      <div class="rounded-3xl p-5 sm:p-6 border-2 vf-impeccable flex flex-col sm:flex-row items-center sm:items-start gap-5">
        ${masteryBadgeHtml(badgeMarkup, rank, { size: 104, className: 'shrink-0 vf-order-seal' })}
        <div class="min-w-0 flex-1 text-center sm:text-left">
          ${source ? `<div class="text-xs font-mono font-bold uppercase tracking-wider opacity-80">${escapeHtml(source)}</div>` : ''}
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span class="badge badge-success font-bold">VERIFIED</span>
            <span class="badge vf-order-chip font-bold" title="${escapeHtml(rank.fullTitle)}">${escapeHtml(rank.title)}</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-extrabold mt-2 leading-snug">${escapeHtml(ORDER.headline)}</h2>
          <p class="text-sm opacity-90 mt-1.5">${escapeHtml(ORDER.subline)}</p>
          <p class="text-xs mt-2 opacity-80"><strong>${escapeHtml(rank.fullTitle)}.</strong> ${escapeHtml(rank.blurb)}</p>
          <p class="text-xs mt-1 opacity-80"><em>${escapeHtml(ORDER.motto)}</em> ${escapeHtml(ORDER.signoff)}</p>
          ${reference ? `<div class="text-xs font-mono opacity-80 mt-2">Verification Ref: ${escapeHtml(reference)}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="rounded-3xl p-5 border-2 border-success m3-success-container flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3.5 min-w-0">
        <span class="material-symbols-outlined filled text-[36px]" aria-hidden="true">verified</span>
        <div class="min-w-0">
          ${source ? `<div class="text-xs font-mono font-bold uppercase tracking-wider opacity-80">${escapeHtml(source)}</div>` : ''}
          <h2 class="text-lg sm:text-xl font-extrabold">Status: Authentic &amp; Verified</h2>
          ${reference ? `<div class="text-xs font-mono opacity-90 mt-0.5">Verification Ref: ${escapeHtml(reference)}</div>` : ''}
        </div>
      </div>
      <span class="badge badge-success badge-lg font-bold">VERIFIED</span>
    </div>
  `;
}

/** What was opened and how. `detailed` = per-place entries (Verification Code); otherwise totals (QR). */
function renderTrailSection(events, { detailed }) {
  if (!events.length) return '';
  const rows = detailed ? events : summarizeTrail(events);
  return `
    <div class="m3-surface-container-lowest rounded-3xl p-5 border m3-border-subtle">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 class="text-sm font-bold flex items-center gap-2">
          <span class="material-symbols-outlined m3-text-primary" aria-hidden="true">terminal</span>
          DevTools Trail
        </h3>
        <span class="badge m3-tonal-badge font-mono text-xs">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      <p class="text-xs m3-text-muted mb-4">
        What the learner opened and how they bent the app, as noticed in their own browser.
        ${detailed ? '' : 'A QR scan carries totals only; paste the full Verification Code for places and times.'}
        The trail travels unsigned next to the signed certificate.
      </p>
      <ol class="flex flex-col gap-2.5">
        ${rows.map((e) => {
          const type = TRAIL_TYPES[e.type];
          return `
            <li class="flex items-start gap-3 p-3 rounded-2xl m3-surface-container-low border m3-border-subtle">
              <span class="w-9 h-9 rounded-xl ${type.mastery ? 'm3-primary-container' : 'm3-surface-container-high'} flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined icon-20" aria-hidden="true">${type.icon}</span>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="font-bold text-sm">${escapeHtml(type.label)}</span>
                  <span class="badge badge-sm font-mono">&times;${e.count}</span>
                  ${e.where ? `<span class="badge badge-sm badge-outline h-auto py-0.5 whitespace-normal text-left">${escapeHtml(e.where)}</span>` : ''}
                  ${e.seconds ? `<span class="badge badge-sm badge-outline font-mono">${formatDuration(e.seconds)} open</span>` : ''}
                </div>
                <div class="text-xs m3-text-muted mt-1">${escapeHtml(type.how)}</div>
                ${e.detail ? `<div class="text-xs font-mono mt-1 break-words">${escapeHtml(e.detail)}</div>` : ''}
                ${detailed && e.firstAt ? `<div class="text-[11px] m3-text-muted mt-1">First ${escapeHtml(formatDate(e.firstAt))}${e.lastAt && e.lastAt !== e.firstAt ? ` · last ${escapeHtml(formatDate(e.lastAt))}` : ''}</div>` : ''}
              </div>
            </li>
          `;
        }).join('')}
      </ol>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Input parsing
// ----------------------------------------------------------------------------

function splitKey(raw) {
  const { key, trail } = splitKeyAndTrail(raw);
  return { value: key, trail };
}

/**
 * Accepts a QR link, a "?v=..." / "?key=..." query, a bare QR token or a full Verification Code.
 * @returns {{ type: 'empty' | 'qr' | 'key', value: string, trail: string }}
 */
function extractVerificationToken(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return { type: 'empty', value: '', trail: '' };

  const extractFromQuery = (queryStr) => {
    try {
      const params = new URLSearchParams(queryStr);
      const v = params.get('v');
      if (v) return { type: 'qr', value: v.trim(), trail: (params.get('t') || '').trim() };
      const key = params.get('key');
      if (key) return { type: 'key', ...splitKey(key) };
    } catch {}
    return null;
  };

  if (trimmed.startsWith('?')) {
    const hit = extractFromQuery(trimmed.slice(1).split('#')[0]);
    if (hit) return hit;
  }

  // Handle full URLs or hash URLs (e.g. https://druba.in/learn/#/verify?v=... or ?v=...#/verify)
  const qIdx = trimmed.indexOf('?');
  if (qIdx !== -1) {
    const afterQ = trimmed.slice(qIdx + 1);
    const hit = extractFromQuery(afterQ.split('#')[0]) || extractFromQuery(afterQ);
    if (hit) return hit;
  }

  if (trimmed.startsWith('druba-web-v1.') || trimmed.startsWith('druba-web-v1r.')) {
    return { type: 'key', ...splitKey(trimmed) };
  }

  return { type: 'qr', value: trimmed, trail: '' };
}

export async function renderVerifyView(queryParams = null) {
  const view = document.getElementById('app-view');
  const searchParams = new URLSearchParams(window.location.search || '');
  const qrParam = (queryParams && queryParams.get('v')) || searchParams.get('v') || null;
  const keyParam = (queryParams && queryParams.get('key')) || searchParams.get('key') || null;

  view.innerHTML = `
    <section class="flex flex-col gap-5 max-w-5xl mx-auto">
      <!-- Verified Results Area (Takes Center Stage First) -->
      <div id="verify-results-container" class="flex flex-col gap-5"></div>

      <!-- Check a Certificate Card (Auto-Collapses When Results Are Shown) -->
      <div id="verify-input-card" class="m3-card rounded-3xl border m3-border-subtle overflow-hidden">
        <!-- Collapsed Single-Row Header -->
        <button id="verify-expand-bar" type="button" class="m3-menu-item hidden w-full px-5 py-4 flex items-center justify-between gap-3 text-left" aria-expanded="false" aria-controls="verify-input-body">
          <span class="flex items-center gap-2.5 font-semibold text-sm sm:text-base">
            <span class="material-symbols-outlined icon-20 m3-text-primary">verified_user</span>
            <span>Check Another Certificate</span>
          </span>
          <span class="material-symbols-outlined icon-20 m3-text-muted">expand_more</span>
        </button>

        <!-- Expanded Scanner + Paste Body -->
        <div id="verify-input-body" class="p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <span class="material-symbols-outlined icon-24 m3-text-primary">verified_user</span>
                <span>Check a Certificate</span>
              </h1>
              <p class="text-sm m3-text-muted mt-1">
                Scan a certificate QR code with your camera, or paste a Verification Code or URL below.
              </p>
            </div>
            <button id="verify-scan-qr-btn" type="button" class="btn btn-sm sm:btn-md m3-btn-tonal rounded-full gap-2 shrink-0">
              <span class="material-symbols-outlined icon-20">qr_code_scanner</span>
              <span>Scan QR with Camera</span>
            </button>
          </div>

          <!-- Inline Camera QR Viewfinder -->
          <div id="verify-scanner-panel" class="hidden mt-4 p-4 rounded-2xl m3-surface-container-low border m3-border-subtle flex flex-col items-center gap-3">
            <div class="verify-scanner-frame">
              <video id="verify-scanner-video" class="verify-scanner-video" playsinline muted autoplay></video>
              <div class="verify-scanner-reticle" aria-hidden="true"></div>
            </div>
            <p id="verify-scanner-status" class="text-xs m3-text-muted text-center" aria-live="polite">
              Point your camera at the certificate QR code...
            </p>
            <button id="verify-stop-camera-btn" type="button" class="btn btn-sm btn-outline rounded-full gap-1.5">
              <span class="material-symbols-outlined icon-18">videocam_off</span>
              <span>Stop Camera</span>
            </button>
          </div>

          <!-- Single-Box Verification Code / URL Paste Input -->
          <div class="mt-4">
            <textarea id="verify-key-input" rows="3" spellcheck="false" autocomplete="off" placeholder="Paste Verification Code or certificate URL (?v=... or ?key=...)" class="textarea textarea-bordered w-full font-mono text-xs rounded-2xl"></textarea>
            <div class="flex flex-wrap gap-2 mt-3 justify-end">
              <button id="verify-clear-btn" type="button" class="btn btn-sm btn-ghost rounded-full">Clear</button>
              <button id="verify-inspect-btn" type="button" class="btn btn-sm btn-primary rounded-full px-6 gap-1.5">
                <span class="material-symbols-outlined icon-18">search_check</span>
                <span>Check Certificate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const resultsContainer = document.getElementById('verify-results-container');
  const expandBar = document.getElementById('verify-expand-bar');
  const inputBody = document.getElementById('verify-input-body');
  const scannerPanel = document.getElementById('verify-scanner-panel');
  const scannerVideo = document.getElementById('verify-scanner-video');
  const scannerStatus = document.getElementById('verify-scanner-status');
  const scanBtn = document.getElementById('verify-scan-qr-btn');

  const setInputCollapsed = (collapsed) => {
    if (!expandBar || !inputBody) return;
    expandBar.classList.toggle('hidden', !collapsed);
    expandBar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    inputBody.classList.toggle('hidden', collapsed);
  };

  expandBar?.addEventListener('click', () => {
    setInputCollapsed(false);
    document.getElementById('verify-key-input')?.focus();
  });

  // Camera QR Scanner state
  let mediaStream = null;
  let scanRafId = null;
  let scanCanvas = null;
  let scanCtx = null;
  let barcodeDetector = null;
  let lastDecodeAt = 0;

  const stopCamera = () => {
    if (scanRafId !== null) {
      cancelAnimationFrame(scanRafId);
      scanRafId = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (scannerVideo) {
      scannerVideo.srcObject = null;
    }
    scannerPanel?.classList.add('hidden');
    if (scanBtn) scanBtn.disabled = false;
  };

  appState.cleanupRouteView = stopCamera;

  const renderQrResult = async (tokenStr, trailStr = '') => {
    const qrRes = await verifyCompactQrToken(tokenStr);
    if (qrRes.valid && qrRes.payload) {
      const p = qrRes.payload;
      const scores = Array.isArray(p.quizScores) ? p.quizScores : [];
      const trail = decodeTrailFromQr(trailStr);
      const rank = getMasteryRank(trail);
      const badgeMarkup = rank ? await loadMasteryBadge() : '';
      resultsContainer.innerHTML = `
        ${renderStatusBanner({ valid: true, rank, badgeMarkup, reference: qrRes.verifyId, source: 'QR Code Scan · Certificate Check' })}
        <div class="m3-surface-container-lowest rounded-3xl p-6 border m3-border-subtle shadow-sm">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-success font-mono font-bold whitespace-nowrap">Avg: ${Number(p.avgScore || 0)}%</span>
                  <span class="badge m3-primary-container font-mono font-bold whitespace-nowrap">Coding Labs: ${Number(p.labsPassed || 0)} / ${LABS.length}</span>
                </div>
              </div>
              <div class="grid grid-cols-5 gap-2 text-center">
                ${MODULES.map((m, idx) => `
                  <div class="m3-surface-container-lowest rounded-xl p-2 border m3-border-subtle">
                    <div class="text-[11px] font-mono m3-text-muted">${m.code}</div>
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
        ${renderTrailSection(trail, { detailed: false })}
      `;
    } else {
      resultsContainer.innerHTML = renderStatusBanner({ valid: false, error: qrRes.error || 'This certificate link could not be verified.' });
    }
    setInputCollapsed(true);
  };

  const runInspection = async (rawInput) => {
    const parsed = extractVerificationToken(rawInput);
    if (parsed.type === 'empty') {
      resultsContainer.innerHTML = `
        <div class="rounded-3xl p-5 border-2 border-error m3-error-container flex items-center gap-3">
          <span class="material-symbols-outlined text-[30px]">gpp_bad</span>
          <div>
            <div class="font-bold">Verification Code Required</div>
            <div class="text-sm">Scan a certificate QR code or paste a Verification Code to check.</div>
          </div>
        </div>
      `;
      return;
    }

    if (parsed.type === 'qr') {
      await renderQrResult(parsed.value, parsed.trail);
      return;
    }

    const res = await verifyCompletionKey(parsed.value);

    if (!res.payload) {
      resultsContainer.innerHTML = `
        <div class="rounded-3xl p-5 border-2 border-error m3-error-container flex items-center gap-3">
          <span class="material-symbols-outlined text-[30px]">gpp_bad</span>
          <div>
            <div class="font-bold">Could Not Check Certificate</div>
            <div class="text-sm">${escapeHtml(res.error)}</div>
          </div>
        </div>
      `;
      setInputCollapsed(true);
      return;
    }

    const p = res.payload;
    const avgQuiz = p.quizzes?.length
      ? Math.round(p.quizzes.reduce((s, q) => s + Number(q.bestScorePercent || 0), 0) / p.quizzes.length)
      : 0;
    const labOrder = (labId) => LABS.findIndex((l) => l.id === Number(labId));
    const labsList = (p.practicals || []).slice().sort((a, b) => labOrder(a.labId) - labOrder(b.labId));
    const trail = decodeTrailFromKey(parsed.trail);
    const rank = res.valid ? getMasteryRank(trail) : null;
    const badgeMarkup = rank ? await loadMasteryBadge() : '';

    resultsContainer.innerHTML = `
      <div class="flex flex-col gap-5">
        ${renderStatusBanner({
          valid: res.valid,
          rank,
          badgeMarkup,
          error: res.error,
          reference: res.valid ? res.signature.slice(0, 16).toUpperCase() : ''
        })}
        ${res.valid ? renderTrailSection(trail, { detailed: true }) : ''}

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
            <h3 class="text-xs font-bold uppercase tracking-wider m3-text-muted mb-3">Quiz Scores (${PASSING_PERCENT}% Needed to Pass)</h3>
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
                      <td class="font-bold">${escapeHtml(getLabById(pr.labId)?.code || `Lab ${pr.labId}`)}</td>
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
            <div class="tabs tabs-boxed rounded-full p-1 m3-surface-container inline-flex flex-nowrap max-w-full overflow-x-auto no-scrollbar" id="verify-lab-tabs">
              ${LABS.map((l, idx) => `
                <button type="button" class="tab tab-sm rounded-full shrink-0 ${idx === 0 ? 'tab-active font-bold' : ''}" data-inspect-lab="${l.id}">
                  ${l.code}
                </button>
              `).join('')}
            </div>
          </div>

          <div id="verify-lab-detail"></div>
        </div>
      </div>
    `;

    setInputCollapsed(true);

    const showInspectLab = (labId) => {
      const labMeta = getLabById(labId);
      const prac = labsList.find((item) => Number(item.labId) === Number(labId)) || {
        labId, htmlCode: '', cssCode: '', jsCode: '', activeTypingSeconds: 0, pasteCount: 0
      };
      resultsContainer.querySelectorAll('[data-inspect-lab]').forEach((b) => {
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

    resultsContainer.querySelectorAll('[data-inspect-lab]').forEach((btn) => {
      btn.addEventListener('click', () => showInspectLab(btn.dataset.inspectLab));
    });
    showInspectLab(LABS[0].id);
  };

  // Start WebRTC camera QR scanner (BarcodeDetector with jsQR fallback)
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera access is not supported in this browser.', 'error');
      return;
    }
    stopCamera();
    if (scanBtn) scanBtn.disabled = true;
    scannerPanel?.classList.remove('hidden');
    if (scannerStatus) scannerStatus.textContent = 'Starting camera...';

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      if (!scannerVideo) {
        stopCamera();
        return;
      }
      scannerVideo.srcObject = mediaStream;
      await scannerVideo.play();

      if ('BarcodeDetector' in window) {
        try {
          const formats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
            ? await window.BarcodeDetector.getSupportedFormats()
            : ['qr_code'];
          if (formats.includes('qr_code')) {
            barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
          }
        } catch {
          barcodeDetector = null;
        }
      }

      if (scannerStatus) {
        scannerStatus.textContent = 'Point your camera at the certificate QR code...';
      }

      const decodeFrame = async (now) => {
        if (!mediaStream || !scannerVideo) return;
        if (now - lastDecodeAt >= 120 && scannerVideo.readyState >= 2 && scannerVideo.videoWidth > 0) {
          lastDecodeAt = now;
          let detectedRaw = '';

          if (barcodeDetector) {
            try {
              const codes = await barcodeDetector.detect(scannerVideo);
              if (codes && codes.length && codes[0].rawValue) {
                detectedRaw = codes[0].rawValue;
              }
            } catch {
              barcodeDetector = null;
            }
          }

          if (!detectedRaw && !barcodeDetector && typeof window.jsQR !== 'function') {
            await loadScript('./vendor/jsQR.min.js').catch(() => {});
          }
          if (!detectedRaw && typeof window.jsQR === 'function') {
            if (!scanCanvas) {
              scanCanvas = document.createElement('canvas');
              scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
            }
            const w = scannerVideo.videoWidth;
            const h = scannerVideo.videoHeight;
            if (scanCanvas.width !== w || scanCanvas.height !== h) {
              scanCanvas.width = w;
              scanCanvas.height = h;
            }
            scanCtx.drawImage(scannerVideo, 0, 0, w, h);
            const imgData = scanCtx.getImageData(0, 0, w, h);
            const code = window.jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              detectedRaw = code.data;
            }
          }

          if (detectedRaw) {
            stopCamera();
            const keyInput = document.getElementById('verify-key-input');
            if (keyInput) keyInput.value = detectedRaw;
            await runInspection(detectedRaw);
            return;
          }
        }
        scanRafId = requestAnimationFrame(decodeFrame);
      };

      scanRafId = requestAnimationFrame(decodeFrame);
    } catch (err) {
      stopCamera();
      showToast(`Could not access camera: ${err.message}`, 'error');
    }
  };

  scanBtn?.addEventListener('click', startCamera);
  document.getElementById('verify-stop-camera-btn')?.addEventListener('click', stopCamera);

  document.getElementById('verify-inspect-btn')?.addEventListener('click', () => {
    stopCamera();
    runInspection(document.getElementById('verify-key-input').value);
  });
  document.getElementById('verify-clear-btn')?.addEventListener('click', () => {
    stopCamera();
    document.getElementById('verify-key-input').value = '';
    resultsContainer.innerHTML = '';
    setInputCollapsed(false);
  });

  if (qrParam) {
    const parsed = extractVerificationToken(qrParam);
    const trailParam = (queryParams && queryParams.get('t')) || searchParams.get('t') || '';
    await renderQrResult(parsed.value, trailParam);
  } else if (keyParam) {
    const keyInput = document.getElementById('verify-key-input');
    if (keyInput) keyInput.value = keyParam;
    await runInspection(keyParam);
  }
}
