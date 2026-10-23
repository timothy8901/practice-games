/**
 * Panel chrome. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `drawPanel(ctx, rect, style, opts)` for the five styles:
 *  - `paper`  ledger paper with a notched 1px edge in the paper's own dark hue, a 1px inner rule and
 *             a faint grain (Porchlight "keeper's desk").
 *  - `ledger` paper plus horizontal rules every 8px and a wax margin line.
 *  - `notice` lighter torn-paper slip: jagged top/bottom edge (deterministic per width), optional pin.
 *  - `card`   small paper card with a brass edge.
 *  - `dark`   Wildshift battle chrome: `n` fill, 1px `v` border, inner `d` line.
 * Bodies are rendered once per (style, w, h, torn) into an offscreen canvas and blitted afterwards,
 * with a second cached canvas for the drop shadow so it follows notches and tears exactly. The
 * optional title tab and wax seal are drawn live on top (they carry text).
 *
 * Pure helpers: `panelInner()` (content rect for a style), `tearDepth()` (the torn edge profile).
 * Importing this module touches no DOM; caches are created on first draw.
 * @module ui/panel
 */
import { drawText, measureText } from '../core/font.js';
import { makePattern } from '../core/pixelart.js';
import { COLORS, SPACE, TYPE } from './theme.js';
import { drawSeal, drawIcon } from './icons.js';

/** @type {ReadonlyArray<PanelStyle>} */
export const PANEL_STYLES = Object.freeze(['paper', 'ledger', 'notice', 'card', 'dark']);

/** @typedef {'paper'|'ledger'|'notice'|'card'|'dark'} PanelStyle */

/**
 * @typedef {Object} PanelOptions
 * @property {string} [title]                 Title tab text (top-left).
 * @property {'paper'|'wax'|'dark'} [titleStyle] Tab material (default: wax for notice, paper otherwise, dark for dark).
 * @property {string} [titleColor]            Override the tab fill (speaker key colour).
 * @property {boolean} [seal]                 Wax seal on the top-right corner.
 * @property {'top'|'bottom'|'both'|'none'} [torn] Torn edges for `notice` (default both).
 * @property {boolean} [pin]                  Brass pin at the top centre (notice).
 * @property {number} [rulePitch=10]       Ledger: distance between rules (match the row height).
 * @property {number} [ruleStart]           Ledger: y of the first rule from the panel top (default 14,
 *                                          under the first text line at the inner top).
 * @property {number} [margin=10]           Ledger: x of the wax margin line from the panel left (0 = none).
 * @property {boolean} [shadow=true]
 * @property {boolean} [grain=true]
 * @property {number} [alpha]
 */

/** Padding from the panel edge to its content, per style. */
const PADDING = Object.freeze({ paper: 6, ledger: 6, notice: 5, card: 4, dark: 5 });

/**
 * Content rectangle inside a panel.
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {PanelStyle} [style='paper']
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function panelInner(rect, style = 'paper') {
  const p = PADDING[style] ?? 6;
  return { x: rect.x + p, y: rect.y + p, w: Math.max(0, rect.w - p * 2), h: Math.max(0, rect.h - p * 2) };
}

/**
 * Deterministic tear depth (0..2 px) for column `x` of a torn edge. A tiny hash so the same
 * notice never flickers between frames and two widths tear differently.
 * @param {number} x
 * @param {number} [salt=0]
 * @returns {number}
 */
export function tearDepth(x, salt = 0) {
  let h = (x * 2654435761 + salt * 40503 + 12345) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  const v = h & 7; // 0..7
  return v < 3 ? 0 : v < 6 ? 1 : 2;
}

// ---- caches -------------------------------------------------------------------------------------
/** @type {Map<string, {body: any, shadow: any}>} */
const cache = new Map();
const CACHE_MAX = 96;
let grainPattern = null;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return null;
}

/** Drop every cached body (tests, theme hot-swap). */
export function clearPanelCache() {
  cache.clear();
  grainPattern = null;
}

/** @returns {number} */
export function panelCacheSize() {
  return cache.size;
}

const GRAIN_TILE = [
  '........',
  '..g.....',
  '......g.',
  '........',
  '.g......',
  '....g...',
  '........',
  '.......g',
];

function grain(ctx) {
  if (!grainPattern) grainPattern = makePattern(GRAIN_TILE, { g: COLORS.paper.grain, '.': null }, ctx);
  return grainPattern;
}

/**
 * Fill a 1px frame with notched (empty) corners.
 * @param {CanvasRenderingContext2D} c
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {string} color
 */
export function drawNotchedFrame(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x + 1, y, w - 2, 1);
  c.fillRect(x + 1, y + h - 1, w - 2, 1);
  c.fillRect(x, y + 1, 1, h - 2);
  c.fillRect(x + w - 1, y + 1, 1, h - 2);
}

/**
 * Render a panel body at (0,0) into `c`.
 * @param {CanvasRenderingContext2D} c
 * @param {number} w @param {number} h
 * @param {PanelStyle} style
 * @param {'top'|'bottom'|'both'|'none'} torn
 * @param {boolean} useGrain
 */
function paintBody(c, w, h, style, torn, useGrain, lg) {
  const P = COLORS.paper;
  if (style === 'dark') {
    c.fillStyle = COLORS.dark.fill;
    c.fillRect(1, 1, w - 2, h - 2);
    drawNotchedFrame(c, 0, 0, w, h, COLORS.dark.border);
    if (w > 12 && h > 12) {
      c.fillStyle = COLORS.dark.inner;
      c.fillRect(2, 2, w - 4, 1); c.fillRect(2, h - 3, w - 4, 1); c.fillRect(2, 2, 1, h - 4); c.fillRect(w - 3, 2, 1, h - 4);
    }
    return;
  }
  if (style === 'notice') {
    const top = torn === 'top' || torn === 'both';
    const bottom = torn === 'bottom' || torn === 'both';
    c.fillStyle = P.light;
    c.fillRect(0, 0, w, h);
    if (useGrain) { c.fillStyle = grain(c); c.fillRect(0, 0, w, h); }
    // straight sides, soft
    c.fillStyle = P.deep;
    c.fillRect(0, 0, 1, h); c.fillRect(w - 1, 0, 1, h);
    if (!top) c.fillRect(0, 0, w, 1);
    if (!bottom) c.fillRect(0, h - 1, w, 1);
    for (let x = 0; x < w; x++) {
      if (top) {
        const d = x === 0 || x === w - 1 ? 1 : tearDepth(x, w);
        if (d > 0) c.clearRect(x, 0, 1, d);
        c.fillStyle = P.deep; c.fillRect(x, d, 1, 1);
        c.fillStyle = P.shade; c.fillRect(x, d + 1, 1, 1);
      }
      if (bottom) {
        const d = x === 0 || x === w - 1 ? 1 : tearDepth(x + 97, w * 3 + 1);
        if (d > 0) c.clearRect(x, h - d, 1, d);
        c.fillStyle = P.deep; c.fillRect(x, h - d - 1, 1, 1);
      }
    }
    return;
  }
  // paper / ledger / card
  c.fillStyle = P.fill;
  c.fillRect(1, 1, w - 2, h - 2);
  if (useGrain && style !== 'card') { c.fillStyle = grain(c); c.fillRect(1, 1, w - 2, h - 2); }
  drawNotchedFrame(c, 0, 0, w, h, style === 'card' ? COLORS.brass.dark : P.edge);
  if (style === 'card') {
    c.fillStyle = COLORS.brass.fill;
    c.fillRect(1, 1, w - 2, 1); c.fillRect(1, 1, 1, h - 2); // brass highlight on the lit edges
  }
  if (w > 16 && h > 16) {
    c.fillStyle = P.rule;
    c.fillRect(2, 2, w - 4, 1); c.fillRect(2, h - 3, w - 4, 1); c.fillRect(2, 2, 1, h - 4); c.fillRect(w - 3, 2, 1, h - 4);
  }
  if (style === 'ledger') {
    const pitch = Math.max(4, lg.pitch | 0);
    c.fillStyle = P.rule;
    for (let y = lg.start; y < h - 4; y += pitch) c.fillRect(3, y, w - 6, 1);
    if (lg.margin > 0) {
      c.fillStyle = COLORS.wax.light;
      c.fillRect(lg.margin, 3, 1, h - 6);
    }
  }
}

function cached(ctx, w, h, style, torn, useGrain, lg) {
  const key = `${style}|${w}|${h}|${torn}|${useGrain ? 1 : 0}|${style === 'ledger' ? `${lg.pitch},${lg.start},${lg.margin}` : ''}`;
  let entry = cache.get(key);
  if (entry) return entry;
  const body = makeCanvas(w, h);
  if (!body) return null;
  const bc = body.getContext('2d');
  bc.imageSmoothingEnabled = false;
  paintBody(bc, w, h, style, torn, useGrain, lg);
  const shadow = makeCanvas(w, h);
  const sc = shadow.getContext('2d');
  sc.drawImage(body, 0, 0);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = COLORS.shadow;
  sc.fillRect(0, 0, w, h);
  entry = { body, shadow };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, entry);
  return entry;
}

/**
 * Draw a panel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {PanelStyle} [style='paper']
 * @param {PanelOptions} [opts]
 * @returns {{x: number, y: number, w: number, h: number}} The content rect (`panelInner`).
 */
export function drawPanel(ctx, rect, style = 'paper', opts) {
  const o = opts || {};
  if (!PANEL_STYLES.includes(style)) throw new RangeError(`drawPanel: unknown style ${JSON.stringify(style)}`);
  const x = Math.round(rect.x), y = Math.round(rect.y);
  const w = Math.max(4, Math.round(rect.w)), h = Math.max(4, Math.round(rect.h));
  const torn = style === 'notice' ? (o.torn || 'both') : 'none';
  const useGrain = o.grain !== false;
  const lg = { pitch: o.rulePitch || TYPE.lineH, start: o.ruleStart === undefined ? PADDING.ledger + 8 : o.ruleStart, margin: o.margin === undefined ? 10 : o.margin };
  const entry = cached(ctx, w, h, style, torn, useGrain, lg);
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  if (entry) {
    if (o.shadow !== false) ctx.drawImage(entry.shadow, x + 1, y + 2);
    ctx.drawImage(entry.body, x, y);
  } else {
    // No canvas factory (fake context): paint straight through, untranslated caches aside.
    ctx.save(); ctx.translate(x, y); paintBody(ctx, w, h, style, torn, useGrain, lg); ctx.restore();
  }
  if (o.pin) drawIcon(ctx, 'pin', x + Math.floor(w / 2) - 4, y - 3);
  if (o.title) drawTitleTab(ctx, x, y, w, style, o);
  if (o.seal) drawSeal(ctx, x + w - 9, y - 4);
  ctx.globalAlpha = prevAlpha;
  return panelInner({ x, y, w, h }, style);
}

/**
 * Title tab across the top-left edge. Wax tabs carry light text; paper tabs carry ink.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w
 * @param {PanelStyle} style
 * @param {PanelOptions} o
 */
function drawTitleTab(ctx, x, y, w, style, o) {
  const text = String(o.title);
  const tw = measureText(text).w;
  const tabW = Math.min(w - 12, tw + SPACE.md);
  const tabH = TYPE.capH + 4;
  const tx = x + 6, ty = y - tabH + 2;
  const material = o.titleStyle || (style === 'dark' ? 'dark' : style === 'notice' ? 'wax' : 'paper');
  let fill, ink, edge;
  if (material === 'wax') { fill = o.titleColor || COLORS.wax.fill; ink = COLORS.wax.text; edge = COLORS.wax.dark; }
  else if (material === 'dark') { fill = o.titleColor || COLORS.dark.fill; ink = COLORS.dark.text; edge = COLORS.dark.border; }
  else { fill = o.titleColor || COLORS.paper.shade; ink = COLORS.paper.ink; edge = COLORS.paper.edge; }
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(tx + 1, ty + 1, tabW, tabH - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(tx + 1, ty + 1, tabW - 2, tabH - 1);
  drawNotchedFrame(ctx, tx, ty, tabW, tabH, edge);
  if (material === 'paper') {
    // merge the tab into the panel: open its bottom edge
    ctx.fillStyle = fill;
    ctx.fillRect(tx + 1, ty + tabH - 1, tabW - 2, 2);
  } else if (material === 'wax') {
    ctx.fillStyle = COLORS.wax.light; // a lit top edge like pressed wax
    ctx.fillRect(tx + 2, ty + 1, tabW - 4, 1);
  }
  drawText(ctx, text, tx + SPACE.sm, ty + 2, { color: ink, maxWidth: tabW - SPACE.md });
}

/**
 * A 1px ledger rule across a panel (separators between sections).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w
 * @param {{dark?: boolean, dotted?: boolean}} [o]
 */
export function drawRule(ctx, x, y, w, o) {
  const dark = !!(o && o.dark);
  ctx.fillStyle = dark ? COLORS.dark.inner : COLORS.paper.rule;
  if (o && o.dotted) {
    for (let i = 0; i < w; i += 2) ctx.fillRect(Math.round(x) + i, Math.round(y), 1, 1);
  } else {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
  }
}

/**
 * Dim the screen beneath a modal (confirm, pause). Alpha fill of night ink.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [w] @param {number} [h]
 */
export function drawDim(ctx, w, h) {
  const W = w || (ctx.canvas && ctx.canvas.width) || 480;
  const H = h || (ctx.canvas && ctx.canvas.height) || 270;
  ctx.fillStyle = COLORS.dim;
  ctx.fillRect(0, 0, W, H);
}
