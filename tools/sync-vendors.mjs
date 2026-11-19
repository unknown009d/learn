#!/usr/bin/env node
/**
 * Downloads and bundles all third-party CDN assets locally into ../vendor/
 * so the application runs with zero external CDN dependencies.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const VENDOR_DIR = path.join(ROOT_DIR, 'vendor');
const FONTS_DIR = path.join(VENDOR_DIR, 'fonts');
const CM_DIR = path.join(VENDOR_DIR, 'codemirror');
const BS_DIR = path.join(VENDOR_DIR, 'bootstrap');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ALLOWED_FONT_SUBSETS = new Set(['latin', 'latin-ext', 'symbols']);

// Explicit icons set dynamically via JS (ensures subsetting never misses them)
const EXTRA_ICONS = [
  'check',
  'check_circle',
  'chevron_right',
  'content_copy',
  'dark_mode',
  'dns',
  'dock_to_left',
  'error',
  'expand_less',
  'expand_more',
  'forum',
  'light_mode',
  'menu_open',
  'pause',
  'play_arrow',
  'quiz',
  'radio_button_checked',
  'radio_button_unchecked'
];

const CODEMIRROR_CSS = [
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.css',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/theme/eclipse.min.css',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/theme/material-darker.min.css',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/show-hint.min.css'
];

const CODEMIRROR_JS = [
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/xml/xml.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/javascript/javascript.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/css/css.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/htmlmixed/htmlmixed.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/xml-fold.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/closetag.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/closebrackets.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/matchbrackets.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/matchtags.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/selection/active-line.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/show-hint.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/xml-hint.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/html-hint.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/css-hint.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/javascript-hint.min.js'
];

const STANDALONE_ASSETS = [
  {
    url: 'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
    dest: path.join(VENDOR_DIR, 'qrious.min.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    dest: path.join(VENDOR_DIR, 'html2canvas.min.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
    dest: path.join(VENDOR_DIR, 'jsQR.min.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    dest: path.join(BS_DIR, 'bootstrap.min.css')
  }
];

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchBuffer(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function discoverMaterialIcons() {
  const icons = new Set(EXTRA_ICONS);
  const scanFiles = [path.join(ROOT_DIR, 'index.html')];
  const jsEntries = await fs.readdir(path.join(ROOT_DIR, 'js'));
  for (const name of jsEntries) {
    if (name.endsWith('.js')) scanFiles.push(path.join(ROOT_DIR, 'js', name));
  }

  for (const filePath of scanFiles) {
    const txt = await fs.readFile(filePath, 'utf8');
    const lines = txt.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.includes('material-symbols-outlined')) {
        const chunk = lines.slice(idx, idx + 4).join(' ');
        const match = chunk.match(/material-symbols-outlined[^>]*>([\s\S]*?)<\/span>/);
        if (match) {
          const inner = match[1].trim();
          if (/^[a-z0-9_]+$/.test(inner)) {
            icons.add(inner);
          } else {
            for (const lit of inner.matchAll(/['"]([a-z0-9_]+)['"]/g)) {
              icons.add(lit[1]);
            }
          }
        }
      }
    });
    for (const m of txt.matchAll(/\bicon\s*:\s*['"]([a-z0-9_]+)['"]/g)) {
      icons.add(m[1]);
    }
  }

  return [...icons].sort();
}

async function syncFonts() {
  await fs.mkdir(FONTS_DIR, { recursive: true });
  // Clean existing .woff2 files in vendor/fonts so stale hashes never linger
  for (const existing of await fs.readdir(FONTS_DIR)) {
    if (existing.endsWith('.woff2')) {
      await fs.unlink(path.join(FONTS_DIR, existing));
    }
  }

  const textFontsUrl =
    'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400..700&family=Inter:wght@400..700&family=JetBrains+Mono:ital,wght@0,400..600;1,400&family=Plus+Jakarta+Sans:wght@500..800&display=swap';
  const textCss = await fetchText(textFontsUrl, { 'User-Agent': CHROME_UA });

  const blockRegex = /\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g;
  const cssParts = ['/* Self-hosted Google Fonts & Material Symbols Outlined */'];
  const downloadedUrls = new Map();
  let fontBytes = 0;

  for (const match of textCss.matchAll(blockRegex)) {
    const subset = match[1].trim();
    const body = match[2];
    if (!ALLOWED_FONT_SUBSETS.has(subset)) continue;

    const family = body.match(/font-family:\s*'([^']+)'/)?.[1] || 'font';
    const style = body.match(/font-style:\s*([^;\n]+)/)?.[1]?.trim() || 'normal';
    const weight = body.match(/font-weight:\s*([^;\n]+)/)?.[1]?.trim() || '400';
    const urlMatch = body.match(/url\((https:[^)]+)\)/);
    if (!urlMatch) continue;

    const remoteUrl = urlMatch[1];
    let localFile = downloadedUrls.get(remoteUrl);
    if (!localFile) {
      localFile = `${slugify(family)}-${slugify(subset)}-${slugify(style)}-${slugify(weight)}.woff2`;
      const buf = await fetchBuffer(remoteUrl, { 'User-Agent': CHROME_UA });
      await fs.writeFile(path.join(FONTS_DIR, localFile), buf);
      downloadedUrls.set(remoteUrl, localFile);
      fontBytes += buf.length;
    }

    const rewrittenBody = body.replace(remoteUrl, `./${localFile}`);
    cssParts.push(`/* ${subset} */\n@font-face {${rewrittenBody}}`);
  }

  // Material Symbols Outlined (subsetted to icons used in the workspace)
  const icons = await discoverMaterialIcons();
  const iconUrl =
    `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${icons.join(',')}&display=block`;
  const iconCss = await fetchText(iconUrl, { 'User-Agent': CHROME_UA });
  const iconWoffMatch = iconCss.match(/url\((https:[^)]+)\)/);
  if (!iconWoffMatch) {
    throw new Error('Failed to locate Material Symbols Outlined WOFF2 URL');
  }
  const iconBuf = await fetchBuffer(iconWoffMatch[1], { 'User-Agent': CHROME_UA });
  const iconFile = 'material-symbols-outlined.woff2';
  await fs.writeFile(path.join(FONTS_DIR, iconFile), iconBuf);
  fontBytes += iconBuf.length;

  const rewrittenIconCss = iconCss.replace(iconWoffMatch[1], `./${iconFile}`);
  cssParts.push(`/* Material Symbols Outlined (${icons.length} icons) */\n${rewrittenIconCss.trim()}`);

  await fs.writeFile(path.join(FONTS_DIR, 'fonts.css'), cssParts.join('\n\n') + '\n', 'utf8');
  console.log(
    `[fonts] Downloaded ${downloadedUrls.size} text WOFF2 files + 1 Material Symbols WOFF2 (${icons.length} icons) = ${(fontBytes / 1024).toFixed(1)} KB total`
  );
}

async function syncCodeMirror() {
  await fs.mkdir(CM_DIR, { recursive: true });

  const cssChunks = [];
  for (const url of CODEMIRROR_CSS) {
    const css = await fetchText(url);
    // Strip sourceMappingURL comments so DevTools never tries to fetch missing .map files
    cssChunks.push(`/* ${path.basename(url)} */\n${css.replace(/\/\*#\s*sourceMappingURL=.*?\*\//g, '').trim()}`);
  }
  const bundledCss = cssChunks.join('\n');
  await fs.writeFile(path.join(CM_DIR, 'codemirror.bundle.min.css'), bundledCss + '\n', 'utf8');

  const jsChunks = [];
  for (const url of CODEMIRROR_JS) {
    const js = await fetchText(url);
    jsChunks.push(js.replace(/\/\/#\s*sourceMappingURL=.*$/gm, '').trim());
  }
  const bundledJs = jsChunks.join(';\n');
  await fs.writeFile(path.join(CM_DIR, 'codemirror.bundle.min.js'), bundledJs + '\n', 'utf8');

  console.log(
    `[codemirror] Bundled ${CODEMIRROR_CSS.length} CSS (${(Buffer.byteLength(bundledCss) / 1024).toFixed(1)} KB) + ${CODEMIRROR_JS.length} JS (${(Buffer.byteLength(bundledJs) / 1024).toFixed(1)} KB)`
  );
}

async function syncStandalone() {
  await fs.mkdir(BS_DIR, { recursive: true });
  for (const asset of STANDALONE_ASSETS) {
    let text = await fetchText(asset.url);
    // Strip sourceMappingURL references so browser DevTools stays clean
    text = text
      .replace(/\/\*#\s*sourceMappingURL=.*?\*\//g, '')
      .replace(/\/\/#\s*sourceMappingURL=.*$/gm, '');
    await fs.writeFile(asset.dest, text, 'utf8');
    console.log(`[vendor] ${path.relative(ROOT_DIR, asset.dest)} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
  }
}

async function main() {
  await fs.mkdir(VENDOR_DIR, { recursive: true });
  await Promise.all([syncFonts(), syncCodeMirror(), syncStandalone()]);
  console.log('All vendor assets synced successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
