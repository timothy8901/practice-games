/**
 * Small drawing primitives. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * Bars, pips, badges, type chips, currency, tally sticks and device glyphs. Every readout here
 * carries its meaning in shape, texture or words, never colour alone:
 *  - `drawBar` gives each kind its own fill texture (hp solid, exp dotted, glow hatched, bond
 *    checked) and an HP bar changes texture as it drops (hatch at <=50 %, checker at <=20 %) in
 *    addition to its colour; `showNumber` prints the exact value.
 *  - `drawPips` draws spent pips hollow and unknown rows as `?`.
 *  - `drawBadge` pairs each state with an icon and a word (`Ward ?`, `EMPTY`, `EVA +2` …).
 *  - `drawTypeChip` = unique icon + 3-letter code (+ the word on request).
 * Pure helpers (`formatNumber`, `barFill`, `hpBand`) are unit-testable. No DOM at import time.
 * @module ui/widgets
 */
import { drawText, measureText } from '../core/font.js';
import { makePattern } from '../core/pixelart.js';
import { COLORS, PALETTE, TYPE, TYPE_CHIPS, STRINGS, ROLE_GLYPH } from './theme.js';
import { drawIcon, drawSeal } from './icons.js';
import { drawNotchedFrame } from './panel.js';

/**
 * Thousands separators, no locale dependency.
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  const v = Math.trunc(Number(n) || 0);
  const s = String(Math.abs(v));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const fromEnd = s.length - i;
    out += s[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += ',';
  }
  return (v < 0 ? '-' : '') + out;
}

/**
 * Fill width in pixels for a value, never showing an empty bar for a non-zero value.
 * @param {number} value @param {number} max @param {number} innerW
 * @returns {number}
 */
export function barFill(value, max, innerW) {
  if (!(max > 0) || !(innerW > 0)) return 0;
  const t = Math.min(1, Math.max(0, value / max));
  if (t <= 0) return 0;
  return Math.max(1, Math.round(t * innerW));
}

/**
 * HP band: 'full' > 50 %, 'low' <= 50 %, 'crit' <= 20 %.
 * @param {number} value @param {number} max
 * @returns {'full'|'low'|'crit'}
 */
export function hpBand(value, max) {
  const t = max > 0 ? value / max : 0;
  return t <= 0.2 ? 'crit' : t <= 0.5 ? 'low' : 'full';
}

// ---- textures (2px/4px tiles, transparent + shade) -----------------------------------------------
const TEXTURES = Object.freeze({
  dots: ['s.', '..'],
  hatch: ['s...', '.s..', '..s.', '...s'],
  checker: ['s.', '.s'],
  solid: null,
});
/** @type {Map<string, CanvasPattern>} */
const textureCache = new Map();

function texture(ctx, name, color) {
  const rows = TEXTURES[name];
  if (!rows) return null;
  const key = `${name}|${color}`;
  let p = textureCache.get(key);
  if (!p) {
    p = makePattern(rows, { s: color, '.': null }, ctx);
    textureCache.set(key, p);
  }
  return p;
}

/** Fill texture per bar kind (and per HP band). */
export const BAR_TEXTURE = Object.freeze({ hp: 'solid', hpLow: 'hatch', hpCrit: 'checker', exp: 'dots', glow: 'hatch', bond: 'checker' });

/**
 * @typedef {Object} BarOptions
 * @property {number} x @property {number} y @property {number} w @property {number} [h=6]
 * @property {number} value @property {number} max
 * @property {'hp'|'exp'|'glow'|'bond'} kind
 * @property {boolean} [showNumber]  Print `value/max` right of the bar.
 * @property {string} [label]        Short label inside the track's left end ('HP', 'EXP').
 * @property {boolean} [dark]        Draw on a dark panel.
 * @property {string} [color]        Override the fill colour.
 */

/**
 * Draw a bar. Returns the total width used (bar + number).
 * @param {CanvasRenderingContext2D} ctx
 * @param {BarOptions} o
 * @returns {number}
 */
export function drawBar(ctx, o) {
  const x = Math.round(o.x), y = Math.round(o.y), w = Math.max(6, Math.round(o.w)), h = Math.max(4, Math.round(o.h || 6));
  const dark = !!o.dark;
  const kind = o.kind || 'hp';
  const value = Number(o.value) || 0, max = Number(o.max) || 0;
  const band = kind === 'hp' ? hpBand(value, max) : 'full';
  let fill = o.color || COLORS.bar[kind] || COLORS.bar.hp;
  let tex = BAR_TEXTURE[kind] || 'solid';
  if (kind === 'hp' && band === 'low') { fill = o.color || COLORS.bar.hpLow; tex = BAR_TEXTURE.hpLow; }
  if (kind === 'hp' && band === 'crit') { fill = o.color || COLORS.bar.hpCrit; tex = BAR_TEXTURE.hpCrit; }
  // frame + track
  ctx.fillStyle = dark ? COLORS.dark.border : COLORS.paper.ink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = dark ? COLORS.bar.trackDark : COLORS.bar.track;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // fill
  const fw = barFill(value, max, w - 2);
  if (fw > 0) {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, fw, h - 2);
    const shade = dark ? COLORS.dark.inner : COLORS.paper.ink;
    const pat = texture(ctx, tex, shade);
    if (pat) {
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = pat;
      ctx.fillRect(x + 1, y + 1, fw, h - 2);
      ctx.restore();
    }
    // 1px lit top edge so the fill reads as a solid bar even at 4px tall
    ctx.fillStyle = dark ? COLORS.dark.text : COLORS.paper.light;
    ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillRect(x + 1, y + 1, fw, 1); ctx.restore();
  }
  // tick marks every 25 % on hp/exp so length is readable without colour
  if (w >= 24 && h >= 5) {
    ctx.fillStyle = dark ? COLORS.dark.border : COLORS.paper.ink;
    for (let q = 1; q < 4; q++) {
      const tx = x + 1 + Math.round(((w - 2) * q) / 4);
      ctx.fillRect(tx, y + h - 2, 1, 1);
    }
  }
  let used = w;
  if (o.label) {
    drawText(ctx, o.label, x + 2, y + Math.floor((h - 5) / 2), { font: 'small', color: dark ? COLORS.dark.text : COLORS.paper.ink });
  }
  if (o.showNumber) {
    const txt = `${formatNumber(value)}/${formatNumber(max)}`;
    const m = drawText(ctx, txt, x + w + 3, y + Math.floor((h - 5) / 2), {
      font: 'small', color: dark ? COLORS.dark.text : COLORS.paper.ink,
    });
    used = w + 3 + m.w;
  }
  return used;
}

/**
 * @typedef {Object} PipOptions
 * @property {number} x @property {number} y
 * @property {number} n     Filled pips.
 * @property {number} max   Total pips.
 * @property {number} [size=4] @property {number} [gap=2]
 * @property {boolean} [unknown]  Draw `?` instead (foe Mends before the Prism).
 * @property {string} [label]     Word before the pips ('Mends').
 * @property {boolean} [dark]
 * @property {string} [color]
 */

/**
 * Pip row: filled pips solid with a light corner, spent pips hollow. Returns the width used.
 * @param {CanvasRenderingContext2D} ctx
 * @param {PipOptions} o
 * @returns {number}
 */
export function drawPips(ctx, o) {
  const size = o.size || 4, gap = o.gap === undefined ? 2 : o.gap;
  const dark = !!o.dark;
  const ink = dark ? COLORS.dark.text : COLORS.paper.ink;
  let x = Math.round(o.x);
  const y = Math.round(o.y);
  if (o.label) {
    x += drawText(ctx, o.label, x, y + Math.max(0, Math.floor((size - 5) / 2)), { font: 'small', color: dark ? COLORS.dark.textSoft : COLORS.paper.inkSoft }).w + 3;
  }
  if (o.unknown) {
    const m = drawText(ctx, '?', x, y - 1, { color: ink });
    return x + m.w - Math.round(o.x);
  }
  const fill = o.color || (dark ? COLORS.dark.text : COLORS.paper.ink);
  for (let i = 0; i < o.max; i++) {
    const px = x + i * (size + gap);
    if (i < o.n) {
      ctx.fillStyle = fill;
      ctx.fillRect(px, y, size, size);
      ctx.fillStyle = dark ? COLORS.dark.fill : COLORS.paper.light;
      ctx.fillRect(px, y, 1, 1);
    } else {
      ctx.fillStyle = dark ? COLORS.dark.textSoft : COLORS.paper.inkFaint;
      ctx.fillRect(px, y, size, 1); ctx.fillRect(px, y + size - 1, size, 1);
      ctx.fillRect(px, y, 1, size); ctx.fillRect(px + size - 1, y, 1, size);
    }
  }
  return x + o.max * (size + gap) - gap - Math.round(o.x);
}

/** Alias kept for the architecture's name. */
export const drawPipRow = drawPips;

/** Badge styles: each pairs an icon with a word. */
export const BADGE_STYLES = Object.freeze({
  ward: { icon: 'ward', fill: PALETTE.n, ink: PALETTE.w, edge: PALETTE.v },
  wardKnown: { icon: 'wardKnown', fill: PALETTE.n, ink: PALETTE.i, edge: PALETTE.i },
  status: { icon: null, fill: PALETTE.d, ink: PALETTE.w, edge: PALETTE.v },
  eva: { icon: null, glyph: '▲', fill: PALETTE.d, ink: PALETTE.o, edge: PALETTE.o },
  unique: { icon: null, glyph: ROLE_GLYPH.unique, fill: COLORS.paper.fill, ink: COLORS.paper.ink, edge: PALETTE.y },
  empty: { icon: 'strike', fill: PALETTE.e, ink: PALETTE.w, edge: PALETTE.e },
  lock: { icon: 'lock', fill: PALETTE.e, ink: PALETTE.w, edge: PALETTE.e },
  info: { icon: null, fill: COLORS.paper.shade, ink: COLORS.paper.ink, edge: COLORS.paper.edge },
  danger: { icon: 'cross', fill: COLORS.paper.light, ink: PALETTE.r, edge: PALETTE.r },
  safe: { icon: 'check', fill: COLORS.paper.light, ink: COLORS.paper.ink, edge: PALETTE.g },
  shift: { icon: 'shift', fill: COLORS.paper.light, ink: COLORS.paper.ink, edge: PALETTE.m },
});

/**
 * Draw a badge (chip with icon/glyph + word). Returns its rect.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x @param {number} y
 * @param {{style?: keyof typeof BADGE_STYLES, icon?: string, iconAccent?: string, small?: boolean}} [o]
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function drawBadge(ctx, text, x, y, o) {
  const opt = o || {};
  const st = BADGE_STYLES[opt.style || 'info'] || BADGE_STYLES.info;
  const icon = opt.icon !== undefined ? opt.icon : st.icon;
  const small = !!opt.small;
  const font = small ? 'small' : 'main';
  const tw = measureText(text, { font }).w;
  const glyphW = icon ? 9 : st.glyph ? 6 : 0;
  const w = 2 + glyphW + tw + 3 + (glyphW ? 1 : 0);
  const h = small ? 9 : 11;
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = st.fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawNotchedFrame(ctx, x, y, w, h, st.edge);
  let cx = x + 2;
  if (icon) {
    drawIcon(ctx, icon, cx, y + Math.floor((h - 8) / 2), { ink: st.ink, accent: opt.iconAccent, light: st.ink === PALETTE.w ? PALETTE.v : COLORS.paper.light });
    cx += 10;
  } else if (st.glyph) {
    drawText(ctx, st.glyph, cx, y + (small ? 1 : 2), { color: st.ink });
    cx += 7;
  }
  drawText(ctx, text, cx, y + (small ? 2 : 2), { font, color: st.ink });
  return { x, y, w, h };
}

/**
 * Type chip: icon + 3-letter code on the type's colour, with its ink picked for contrast.
 * `word: true` appends the full word after the chip in the surface ink.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type  Type id (`'brine'`) — unknown ids draw `???`.
 * @param {number} x @param {number} y
 * @param {{word?: boolean, dark?: boolean}} [o]
 * @returns {number} Width used.
 */
export function drawTypeChip(ctx, type, x, y, o) {
  const opt = o || {};
  const chip = TYPE_CHIPS[type];
  x = Math.round(x); y = Math.round(y);
  const code = chip ? chip.code : STRINGS.unknown;
  const fill = chip ? chip.color : PALETTE.e;
  const ink = chip ? chip.ink : PALETTE.w;
  const edge = opt.dark ? PALETTE.k : COLORS.paper.ink;
  const codeW = measureText(code, { font: 'small' }).w;
  const w = 2 + 8 + 2 + codeW + 3;
  const h = 11;
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawNotchedFrame(ctx, x, y, w, h, edge);
  drawIcon(ctx, chip ? chip.icon : 'cross', x + 2, y + 1, { ink, accent: ink === PALETTE.w ? PALETTE.v : PALETTE.o, light: ink === PALETTE.w ? PALETTE.v : COLORS.paper.light });
  drawText(ctx, code, x + 12, y + 3, { font: 'small', color: ink });
  let used = w;
  if (opt.word) {
    const m = drawText(ctx, chip ? chip.word : STRINGS.unknown, x + w + 3, y + 2, { color: opt.dark ? COLORS.dark.text : COLORS.paper.ink });
    used = w + 3 + m.w;
  }
  return used;
}

/**
 * Currency readout `◉ 1,240`. Returns the width used.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} amount
 * @param {number} x @param {number} y
 * @param {{align?: 'left'|'right', dark?: boolean, color?: string, prefix?: string}} [o]
 * @returns {number}
 */
export function drawCurrency(ctx, amount, x, y, o) {
  const opt = o || {};
  const num = (opt.prefix || '') + formatNumber(amount);
  const nw = measureText(num).w;
  const total = 7 + 2 + nw;
  let sx = Math.round(x);
  if (opt.align === 'right') sx -= total;
  const brass = COLORS.brass.fill;
  drawText(ctx, TYPE.currency, sx, y, { color: brass, shadow: { color: COLORS.brass.dark, dx: 0, dy: 1 } });
  drawText(ctx, num, sx + 9, y, { color: opt.color || (opt.dark ? COLORS.dark.text : COLORS.paper.ink) });
  return total;
}

/**
 * Tally stick: a wood bar with one notch per paid unit; every fifth notch is crossed.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, notches: number, total: number, step?: number, label?: boolean}} o
 * @returns {number} Width used.
 */
export function drawTally(ctx, o) {
  const step = o.step || 4;
  const x = Math.round(o.x), y = Math.round(o.y);
  const w = o.total * step + 4, h = 7;
  ctx.fillStyle = COLORS.tally.dark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.tally.light;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = COLORS.paper.light;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  for (let i = 0; i < o.total; i++) {
    const nx = x + 2 + i * step + 1;
    if (i < o.notches) {
      ctx.fillStyle = COLORS.tally.dark;
      ctx.fillRect(nx, y + 1, 1, h - 2);
      if ((i + 1) % 5 === 0) { // cross-stroke through the group of five
        ctx.fillRect(nx - step * 4, y + 3, step * 4 + 1, 1);
      }
    } else {
      ctx.fillStyle = COLORS.tally.dark;
      ctx.fillRect(nx, y + h - 3, 1, 1);
    }
  }
  let used = w;
  if (o.label !== false) {
    const m = drawText(ctx, `${o.notches}/${o.total}`, x + w + 3, y + 1, { font: 'small', color: COLORS.paper.ink });
    used = w + 3 + m.w;
  }
  return used;
}

/**
 * Width `drawKeyGlyph` will use, without drawing (for laying out chips around it).
 * @param {'keyboard'|'gamepad'|'touch'} device
 * @param {string} label
 * @returns {number}
 */
export function keyGlyphWidth(device, label) {
  const tw = measureText(String(label), { font: 'small' }).w;
  if (device === 'touch') return 9 + tw;
  return Math.max(9, tw + 6);
}

/**
 * Device glyph: a key cap, a face button or a tap mark with its label. Returns the width used.
 * @param {CanvasRenderingContext2D} ctx
 * @param {'keyboard'|'gamepad'|'touch'} device
 * @param {string} label
 * @param {number} x @param {number} y
 * @param {{dark?: boolean}} [o]
 * @returns {number}
 */
export function drawKeyGlyph(ctx, device, label, x, y, o) {
  const dark = !!(o && o.dark);
  x = Math.round(x); y = Math.round(y);
  const ink = dark ? COLORS.dark.text : COLORS.paper.ink;
  const capFill = dark ? COLORS.dark.inner : COLORS.paper.light;
  const txt = String(label);
  const tw = measureText(txt, { font: 'small' }).w;
  if (device === 'gamepad') {
    const w = Math.max(9, tw + 6);
    ctx.fillStyle = ink;
    ctx.fillRect(x + 1, y, w - 2, 9); ctx.fillRect(x, y + 1, w, 7);
    ctx.fillStyle = capFill;
    ctx.fillRect(x + 1, y + 1, w - 2, 7);
    ctx.fillStyle = dark ? COLORS.dark.border : COLORS.paper.rule;
    ctx.fillRect(x + 1, y + 7, w - 2, 1);
    drawText(ctx, txt, x + Math.floor((w - tw) / 2), y + 2, { font: 'small', color: ink });
    return w;
  }
  if (device === 'touch') {
    drawIcon(ctx, 'tap', x, y, { ink, accent: COLORS.wax.fill, light: capFill });
    const m = drawText(ctx, txt, x + 9, y + 2, { font: 'small', color: ink });
    return 9 + m.w;
  }
  const w = Math.max(9, tw + 6);
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = capFill;
  ctx.fillRect(x + 1, y + 1, w - 2, 6);
  ctx.fillStyle = dark ? COLORS.dark.border : COLORS.paper.rule;
  ctx.fillRect(x + 1, y + 7, w - 2, 1);
  drawText(ctx, txt, x + Math.floor((w - tw) / 2), y + 2, { font: 'small', color: ink });
  return w;
}

/**
 * Wax-seal button: seal + label on a paper strip. Returns its rect so a focus model can hit it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x @param {number} y
 * @param {{focused?: boolean, role?: 'safe'|'danger'|'neutral', dark?: boolean, w?: number}} [o]
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function drawSealButton(ctx, text, x, y, o) {
  const opt = o || {};
  x = Math.round(x); y = Math.round(y);
  const tw = measureText(text).w;
  const w = opt.w || tw + 20;
  const h = 13;
  const role = opt.role || 'neutral';
  const ink = role === 'danger' ? PALETTE.r : COLORS.paper.ink;
  // Focused: raised a pixel on a deeper shadow, light paper, ink frame. Resting: flat, shaded paper,
  // a soft rule edge. (The focus model adds the cursor; the difference never rests on colour alone.)
  const lift = opt.focused ? 1 : 0;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x + 1, y + 1, w, h);
  if (opt.focused) ctx.fillRect(x + 1, y + h, w, 1);
  y -= lift;
  ctx.fillStyle = opt.focused ? COLORS.paper.light : COLORS.paper.shade;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawNotchedFrame(ctx, x, y, w, h, opt.focused ? COLORS.paper.ink : COLORS.paper.rule);
  if (opt.focused) { ctx.fillStyle = COLORS.paper.shade; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); }
  // The seal is stamped with the role's symbol (check = safe, cross = destructive), so the role
  // never rests on the seal's colour alone.
  const seal = role === 'safe' ? { fill: PALETTE.g, light: PALETTE.l, ink: PALETTE.t, emblem: 'check' }
    : role === 'danger' ? { emblem: 'cross' }
      : { fill: COLORS.brass.fill, light: COLORS.brass.light, ink: COLORS.brass.dark, emblem: 'plus' };
  drawSeal(ctx, x + 1, y + 1, seal);
  drawText(ctx, text, x + 15, y + 3, { color: ink });
  return { x, y: y + lift, w, h };
}

/** Ward shimmer timing (wildshift-visuals §13.3): 6 frames x 8 f = 800 ms, replayed every ~4 s. */
export const WARD_SHIMMER = Object.freeze({ frames: 6, frameMs: 133, loopMs: 800, everyMs: 4000 });

/**
 * Shimmer frame for a time in ms: 0..5 while the lattice sweeps, -1 between sweeps.
 * @param {number} t
 * @returns {number}
 */
export function wardShimmerFrame(t) {
  const k = ((Number(t) || 0) % WARD_SHIMMER.everyMs + WARD_SHIMMER.everyMs) % WARD_SHIMMER.everyMs;
  return k < WARD_SHIMMER.loopMs ? Math.min(WARD_SHIMMER.frames - 1, Math.floor(k / WARD_SHIMMER.frameMs)) : -1;
}

/**
 * The Ward badge: hex glyph + `Ward ?` / `Ward: known`, with the shimmer lattice (1px w/i diagonal
 * lines) sweeping across it every ~4 s. Reduced motion draws a static lattice instead.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {{known?: boolean, t?: number, reducedMotion?: boolean, small?: boolean}} [o]
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function drawWardBadge(ctx, x, y, o) {
  const opt = o || {};
  const r = drawBadge(ctx, opt.known ? STRINGS.wardKnown : STRINGS.wardUnknown, x, y, { style: opt.known ? 'wardKnown' : 'ward', small: opt.small });
  const frame = opt.reducedMotion ? -2 : wardShimmerFrame(opt.t || 0);
  if (frame === -1) return r;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.clip();
  const span = r.w + r.h;
  const lines = frame === -2 ? [0.25, 0.55, 0.85] : [frame / (WARD_SHIMMER.frames - 1)];
  for (let li = 0; li < lines.length; li++) {
    const off = Math.round(lines[li] * span) - r.h;
    for (let k = 0; k < r.h; k++) {
      const px = r.x + off + k;
      ctx.fillStyle = (k + li) % 2 ? PALETTE.i : PALETTE.w;
      ctx.fillRect(px, r.y + r.h - 1 - k, 1, 1);
      if (frame !== -2) { ctx.fillStyle = PALETTE.i; ctx.fillRect(px - 3, r.y + r.h - 1 - k, 1, 1); }
    }
  }
  ctx.restore();
  return r;
}

/**
 * Small "n of N" or page counter in the small font, right-aligned at `x`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} rightX @param {number} y
 * @param {{dark?: boolean}} [o]
 */
export function drawCounter(ctx, text, rightX, y, o) {
  drawText(ctx, text, rightX, y, { font: 'small', align: 'right', color: o && o.dark ? COLORS.dark.textSoft : COLORS.paper.inkSoft });
}
