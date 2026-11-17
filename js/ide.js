/**
 * Mobile-Friendly Multi-Tab IDE, Emmet Expander, Telemetry & Sandboxed Preview Runner
 * Executes student code inside <iframe sandbox="allow-scripts allow-modals">
 */

import { savePracticalProgress } from './db.js';

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const CSS_ABBREVIATIONS = {
  df: 'display: flex;',
  db: 'display: block;',
  dib: 'display: inline-block;',
  dn: 'display: none;',
  jcc: 'justify-content: center;',
  jcsb: 'justify-content: space-between;',
  aic: 'align-items: center;',
  tac: 'text-align: center;',
  bsbb: 'box-sizing: border-box;',
  c: 'color: #0e7a3a;',
  bg: 'background-color: lightyellow;',
  fz: 'font-size: 16px;',
  ff: 'font-family: Arial, sans-serif;',
  bd: 'border: 2px solid #0e7a3a;',
  br: 'border-radius: 12px;'
};

/**
 * Lightweight, reliable Emmet expander for HTML & CSS (works offline and on mobile).
 */
export function expandEmmetExpression(abbr, mode = 'html') {
  const token = (abbr || '').trim();
  if (!token) return null;

  if (mode === 'css') {
    if (CSS_ABBREVIATIONS[token]) return CSS_ABBREVIATIONS[token];
    const numMatch = token.match(/^([pm])([trblxy]?)(\d+)(p?)$/);
    if (numMatch) {
      const prop = numMatch[1] === 'p' ? 'padding' : 'margin';
      const dirMap = { t: '-top', r: '-right', b: '-bottom', l: '-left', '': '' };
      const unit = numMatch[4] === 'p' ? '%' : 'px';
      if (numMatch[2] === 'x') return `${prop}: 0 ${numMatch[3]}${unit};`;
      if (numMatch[2] === 'y') return `${prop}: ${numMatch[3]}${unit} 0;`;
      return `${prop}${dirMap[numMatch[2]] || ''}: ${numMatch[3]}${unit};`;
    }
    const whMatch = token.match(/^([wh])(\d+)(p?)$/);
    if (whMatch) {
      const prop = whMatch[1] === 'w' ? 'width' : 'height';
      const unit = whMatch[3] === 'p' ? '%' : 'px';
      return `${prop}: ${whMatch[2]}${unit};`;
    }
    return null;
  }

  // HTML5 boilerplate shortcut
  if (token === '!' || token === 'html:5') {
    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>Document</title>',
      '</head>',
      '<body>',
      '  ',
      '</body>',
      '</html>'
    ].join('\n');
  }

  // Parse simple Emmet chains with >, +, *, ., #, [], {}
  if (!/^[a-zA-Z.#\[{]/.test(token)) return null;
  if (token.includes('<') || token.includes(' ') || token.includes(';')) return null;

  function renderSingleNode(nodeSpec, indexNum = 1) {
    let rest = nodeSpec.replace(/\$/g, String(indexNum));
    let textContent = '';
    const textMatch = rest.match(/\{([^}]*)\}/);
    if (textMatch) {
      textContent = textMatch[1];
      rest = rest.replace(textMatch[0], '');
    }

    const attrs = [];
    const attrRegex = /\[([^\]]+)\]/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rest)) !== null) {
      attrs.push(attrMatch[1]);
    }
    rest = rest.replace(attrRegex, '');

    let mult = 1;
    const multMatch = rest.match(/\*(\d+)$/);
    if (multMatch) {
      mult = Math.min(20, Math.max(1, parseInt(multMatch[1], 10)));
      rest = rest.slice(0, -multMatch[0].length);
    }

    const parts = rest.split(/(?=[.#])/);
    let tag = 'div';
    const classes = [];
    let id = '';

    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('.')) classes.push(part.slice(1));
      else if (part.startsWith('#')) id = part.slice(1);
      else tag = part.toLowerCase();
    }

    if (!/^[a-z][a-z0-9:-]*$/i.test(tag)) return null;

    // Default helpful attributes for common tags
    if (tag === 'a' && !attrs.some((a) => a.startsWith('href'))) attrs.push('href="#"');
    if (tag === 'img' && !attrs.some((a) => a.startsWith('src'))) attrs.push('src=""', 'alt=""');
    if (tag === 'input' && !attrs.some((a) => a.startsWith('type'))) attrs.push('type="text"');
    if (tag === 'form' && !attrs.some((a) => a.startsWith('action'))) attrs.push('action=""');

    const attrParts = [];
    if (id) attrParts.push(`id="${id}"`);
    if (classes.length) attrParts.push(`class="${classes.join(' ')}"`);
    for (const a of attrs) {
      if (a.includes('=')) {
        const [k, ...v] = a.split('=');
        const val = v.join('=').replace(/^["']|["']$/g, '');
        attrParts.push(`${k}="${val}"`);
      } else {
        attrParts.push(a);
      }
    }

    const open = attrParts.length ? `<${tag} ${attrParts.join(' ')}>` : `<${tag}>`;
    if (VOID_TAGS.has(tag)) {
      return Array.from({ length: mult }, () => open);
    }
    return Array.from({ length: mult }, (_, idx) => {
      const content = textContent || (mult > 1 ? `Item ${idx + 1}` : '');
      return `${open}${content}</${tag}>`;
    });
  }

  function buildChain(expr) {
    const childSplit = expr.split('>');
    if (childSplit.length === 1) {
      const siblings = expr.split('+');
      const out = [];
      for (const sib of siblings) {
        const rendered = renderSingleNode(sib);
        if (!rendered) return null;
        out.push(...rendered);
      }
      return out.join('\n');
    }

    const parentExpr = childSplit[0];
    const restExpr = childSplit.slice(1).join('>');
    const inner = buildChain(restExpr);
    if (!inner) return null;

    // Handle parent siblings like h2+ul>li*3
    const parentSibs = parentExpr.split('+');
    const resultLines = [];
    for (let i = 0; i < parentSibs.length; i++) {
      const isLast = i === parentSibs.length - 1;
      if (!isLast) {
        const rendered = renderSingleNode(parentSibs[i]);
        if (!rendered) return null;
        resultLines.push(...rendered);
      } else {
        const lastSpec = parentSibs[i];
        const multMatch = lastSpec.match(/\*(\d+)$/);
        const count = multMatch ? Math.min(10, parseInt(multMatch[1], 10)) : 1;
        const cleanParent = multMatch ? lastSpec.slice(0, -multMatch[0].length) : lastSpec;
        const parentRendered = renderSingleNode(cleanParent);
        if (!parentRendered || !parentRendered[0].includes('</')) return null;

        const closeIdx = parentRendered[0].lastIndexOf('</');
        const openTag = parentRendered[0].slice(0, closeIdx);
        const closeTag = parentRendered[0].slice(closeIdx);
        const indentedInner = inner.split('\n').map((l) => `  ${l}`).join('\n');
        for (let k = 0; k < count; k++) {
          resultLines.push(`${openTag}\n${indentedInner}\n${closeTag}`);
        }
      }
    }
    return resultLines.join('\n');
  }

  return buildChain(token);
}

/**
 * In-iframe assertion runner (defined as a real JS function so regexes are syntax-checked).
 */
function __verifyLabInIframe(__meta) {
  const results = [];
  function check(name, pass, detail) {
    results.push({ name, pass: Boolean(pass), detail: detail || '' });
  }

  try {
    const id = __meta.labId;
    if (id === 1) {
      const h1 = document.querySelector('h1');
      const h1Text = h1 ? h1.textContent.trim() : '';
      const h1Ok = h1Text.length >= 2;
      check('Main Heading (<h1>)', h1Ok, h1Ok ? 'Found: "' + h1Text.slice(0, 40) + '"' : 'Almost there! Check step 1: add an <h1> heading with your name or page title.');
      const p = document.querySelector('p');
      const pText = p ? p.textContent.trim() : '';
      const pOk = pText.length >= 10;
      check('Introductory Paragraph (<p>)', pOk, pOk ? 'Found a ' + pText.length + '-character paragraph.' : 'Almost there! Check step 2: write a <p> paragraph with at least a short sentence (10+ characters) introducing yourself.');
      const img = document.querySelector('img');
      const imgSrc = img ? (img.getAttribute('src') || '').trim() : '';
      const imgAlt = img ? (img.getAttribute('alt') || '').trim() : '';
      check('Image with src & alt (<img>)', Boolean(img && imgSrc.length > 0 && imgAlt.length > 0), (img && imgSrc.length > 0 && imgAlt.length > 0) ? 'Image includes both src and alt description.' : 'Almost there! Check step 3: make sure your <img> tag includes both a src image link and an alt description.');
      const link = Array.from(document.querySelectorAll('a')).find((a) => (a.getAttribute('href') || '').trim().length > 0 && a.textContent.trim().length > 0);
      check('Clickable Link (<a href="...">)', Boolean(link), link ? 'Clickable link found: ' + link.getAttribute('href') : 'Almost there! Check step 4: add a clickable <a href="https://..."> link with visible text inside it.');
    } else if (id === 2) {
      const form = document.querySelector('form');
      check('Form Container (<form>)', Boolean(form), form ? 'Form uses method="' + (form.getAttribute('method') || 'get') + '".' : 'Almost there! Check step 1: wrap all your form fields inside a <form>...</form> tag.');
      const inputs = form ? Array.from(form.querySelectorAll('input')).filter((i) => !['submit', 'reset', 'button'].includes((i.type || '').toLowerCase())) : [];
      check('At Least 3 Input Fields', inputs.length >= 3, inputs.length >= 3 ? 'Found ' + inputs.length + ' input field(s).' : 'Almost there! Check step 2: add at least 3 <input> fields (such as Name, Email, and Password).');
      const labels = form ? form.querySelectorAll('label') : [];
      check('Clear Field Labels (<label>)', labels.length >= 1, labels.length >= 1 ? 'Found ' + labels.length + ' field label(s).' : 'Almost there! Check step 2: add <label> tags so visitors know what each field is for.');
      const choices = form ? form.querySelectorAll('input[type="radio"], input[type="checkbox"], select') : [];
      check('Choice Control (Radio / Checkbox / Select)', choices.length >= 1, choices.length >= 1 ? 'Found ' + choices.length + ' choice control(s).' : 'Almost there! Check step 3: include at least one radio button, checkbox, or <select> dropdown.');
      const submit = form ? form.querySelector('input[type="submit"], button[type="submit"], button:not([type="button"]):not([type="reset"])') : null;
      check('Submit Button', Boolean(submit), submit ? 'Submit button is ready.' : 'Almost there! Check step 4: add a submit button (<input type="submit"> or <button type="submit">) inside your form.');
    } else if (id === 3) {
      const table = document.querySelector('table');
      const rows = table ? table.querySelectorAll('tr') : [];
      const cells = table ? table.querySelectorAll('th, td') : [];
      check('Table with Rows & Cells', Boolean(table && rows.length >= 2 && cells.length >= 3), (table && rows.length >= 2 && cells.length >= 3) ? ('Found ' + rows.length + ' rows and ' + cells.length + ' cells.') : 'Almost there! Check step 1: create a <table> with at least 2 rows (<tr>) and table cells (<th> or <td>).');
      const merged = table ? table.querySelectorAll('[colspan], [rowspan]') : [];
      check('Merged Cell (colspan or rowspan)', merged.length >= 1, merged.length ? 'Found ' + merged.length + ' merged cell(s).' : 'Almost there! Check step 2: merge at least one table cell using colspan="..." or rowspan="...".');
      const outerList = document.querySelector('ul, ol');
      const items = outerList ? outerList.querySelectorAll(':scope > li') : [];
      check('Outer List (<ul> or <ol>) with 2+ Items', Boolean(outerList && items.length >= 2), (outerList && items.length >= 2) ? ('Found ' + items.length + ' top-level list items.') : 'Almost there! Check step 3: create an outer list (<ul> or <ol>) with at least 2 list items (<li>).');
      const nested = document.querySelector('li > ul, li > ol');
      check('Nested List Inside a List Item', Boolean(nested), nested ? 'Nested list placed cleanly inside an <li>.' : 'Almost there! Check step 4: place your inner <ul> or <ol> directly inside one of the outer <li> items.');
    } else if (id === 4) {
      const styleRegex = /<style[\s>][\s\S]*?<\/style>/i;
      const hasInternalStyle = styleRegex.test(__meta.htmlCode);
      const matchBody = __meta.htmlCode.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const internalCssBody = (matchBody ? matchBody[1] : '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
      check('Page Styles Inside <style>', hasInternalStyle && internalCssBody.length > 5, (hasInternalStyle && internalCssBody.length > 5) ? 'Style rules found inside <style>.' : 'Almost there! Check step 1: add a <style>...</style> block inside the HTML tab with at least one CSS rule.');
      const extClean = __meta.cssCode.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      check('Rules in style.css Tab', extClean.length > 8, extClean.length > 8 ? 'Rules detected in style.css.' : 'Almost there! Check step 2: switch to the style.css tab and write at least one CSS rule there.');
      const hasClassOrIdRule = /(\.[a-zA-Z_-]|#[a-zA-Z_-])/.test(__meta.cssCode + internalCssBody);
      check('Uses Class (.) or ID (#) Selector', hasClassOrIdRule, hasClassOrIdRule ? 'Class or ID selector found.' : 'Almost there! Check step 2: use a class selector (like .highlight) or an ID selector (like #title) in your CSS.');
      const styledEl = Array.from(document.querySelectorAll('h1, h2, p, div, body')).some((el) => {
        const cs = getComputedStyle(el);
        return cs.color !== 'rgb(0, 0, 0)' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || parseFloat(cs.paddingTop) > 0;
      });
      check('Visual Styles Applied on Page', styledEl, styledEl ? 'Custom colors or spacing appear on the page.' : 'Almost there! Check step 3: make sure your CSS changes the color, background, or padding of an element on the page.');
    } else if (id === 5) {
      const form = document.querySelector('form');
      const pwdInput = form ? form.querySelector('input[type="password"], input[id*="pass" i], input[name*="pass" i]') : null;
      const allInputs = form ? form.querySelectorAll('input') : [];
      check('Form with Name, Email & Password Fields', Boolean(form && allInputs.length >= 3 && pwdInput), (form && allInputs.length >= 3 && pwdInput) ? 'Found all form inputs.' : 'Almost there! Check step 1: make sure your <form> has Name, Email, and Password inputs plus a submit button.');
      const hasTryCatch = /\btry\s*\{[\s\S]*?\}\s*catch\s*\(/.test(__meta.jsCode);
      check('Uses try...catch Error Checking', hasTryCatch, hasTryCatch ? 'try...catch block found in app.js.' : 'Almost there! Check step 3: use a try { ... } catch (error) { ... } block in app.js to check the form inputs.');

      const origAlert = window.alert;
      const alerts = [];
      window.alert = (m) => alerts.push(String(m));

      let emptyPrevented = false;
      let invalidFeedback = '';
      let validFeedback = '';

      if (form) {
        const textInputs = Array.from(form.querySelectorAll('input')).filter((i) => !['submit', 'reset', 'button'].includes((i.type || '').toLowerCase()));
        textInputs.forEach((i) => { i.value = ''; });
        const evt1 = new Event('submit', { bubbles: true, cancelable: true });
        const notCanceled = form.dispatchEvent(evt1);
        emptyPrevented = !notCanceled || evt1.defaultPrevented;
        invalidFeedback = (document.body.innerText || '') + ' ' + alerts.join(' ');

        alerts.length = 0;
        textInputs.forEach((inp) => {
          const t = (inp.type || '').toLowerCase();
          const idName = ((inp.id || '') + (inp.name || '')).toLowerCase();
          if (t === 'email' || idName.includes('email')) inp.value = 'ananya@example.in';
          else if (t === 'password' || idName.includes('pass') || idName.includes('pwd')) inp.value = 'Secret123';
          else inp.value = 'Drubajyoti Debnath';
        });
        const evt2 = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(evt2);
        validFeedback = (document.body.innerText || '') + ' ' + alerts.join(' ');
      }
      window.alert = origAlert;

      check('Shows Helpful Message on Empty Submit', emptyPrevented && invalidFeedback.trim().length > 0, (emptyPrevented && invalidFeedback.trim().length > 0) ? 'Page stayed open and showed feedback.' : 'Almost there! Check step 2 & 4: call e.preventDefault() and show a helpful message when the form is submitted empty.');
      check('Shows Success Message When Valid', validFeedback !== invalidFeedback && validFeedback.trim().length > 0, (validFeedback !== invalidFeedback && validFeedback.trim().length > 0) ? 'Valid details produced a distinct success message.' : 'Almost there! Check step 4: when valid Name, Email (with @), and Password (6+ characters) are entered, show a success message.');
    } else if (id === 6) {
      const usesDateObj = /\bnew\s+Date\s*\(/.test(__meta.jsCode);
      check('Creates a Current Date (new Date())', usesDateObj, usesDateObj ? 'new Date() found in app.js.' : 'Almost there! Check step 2: create a date object in app.js using new Date().');
      const txt = document.body.innerText || '';
      const currentYear = String(new Date().getFullYear());
      const hasYear = txt.includes(currentYear);
      check('Displays Current Date (' + currentYear + ')', hasYear, hasYear ? 'Current year is visible on the page.' : 'Almost there! Check step 3: display today\'s date (including the 4-digit year ' + currentYear + ') on the page.');
      const hasTime = /\d{1,2}:\d{2}/.test(txt);
      check('Displays Live Time', hasTime, hasTime ? 'Formatted time appears on the page.' : 'Almost there! Check step 3: display the current time (with hours and minutes separated by ":") on the page.');
      const hasTimer = /\bset(Interval|Timeout)\s*\(/.test(__meta.jsCode);
      check('Updates Every Second', hasTimer, hasTimer ? 'Live timer found.' : 'Almost there! Check step 4: use setInterval(..., 1000) so your clock updates every second.');
    } else if (id === 7) {
      const usesInnerHtml = /\.innerHTML\b/.test(__meta.jsCode);
      check('Updates Page Content with .innerHTML', usesInnerHtml, usesInnerHtml ? '.innerHTML found in app.js.' : 'Almost there! Check step 3: use .innerHTML in app.js to update the page content with HTML tags.');
      const btn = document.querySelector('button, input[type="button"]');
      check('Clickable Button on Page', Boolean(btn), btn ? 'Button found.' : 'Almost there! Check step 1: add a <button> element on the page for the user to click.');
      const beforeHtml = document.body.innerHTML;
      if (btn) btn.click();
      const afterHtml = document.body.innerHTML;
      check('Button Click Changes the Page', Boolean(btn && afterHtml !== beforeHtml), afterHtml !== beforeHtml ? 'Page updated after clicking the button.' : 'Almost there! Check step 2 & 3: listen for a click on the button and update the page content inside your click function.');
    } else if (id === 8) {
      const divs = Array.from(document.querySelectorAll('div'));
      check('At Least Two <div> Sections', divs.length >= 2, divs.length >= 2 ? ('Found ' + divs.length + ' <div> section(s).') : 'Almost there! Check step 1: use at least two <div> blocks to organize your page sections.');
      const spans = Array.from(document.querySelectorAll('span'));
      check('Inline <span> Highlight Inside Text', spans.length >= 1, spans.length >= 1 ? ('Found ' + spans.length + ' <span> tag(s).') : 'Almost there! Check step 2: place at least one <span> tag inside a sentence to highlight a word.');
      const hasBoxModel = divs.some((d) => {
        const cs = getComputedStyle(d);
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingLeft);
        const brd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth);
        const mar = parseFloat(cs.marginTop) + parseFloat(cs.marginLeft) + parseFloat(cs.marginBottom) + parseFloat(cs.marginRight);
        return pad > 0 && brd > 0 && mar > 0;
      });
      check('Box Model Spacing (Padding, Border & Margin)', hasBoxModel, hasBoxModel ? 'Padding, border, and margin applied.' : 'Almost there! Check step 3: in style.css, give your <div> padding, a border, and margin so the Box Model is visible.');
      const inlineSpan = spans.some((s) => {
        const d = getComputedStyle(s).display;
        return d === 'inline' || d === 'inline-block';
      });
      check('<span> Stays Inline Inside Sentence', inlineSpan, inlineSpan ? '<span> flows cleanly inline.' : 'Almost there! Check step 2: keep your <span> inline so it stays on the same line as the surrounding text.');
    }
  } catch (err) {
    check('Code Run Check', false, 'There was a problem running your code: ' + err.message);
  }

  const passedAssertions = results.filter((r) => r.pass).length;
  window.parent.postMessage({
    type: 'LAB_VERIFY_RESULT',
    runToken: window.__RUN_TOKEN || '',
    labId: __meta.labId,
    results,
    passedAssertions,
    totalAssertions: results.length,
    snapshot: document.body ? document.body.innerHTML : ''
  }, '*');
}

/**
 * Generates the automated assertion script injected inside the sandboxed iframe for Labs 1-8.
 */
function getLabVerificationScript(labId, rawHtml, rawCss, rawJs) {
  const safeMeta = JSON.stringify({
    labId: Number(labId),
    htmlCode: rawHtml,
    cssCode: rawCss,
    jsCode: rawJs
  }).replace(/<\/script/gi, '<\\/script');

  return `(${__verifyLabInIframe.toString()})(${safeMeta});`;
}

export function composeSrcDoc(htmlCode, cssCode, jsCode, verifierScript = '', runToken = '') {
  const cleanedHtml = htmlCode || '';
  const cleanedCss = cssCode || '';
  const cleanedJs = jsCode || '';

  const bridgeScript = `
    <script>
      window.__RUN_TOKEN = ${JSON.stringify(runToken)};
      (function() {
        const sendLog = (level, args) => {
          try {
            window.parent.postMessage({
              type: 'LAB_CONSOLE_LOG',
              runToken: window.__RUN_TOKEN,
              level,
              text: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            }, '*');
          } catch (_) {}
        };
        const origLog = console.log;
        const origErr = console.error;
        console.log = function(...args) { sendLog('log', args); origLog.apply(console, args); };
        console.error = function(...args) { sendLog('error', args); origErr.apply(console, args); };
        window.addEventListener('error', function(e) {
          sendLog('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]);
        });
      })();
    <\/script>
  `;

  const externalStyleTag = `<style data-source="style.css">\n${cleanedCss}\n</style>`;
  const appScriptTag = cleanedJs.trim() ? `<script>\n${cleanedJs}\n<\/script>` : '';
  const verifyTag = verifierScript ? `<script>\n${verifierScript}\n<\/script>` : '';

  if (/<html[\s>]/i.test(cleanedHtml)) {
    let doc = cleanedHtml;
    if (/<\/head>/i.test(doc)) {
      doc = doc.replace(/<\/head>/i, () => `${externalStyleTag}\n${bridgeScript}\n</head>`);
    } else {
      doc = `${externalStyleTag}\n${bridgeScript}\n${doc}`;
    }
    if (/<\/body>/i.test(doc)) {
      doc = doc.replace(/<\/body>/i, () => `${appScriptTag}\n${verifyTag}\n</body>`);
    } else {
      doc = `${doc}\n${appScriptTag}\n${verifyTag}`;
    }
    return doc;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body { font-family: system-ui, -apple-system, sans-serif; padding: 14px; color: #171d19; }</style>
  ${externalStyleTag}
  ${bridgeScript}
</head>
<body>
${cleanedHtml}
${appScriptTag}
${verifyTag}
</body>
</html>`;
}

/**
 * Interactive IDE Controller bound to a Lab or Sandbox view
 */
export class LabIDEController {
  constructor(options) {
    this.lab = options.lab;
    this.initialState = options.initialState || {};
    this.onVerifyComplete = options.onVerifyComplete || (() => {});
    this.onTelemetryUpdate = options.onTelemetryUpdate || (() => {});
    this.onCodeChange = options.onCodeChange || null;
    this.customRunner = options.customRunner || null;
    this.onShortcutRunAdvance = options.onShortcutRunAdvance || null;
    this.onShortcutRunPreview = options.onShortcutRunPreview || null;
    this.onShortcutReset = options.onShortcutReset || null;
    this.onShortcutSave = options.onShortcutSave || null;
    this.onShortcutToggleSidebar = options.onShortcutToggleSidebar || null;
    this.isBonus = Boolean(options.isBonus);

    this.activeTab = options.initialTab || 'html';
    this.changeTimeout = null;
    this.code = {
      html: this.initialState.htmlCode ?? this.lab.starterHtml ?? '',
      css: this.initialState.cssCode ?? this.lab.starterCss ?? '',
      js: this.initialState.jsCode ?? this.lab.starterJs ?? ''
    };
    this.telemetry = {
      activeTypingSeconds: Number(this.initialState.activeTypingSeconds || 0),
      pasteCount: Number(this.initialState.pasteCount || 0)
    };

    this.editors = {};
    this.fallbacks = {};
    this.lastTypeTs = 0;
    this.typingInterval = null;
    this.saveTimeout = null;
    this.messageListener = null;
    this.activeRunToken = null;
    this.verifyTimeout = null;
  }

  getCurrentThemeName() {
    return document.documentElement.getAttribute('data-theme') === 'm3-dark'
      ? 'material-darker'
      : 'eclipse';
  }

  mount(containers) {
    this.containers = containers;
    this.initEditors();
    this.bindSymbolBar();
    this.startTelemetryLoop();
    this.bindPostMessageListener();
    this.switchTab(this.activeTab);
    this.runPreviewOnly();
  }

  initEditors() {
    const tabSpecs = [
      { key: 'html', mode: 'htmlmixed', el: this.containers.htmlEl },
      { key: 'css', mode: 'css', el: this.containers.cssEl },
      { key: 'js', mode: 'javascript', el: this.containers.jsEl }
    ];

    const hasCodeMirror = typeof window.CodeMirror === 'function';

    for (const spec of tabSpecs) {
      if (!spec.el) continue;

      if (hasCodeMirror) {
        const textarea = document.createElement('textarea');
        textarea.value = this.code[spec.key];
        spec.el.innerHTML = '';
        spec.el.appendChild(textarea);

        const cm = window.CodeMirror.fromTextArea(textarea, {
          mode: spec.mode,
          theme: this.getCurrentThemeName(),
          lineNumbers: true,
          lineWrapping: true,
          tabSize: 2,
          indentUnit: 2,
          autoCloseTags: spec.key === 'html',
          autoCloseBrackets: true,
          matchBrackets: true,
          matchTags: spec.key === 'html' ? { bothTags: true } : false,
          styleActiveLine: true,
          hintOptions: {
            completeSingle: false
          },
          extraKeys: {
            'Ctrl-Space': (instance) => {
              this.triggerAutocomplete(instance, spec.key, true);
            },
            'Ctrl-Enter': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutRunAdvance) this.onShortcutRunAdvance(this);
            },
            'Cmd-Enter': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutRunAdvance) this.onShortcutRunAdvance(this);
            },
            'Alt-R': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutRunPreview) this.onShortcutRunPreview(this);
            },
            'Ctrl-Shift-R': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutRunPreview) this.onShortcutRunPreview(this);
            },
            'Cmd-Shift-R': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutRunPreview) this.onShortcutRunPreview(this);
            },
            'Alt-Backspace': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutReset) this.onShortcutReset(this);
            },
            'Ctrl-Shift-X': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutReset) this.onShortcutReset(this);
            },
            'Cmd-Shift-X': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutReset) this.onShortcutReset(this);
            },
            'Ctrl-B': () => {
              if (this.onShortcutToggleSidebar) this.onShortcutToggleSidebar();
            },
            'Cmd-B': () => {
              if (this.onShortcutToggleSidebar) this.onShortcutToggleSidebar();
            },
            'Ctrl-S': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutSave) this.onShortcutSave(this);
            },
            'Cmd-S': (instance) => {
              this.code[spec.key] = instance.getValue();
              if (this.onShortcutSave) this.onShortcutSave(this);
            },
            Tab: (instance) => {
              if (instance.somethingSelected()) {
                instance.indentSelection('add');
                return;
              }
              if (this.tryExpandEmmetInCodeMirror(instance, spec.key)) {
                return;
              }
              instance.replaceSelection('  ', 'end');
            }
          }
        });

        // Disable mobile browser interference
        const inputField = cm.getInputField();
        if (inputField) {
          inputField.setAttribute('autocorrect', 'off');
          inputField.setAttribute('autocapitalize', 'off');
          inputField.setAttribute('autocomplete', 'off');
          inputField.setAttribute('spellcheck', 'false');
        }

        // Contextual autocomplete on <, tag attributes, CSS props, and JS dot/identifiers
        cm.on('inputRead', (instance, changeObj) => {
          if (!changeObj || changeObj.origin !== '+input') return;
          const typed = (changeObj.text || []).join('');
          if (!typed) return;

          if (spec.key === 'html') {
            const cur = instance.getCursor();
            const lineBefore = instance.getLine(cur.line).slice(0, cur.ch);
            const insideTag = /<[^>]*$/.test(lineBefore);
            if (typed === '<' || (insideTag && /[a-zA-Z\s-]/.test(typed))) {
              this.triggerAutocomplete(instance, 'html', false);
            }
          } else if (spec.key === 'css') {
            const cur = instance.getCursor();
            const lineBefore = instance.getLine(cur.line).slice(0, cur.ch);
            if (/[:\s{][a-zA-Z-]{2,}$/.test(lineBefore)) {
              this.triggerAutocomplete(instance, 'css', false);
            }
          } else if (spec.key === 'js') {
            if (typed === '.' || /[a-zA-Z]{2,}/.test(this.getWordBeforeCursor(instance))) {
              this.triggerAutocomplete(instance, 'js', false);
            }
          }
        });

        cm.on('change', (_instance, changeObj) => {
          this.code[spec.key] = cm.getValue();
          if (changeObj.origin !== 'setValue') {
            if (changeObj.origin === 'paste') {
              this.recordPaste();
            } else {
              this.markTyping();
            }
            this.scheduleSave();
            this.scheduleCodeChange();
          }
        });

        this.editors[spec.key] = cm;
      } else {
        // Offline Fallback Plain Textarea
        const ta = document.createElement('textarea');
        ta.className = 'ide-fallback-textarea';
        ta.value = this.code[spec.key];
        ta.setAttribute('autocorrect', 'off');
        ta.setAttribute('autocapitalize', 'off');
        ta.setAttribute('autocomplete', 'off');
        ta.setAttribute('spellcheck', 'false');

        ta.addEventListener('keydown', (e) => {
          const mod = e.ctrlKey || e.metaKey;
          const lower = e.key.toLowerCase();
          if (mod && !e.altKey && !e.shiftKey && lower === 'b') {
            e.preventDefault();
            e.stopPropagation();
            if (this.onShortcutToggleSidebar) this.onShortcutToggleSidebar();
            return;
          }
          if ((e.altKey && !mod && !e.shiftKey && lower === 'r') || (mod && e.shiftKey && !e.altKey && lower === 'r')) {
            e.preventDefault();
            e.stopPropagation();
            this.code[spec.key] = ta.value;
            if (this.onShortcutRunPreview) this.onShortcutRunPreview(this);
            return;
          }
          if ((e.altKey && !mod && !e.shiftKey && e.key === 'Backspace') || (mod && e.shiftKey && !e.altKey && lower === 'x')) {
            e.preventDefault();
            e.stopPropagation();
            this.code[spec.key] = ta.value;
            if (this.onShortcutReset) this.onShortcutReset(this);
            return;
          }
          if (mod && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this.code[spec.key] = ta.value;
            if (this.onShortcutRunAdvance) this.onShortcutRunAdvance(this);
            return;
          }
          if (mod && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            this.code[spec.key] = ta.value;
            if (this.onShortcutSave) this.onShortcutSave(this);
            return;
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            if (!this.tryExpandEmmetInTextarea(ta, spec.key)) {
              this.insertAtTextarea(ta, '  ');
            }
            this.code[spec.key] = ta.value;
            this.markTyping();
            this.scheduleSave();
            this.scheduleCodeChange();
          }
        });
        ta.addEventListener('paste', () => {
          this.recordPaste();
        });
        ta.addEventListener('input', () => {
          this.code[spec.key] = ta.value;
          this.markTyping();
          this.scheduleSave();
          this.scheduleCodeChange();
        });

        spec.el.innerHTML = '';
        spec.el.appendChild(ta);
        this.fallbacks[spec.key] = ta;
      }
    }
  }

  getWordBeforeCursor(cm) {
    const cur = cm.getCursor();
    const line = cm.getLine(cur.line).slice(0, cur.ch);
    const m = line.match(/([a-zA-Z0-9_$-]+)$/);
    return m ? m[1] : '';
  }

  triggerAutocomplete(cm, tabKey, isManual = false) {
    if (!window.CodeMirror || typeof cm.showHint !== 'function') return;

    const HTML_TAGS = [
      'a', 'article', 'aside', 'audio', 'b', 'body', 'br', 'button', 'div', 'dl', 'dt', 'dd',
      'em', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'head', 'header', 'hr', 'html', 'iframe',
      'img', 'input', 'label', 'li', 'link', 'main', 'mark', 'meta', 'nav', 'ol', 'option',
      'p', 'pre', 'script', 'section', 'select', 'small', 'source', 'span', 'strong', 'style',
      'sub', 'sup', 'table', 'td', 'textarea', 'th', 'title', 'tr', 'u', 'ul', 'video'
    ];
    const CSS_PROPS = [
      'align-items', 'animation', 'background', 'background-color', 'border', 'border-collapse',
      'border-radius', 'bottom', 'box-sizing', 'color', 'display', 'flex', 'flex-direction',
      'flex-wrap', 'float', 'font-family', 'font-size', 'font-weight', 'gap', 'height',
      'justify-content', 'left', 'line-height', 'list-style-type', 'margin', 'max-width',
      'opacity', 'overflow', 'padding', 'position', 'right', 'text-align', 'text-decoration',
      'top', 'transform', 'transition', 'width', 'z-index'
    ];
    const JS_TOKENS = [
      'addEventListener', 'alert', 'append', 'classList', 'confirm', 'console.log', 'const',
      'createElement', 'document', 'document.getElementById', 'document.querySelector',
      'document.querySelectorAll', 'finally', 'function', 'getFullYear', 'innerHTML', 'let',
      'localStorage', 'Math.floor', 'Math.random', 'new Date()', 'preventDefault', 'prompt',
      'setInterval', 'sessionStorage', 'style', 'textContent', 'throw new Error',
      'toLocaleDateString', 'toLocaleTimeString', 'try'
    ];

    const hintFn = (instance) => {
      const CM = window.CodeMirror;
      let builtIn = null;
      if (tabKey === 'html' && CM.hint && CM.hint.html) builtIn = CM.hint.html(instance);
      else if (tabKey === 'css' && CM.hint && CM.hint.css) builtIn = CM.hint.css(instance);
      else if (tabKey === 'js' && CM.hint && CM.hint.javascript) builtIn = CM.hint.javascript(instance);

      if (builtIn && builtIn.list && builtIn.list.length > 0 && !isManual) {
        return builtIn;
      }

      const cur = instance.getCursor();
      const line = instance.getLine(cur.line);
      const before = line.slice(0, cur.ch);
      const wordMatch = before.match(/([a-zA-Z0-9_.-]*)$/);
      const prefix = (wordMatch ? wordMatch[1] : '').toLowerCase();
      const from = CM.Pos(cur.line, cur.ch - prefix.length);

      let sourceList = JS_TOKENS;
      if (tabKey === 'html') {
        const afterLt = before.match(/<([a-zA-Z0-9]*)$/);
        if (afterLt) {
          const tagPrefix = afterLt[1].toLowerCase();
          const tagMatches = HTML_TAGS.filter((t) => t.startsWith(tagPrefix));
          if (tagMatches.length) {
            return {
              list: tagMatches,
              from: CM.Pos(cur.line, cur.ch - tagPrefix.length),
              to: cur
            };
          }
        }
        sourceList = HTML_TAGS;
      } else if (tabKey === 'css') {
        sourceList = CSS_PROPS;
      }

      const combined = new Set(builtIn && builtIn.list ? builtIn.list : []);
      for (const item of sourceList) {
        if (!prefix || item.toLowerCase().startsWith(prefix)) {
          combined.add(item);
        }
      }
      const list = Array.from(combined).slice(0, 25);
      return list.length ? { list, from, to: cur } : builtIn;
    };

    cm.showHint({
      hint: hintFn,
      completeSingle: false
    });
  }

  tryExpandEmmetInCodeMirror(cm, tabKey) {
    const mode = tabKey === 'css' ? 'css' : tabKey === 'html' ? 'html' : null;
    if (!mode) return false;
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    const match = before.match(/([^\s<>;"']+)$/);
    if (!match) return false;

    let expanded = expandEmmetExpression(match[1], mode);
    if (!expanded) return false;

    const indent = (line.match(/^\s*/) || [''])[0];
    if (indent && expanded.includes('\n')) {
      expanded = expanded.replace(/\n/g, `\n${indent}`);
    }

    const from = { line: cursor.line, ch: cursor.ch - match[1].length };
    cm.replaceRange(expanded, from, cursor, 'emmet');
    return true;
  }

  tryExpandEmmetInTextarea(ta, tabKey) {
    const mode = tabKey === 'css' ? 'css' : tabKey === 'html' ? 'html' : null;
    if (!mode) return false;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineText = before.slice(lineStart);
    const match = lineText.match(/([^\s<>;"']+)$/);
    if (!match) return false;

    const expanded = expandEmmetExpression(match[1], mode);
    if (!expanded) return false;

    const start = pos - match[1].length;
    ta.value = ta.value.slice(0, start) + expanded + ta.value.slice(pos);
    ta.selectionStart = ta.selectionEnd = start + expanded.length;
    return true;
  }

  insertAtTextarea(ta, text) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
  }

  bindSymbolBar() {
    if (!this.containers.symbolBar) return;
    this.containers.symbolBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-symbol], [data-action="emmet"]');
      if (!btn) return;
      e.preventDefault();

      const cm = this.editors[this.activeTab];
      const ta = this.fallbacks[this.activeTab];

      if (btn.dataset.action === 'emmet') {
        if (cm) {
          this.tryExpandEmmetInCodeMirror(cm, this.activeTab);
          cm.focus();
        } else if (ta) {
          this.tryExpandEmmetInTextarea(ta, this.activeTab);
          this.code[this.activeTab] = ta.value;
          ta.focus();
        }
        return;
      }

      const sym = btn.dataset.symbol;
      if (cm) {
        cm.replaceSelection(sym, 'end');
        cm.focus();
      } else if (ta) {
        this.insertAtTextarea(ta, sym);
        this.code[this.activeTab] = ta.value;
        ta.focus();
      }
      this.markTyping();
      this.scheduleSave();
    });
  }

  refreshEditors() {
    Object.values(this.editors).forEach((cm) => {
      if (cm && typeof cm.refresh === 'function') {
        cm.refresh();
      }
    });
  }

  switchTab(tabKey) {
    this.activeTab = tabKey;
    const allTabs = ['html', 'css', 'js'];
    for (const k of allTabs) {
      const wrap = this.containers[`${k}Wrap`];
      const btn = this.containers[`${k}TabBtn`];
      if (wrap) wrap.classList.toggle('hidden', k !== tabKey);
      if (btn) {
        btn.classList.toggle('tab-active', k === tabKey);
        btn.classList.toggle('font-bold', k === tabKey);
      }
    }
    const cm = this.editors[tabKey];
    const ta = this.fallbacks[tabKey];
    requestAnimationFrame(() => {
      if (cm) {
        cm.refresh();
        cm.focus();
      } else if (ta) {
        ta.focus();
      }
    });
  }

  syncTheme() {
    const theme = this.getCurrentThemeName();
    Object.values(this.editors).forEach((cm) => cm.setOption('theme', theme));
  }

  markTyping() {
    this.lastTypeTs = Date.now();
  }

  recordPaste() {
    this.telemetry.pasteCount += 1;
    this.onTelemetryUpdate({ ...this.telemetry });
    this.persistDraft();
  }

  startTelemetryLoop() {
    this.typingInterval = setInterval(() => {
      if (this.lastTypeTs && Date.now() - this.lastTypeTs <= 4000) {
        this.telemetry.activeTypingSeconds += 1;
        this.onTelemetryUpdate({ ...this.telemetry });
        if (this.telemetry.activeTypingSeconds % 5 === 0) {
          this.persistDraft();
        }
      }
    }, 1000);
  }

  scheduleCodeChange() {
    if (!this.onCodeChange) return;
    clearTimeout(this.changeTimeout);
    this.changeTimeout = setTimeout(() => {
      this.onCodeChange({ ...this.code });
    }, 150);
  }

  setCode(tabKey, value) {
    this.code[tabKey] = value;
    if (this.editors[tabKey]) this.editors[tabKey].setValue(value);
    if (this.fallbacks[tabKey]) this.fallbacks[tabKey].value = value;
    this.runPreviewOnly();
  }

  scheduleSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.persistDraft(), 600);
  }

  async persistDraft() {
    if (this.isBonus) return;
    await savePracticalProgress(this.lab.id, {
      htmlCode: this.code.html,
      cssCode: this.code.css,
      jsCode: this.code.js,
      activeTypingSeconds: this.telemetry.activeTypingSeconds,
      pasteCount: this.telemetry.pasteCount
    });
  }

  resetStarterCode() {
    this.code = {
      html: this.lab.starterHtml || '',
      css: this.lab.starterCss || '',
      js: this.lab.starterJs || ''
    };
    for (const key of ['html', 'css', 'js']) {
      if (this.editors[key]) this.editors[key].setValue(this.code[key]);
      if (this.fallbacks[key]) this.fallbacks[key].value = this.code[key];
    }
    this.persistDraft();
    this.runPreviewOnly();
    if (this.onCodeChange) this.onCodeChange({ ...this.code });
  }

  runPreviewOnly() {
    if (this.customRunner) {
      this.customRunner({ ...this.code }, this.containers);
      return;
    }
    if (!this.containers.iframe) return;
    if (this.containers.consoleEl) this.containers.consoleEl.innerHTML = '';
    if (this.containers.consoleCountEl) this.containers.consoleCountEl.textContent = '0';
    const token = 'prev_' + Date.now();
    this.activeRunToken = token;
    const srcdoc = composeSrcDoc(this.code.html, this.code.css, this.code.js, '', token);
    this.containers.iframe.srcdoc = srcdoc;
  }

  runAndVerify() {
    if (!this.containers.iframe) return;
    if (this.containers.consoleEl) this.containers.consoleEl.innerHTML = '';
    if (this.containers.consoleCountEl) this.containers.consoleCountEl.textContent = '0';
    const token = 'ver_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    this.activeRunToken = token;

    clearTimeout(this.verifyTimeout);
    this.verifyTimeout = setTimeout(() => {
      this.onVerifyComplete({
        timedOut: true,
        results: [{ name: 'Execution Timeout', pass: false, detail: 'Code did not respond within 3 seconds (check for infinite loops).' }],
        passedAssertions: 0,
        totalAssertions: 1
      });
    }, 3000);

    const verifierScript = this.isBonus
      ? ''
      : getLabVerificationScript(this.lab.id, this.code.html, this.code.css, this.code.js);

    const srcdoc = composeSrcDoc(this.code.html, this.code.css, this.code.js, verifierScript, token);
    this.containers.iframe.srcdoc = srcdoc;
  }

  bindPostMessageListener() {
    this.messageListener = async (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.runToken !== this.activeRunToken) return;

      if (data.type === 'LAB_CONSOLE_LOG' && this.containers.consoleEl) {
        const line = document.createElement('div');
        line.className = data.level === 'error'
          ? 'flex items-start gap-1.5 text-xs font-mono text-error py-1 border-b border-base-300/40'
          : 'flex items-start gap-1.5 text-xs font-mono py-1 border-b border-base-300/40';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined shrink-0 mt-0.5';
        icon.style.fontSize = '15px';
        icon.textContent = data.level === 'error' ? 'error' : 'chevron_right';
        const textSpan = document.createElement('span');
        textSpan.textContent = data.text;
        line.appendChild(icon);
        line.appendChild(textSpan);
        this.containers.consoleEl.appendChild(line);

        if (this.containers.consoleCountEl) {
          this.containers.consoleCountEl.textContent = String(this.containers.consoleEl.children.length);
        }
      }

      if (data.type === 'LAB_VERIFY_RESULT') {
        clearTimeout(this.verifyTimeout);
        const allPassed = data.totalAssertions > 0 && data.passedAssertions === data.totalAssertions;

        if (!this.isBonus) {
          await savePracticalProgress(this.lab.id, {
            htmlCode: this.code.html,
            cssCode: this.code.css,
            jsCode: this.code.js,
            exactOutputSnapshot: data.snapshot || '',
            passedAssertions: data.passedAssertions,
            totalAssertions: data.totalAssertions,
            activeTypingSeconds: this.telemetry.activeTypingSeconds,
            pasteCount: this.telemetry.pasteCount,
            completed: allPassed
          });
        }

        this.onVerifyComplete({
          timedOut: false,
          allPassed,
          results: data.results || [],
          passedAssertions: data.passedAssertions || 0,
          totalAssertions: data.totalAssertions || 0,
          snapshot: data.snapshot || ''
        });
      }
    };
    window.addEventListener('message', this.messageListener);
  }

  destroy() {
    clearInterval(this.typingInterval);
    clearTimeout(this.saveTimeout);
    clearTimeout(this.changeTimeout);
    clearTimeout(this.verifyTimeout);
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }
    this.persistDraft();
  }
}
