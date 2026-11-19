/**
 * Interactive Micro-Lesson Widgets & Sandboxes
 * Zero-dependency M3 interactive simulators, live mini-editors, JS sandbox,
 * CSS Box Model / Specificity / DOM playgrounds, and Security simulators.
 */

import { composeSrcDoc } from './ide.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function runJsInSandbox(userCode) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    const token = 'js_' + Math.random().toString(36).slice(2);
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMsg);
      iframe.remove();
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        logs: [{ level: 'error', text: 'Execution timed out (2s limit).' }],
        popups: [],
        returned: null
      });
    }, 2000);

    function onMsg(ev) {
      const d = ev.data;
      if (!d || d.token !== token) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(d.payload);
    }

    window.addEventListener('message', onMsg);

    const wrappedSrc = `<!DOCTYPE html><html><head><script>
      (function () {
        const logs = [];
        const popups = [];
        const fmt = (v) => {
          if (v === undefined) return 'undefined';
          if (v === null) return 'null';
          if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
          return String(v);
        };
        const consoleProxy = {
          log: (...args) => logs.push({ level: 'log', text: args.map(fmt).join(' ') }),
          error: (...args) => logs.push({ level: 'error', text: args.map(fmt).join(' ') }),
          warn: (...args) => logs.push({ level: 'warn', text: args.map(fmt).join(' ') })
        };
        const simAlert = (msg) => { popups.push({ kind: 'alert', text: String(msg), result: 'OK' }); };
        const simConfirm = (msg) => { popups.push({ kind: 'confirm', text: String(msg), result: 'true (OK)' }); return true; };
        const simPrompt = (msg, def = 'Ananya') => { popups.push({ kind: 'prompt', text: String(msg), result: '"' + def + '"' }); return String(def); };

        let returned = null;
        try {
          const fn = new Function('console', 'alert', 'confirm', 'prompt', ${JSON.stringify(userCode)});
          const res = fn(consoleProxy, simAlert, simConfirm, simPrompt);
          if (res !== undefined) returned = res;
        } catch (err) {
          logs.push({ level: 'error', text: err.name + ': ' + err.message });
        }
        parent.postMessage({ token: ${JSON.stringify(token)}, payload: { logs, popups, returned } }, '*');
      })();
    <\/script></head><body></body></html>`;

    iframe.srcdoc = wrappedSrc;
    document.body.appendChild(iframe);
  });
}

// ============================================================================
// HTML Markup Builders
// ============================================================================

export function renderLessonWidgetHtml(widgetSpec) {
  if (!widgetSpec || !widgetSpec.type) return '';
  const type = widgetSpec.type;

  if (type === 'packet-toggle') {
    const nodes = [
      { x: 70, icon: 'smartphone', label: 'Your Device', id: '0' },
      { x: 236, icon: 'router', label: 'ISP / Router', id: '1' },
      { x: 404, icon: 'public', label: 'Internet Backbone', id: '2' },
      { x: 570, icon: 'forum', label: 'Chat Server', id: '3' }
    ];
    return `
      <div class="flex flex-col gap-4 h-full" data-widget="packet-toggle">
        <!-- Widget Header -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">hub</span>
            <span>Interactive Network Topology &amp; Packet Inspector</span>
          </div>
          <span class="badge m3-tonal-badge font-mono text-[11px]" data-pt-proto>TCP/IP · Port 5222</span>
        </div>

        <!-- Mode Buttons + Animate Action -->
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-xs sm:btn-sm btn-primary rounded-full gap-1.5 font-medium" data-pt-mode="internet">
            <span class="material-symbols-outlined icon-18">chat</span>
            <span>Send Message (Internet Only)</span>
          </button>
          <button type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full gap-1.5 font-medium" data-pt-mode="www">
            <span class="material-symbols-outlined icon-18">language</span>
            <span>Open Webpage (World Wide Web)</span>
          </button>
          <button type="button" class="btn btn-xs sm:btn-sm btn-outline rounded-full gap-1.5 ml-auto font-medium" data-pt-send>
            <span class="material-symbols-outlined icon-18">play_circle</span>
            <span>Animate Packet</span>
          </button>
        </div>

        <!-- SVG Network Topology Card -->
        <div class="m3-surface-container-low rounded-2xl p-4 sm:p-5 border m3-border-subtle flex flex-col gap-3">
          <svg viewBox="0 0 640 138" class="w-full h-auto block select-none" role="img" aria-label="Network Topology Diagram">
            <defs>
              <filter id="pt-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <!-- Base connection track + animated dashed flow -->
            <line x1="70" y1="54" x2="570" y2="54" stroke="var(--m3-outline-variant)" stroke-width="2.5" stroke-linecap="round" />
            <line x1="70" y1="54" x2="570" y2="54" stroke="var(--m3-primary)" stroke-width="2.5" stroke-linecap="round" class="m3-svg-flow" opacity="0.78" />

            <!-- Nodes -->
            ${nodes.map((n, idx) => `
              <g data-pt-node="${idx}" class="cursor-pointer">
                <circle cx="${n.x}" cy="54" r="24" fill="var(--m3-surface-container-lowest)" stroke="${idx === 0 ? 'var(--m3-primary)' : 'var(--m3-outline-variant)'}" stroke-width="2.5" data-pt-ring="${idx}" />
                <foreignObject x="${n.x - 12}" y="42" width="24" height="24">
                  <div xmlns="http://www.w3.org/1999/xhtml" class="w-6 h-6 flex items-center justify-center" style="color:var(--m3-text);">
                    <span class="material-symbols-outlined icon-20" ${idx === 3 ? 'data-pt-dest-icon' : ''}>${n.icon}</span>
                  </div>
                </foreignObject>
                <circle cx="${n.x + 17}" cy="36" r="9" fill="${idx === 0 ? 'var(--m3-primary)' : 'var(--m3-surface-container-highest)'}" data-pt-badge-bg="${idx}" />
                <text x="${n.x + 17}" y="39.5" text-anchor="middle" font-size="9.5" font-weight="700" font-family="'JetBrains Mono', monospace" fill="${idx === 0 ? 'var(--m3-on-primary)' : 'var(--m3-text-muted)'}" data-pt-badge-txt="${idx}">${idx + 1}</text>
                <text x="${n.x}" y="98" text-anchor="middle" font-size="11.5" font-weight="700" font-family="'Google Sans', 'Plus Jakarta Sans', sans-serif" fill="var(--m3-text)" ${idx === 3 ? 'data-pt-dest-label' : ''}>${n.label}</text>
                <text x="${n.x}" y="114" text-anchor="middle" font-size="9.5" font-family="'JetBrains Mono', monospace" fill="var(--m3-text-muted)" data-pt-sub="${idx}">${idx === 2 ? 'Fibre / TCP/IP' : idx === 3 ? 'Chat Relay' : ''}</text>
              </g>
            `).join('')}

            <!-- Travelling Glowing Packet Dot -->
            <circle cx="70" cy="54" r="10" fill="var(--m3-primary)" opacity="0.28" class="m3-packet-dot" data-pt-packet-glow />
            <circle cx="70" cy="54" r="5.5" fill="var(--m3-primary)" stroke="var(--m3-surface-container-lowest)" stroke-width="1.5" filter="url(#pt-glow)" class="m3-packet-dot" data-pt-packet />
          </svg>

          <!-- Interactive Hop Inspection Row -->
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t m3-border-subtle">
            <span class="flex items-center gap-1.5 m3-text-muted">
              <span class="material-symbols-outlined text-sm m3-text-primary">touch_app</span>
              <span>Click any node to inspect hop details</span>
            </span>
            <span class="font-bold m3-text-primary text-xs" data-pt-hop-title>Node 4 of 4: Destination</span>
          </div>

          <!-- Hop Description Banner -->
          <div class="rounded-xl p-3 m3-tonal-badge text-xs text-center font-medium leading-relaxed" data-pt-status>
            Node 4 (Chat Relay Server): Receives direct app packet on port 5222 without browser parsing.
          </div>
        </div>

        <!-- Structured Live Packet Header Card -->
        <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle">
          <div class="text-[11px] font-bold uppercase tracking-wider m3-text-muted mb-3 flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">receipt_long</span>
            <span>Live Packet Header</span>
          </div>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-2.5 sm:p-3 rounded-xl m3-surface-container-lowest border m3-border-subtle">
              <div class="text-[10px] uppercase font-bold m3-text-muted">Protocol</div>
              <div class="font-mono font-bold m3-text-primary mt-1" data-pt-h-proto>TCP/IP (XMPP)</div>
            </div>
            <div class="p-2.5 sm:p-3 rounded-xl m3-surface-container-lowest border m3-border-subtle">
              <div class="text-[10px] uppercase font-bold m3-text-muted">Port</div>
              <div class="font-mono font-bold mt-1" data-pt-h-port>5222</div>
            </div>
            <div class="p-2.5 sm:p-3 rounded-xl m3-surface-container-lowest border m3-border-subtle">
              <div class="text-[10px] uppercase font-bold m3-text-muted">Payload Type</div>
              <div class="font-mono font-semibold mt-1" data-pt-h-payload>Raw Binary / JSON</div>
            </div>
            <div class="p-2.5 sm:p-3 rounded-xl m3-surface-container-lowest border m3-border-subtle">
              <div class="text-[10px] uppercase font-bold m3-text-muted">Browser Rendering</div>
              <div class="font-mono font-semibold mt-1" data-pt-h-render>Not Needed</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (type === 'url-dns-sim') {
    return `
      <div class="flex flex-col gap-4 h-full" data-widget="url-dns-sim">
        <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined icon-18">dns</span>
          <span>URL Anatomy &amp; Live DNS Lookup</span>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-3.5 border m3-border-subtle">
          <div class="text-[11px] font-semibold m3-text-muted mb-2">1. Click any part of this URL to inspect it:</div>
          <div class="flex flex-wrap items-center gap-1 font-mono text-xs sm:text-sm p-2.5 rounded-xl m3-surface-container-lowest border m3-border-subtle">
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-lg font-mono" data-url-part="protocol">https://</button>
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-lg font-mono" data-url-part="domain">druba.in</button>
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-lg font-mono" data-url-part="path">/learn/index.html</button>
          </div>
          <div class="text-xs mt-2.5 p-2.5 rounded-xl m3-surface-container border m3-border-subtle" data-url-desc>
            <strong>Protocol (https://):</strong> Encrypted HyperText rules on Port 443.
          </div>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-3.5 border m3-border-subtle flex flex-col gap-2.5">
          <div class="text-[11px] font-semibold m3-text-muted">2. Simulated DNS Resolver (Domain &rarr; IP Address):</div>
          <div class="flex gap-2">
            <input type="text" class="input input-sm input-bordered font-mono text-xs flex-1 rounded-full" value="druba.in" placeholder="Enter domain e.g. google.com" data-dns-input>
            <button type="button" class="btn btn-sm btn-primary rounded-full px-4 gap-1" data-dns-btn>
              <span class="material-symbols-outlined icon-18">search</span>
              <span>Resolve</span>
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${['druba.in', 'google.com', 'swayam.gov.in', 'india.gov.in'].map((d) => `
              <button type="button" class="btn btn-xs btn-ghost border m3-border-subtle rounded-full font-mono" data-dns-chip="${d}">${d}</button>
            `).join('')}
          </div>
          <div class="m3-code-block p-3 font-mono text-xs leading-relaxed" data-dns-out></div>
        </div>
      </div>
    `;
  }

  if (type === 'http-cycle') {
    return `
      <div class="flex flex-col gap-3.5 h-full" data-widget="http-cycle">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">swap_horiz</span>
            <span>HTTP Request &rarr; Response Inspector</span>
          </div>
          <div class="flex gap-1">
            <button type="button" class="btn btn-xs btn-primary rounded-full font-mono" data-http-method="GET">GET</button>
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-http-method="POST">POST</button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-http-path="/index.html">/index.html (200)</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-http-path="/missing.html">/missing.html (404)</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-http-path="/api/crash">/api/crash (500)</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-http-path="/login">/login (Auth)</button>
        </div>

        <div class="m3-code-block p-3 font-mono text-[11px] leading-relaxed" data-http-raw></div>

        <div class="m3-surface-container-low rounded-2xl p-3 border m3-border-subtle">
          <div class="text-[11px] font-bold uppercase tracking-wider m3-text-muted mb-1.5 flex items-center gap-1">
            <span class="material-symbols-outlined icon-18">preview</span>
            <span>Browser Parsed Output</span>
          </div>
          <div class="p-3 rounded-xl bg-white text-[#171d19] border border-slate-200 text-xs" data-http-render></div>
        </div>
      </div>
    `;
  }

  if (type === 'arch-responsive-sim') {
    return `
      <div class="flex flex-col gap-3.5 h-full" data-widget="arch-responsive-sim">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">devices</span>
            <span>Responsive &amp; Stack Simulator</span>
          </div>
          <div class="flex gap-1">
            <button type="button" class="btn btn-xs btn-primary rounded-full" data-vp="mobile">Mobile 375px</button>
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-vp="tablet">Tablet 768px</button>
            <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-vp="desktop">Desktop 1200px</button>
          </div>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-3.5 border m3-border-subtle flex justify-center">
          <div class="w-full max-w-[240px] transition-all duration-200 m3-surface-container-lowest rounded-2xl p-3 border m3-border-subtle" data-vp-frame>
            <div class="flex items-center justify-between text-[11px] font-bold pb-2 border-b m3-border-subtle">
              <span>druba.in</span>
              <span class="badge badge-xs m3-primary-container font-mono" data-vp-badge>1-Col Stack</span>
            </div>
            <div class="grid grid-cols-1 gap-2 mt-2 text-[11px]" data-vp-grid>
              <div class="p-2 rounded-lg m3-surface-container font-semibold">HTML Structure</div>
              <div class="p-2 rounded-lg m3-surface-container font-semibold">CSS Layout</div>
              <div class="p-2 rounded-lg m3-surface-container font-semibold">JS Logic</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 text-xs">
          <div class="p-3 rounded-2xl m3-primary-container">
            <div class="font-bold flex items-center gap-1"><span class="material-symbols-outlined icon-18">laptop_mac</span> Front End (Browser)</div>
            <div class="opacity-90 mt-1">HTML + CSS + JavaScript run directly on the user’s screen.</div>
          </div>
          <div class="p-3 rounded-2xl m3-surface-container border m3-border-subtle">
            <div class="font-bold flex items-center gap-1"><span class="material-symbols-outlined icon-18">dns</span> Back End (Server)</div>
            <div class="m3-text-muted mt-1">Node.js / Python / MySQL process logins &amp; databases securely.</div>
          </div>
        </div>
      </div>
    `;
  }

  if (type === 'mini-editor') {
    const checks = Array.isArray(widgetSpec.checks) ? widgetSpec.checks : [];
    return `
      <div class="flex flex-col gap-3 h-full" data-widget="mini-editor">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-muted">Live Practice</div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-xs btn-ghost rounded-full" data-me-reset>Reset</button>
            <button type="button" class="btn btn-xs btn-primary rounded-full px-3" data-me-run>Run</button>
          </div>
        </div>

        ${widgetSpec.task ? `<p class="text-xs m3-text-muted m-0">${escapeHtml(widgetSpec.task)}</p>` : ''}

        <textarea spellcheck="false" rows="7" class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed rounded-2xl" data-me-input>${escapeHtml(widgetSpec.starterHtml || '')}</textarea>

        ${checks.length ? `
          <div class="flex flex-wrap gap-1.5" data-me-checks>
            ${checks.map((chk, idx) => `
              <span class="badge badge-sm m3-surface-container border m3-border-subtle gap-1 font-medium" data-me-check="${idx}">
                <span class="material-symbols-outlined text-sm">radio_button_unchecked</span>
                <span>${escapeHtml(chk.label)}</span>
              </span>
            `).join('')}
          </div>
        ` : ''}

        <div class="flex flex-col flex-1 min-h-[160px]">
          <div class="text-[11px] font-semibold m3-text-muted mb-1">Preview</div>
          <iframe class="w-full flex-1 min-h-[150px] rounded-2xl border m3-border-subtle bg-white" sandbox="allow-scripts allow-modals" title="Mini Editor Live Preview" data-me-iframe></iframe>
        </div>
      </div>
    `;
  }

  if (type === 'js-sandbox') {
    const presets = Array.isArray(widgetSpec.presets) ? widgetSpec.presets : [];
    const initialCode = presets[0]?.code || 'console.log("Hello JS!");';
    return `
      <div class="flex flex-col gap-3 h-full" data-widget="js-sandbox">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-muted">Live Practice</div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-xs btn-ghost rounded-full" data-js-reset>Reset</button>
            <button type="button" class="btn btn-xs btn-primary rounded-full px-3" data-js-run>Run</button>
          </div>
        </div>

        ${presets.length ? `
          <div class="flex flex-wrap gap-1.5">
            ${presets.map((p, idx) => `
              <button type="button" class="btn btn-xs ${idx === 0 ? 'm3-btn-tonal font-semibold' : 'btn-ghost border m3-border-subtle'} rounded-full" data-js-preset="${idx}">
                ${escapeHtml(p.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <textarea spellcheck="false" rows="7" class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed rounded-2xl" data-js-input>${escapeHtml(initialCode)}</textarea>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div class="m3-code-block p-3 font-mono text-[11px] min-h-[84px] max-h-[150px] overflow-y-auto" data-js-console>
            <div class="opacity-60">Click Run to see console output...</div>
          </div>
          <div class="m3-surface-container-low rounded-2xl p-3 border m3-border-subtle min-h-[84px] max-h-[150px] overflow-y-auto">
            <div class="text-[10px] font-bold uppercase tracking-wider m3-text-muted mb-1.5">Variables</div>
            <div class="flex flex-wrap gap-1.5 text-xs font-mono" data-js-vars>
              <span class="m3-text-muted text-[11px]">Run code to inspect values</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (type === 'css-specificity-sim') {
    return `
      <div class="flex flex-col gap-3.5 h-full" data-widget="css-specificity-sim">
        <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined icon-18">tune</span>
          <span>CSS Specificity &amp; Style Toggle</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">p &#123; gray &#125; <span class="opacity-60">(0,0,1)</span></span>
            <input type="checkbox" checked class="checkbox checkbox-xs checkbox-primary" data-spec-rule="tag">
          </label>
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">.alert &#123; green &#125; <span class="opacity-60">(0,1,0)</span></span>
            <input type="checkbox" checked class="checkbox checkbox-xs checkbox-primary" data-spec-rule="class">
          </label>
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">#title &#123; blue &#125; <span class="opacity-60">(1,0,0)</span></span>
            <input type="checkbox" class="checkbox checkbox-xs checkbox-primary" data-spec-rule="id">
          </label>
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">style="red" <span class="opacity-60">(1,0,0,0)</span></span>
            <input type="checkbox" class="checkbox checkbox-xs checkbox-primary" data-spec-rule="inline">
          </label>
        </div>

        <div class="p-4 rounded-2xl bg-white text-[#171d19] border border-slate-200 text-center">
          <div class="text-[11px] font-mono text-slate-500 mb-1">&lt;p id="title" class="alert"&gt;</div>
          <div class="text-lg font-bold transition-all" data-spec-target>Notice: Admissions Open!</div>
        </div>

        <div class="p-3 rounded-2xl m3-surface-container border m3-border-subtle text-xs" data-spec-winner></div>
      </div>
    `;
  }

  if (type === 'box-model-sliders') {
    return `
      <div class="flex flex-col gap-3 h-full" data-widget="box-model-sliders">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">crop_square</span>
            <span>Live CSS Box Model Sliders</span>
          </div>
          <label class="label cursor-pointer gap-2 py-0">
            <span class="text-xs font-semibold">box-sizing: border-box</span>
            <input type="checkbox" class="toggle toggle-xs toggle-primary" data-bm-borderbox>
          </label>
        </div>

        <div class="grid grid-cols-2 gap-2.5 text-xs">
          <label class="flex flex-col gap-1">
            <span>Width: <strong class="font-mono" data-bm-val="w">180px</strong></span>
            <input type="range" min="120" max="260" value="180" class="range range-xs range-primary" data-bm-slider="w">
          </label>
          <label class="flex flex-col gap-1">
            <span>Padding: <strong class="font-mono" data-bm-val="p">16px</strong></span>
            <input type="range" min="0" max="32" value="16" class="range range-xs range-primary" data-bm-slider="p">
          </label>
          <label class="flex flex-col gap-1">
            <span>Border: <strong class="font-mono" data-bm-val="b">4px</strong></span>
            <input type="range" min="0" max="14" value="4" class="range range-xs range-primary" data-bm-slider="b">
          </label>
          <label class="flex flex-col gap-1">
            <span>Margin: <strong class="font-mono" data-bm-val="m">14px</strong></span>
            <input type="range" min="0" max="28" value="14" class="range range-xs range-primary" data-bm-slider="m">
          </label>
        </div>

        <div class="flex items-center gap-1.5 text-xs">
          <span class="m3-text-muted font-semibold">Element Display:</span>
          <button type="button" class="btn btn-xs btn-primary rounded-full font-mono" data-bm-disp="block">&lt;div&gt; block</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-bm-disp="inline">&lt;span&gt; inline</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-bm-disp="inline-block">inline-block</button>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-3 border m3-border-subtle overflow-x-auto flex justify-center">
          <div class="rounded-xl border border-dashed border-amber-500/70 bg-amber-500/10 inline-block" data-bm-margin-box>
            <div class="text-[10px] font-mono opacity-75 px-1.5">margin</div>
            <div data-bm-border-box style="background:#0e7a3a; color:#fff; transition: all 120ms ease;">
              <div class="text-[10px] font-mono opacity-90 text-center" style="background:#b9f3c6; color:#00210b;" data-bm-content-box>
                Content Box
              </div>
            </div>
          </div>
        </div>

        <div class="p-2.5 rounded-xl m3-surface-container border m3-border-subtle font-mono text-[11px]" data-bm-readout></div>
      </div>
    `;
  }

  if (type === 'flexbox-playground') {
    return `
      <div class="flex flex-col gap-3 h-full" data-widget="flexbox-playground">
        <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined icon-18">view_column</span>
          <span>Interactive Flexbox Layout Playground</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <label class="flex flex-col gap-1">
            <span class="font-semibold">flex-direction</span>
            <select class="select select-xs select-bordered rounded-xl font-mono" data-fx="direction">
              <option value="row">row</option>
              <option value="column">column</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-semibold">justify-content</span>
            <select class="select select-xs select-bordered rounded-xl font-mono" data-fx="justify">
              <option value="flex-start">flex-start</option>
              <option value="center">center</option>
              <option value="space-between" selected>space-between</option>
              <option value="space-around">space-around</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-semibold">align-items</span>
            <select class="select select-xs select-bordered rounded-xl font-mono" data-fx="align">
              <option value="stretch">stretch</option>
              <option value="center" selected>center</option>
              <option value="flex-start">flex-start</option>
              <option value="flex-end">flex-end</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-semibold">gap: <strong class="font-mono" data-fx-gap-val>10px</strong></span>
            <input type="range" min="4" max="24" value="10" class="range range-xs range-primary" data-fx="gap">
          </label>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-3 border m3-border-subtle min-h-[140px] flex justify-between items-center gap-2.5" data-fx-stage>
          <div class="px-3 py-2 rounded-xl m3-primary-container font-bold text-xs">Item 1</div>
          <div class="px-3 py-4 rounded-xl m3-tonal-badge font-bold text-xs">Item 2</div>
          <div class="px-3 py-2 rounded-xl m3-primary-container font-bold text-xs">Item 3</div>
        </div>

        <div class="m3-code-block p-2.5 font-mono text-[11px]" data-fx-css></div>
      </div>
    `;
  }

  if (type === 'dom-clicker') {
    return `
      <div class="flex flex-col gap-3 h-full" data-widget="dom-clicker">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">account_tree</span>
            <span>Interactive DOM Tree Clicker</span>
          </div>
          <button type="button" class="btn btn-xs btn-ghost rounded-full" data-dom-act="reset">Reset DOM</button>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="btn btn-xs btn-primary rounded-full font-mono" data-dom-act="title">.innerHTML = "Welcome!"</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-dom-act="style">.style.background = green</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full font-mono" data-dom-act="append">.append(&lt;li&gt;)</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          <div class="p-3.5 rounded-2xl bg-white text-[#171d19] border border-slate-200 flex flex-col gap-2">
            <div class="text-[10px] font-bold uppercase text-slate-500">Live Webpage</div>
            <h4 class="font-bold text-base m-0" data-dom-title>Hello, Guest</h4>
            <div class="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 transition-colors" data-dom-status>Status: Waiting</div>
            <ul class="list-disc pl-4 text-xs space-y-0.5 m-0" data-dom-list>
              <li>HTML Structure</li>
            </ul>
          </div>

          <div class="m3-code-block p-3 font-mono text-[11px] flex flex-col gap-1.5" data-dom-tree></div>
        </div>
      </div>
    `;
  }

  if (type === 'security-checklist') {
    return `
      <div class="flex flex-col gap-3.5 h-full" data-widget="security-checklist">
        <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined icon-18">security</span>
          <span>Interactive Security Defense Lab</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="https">HTTPS / TLS Enabled</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="waf">Firewall / WAF Active</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="text">Use textContent (not innerHTML)</button>
          <button type="button" class="btn btn-xs m3-btn-tonal rounded-full" data-sec="hash">Salted Password Hashing</button>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-3 border m3-border-subtle flex flex-col gap-2">
          <div class="text-[11px] font-bold uppercase m3-text-muted">Test Simulated Attacks:</div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="btn btn-xs btn-outline rounded-full" data-atk="xss">Simulate XSS &lt;script&gt;</button>
            <button type="button" class="btn btn-xs btn-outline rounded-full" data-atk="wifi">Public Wi-Fi Sniff</button>
            <button type="button" class="btn btn-xs btn-outline rounded-full" data-atk="db">Database Leak Test</button>
          </div>
          <div class="text-xs mt-1 p-2.5 rounded-xl m3-surface-container border m3-border-subtle" data-atk-out>
            Toggle defenses above and simulate an attack to check your site’s protection.
          </div>
        </div>

        <div class="text-xs font-semibold" data-sec-status></div>
      </div>
    `;
  }

  if (type === 'firewall-sim') {
    return `
      <div class="flex flex-col gap-3.5 h-full" data-widget="firewall-sim">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">shield</span>
            <span>Firewall Packet Filter Simulator</span>
          </div>
          <span class="badge m3-tonal-badge font-mono text-xs" data-fw-score>Rule Audit: 2/4 Safe</span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">Port 443 (HTTPS)</span>
            <input type="checkbox" checked class="toggle toggle-xs toggle-primary" data-fw-port="443">
          </label>
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">Port 80 (Plain HTTP)</span>
            <input type="checkbox" class="toggle toggle-xs toggle-primary" data-fw-port="80">
          </label>
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">Port 22 (Open SSH)</span>
            <input type="checkbox" checked class="toggle toggle-xs toggle-primary" data-fw-port="22">
          </label>
          <label class="flex items-center justify-between p-2.5 rounded-xl m3-surface-container-low border m3-border-subtle cursor-pointer">
            <span class="font-mono">Port 4444 (Malware)</span>
            <input type="checkbox" checked class="toggle toggle-xs toggle-primary" data-fw-port="4444">
          </label>
        </div>

        <button type="button" class="btn btn-sm btn-primary rounded-full gap-1.5" data-fw-test>
          <span class="material-symbols-outlined icon-18">radar</span>
          <span>Send Test Traffic Wave</span>
        </button>

        <div class="m3-code-block p-3 font-mono text-[11px] space-y-1" data-fw-log>
          Toggle port rules above (block risky ports 22 &amp; 4444, keep 443 open) and test incoming traffic!
        </div>
      </div>
    `;
  }

  if (type === 'phishing-inspector' || type === 'license-inspector') {
    const isPhishing = type === 'phishing-inspector';
    return `
      <div class="flex flex-col gap-3.5 h-full" data-widget="${type}">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-bold uppercase tracking-wider m3-text-primary flex items-center gap-1.5">
            <span class="material-symbols-outlined icon-18">${isPhishing ? 'phishing' : 'copyright'}</span>
            <span>${isPhishing ? 'Phishing URL &amp; Privacy Inspector' : 'License &amp; Asset Inspector'}</span>
          </div>
          <span class="badge m3-tonal-badge font-mono text-xs" data-insp-step>Case 1 / 3</span>
        </div>

        <div class="m3-surface-container-low rounded-2xl p-4 border m3-border-subtle flex flex-col gap-2.5" data-insp-card></div>

        <div class="flex flex-wrap gap-2" data-insp-actions></div>

        <div class="text-xs p-3 rounded-2xl m3-surface-container border m3-border-subtle hidden" data-insp-feedback></div>
      </div>
    `;
  }

  return '';
}

// ============================================================================
// Widget Hydration
// ============================================================================

export function hydrateLessonWidget(rootEl, widgetSpec) {
  if (!rootEl || !widgetSpec) return;

  // 1. Interactive SVG Network Topology & Live Packet Inspector (M1L1)
  const pt = rootEl.querySelector('[data-widget="packet-toggle"]');
  if (pt) {
    let mode = 'internet';
    let stepTimer = null;
    const nodeXs = [70, 236, 404, 570];
    const protoEl = pt.querySelector('[data-pt-proto]');
    const destIcon = pt.querySelector('[data-pt-dest-icon]');
    const destLabel = pt.querySelector('[data-pt-dest-label]');
    const sub2 = pt.querySelector('[data-pt-sub="2"]');
    const sub3 = pt.querySelector('[data-pt-sub="3"]');
    const hopTitle = pt.querySelector('[data-pt-hop-title]');
    const status = pt.querySelector('[data-pt-status]');
    const packet = pt.querySelector('[data-pt-packet]');
    const packetGlow = pt.querySelector('[data-pt-packet-glow]');
    const hProto = pt.querySelector('[data-pt-h-proto]');
    const hPort = pt.querySelector('[data-pt-h-port]');
    const hPayload = pt.querySelector('[data-pt-h-payload]');
    const hRender = pt.querySelector('[data-pt-h-render]');

    const hopTitles = {
      internet: [
        'Node 1 of 4: Sender (Your Device)',
        'Node 2 of 4: Local ISP Gateway',
        'Node 3 of 4: Global Fibre Backbone',
        'Node 4 of 4: Destination (Chat Relay)'
      ],
      www: [
        'Node 1 of 4: Client Web Browser',
        'Node 2 of 4: DNS Resolver & ISP',
        'Node 3 of 4: High-Speed Internet Backbone',
        'Node 4 of 4: Web Server (HTML Host)'
      ]
    };

    const hopDescriptions = {
      internet: [
        'Node 1 (Your Device): Creates message payload and initiates connection on TCP port 5222.',
        'Node 2 (ISP / Router): Routes raw TCP/IP packet through local gateway towards backbone.',
        'Node 3 (Internet Backbone): Undersea fibre cables and transit routers move binary TCP packet globally.',
        'Node 4 (Chat Relay Server): Receives direct app packet on port 5222 without browser parsing.'
      ],
      www: [
        'Node 1 (Browser): User types URL; browser initiates DNS lookup & TLS 1.3 handshake.',
        'Node 2 (ISP / DNS): Resolves domain name into server IP address and routes HTTPS request.',
        'Node 3 (Internet Backbone): High-speed fibre network routes encrypted HTTPS packet to hosting datacenter.',
        'Node 4 (Web Server): Returns HTML, CSS & JS over port 443; browser engine parses the DOM tree.'
      ]
    };

    const highlightNode = (activeIdx) => {
      nodeXs.forEach((_, idx) => {
        const lit = idx <= activeIdx;
        const ring = pt.querySelector(`[data-pt-ring="${idx}"]`);
        const badgeBg = pt.querySelector(`[data-pt-badge-bg="${idx}"]`);
        const badgeTxt = pt.querySelector(`[data-pt-badge-txt="${idx}"]`);
        if (ring) ring.setAttribute('stroke', lit ? 'var(--m3-primary)' : 'var(--m3-outline-variant)');
        if (badgeBg) badgeBg.setAttribute('fill', lit ? 'var(--m3-primary)' : 'var(--m3-surface-container-highest)');
        if (badgeTxt) badgeTxt.setAttribute('fill', lit ? 'var(--m3-on-primary)' : 'var(--m3-text-muted)');
      });
      const x = nodeXs[Math.min(3, Math.max(0, activeIdx))];
      if (packet) {
        packet.setAttribute('cx', String(x));
        packet.style.cx = `${x}px`;
      }
      if (packetGlow) {
        packetGlow.setAttribute('cx', String(x));
        packetGlow.style.cx = `${x}px`;
      }
      if (hopTitle) {
        hopTitle.textContent = hopTitles[mode]?.[activeIdx] || 'Node 4 of 4: Destination';
      }
      if (status) {
        status.textContent = hopDescriptions[mode]?.[activeIdx] || '';
      }
    };

    const animatePacket = () => {
      clearInterval(stepTimer);
      let hop = 0;
      highlightNode(0);
      stepTimer = setInterval(() => {
        hop += 1;
        highlightNode(hop);
        if (hop >= 3) clearInterval(stepTimer);
      }, 420);
    };

    const renderMode = () => {
      pt.querySelectorAll('[data-pt-mode]').forEach((b) => {
        const active = b.dataset.ptMode === mode;
        b.classList.toggle('btn-primary', active);
        b.classList.toggle('m3-btn-tonal', !active);
      });
      if (mode === 'internet') {
        protoEl.textContent = 'TCP/IP · Port 5222';
        if (destIcon) destIcon.textContent = 'forum';
        if (destLabel) destLabel.textContent = 'Chat Server';
        if (sub2) sub2.textContent = 'Fibre / TCP/IP';
        if (sub3) sub3.textContent = 'Chat Relay';
        hProto.textContent = 'TCP/IP (XMPP)';
        hPort.textContent = '5222';
        hPayload.textContent = 'Raw Binary / JSON';
        hRender.textContent = 'Not Needed';
      } else {
        protoEl.textContent = 'HTTPS · Port 443';
        if (destIcon) destIcon.textContent = 'dns';
        if (destLabel) destLabel.textContent = 'Web Server';
        if (sub2) sub2.textContent = 'DNS + Fibre';
        if (sub3) sub3.textContent = 'HTML Host';
        hProto.textContent = 'HTTPS (HTTP over TLS)';
        hPort.textContent = '443';
        hPayload.textContent = 'HTML Document';
        hRender.textContent = 'Parses DOM';
      }
      animatePacket();
    };

    pt.querySelectorAll('[data-pt-node]').forEach((g, idx) => {
      g.addEventListener('click', () => {
        clearInterval(stepTimer);
        highlightNode(idx);
      });
    });

    pt.querySelectorAll('[data-pt-mode]').forEach((b) => {
      b.addEventListener('click', () => {
        mode = b.dataset.ptMode;
        renderMode();
      });
    });

    pt.querySelector('[data-pt-send]')?.addEventListener('click', animatePacket);
    renderMode();
  }

  // 2. URL Anatomy & Live DNS Lookup (M1L2)
  const dnsSim = rootEl.querySelector('[data-widget="url-dns-sim"]');
  if (dnsSim) {
    const partDescriptions = {
      protocol: '<strong>Protocol (https://):</strong> Encrypted HyperText rules on Port 443.',
      domain: '<strong>Domain Name (druba.in):</strong> Human-friendly name translated by DNS to an IP address.',
      path: '<strong>Resource Path (/learn/index.html):</strong> Exact folder and HTML file requested from the server.'
    };
    const descEl = dnsSim.querySelector('[data-url-desc]');
    dnsSim.querySelectorAll('[data-url-part]').forEach((btn) => {
      btn.addEventListener('click', () => {
        dnsSim.querySelectorAll('[data-url-part]').forEach((b) => {
          b.classList.toggle('btn-primary', b === btn);
          b.classList.toggle('m3-btn-tonal', b !== btn);
        });
        descEl.innerHTML = partDescriptions[btn.dataset.urlPart] || '';
      });
    });

    const dnsRecords = {
      'druba.in': { v4: '104.21.48.192', v6: '2606:4700:3034::6815:30c0' },
      'google.com': { v4: '142.250.193.78', v6: '2404:6800:4009:82d::200e' },
      'swayam.gov.in': { v4: '164.100.166.91', v6: '2404:1a80:1:2::91' },
      'india.gov.in': { v4: '164.100.229.68', v6: '2404:1a80:0:5::68' }
    };
    const dnsInput = dnsSim.querySelector('[data-dns-input]');
    const dnsOut = dnsSim.querySelector('[data-dns-out]');

    const resolveDomain = (raw) => {
      const host = (raw || 'druba.in').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] || 'druba.in';
      dnsInput.value = host;
      let rec = dnsRecords[host];
      if (!rec) {
        let hash = 0;
        for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) & 0xffff;
        rec = {
          v4: `172.${(hash >> 8) & 127 || 16}.${hash & 255}.${((hash >> 3) % 200) + 20}`,
          v6: `2001:db8::${hash.toString(16)}:1`
        };
      }
      dnsOut.innerHTML = `
        <div>$ nslookup ${escapeHtml(host)}</div>
        <div class="text-emerald-300">1. Cache check &rarr; 2. DNS Resolver &rarr; 3. Resolved!</div>
        <div>IPv4: <strong>${rec.v4}</strong> &middot; IPv6: <strong>${rec.v6}</strong></div>
      `;
    };

    dnsSim.querySelector('[data-dns-btn]')?.addEventListener('click', () => resolveDomain(dnsInput.value));
    dnsSim.querySelectorAll('[data-dns-chip]').forEach((c) => {
      c.addEventListener('click', () => resolveDomain(c.dataset.dnsChip));
    });
    resolveDomain('druba.in');
  }

  // 3. HTTP Request-Response Simulator (M1L3)
  const httpSim = rootEl.querySelector('[data-widget="http-cycle"]');
  if (httpSim) {
    let method = 'GET';
    let path = '/index.html';
    const rawEl = httpSim.querySelector('[data-http-raw]');
    const renderEl = httpSim.querySelector('[data-http-render]');

    const routes = {
      '/index.html': {
        status: '200 OK',
        html: '<h4 style="margin:0 0 4px;font-weight:700;">Welcome to druba.in</h4><p style="margin:0;">Browser parsed HTML and rendered this page.</p>'
      },
      '/missing.html': {
        status: '404 Not Found',
        html: '<h4 style="margin:0 0 4px;color:#b91c1c;font-weight:700;">404 — Page Not Found</h4><p style="margin:0;">The requested file does not exist on this server.</p>'
      },
      '/api/crash': {
        status: '500 Internal Server Error',
        html: '<h4 style="margin:0 0 4px;color:#b91c1c;font-weight:700;">500 — Server Error</h4><p style="margin:0;">Backend script crashed while preparing response.</p>'
      },
      '/login': {
        status: '200 OK',
        html: '<h4 style="margin:0 0 4px;color:#0e7a3a;font-weight:700;">Signed In Securely</h4><p style="margin:0;">POST payload encrypted inside HTTPS body (Port 443).</p>'
      }
    };

    const draw = () => {
      httpSim.querySelectorAll('[data-http-method]').forEach((b) => {
        const active = b.dataset.httpMethod === method;
        b.classList.toggle('btn-primary', active);
        b.classList.toggle('m3-btn-tonal', !active);
      });
      const r = routes[path] || routes['/index.html'];
      const note = method === 'GET' && path === '/login'
        ? 'Warning: GET exposes parameters in URL (?user=ananya). Switch to POST!'
        : `${method} ${path} HTTP/1.1 | Host: druba.in`;
      rawEl.innerHTML = `
        <div class="text-emerald-300">&gt; ${escapeHtml(note)}</div>
        <div>&lt; HTTP/1.1 <strong>${escapeHtml(r.status)}</strong> · Content-Type: text/html</div>
      `;
      renderEl.innerHTML = r.html;
    };

    httpSim.querySelectorAll('[data-http-method]').forEach((b) => {
      b.addEventListener('click', () => {
        method = b.dataset.httpMethod;
        draw();
      });
    });
    httpSim.querySelectorAll('[data-http-path]').forEach((b) => {
      b.addEventListener('click', () => {
        path = b.dataset.httpPath;
        if (path === '/login') method = 'POST';
        draw();
      });
    });
    draw();
  }

  // 4. Architecture & Responsive Viewport Simulator (M1L4)
  const archSim = rootEl.querySelector('[data-widget="arch-responsive-sim"]');
  if (archSim) {
    const frame = archSim.querySelector('[data-vp-frame]');
    const grid = archSim.querySelector('[data-vp-grid]');
    const badge = archSim.querySelector('[data-vp-badge]');
    const specs = {
      mobile: { maxW: '220px', cols: 'grid-cols-1', label: '1-Col Stack' },
      tablet: { maxW: '340px', cols: 'grid-cols-2', label: '2-Col Grid' },
      desktop: { maxW: '100%', cols: 'grid-cols-3', label: '3-Col Wide' }
    };
    archSim.querySelectorAll('[data-vp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        archSim.querySelectorAll('[data-vp]').forEach((b) => {
          b.classList.toggle('btn-primary', b === btn);
          b.classList.toggle('m3-btn-tonal', b !== btn);
        });
        const s = specs[btn.dataset.vp] || specs.mobile;
        frame.style.maxWidth = s.maxW;
        grid.className = `grid ${s.cols} gap-2 mt-2 text-[11px]`;
        badge.textContent = s.label;
      });
    });
  }

  // 5. Live Mini-Editor + Instant Preview (M1L5 + all M2 lessons)
  const me = rootEl.querySelector('[data-widget="mini-editor"]');
  if (me) {
    const input = me.querySelector('[data-me-input]');
    const iframe = me.querySelector('[data-me-iframe]');
    const checks = Array.isArray(widgetSpec.checks) ? widgetSpec.checks : [];
    let debounceTimer = null;

    const updatePreviewAndChecks = () => {
      const code = input.value;
      iframe.srcdoc = composeSrcDoc(code, '', '');
      checks.forEach((chk, idx) => {
        const badge = me.querySelector(`[data-me-check="${idx}"]`);
        if (!badge) return;
        let ok = false;
        try { ok = Boolean(chk.test(code)); } catch { ok = false; }
        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = ok ? 'check_circle' : 'radio_button_unchecked';
        badge.classList.toggle('m3-primary-container', ok);
        badge.classList.toggle('m3-surface-container', !ok);
      });
    };

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreviewAndChecks, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, s) + '  ' + input.value.slice(end);
        input.selectionStart = input.selectionEnd = s + 2;
        updatePreviewAndChecks();
      }
    });
    me.querySelector('[data-me-reset]')?.addEventListener('click', () => {
      input.value = widgetSpec.starterHtml || '';
      updatePreviewAndChecks();
    });
    me.querySelector('[data-me-run]')?.addEventListener('click', updatePreviewAndChecks);
    updatePreviewAndChecks();
  }

  // 6. Live JS Sandbox + Console + Variable Inspector (All M3 lessons)
  const jsBox = rootEl.querySelector('[data-widget="js-sandbox"]');
  if (jsBox) {
    const input = jsBox.querySelector('[data-js-input]');
    const consoleEl = jsBox.querySelector('[data-js-console]');
    const varsEl = jsBox.querySelector('[data-js-vars]');
    const presets = Array.isArray(widgetSpec.presets) ? widgetSpec.presets : [];

    const executeCurrent = async () => {
      const result = await runJsInSandbox(input.value);
      const lines = [];
      for (const p of result.popups || []) {
        lines.push(`<div class="text-amber-300">[${escapeHtml(p.kind)}] "${escapeHtml(p.text)}" &rarr; ${escapeHtml(p.result)}</div>`);
      }
      for (const l of result.logs || []) {
        const cls = l.level === 'error' ? 'text-rose-300' : 'text-emerald-200';
        lines.push(`<div class="${cls}">&gt; ${escapeHtml(l.text)}</div>`);
      }
      consoleEl.innerHTML = lines.length ? lines.join('') : '<div class="opacity-60">(No console output)</div>';

      if (result.returned && typeof result.returned === 'object') {
        varsEl.innerHTML = Object.entries(result.returned).map(([k, v]) => `
          <span class="badge badge-sm m3-primary-container font-mono">${escapeHtml(k)}: ${escapeHtml(JSON.stringify(v))}</span>
        `).join('');
      } else if (result.returned !== null && result.returned !== undefined) {
        varsEl.innerHTML = `<span class="badge badge-sm m3-primary-container font-mono">return: ${escapeHtml(String(result.returned))}</span>`;
      } else {
        varsEl.innerHTML = '<span class="m3-text-muted text-[11px]">Add <code>return { ... }</code> to inspect variables.</span>';
      }
    };

    jsBox.querySelector('[data-js-run]')?.addEventListener('click', executeCurrent);
    jsBox.querySelector('[data-js-reset]')?.addEventListener('click', () => {
      input.value = presets[0]?.code || '';
      executeCurrent();
    });
    jsBox.querySelectorAll('[data-js-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = presets[Number(btn.dataset.jsPreset)];
        if (!p) return;
        input.value = p.code;
        jsBox.querySelectorAll('[data-js-preset]').forEach((b) => {
          b.classList.toggle('m3-btn-tonal', b === btn);
          b.classList.toggle('font-semibold', b === btn);
          b.classList.toggle('btn-ghost', b !== btn);
        });
        executeCurrent();
      });
    });
    executeCurrent();
  }

  // 7. CSS Specificity & Style Toggle (M4L1)
  const specSim = rootEl.querySelector('[data-widget="css-specificity-sim"]');
  if (specSim) {
    const target = specSim.querySelector('[data-spec-target]');
    const winner = specSim.querySelector('[data-spec-winner]');
    const updateSpec = () => {
      const hasTag = specSim.querySelector('[data-spec-rule="tag"]').checked;
      const hasClass = specSim.querySelector('[data-spec-rule="class"]').checked;
      const hasId = specSim.querySelector('[data-spec-rule="id"]').checked;
      const hasInline = specSim.querySelector('[data-spec-rule="inline"]').checked;

      let color = '#171d19';
      let bg = 'transparent';
      let msg = 'Browser default (no custom CSS enabled).';
      if (hasTag) { color = '#64748b'; msg = 'Winner: Tag selector p (0,0,1) -> gray'; }
      if (hasClass) { color = '#0e7a3a'; bg = '#d1e8d4'; msg = 'Winner: Class selector .alert (0,1,0) beats Tag!'; }
      if (hasId) { color = '#1d4ed8'; msg = 'Winner: ID selector #title (1,0,0) beats Class & Tag!'; }
      if (hasInline) { color = '#b91c1c'; msg = 'Winner: Inline style="..." (1,0,0,0) overrides all external/internal selectors!'; }

      target.style.color = color;
      target.style.backgroundColor = bg;
      target.style.padding = bg === 'transparent' ? '0' : '6px 12px';
      target.style.borderRadius = '8px';
      winner.innerHTML = `<strong>${escapeHtml(msg)}</strong>`;
    };
    specSim.querySelectorAll('[data-spec-rule]').forEach((cb) => cb.addEventListener('change', updateSpec));
    updateSpec();
  }

  // 8. Live CSS Box Model Sliders (M4L2)
  const bm = rootEl.querySelector('[data-widget="box-model-sliders"]');
  if (bm) {
    let displayMode = 'block';
    const marginBox = bm.querySelector('[data-bm-margin-box]');
    const borderBox = bm.querySelector('[data-bm-border-box]');
    const contentBox = bm.querySelector('[data-bm-content-box]');
    const readout = bm.querySelector('[data-bm-readout]');
    const borderBoxToggle = bm.querySelector('[data-bm-borderbox]');

    const renderBm = () => {
      const w = Number(bm.querySelector('[data-bm-slider="w"]').value);
      const p = Number(bm.querySelector('[data-bm-slider="p"]').value);
      const b = Number(bm.querySelector('[data-bm-slider="b"]').value);
      const m = Number(bm.querySelector('[data-bm-slider="m"]').value);
      const isBorderBox = borderBoxToggle.checked;

      bm.querySelector('[data-bm-val="w"]').textContent = w + 'px';
      bm.querySelector('[data-bm-val="p"]').textContent = p + 'px';
      bm.querySelector('[data-bm-val="b"]').textContent = b + 'px';
      bm.querySelector('[data-bm-val="m"]').textContent = m + 'px';

      marginBox.style.padding = m + 'px';
      borderBox.style.padding = b + 'px';
      borderBox.style.display = displayMode === 'inline' ? 'inline' : 'inline-block';
      contentBox.style.padding = p + 'px';
      const innerW = displayMode === 'inline'
        ? 'auto'
        : (isBorderBox ? Math.max(40, w - (p * 2) - (b * 2)) + 'px' : w + 'px');
      contentBox.style.width = innerW;

      const totalBoxW = displayMode === 'inline'
        ? 'auto (inline ignores width)'
        : (isBorderBox ? `${w}px (locked by border-box)` : `${w + p * 2 + b * 2}px`);
      readout.textContent = `display: ${displayMode} | box-sizing: ${isBorderBox ? 'border-box' : 'content-box'} | Rendered Box Width: ${totalBoxW}`;
    };

    bm.querySelectorAll('[data-bm-slider]').forEach((s) => s.addEventListener('input', renderBm));
    borderBoxToggle.addEventListener('change', renderBm);
    bm.querySelectorAll('[data-bm-disp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        displayMode = btn.dataset.bmDisp;
        bm.querySelectorAll('[data-bm-disp]').forEach((b) => {
          b.classList.toggle('btn-primary', b === btn);
          b.classList.toggle('m3-btn-tonal', b !== btn);
        });
        renderBm();
      });
    });
    renderBm();
  }

  // 9. Flexbox Playground (M4L3)
  const fx = rootEl.querySelector('[data-widget="flexbox-playground"]');
  if (fx) {
    const stage = fx.querySelector('[data-fx-stage]');
    const cssEl = fx.querySelector('[data-fx-css]');
    const gapVal = fx.querySelector('[data-fx-gap-val]');
    const updateFx = () => {
      const dir = fx.querySelector('[data-fx="direction"]').value;
      const just = fx.querySelector('[data-fx="justify"]').value;
      const align = fx.querySelector('[data-fx="align"]').value;
      const gap = fx.querySelector('[data-fx="gap"]').value + 'px';
      gapVal.textContent = gap;
      stage.style.flexDirection = dir;
      stage.style.justifyContent = just;
      stage.style.alignItems = align;
      stage.style.gap = gap;
      cssEl.textContent = `.container { display: flex; flex-direction: ${dir}; justify-content: ${just}; align-items: ${align}; gap: ${gap}; }`;
    };
    fx.querySelectorAll('[data-fx]').forEach((el) => el.addEventListener('input', updateFx));
    updateFx();
  }

  // 10. DOM Tree Clicker (M4L4)
  const dom = rootEl.querySelector('[data-widget="dom-clicker"]');
  if (dom) {
    const titleEl = dom.querySelector('[data-dom-title]');
    const statusEl = dom.querySelector('[data-dom-status]');
    const listEl = dom.querySelector('[data-dom-list]');
    const treeEl = dom.querySelector('[data-dom-tree]');
    let lastFlash = '';
    let itemCount = 1;

    const renderTree = () => {
      const nodes = [
        { key: 'title', html: `&lt;h4 id="title"&gt;${escapeHtml(titleEl.innerHTML)}&lt;/h4&gt;` },
        { key: 'status', html: `&lt;div class="status" style="bg:${escapeHtml(statusEl.style.backgroundColor || 'none')}"&gt;${escapeHtml(statusEl.textContent)}&lt;/div&gt;` },
        { key: 'list', html: `&lt;ul id="list"&gt; (${listEl.children.length} &lt;li&gt; nodes) &lt;/ul&gt;` }
      ];
      treeEl.innerHTML = `<div class="text-emerald-300 font-bold mb-1">Live DOM Tree</div>` +
        nodes.map((n) => `
          <div class="px-2 py-1 rounded ${lastFlash === n.key ? 'm3-dom-flash bg-emerald-500/25 text-emerald-100' : 'opacity-90'}">
            ${n.html}
          </div>
        `).join('');
    };

    dom.querySelectorAll('[data-dom-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.domAct;
        if (act === 'title') {
          titleEl.innerHTML = 'Welcome, <em>Developer</em>!';
          lastFlash = 'title';
        } else if (act === 'style') {
          statusEl.style.backgroundColor = '#b9f3c6';
          statusEl.textContent = 'Status: DOM Updated!';
          lastFlash = 'status';
        } else if (act === 'append') {
          itemCount += 1;
          const li = document.createElement('li');
          li.textContent = `Dynamic Node #${itemCount}`;
          listEl.append(li);
          lastFlash = 'list';
        } else {
          titleEl.textContent = 'Hello, Guest';
          statusEl.style.backgroundColor = '';
          statusEl.textContent = 'Status: Waiting';
          listEl.innerHTML = '<li>HTML Structure</li>';
          itemCount = 1;
          lastFlash = '';
        }
        renderTree();
      });
    });
    renderTree();
  }

  // 11. Security Checklist & Attack Simulator (M5L1)
  const sec = rootEl.querySelector('[data-widget="security-checklist"]');
  if (sec) {
    const active = new Set(['https']);
    const statusEl = sec.querySelector('[data-sec-status]');
    const atkOut = sec.querySelector('[data-atk-out]');
    const renderSec = () => {
      sec.querySelectorAll('[data-sec]').forEach((b) => {
        const on = active.has(b.dataset.sec);
        b.classList.toggle('btn-primary', on);
        b.classList.toggle('m3-btn-tonal', !on);
      });
      statusEl.innerHTML = active.size === 4
        ? '<span class="m3-text-primary font-bold">All 4 core defenses enabled — your site resists common attacks!</span>'
        : `<span>Active defenses: <strong>${active.size} / 4</strong>. Enable all 4 and test attacks above.</span>`;
    };
    sec.querySelectorAll('[data-sec]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.sec;
        if (active.has(k)) active.delete(k); else active.add(k);
        renderSec();
      });
    });
    sec.querySelectorAll('[data-atk]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = b.dataset.atk;
        if (a === 'xss') {
          atkOut.innerHTML = active.has('text') || active.has('waf')
            ? '<strong class="m3-text-primary">BLOCKED:</strong> textContent / WAF neutralized the injected &lt;script&gt; payload.'
            : '<strong class="text-error">VULNERABLE:</strong> Unsafe innerHTML executed the attacker’s &lt;script&gt;!';
        } else if (a === 'wifi') {
          atkOut.innerHTML = active.has('https')
            ? '<strong class="m3-text-primary">BLOCKED:</strong> HTTPS/TLS encrypted the session so Wi-Fi sniffers see only random ciphertext.'
            : '<strong class="text-error">VULNERABLE:</strong> Plain HTTP exposed login data in readable text!';
        } else {
          atkOut.innerHTML = active.has('hash')
            ? '<strong class="m3-text-primary">BLOCKED:</strong> Salted cryptographic hashes prevented password recovery.'
            : '<strong class="text-error">VULNERABLE:</strong> Plaintext passwords were exposed in the leak!';
        }
      });
    });
    renderSec();
  }

  // 12. Firewall Packet Filter Simulator (M5L2)
  const fw = rootEl.querySelector('[data-widget="firewall-sim"]');
  if (fw) {
    const scoreEl = fw.querySelector('[data-fw-score]');
    const logEl = fw.querySelector('[data-fw-log]');
    const getRules = () => ({
      443: fw.querySelector('[data-fw-port="443"]').checked,
      80: fw.querySelector('[data-fw-port="80"]').checked,
      22: fw.querySelector('[data-fw-port="22"]').checked,
      4444: fw.querySelector('[data-fw-port="4444"]').checked
    });
    const updateScore = () => {
      const r = getRules();
      const score = (r[443] ? 1 : 0) + (!r[80] ? 1 : 0) + (!r[22] ? 1 : 0) + (!r[4444] ? 1 : 0);
      scoreEl.textContent = `Rule Audit: ${score}/4 Optimal`;
    };
    fw.querySelectorAll('[data-fw-port]').forEach((el) => el.addEventListener('change', updateScore));
    fw.querySelector('[data-fw-test]')?.addEventListener('click', () => {
      const r = getRules();
      const packets = [
        { name: 'Student HTTPS Request', port: 443, safe: true },
        { name: 'Unencrypted HTTP Login', port: 80, safe: false },
        { name: 'Brute-Force SSH Probe', port: 22, safe: false },
        { name: 'Malware Beacon Packet', port: 4444, safe: false }
      ];
      logEl.innerHTML = packets.map((p) => {
        const allowed = r[p.port];
        const status = allowed ? 'ALLOWED' : 'BLOCKED';
        const good = (allowed && p.safe) || (!allowed && !p.safe);
        return `<div class="${good ? 'text-emerald-300' : 'text-rose-300'}">[Port ${p.port}] ${escapeHtml(p.name)} &rarr; <strong>${status}</strong> ${good ? '(Good)' : '(Risk!)'}</div>`;
      }).join('');
    });
    updateScore();
  }

  // 13 & 14. Phishing & License Inspectors (M5L3, M5L4)
  const insp = rootEl.querySelector('[data-widget="phishing-inspector"], [data-widget="license-inspector"]');
  if (insp) {
    const isPhishing = insp.dataset.widget === 'phishing-inspector';
    const cases = isPhishing
      ? [
          {
            title: 'Case 1: Bank OTP Prompt',
            detail: 'URL: http://sbi-kyc-update-login.xyz/otp.html (No HTTPS padlock, third-party .xyz domain)',
            choices: ['Safe — Enter OTP', 'Phishing — Block & Close'],
            correct: 1,
            why: 'Lookalike domain + plain HTTP is a classic phishing trap. Real banks use official domains over HTTPS.'
          },
          {
            title: 'Case 2: Official Portal',
            detail: 'URL: https://www.india.gov.in/ (Valid TLS padlock, official .gov.in root domain)',
            choices: ['Legitimate — Safe to Browse', 'Phishing — Block'],
            correct: 0,
            why: 'Verified .gov.in root domain with valid HTTPS TLS certificate.'
          },
          {
            title: 'Case 3: Developer Storage Choice',
            detail: 'A student stores user passwords inside browser localStorage.setItem("pwd", val).',
            choices: ['Safe Practice', 'Insecure — Use Server Salted Hash'],
            correct: 1,
            why: 'localStorage is readable by any JS on the page. Passwords must be hashed on the server.'
          }
        ]
      : [
          {
            title: 'Case 1: Commercial News Photo',
            detail: 'You find a great photo on a news website with no Creative Commons notice.',
            choices: ['Copy into project freely', 'Protected by Copyright — Do Not Reuse'],
            correct: 1,
            why: 'Web images are copyrighted by default unless an explicit license allows reuse.'
          },
          {
            title: 'Case 2: CC BY 4.0 Icon Set',
            detail: 'An SVG icon pack carries a Creative Commons Attribution (CC BY 4.0) license.',
            choices: ['Use & credit the creator', 'Illegal to use on websites'],
            correct: 0,
            why: 'CC BY permits free reuse as long as you include creator attribution.'
          },
          {
            title: 'Case 3: MIT Licensed JS Library',
            detail: 'CodeMirror & Bootstrap are published under the permissive MIT License.',
            choices: ['Free to use keeping copyright notice', 'Must pay licensing fee per student'],
            correct: 0,
            why: 'Permissive MIT licenses allow free educational and commercial use with the license notice preserved.'
          }
        ];

    let idx = 0;
    const stepEl = insp.querySelector('[data-insp-step]');
    const cardEl = insp.querySelector('[data-insp-card]');
    const actEl = insp.querySelector('[data-insp-actions]');
    const fbEl = insp.querySelector('[data-insp-feedback]');

    const renderCase = () => {
      const c = cases[idx];
      stepEl.textContent = `Case ${idx + 1} / ${cases.length}`;
      cardEl.innerHTML = `<div class="font-bold text-sm">${escapeHtml(c.title)}</div><div class="font-mono text-xs m3-text-muted">${escapeHtml(c.detail)}</div>`;
      fbEl.classList.add('hidden');
      actEl.innerHTML = c.choices.map((ch, cIdx) => `
        <button type="button" class="btn btn-xs sm:btn-sm m3-btn-tonal rounded-full" data-insp-pick="${cIdx}">${escapeHtml(ch)}</button>
      `).join('') + `
        <button type="button" class="btn btn-xs sm:btn-sm btn-ghost rounded-full ml-auto" data-insp-next>Next Case &rarr;</button>
      `;

      actEl.querySelectorAll('[data-insp-pick]').forEach((b) => {
        b.addEventListener('click', () => {
          const picked = Number(b.dataset.inspPick);
          const ok = picked === c.correct;
          fbEl.classList.remove('hidden');
          fbEl.innerHTML = `<strong class="${ok ? 'm3-text-primary' : 'text-error'}">${ok ? 'Correct!' : 'Not quite:'}</strong> ${escapeHtml(c.why)}`;
        });
      });
      actEl.querySelector('[data-insp-next]')?.addEventListener('click', () => {
        idx = (idx + 1) % cases.length;
        renderCase();
      });
    };
    renderCase();
  }
}
