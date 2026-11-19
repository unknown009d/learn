/**
 * The DEV mastery badge for DevSec (see ORDER in trail-format.js). The artwork lives in assets/badge.svg
 * (drawn in grey, #6E6D7A). It is inlined rather than used as an <img>, with that grey swapped
 * for currentColor, so the surrounding CSS sets its colour: the artwork's own grey on the
 * certificate, the theme accent on the verify page. Inline SVG also survives print and the
 * PNG / JPG certificate export.
 */

import { ORDER } from '../integrity/trail-format.js';

const BADGE_SRC = './assets/badge.svg';
const ARTWORK_COLOUR = /#6E6D7A/gi; // the grey in assets/badge.svg

let markupPromise = null;

/**
 * Keep only the <svg> element and drop any <script> in it. Dev servers such as Live Server
 * inject a reload script into served SVGs, and fetched markup is never trusted to run code.
 */
function cleanSvg(text) {
  const start = text.indexOf('<svg');
  const end = text.lastIndexOf('</svg>');
  if (start < 0 || end < start) return '';
  return text.slice(start, end + '</svg>'.length).replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

/** Fetch the artwork once. Views await this before rendering the badge. */
export function loadMasteryBadge() {
  if (!markupPromise) {
    markupPromise = fetch(BADGE_SRC)
      .then((res) => (res.ok ? res.text() : ''))
      .then((svg) => cleanSvg(svg).replace(ARTWORK_COLOUR, 'currentColor'))
      .catch(() => '');
  }
  return markupPromise;
}

/**
 * @param {string} markup  result of loadMasteryBadge()
 * @param {object} rank    result of getMasteryRank()
 * @param {object} [opts]
 * @param {number} [opts.size=96]  rendered width/height in px
 * @param {string} [opts.className]
 */
export function masteryBadgeHtml(markup, rank, { size = 96, className = '' } = {}) {
  if (!rank || !markup) return '';
  const label = `Mastery badge — ${rank.fullTitle}`;
  return markup.replace(
    /<svg\b[^>]*?\swidth="[^"]*"\s+height="[^"]*"/,
    `<svg width="${size}" height="${size}" class="mastery-badge ${className}" role="img" aria-label="${label}"`
  ).replace(/(<svg\b[^>]*>)/, `$1<title>${rank.fullTitle} · ${ORDER.motto} ${ORDER.signoff}</title>`);
}
