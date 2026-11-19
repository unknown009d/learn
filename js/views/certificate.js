/**
 * Signed certificate view (#/certificate) and background issuing.
 */

import { exportFullState, getCachedCertificate, saveCachedCertificate, clearCachedCertificate } from '../db.js';
import { issueSignedCertificate, validateCachedCertificate } from '../crypto-key.js';
import { MODULES } from '../course-data.js';
import { LABS } from '../labs-data.js';
import { escapeHtml, showToast, copyToClipboard, downloadBlob, loadScript } from '../core/utils.js';
import { appState, isCertificateUnlocked, getNextRecommendedRoute, PASSING_PERCENT } from '../core/state.js';
import { getTrail } from '../integrity/trail.js';
import { encodeTrailForKey, encodeTrailForQr, getMasteryRank } from '../integrity/trail-format.js';
import { loadMasteryBadge, masteryBadgeHtml } from '../ui/mastery-badge.js';
import { renderLockedView } from './locked.js';

function buildOfflineQrFallbackSvg(seedText) {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const size = 21;
  const cells = [];
  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let dark = false;
      if (isFinder(r, c)) {
        const lr = r >= size - 7 ? r - (size - 7) : r;
        const lc = c >= size - 7 ? c - (size - 7) : c;
        dark = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        hash = Math.imul(hash ^ (r * 31 + c), 16777619);
        dark = (hash >>> 0) % 2 === 0;
      }
      if (dark) cells.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="#171d19"/>`);
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="104" height="104" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR Code Fallback"><rect width="${size}" height="${size}" fill="#ffffff"/>${cells.join('')}</svg>`;
}

export function invalidateInMemoryCertCache() {
  appState.certCache = null;
  appState.certIssuePromise = null;
  appState.certIssueGeneration += 1;
}

async function getValidatedCachedCert(fullState) {
  const candidate = appState.certCache || (await getCachedCertificate());
  if (!candidate) return null;

  const check = await validateCachedCertificate(candidate, fullState);
  if (check.valid) {
    appState.certCache = candidate;
    return { generated: candidate, isStale: check.isStale };
  }

  // Discard corrupted, tampered, or mismatched cached certificate
  appState.certCache = null;
  await clearCachedCertificate().catch(() => {});
  return null;
}

async function issueAndCacheCertificate(fullState, { forceRefresh = false } = {}) {
  if (!forceRefresh && appState.certIssuePromise) {
    return appState.certIssuePromise;
  }

  const generation = appState.certIssueGeneration;
  const promise = (async () => {
    const generated = await issueSignedCertificate(fullState);
    if (generation === appState.certIssueGeneration) {
      const saved = await saveCachedCertificate(generated);
      appState.certCache = saved;
      return saved;
    }
    return generated;
  })();

  appState.certIssuePromise = promise;
  promise.finally(() => {
    if (appState.certIssuePromise === promise) {
      appState.certIssuePromise = null;
    }
  });
  return promise;
}

export function prefetchCertificateInBackground() {
  if (!isCertificateUnlocked()) return;
  if (appState.certCache || appState.certIssuePromise) return;

  (async () => {
    try {
      const fullState = await exportFullState();
      const cached = await getValidatedCachedCert(fullState);
      if (cached) return; // Already validly cached in IndexedDB; L1 is now warm
      await issueAndCacheCertificate(fullState);
    } catch {
      // Silent background prefetch; route view handles retries if offline
    }
  })();
}

function renderCertificateSkeleton(view) {
  view.innerHTML = `
    <section class="max-w-6xl mx-auto flex flex-col gap-5" aria-busy="true" aria-live="polite" aria-label="Preparing your certificate">
      <!-- Top Action Bar Skeleton -->
      <div class="m3-card rounded-3xl p-4 sm:p-5 border m3-border-subtle flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-[220px]">
          <div class="m3-skeleton h-7 w-64 rounded-full"></div>
          <div class="m3-skeleton h-4 w-80 max-w-full rounded-full"></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="m3-skeleton h-10 w-28 rounded-full"></div>
          <div class="m3-skeleton h-10 w-36 rounded-full"></div>
        </div>
      </div>

      <!-- A4 Landscape Certificate Frame Skeleton -->
      <div class="m3-surface-container-lowest rounded-3xl p-6 sm:p-10 border m3-border-subtle flex flex-col justify-between min-h-[420px] sm:min-h-[540px] gap-8">
        <!-- Header Row -->
        <div class="flex items-center justify-between">
          <div class="m3-skeleton h-5 w-24 rounded-full"></div>
          <div class="m3-skeleton h-4 w-44 rounded-full"></div>
        </div>

        <!-- Centerpiece Typography Skeleton -->
        <div class="flex flex-col items-center text-center gap-3.5 my-auto py-4">
          <div class="m3-skeleton h-10 w-64 rounded-2xl"></div>
          <div class="m3-skeleton h-4 w-32 rounded-full mt-1"></div>
          <div class="m3-skeleton h-9 w-72 sm:w-80 rounded-2xl"></div>
          <div class="m3-skeleton h-4 w-40 rounded-full"></div>
          <div class="m3-skeleton h-4 w-96 max-w-full rounded-full mt-2"></div>
          <div class="m3-skeleton h-6 w-80 max-w-full rounded-xl"></div>
          <div class="m3-skeleton h-5 w-72 max-w-full rounded-full mt-2"></div>
        </div>

        <!-- Footer 3-Column Skeleton (Authority, QR Box, Credential ID) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 items-end gap-6 pt-4 border-t m3-border-subtle">
          <div class="flex flex-col gap-2">
            <div class="m3-skeleton h-4 w-40 rounded-full"></div>
            <div class="m3-skeleton h-3.5 w-36 rounded-full"></div>
            <div class="m3-skeleton h-3 w-28 rounded-full"></div>
          </div>
          <div class="flex flex-col items-center gap-2">
            <div class="m3-skeleton w-[104px] h-[104px] rounded-2xl"></div>
            <div class="m3-skeleton h-3 w-20 rounded-full"></div>
          </div>
          <div class="flex flex-col sm:items-end gap-2">
            <div class="m3-skeleton h-3.5 w-32 rounded-full"></div>
            <div class="m3-skeleton h-3 w-44 rounded-full"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Verification Code Drawer Skeleton -->
      <div class="m3-surface-container-lowest rounded-3xl px-5 py-4 border m3-border-subtle flex items-center justify-between">
        <div class="m3-skeleton h-4 w-72 max-w-[80%] rounded-full"></div>
        <div class="m3-skeleton h-5 w-5 rounded-full"></div>
      </div>
    </section>
  `;
}

export async function renderCertificateView({ forceRefresh = false } = {}) {
  if (!isCertificateUnlocked()) {
    const nextHash = getNextRecommendedRoute();
    renderLockedView(
      'Certificate of Completion',
      `Pass all ${MODULES.length} module quizzes (${PASSING_PERCENT}% or higher) and complete all ${LABS.length} coding labs to unlock your Certificate of Completion.`,
      nextHash
    );
    return;
  }

  const view = document.getElementById('app-view');
  const renderToken = ++appState.certRenderToken;
  const fullState = await exportFullState();

  let generated = null;
  let isStale = false;

  if (!forceRefresh) {
    const cachedHit = await getValidatedCachedCert(fullState);
    if (cachedHit) {
      generated = cachedHit.generated;
      isStale = cachedHit.isStale;
    }
  }

  if (!generated) {
    // Only show skeleton when an actual Cloudflare Worker signing request is needed
    renderCertificateSkeleton(view);
    try {
      generated = await issueAndCacheCertificate(fullState, { forceRefresh });
    } catch (err) {
      if (renderToken !== appState.certRenderToken) return;
      view.innerHTML = `
        <section class="max-w-xl mx-auto mt-8">
          <div class="m3-card rounded-3xl p-6 border m3-border-subtle text-center flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-[40px] text-error">cloud_off</span>
            <h1 class="text-xl font-bold">Could Not Issue Signed Certificate</h1>
            <p class="text-sm m3-text-muted">${escapeHtml(err.message || 'Certificate signing server is unreachable. Check your internet connection and try again.')}</p>
            <button id="cert-retry-btn" type="button" class="btn btn-primary rounded-full px-6 mt-2">Retry</button>
          </div>
        </section>
      `;
      document.getElementById('cert-retry-btn')?.addEventListener('click', () => renderCertificateView({ forceRefresh }));
      return;
    }
  }

  if (renderToken !== appState.certRenderToken || !window.location.hash.startsWith('#/certificate')) {
    return;
  }

  const qrInfo = { token: generated.qrToken, verifyId: generated.verifyId };
  const signedPayload = generated.payload || {};
  const signedStudent = signedPayload.student || fullState.profile || {};

  const quizScores = MODULES.map((m) => {
    const q = (signedPayload.quizzes || fullState.quizzes || []).find((x) => Number(x.moduleId) === m.id);
    return Number(q?.bestScorePercent || 0);
  });
  const avgQuiz = Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length);
  const completionDate = new Date(signedPayload.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // The inspection trail rides along unsigned: "~<trail>" after the code, "&t=<summary>" in the QR link.
  const trail = await getTrail();
  const trailForKey = encodeTrailForKey(trail);
  const trailForQr = encodeTrailForQr(trail);
  const shareKey = trailForKey ? `${generated.key}~${trailForKey}` : generated.key;
  const rank = getMasteryRank(trail);
  const badgeMarkup = rank ? await loadMasteryBadge() : '';
  if (renderToken !== appState.certRenderToken) return;

  const baseUrl = window.location.origin + window.location.pathname;
  const qrPayload = `${baseUrl}#/verify?v=${encodeURIComponent(qrInfo.token)}${trailForQr ? `&t=${trailForQr}` : ''}`;
  const safeRoll = (signedStudent.rollNo || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');

  view.innerHTML = `
    <section class="max-w-6xl mx-auto flex flex-col gap-5">
      <!-- Certificate Action Bar (Hidden in Print) -->
      <div class="m3-card rounded-3xl p-4 sm:p-5 border m3-border-subtle flex flex-wrap items-center justify-between gap-3 no-print">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-bold">Certificate of Completion</h1>
          <p class="text-xs sm:text-sm m3-text-muted">Printable A4 landscape credential with digitally signed QR verification.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div id="cert-export-dropdown" class="relative">
            <button id="cert-export-btn" type="button" class="btn btn-sm sm:btn-md btn-primary rounded-full gap-1.5 px-4" aria-expanded="false" aria-haspopup="menu" aria-controls="cert-export-menu">
              <span class="material-symbols-outlined icon-18">download</span>
              <span>Export</span>
              <span class="material-symbols-outlined icon-18">expand_more</span>
            </button>
            <div id="cert-export-menu" role="menu" class="cert-export-menu hidden">
              <button id="cert-print-btn" type="button" role="menuitem" class="cert-export-item">
                <span class="material-symbols-outlined icon-18 m3-text-primary">print</span>
                <span>Print / Save as PDF</span>
              </button>
              <button id="cert-download-png-btn" type="button" role="menuitem" class="cert-export-item">
                <span class="material-symbols-outlined icon-18 m3-text-primary">image</span>
                <span>Download as PNG</span>
              </button>
              <button id="cert-download-jpg-btn" type="button" role="menuitem" class="cert-export-item">
                <span class="material-symbols-outlined icon-18 m3-text-primary">photo</span>
                <span>Download as JPG</span>
              </button>
            </div>
          </div>
          <button id="cert-copy-key-btn" type="button" class="btn btn-sm sm:btn-md m3-btn-tonal rounded-full gap-1.5 px-4">
            <span class="material-symbols-outlined icon-18">content_copy</span>
            <span>Copy Code Key</span>
          </button>
        </div>
      </div>

      ${isStale ? `
        <div id="cert-stale-banner" class="m3-surface-container-low rounded-2xl px-4 py-3 border m3-border-subtle flex flex-wrap items-center justify-between gap-3 no-print">
          <div class="flex items-center gap-2.5 text-xs sm:text-sm min-w-0">
            <span class="material-symbols-outlined icon-20 m3-text-primary shrink-0">update</span>
            <span>Your quiz scores or lab code changed since this certificate was issued.</span>
          </div>
          <button id="cert-reissue-btn" type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full gap-1.5 px-4 shrink-0">
            <span class="material-symbols-outlined icon-18">refresh</span>
            <span>Re-issue Certificate</span>
          </button>
        </div>
      ` : ''}

      <!-- Responsive A4 Landscape Stage (Scales 1122x794 Proportionally) -->
      <div id="certificate-stage">
        <article id="certificate-sheet" class="m3-a4-certificate" aria-label="A4 Landscape Certificate of Completion">
          <div class="m3-a4-certificate-inner">
            ${rank ? `<span class="cert-mastery-seal">${masteryBadgeHtml(badgeMarkup, rank, { size: 124 })}</span>` : ''}

            <!-- Minimal Top Header -->
            <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span id="cert-brand-dot" style="display:block;width:10px;height:10px;border-radius:50%;background:#146C43;flex-shrink:0;" aria-hidden="true"></span>
                <span style="display:inline-block;font-size:18px;font-weight:700;letter-spacing:-0.015em;color:#111827;line-height:1.2;">druba.in</span>
              </div>
              <div class="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#64748B]" style="line-height:1.2;">
                CERTIFICATE OF COMPLETION
              </div>
            </header>

            <!-- Centerpiece Typography -->
            <div class="text-center flex flex-col items-center justify-center px-4" style="padding-top:${rank ? 54 : 18}px;">
              <h2 class="text-[40px] font-bold tracking-tight text-[#111827] leading-tight">
                Congratulations
              </h2>

              <p class="text-[14px] text-[#4B5563] mt-3">This certifies that</p>

              <div class="text-[36px] font-bold tracking-tight text-[#146C43] leading-tight mt-1.5">
                ${escapeHtml(signedStudent.fullName)}
              </div>

              <div class="font-mono text-[13px] font-medium text-[#4B5563] mt-1.5">
                Student ID: ${escapeHtml(signedStudent.rollNo)}
              </div>

              <p class="text-[14px] text-[#4B5563] max-w-[680px] mx-auto mt-4 leading-relaxed">
                has successfully completed all lessons, graded assessments, and 8 hands-on front-end labs for
              </p>

              <div class="text-[21px] font-bold text-[#111827] mt-1.5">
                Learning the Web with Basics of Vanilla Front-End Tools
              </div>

              <!-- Minimal Inline Summary (No Pill Boxes) -->
              <div class="text-[13px] text-[#4B5563] mt-5 font-medium whitespace-nowrap" style="display:inline-flex;align-items:center;justify-content:center;line-height:1.4;">
                <span>Quiz Score: <strong class="font-mono font-semibold text-[#111827]">${avgQuiz}%</strong></span>
                <span class="cert-stat-divider" style="display:inline-block;width:1px;height:14px;background:#cbd5e1;flex-shrink:0;margin:0 14px;" aria-hidden="true"></span>
                <span>Labs Completed: <strong class="font-mono font-semibold text-[#111827]">8 / 8</strong></span>
                <span class="cert-stat-divider" style="display:inline-block;width:1px;height:14px;background:#cbd5e1;flex-shrink:0;margin:0 14px;" aria-hidden="true"></span>
                <span>Issued: <strong class="font-mono font-semibold text-[#111827]">${escapeHtml(completionDate)}</strong></span>
              </div>
            </div>

            <!-- Bottom 3-Column Digitally Signed Footer -->
            <footer class="cert-footer-grid">
              <!-- Left Column: Digital Authority & Seal -->
              <div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;">
                <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:6px;">
                  <svg id="cert-seal-svg" width="18" height="18" viewBox="0 0 24 24" fill="#146C43" style="display:block;flex-shrink:0;" aria-hidden="true">
                    <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/>
                  </svg>
                  <span style="display:inline-block;color:#146C43;font-size:12px;font-weight:700;letter-spacing:-0.01em;line-height:1.4;">Digitally Signed Credential</span>
                </div>
                <div style="font-size:12px;font-weight:600;color:#111827;line-height:1.4;">Issued by Drubajyoti Debnath</div>
                <div style="font-size:11px;color:#64748B;line-height:1.3;">Course Author &middot; druba.in</div>
              </div>

              <!-- Center Column: High-Scannability QR Code (104x104, 8px white quiet zone) -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="background:#ffffff;padding:8px;display:inline-flex;align-items:center;justify-content:center;">
                  <canvas id="cert-qr-canvas" width="208" height="208" style="width:104px;height:104px;display:block;image-rendering:pixelated;"></canvas>
                  <div id="cert-qr-fallback" class="hidden"></div>
                </div>
                <div style="font-size:11px;font-weight:500;color:#64748B;line-height:1.3;">Scan to verify</div>
              </div>

              <!-- Right Column: Clean Credential ID -->
              <div class="font-mono" style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;font-size:11px;">
                <div style="font-weight:600;color:#111827;line-height:1.4;">ID: ${escapeHtml(qrInfo.verifyId)}</div>
                <div style="color:#4B5563;line-height:1.3;">Verify at: druba.in/learn/#/verify</div>
              </div>
            </footer>
          </div>
        </article>
      </div>

      <!-- Collapsible Certificate Verification Code Drawer (Hidden in Print) -->
      <details class="m3-accordion m3-surface-container-lowest rounded-3xl border m3-border-subtle no-print">
        <summary class="m3-accordion-trigger px-5 py-3.5 font-bold text-sm">
          <span class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-outlined icon-18 m3-text-primary shrink-0">key</span>
            <span>Certificate Verification Code (share to verify your completed labs)</span>
          </span>
          <span class="material-symbols-outlined icon-20 m3-accordion-chevron" aria-hidden="true">expand_more</span>
        </summary>
        <div class="m3-accordion-body px-5 py-4 flex flex-col gap-3">
          <textarea id="cert-key-box" readonly rows="4" class="textarea textarea-bordered w-full font-mono text-[11px] leading-snug rounded-2xl m3-surface-container-low">${escapeHtml(shareKey)}</textarea>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <span class="text-xs m3-text-muted">
              ${rank
                ? `<span class="m3-text-primary font-semibold">${escapeHtml(rank.fullTitle)}</span>: DevTools trail and badge attached to this code.`
                : trail.length ? 'DevTools trail attached.' : ''}
            </span>
            <a href="#/verify" class="btn btn-xs sm:btn-sm btn-outline rounded-full gap-1.5 ml-auto">
              <span class="material-symbols-outlined icon-18">verified_user</span>
              <span>Check Certificate</span>
            </a>
          </div>
        </div>
      </details>
    </section>
  `;

  // Render QR Code via QRious (loaded on demand), scaled edge-to-edge into the 104x104 (208x208 retina) canvas
  await loadScript('./vendor/qrious.min.js').catch(() => {});
  if (renderToken !== appState.certRenderToken) return;
  const qrCanvas = document.getElementById('cert-qr-canvas');
  const qrFallback = document.getElementById('cert-qr-fallback');
  if (typeof window.QRious === 'function' && qrCanvas) {
    try {
      const tmpCanvas = document.createElement('canvas');
      new window.QRious({
        element: tmpCanvas,
        value: qrPayload,
        size: 400,
        padding: 0,
        level: 'L',
        background: '#FFFFFF',
        foreground: '#111827'
      });
      const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });
      const { width: tw, height: th } = tmpCanvas;
      const img = tmpCtx.getImageData(0, 0, tw, th).data;
      let minX = tw;
      let minY = th;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const i = (y * tw + x) * 4;
          if (img[i] < 128) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      const dstCtx = qrCanvas.getContext('2d');
      dstCtx.fillStyle = '#FFFFFF';
      dstCtx.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
      dstCtx.imageSmoothingEnabled = false;
      if (maxX >= minX && maxY >= minY) {
        dstCtx.drawImage(
          tmpCanvas,
          minX,
          minY,
          maxX - minX + 1,
          maxY - minY + 1,
          0,
          0,
          qrCanvas.width,
          qrCanvas.height
        );
      } else {
        dstCtx.drawImage(tmpCanvas, 0, 0, qrCanvas.width, qrCanvas.height);
      }
    } catch {
      if (qrFallback) {
        qrCanvas.classList.add('hidden');
        qrFallback.classList.remove('hidden');
        qrFallback.innerHTML = buildOfflineQrFallbackSvg(qrInfo.verifyId);
      }
    }
  } else if (qrCanvas && qrFallback) {
    qrCanvas.classList.add('hidden');
    qrFallback.classList.remove('hidden');
    qrFallback.innerHTML = buildOfflineQrFallbackSvg(qrInfo.verifyId);
  }

  // Proportional A4 landscape scaling on any viewport
  const stage = document.getElementById('certificate-stage');
  const sheet = document.getElementById('certificate-sheet');
  const updateCertificateScale = () => {
    if (!stage || !sheet) return;
    const avail = stage.clientWidth;
    if (!avail) return;
    const scale = Math.min(1, avail / 1122);
    const offsetX = Math.max(0, (avail - 1122 * scale) / 2);
    sheet.style.transform = `translateX(${offsetX}px) scale(${scale})`;
    stage.style.height = `${Math.round(794 * scale)}px`;
  };
  updateCertificateScale();

  let resizeObserver = null;
  if (typeof ResizeObserver === 'function' && stage) {
    resizeObserver = new ResizeObserver(updateCertificateScale);
    resizeObserver.observe(stage);
  }
  window.addEventListener('resize', updateCertificateScale);

  // Export dropdown menu controller
  const exportBtn = document.getElementById('cert-export-btn');
  const exportMenu = document.getElementById('cert-export-menu');
  const closeExportMenu = () => {
    exportMenu?.classList.add('hidden');
    exportBtn?.setAttribute('aria-expanded', 'false');
  };
  const onDocClick = (e) => {
    if (exportMenu && !exportMenu.classList.contains('hidden') && !e.target.closest('#cert-export-dropdown')) {
      closeExportMenu();
    }
  };
  const onDocKeydown = (e) => {
    if (e.key === 'Escape' && exportMenu && !exportMenu.classList.contains('hidden')) {
      closeExportMenu();
      exportBtn?.focus();
    }
  };
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = exportMenu?.classList.contains('hidden');
    exportMenu?.classList.toggle('hidden', !willOpen);
    exportBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKeydown);

  appState.cleanupRouteView = () => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', updateCertificateScale);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKeydown);
  };

  // Image export helper (PNG / JPG at full 1122x794 @ 2x retina via off-screen clone)
  const exportCertificateImage = async (format, btn) => {
    try {
      await loadScript('./vendor/html2canvas.min.js');
    } catch {
      showToast('Image export is unavailable right now. Use Print / Save PDF instead.', 'error');
      return;
    }
    if (!sheet) return;
    const origDisabled = btn.disabled;
    btn.disabled = true;
    let offscreenHost = null;
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      offscreenHost = document.createElement('div');
      offscreenHost.style.cssText = 'position:fixed;left:-99999px;top:0;width:1122px;height:794px;overflow:visible;pointer-events:none;z-index:-1;';
      const clonedSheet = sheet.cloneNode(true);
      clonedSheet.style.transform = 'none';
      clonedSheet.style.margin = '0';
      clonedSheet.style.boxShadow = 'none';

      // Preserve QR canvas bitmap inside cloned node
      const srcQr = sheet.querySelector('#cert-qr-canvas');
      const dstQr = clonedSheet.querySelector('#cert-qr-canvas');
      if (srcQr && dstQr && !srcQr.classList.contains('hidden')) {
        const ctx = dstQr.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(srcQr, 0, 0, dstQr.width, dstQr.height);
        }
      }

      offscreenHost.appendChild(clonedSheet);
      document.body.appendChild(offscreenHost);

      const canvas = await window.html2canvas(clonedSheet, {
        scale: 2,
        width: 1122,
        height: 794,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('#cert-brand-dot').forEach((dot) => {
            if (dot.parentElement) dot.parentElement.style.alignItems = 'flex-start';
            dot.style.marginTop = '15px';
          });
          clonedDoc.querySelectorAll('.cert-stat-divider').forEach((el) => {
            if (el.parentElement) el.parentElement.style.alignItems = 'flex-start';
            el.style.marginTop = '6px';
          });
          clonedDoc.querySelectorAll('#cert-seal-svg').forEach((seal) => {
            if (seal.parentElement) seal.parentElement.style.alignItems = 'flex-start';
            seal.style.marginTop = '7px';
          });
        }
      });
      const ext = format === 'jpg' ? 'jpg' : 'png';
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const filename = `${safeRoll}_druba-web_Certificate.${ext}`;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.95));
      if (!blob) throw new Error('Could not encode image.');
      downloadBlob(filename, blob);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      showToast(`Image export failed: ${err.message}`, 'error');
    } finally {
      offscreenHost?.remove();
      btn.disabled = origDisabled;
    }
  };

  document.getElementById('cert-print-btn')?.addEventListener('click', () => {
    closeExportMenu();
    window.print();
  });
  document.getElementById('cert-download-png-btn')?.addEventListener('click', () => {
    closeExportMenu();
    if (exportBtn) exportCertificateImage('png', exportBtn);
  });
  document.getElementById('cert-download-jpg-btn')?.addEventListener('click', () => {
    closeExportMenu();
    if (exportBtn) exportCertificateImage('jpg', exportBtn);
  });
  document.getElementById('cert-copy-key-btn')?.addEventListener('click', () => {
    closeExportMenu();
    copyToClipboard(shareKey, 'Certificate Verification Code copied.');
  });
  document.getElementById('cert-reissue-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="loading loading-spinner loading-xs"></span><span>Updating...</span>`;
    try {
      const latestState = await exportFullState();
      await issueAndCacheCertificate(latestState, { forceRefresh: true });
      await renderCertificateView();
      showToast('Certificate re-issued with your latest progress.', 'success');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      showToast(err.message || 'Could not update certificate right now. Showing your cached certificate.', 'error');
    }
  });
}
