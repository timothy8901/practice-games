/**
 * Toast queue. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `createToasts()` -> {show, push, update, draw, count, texts, clear, dismiss}. Toasts are
 * torn-paper slips that slide in at the top-right, stack downwards (newest at the bottom), live
 * for `TIMING.toastMs` (3 s) each and fade out. At most `max` show at once; the rest wait in the
 * queue. Nothing here reads input: toasts never block. `main.js` calls `update(ms)` and `draw(ctx)`
 * above the scene stack, and `bus.on('toast')` feeds `show`.
 *
 * `kind` pairs each toast with an icon + glyph: 'info' (•), 'safe' (check), 'warn' (!), 'danger'
 * (cross). A toast with `ms: Infinity` persists until `dismiss(id)` (the "Not saved" banner).
 * @module ui/toast
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE, ROLE_GLYPH, SPACE, TIMING } from './theme.js';
import { drawPanel } from './panel.js';
import { drawIcon, hasIcon } from './icons.js';

const KIND_ICON = Object.freeze({ info: null, safe: 'check', warn: null, danger: 'cross', shift: 'heartmark', save: 'check' });
const KIND_INK = Object.freeze({ info: COLORS.paper.ink, safe: COLORS.paper.ink, warn: PALETTE.o, danger: PALETTE.r, shift: COLORS.paper.ink, save: COLORS.paper.ink });
const KIND_ACCENT = Object.freeze({ safe: PALETTE.g, danger: PALETTE.r, warn: PALETTE.o, shift: PALETTE.m, save: PALETTE.g, info: COLORS.paper.inkSoft });

/**
 * @typedef {Object} Toast
 * @property {number} id
 * @property {string} text
 * @property {string|null} icon
 * @property {'info'|'safe'|'warn'|'danger'|'shift'|'save'} kind
 * @property {number} total  Lifetime (ms, Infinity = sticky).
 * @property {number} left   Remaining ms.
 * @property {number} age    Ms since it appeared.
 * @property {number} w @property {number} h
 * @property {string[]} lines
 */

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

/**
 * @param {{width?: number, height?: number, ms?: number, max?: number, maxWidth?: number, top?: number, display?: {width?: number}}} [opts]
 * @returns {Toasts}
 */
export function createToasts(opts = {}) {
  // Accepts plain options or the game context G (architecture signature `createToasts(G)`).
  const width = opts.width || (opts.display && opts.display.width) || 480;
  const defaultMs = opts.ms || TIMING.toastMs;
  const max = opts.max || 3;
  const maxTextW = opts.maxWidth || 176;
  // First slip sits under the HUD's top-right column (wallet + pending-Shift badge end at y=32).
  let top = opts.top === undefined ? 36 : opts.top;
  /** @type {Toast[]} live (visible) */
  const live = [];
  /** @type {Toast[]} waiting */
  const queue = [];
  let nextId = 1;

  /**
   * @param {string} text
   * @param {{icon?: string, ms?: number, kind?: Toast['kind']}} [o]
   * @returns {number} id
   */
  function show(text, o = {}) {
    const kind = o.kind && Object.prototype.hasOwnProperty.call(KIND_ICON, o.kind) ? o.kind : 'info';
    const icon = o.icon !== undefined ? (o.icon && hasIcon(o.icon) ? o.icon : null) : KIND_ICON[kind];
    const ms = o.ms === undefined ? defaultMs : o.ms;
    const str = String(text ?? '');
    const m = measureText(str, { maxWidth: maxTextW });
    const iconW = icon ? 10 : kind !== 'info' ? 7 : 0;
    const t = {
      id: nextId++, text: str, icon, kind, total: ms, left: ms, age: 0,
      w: m.w + iconW + SPACE.md + 4, h: Math.max(14, m.h + 6), lines: [],
    };
    if (live.length < max) live.push(t); else queue.push(t);
    return t.id;
  }

  /** @param {number} dt */
  function update(dt) {
    for (const t of live) { t.age += dt; t.left -= dt; }
    for (let i = live.length - 1; i >= 0; i--) if (live[i].left <= 0) live.splice(i, 1);
    while (live.length < max && queue.length) live.push(queue.shift());
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (!live.length) return;
    let y = top;
    for (const t of live) {
      const slide = easeOut(Math.min(1, t.age / TIMING.toastSlideMs));
      const fadeIn = Math.min(1, t.age / 120);
      const fadeOut = t.total === Infinity ? 1 : Math.min(1, t.left / TIMING.toastFadeMs);
      const x = width - SPACE.sm - t.w + Math.round((1 - slide) * 24);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
      const inner = drawPanel(ctx, { x, y, w: t.w, h: t.h }, 'notice', { torn: 'both', grain: false });
      let tx = inner.x;
      const ty = inner.y - 1;
      if (t.icon) { drawIcon(ctx, t.icon, tx, ty, { ink: KIND_ACCENT[t.kind], accent: KIND_ACCENT[t.kind] }); tx += 10; }
      else if (t.kind !== 'info') { drawText(ctx, ROLE_GLYPH[t.kind === 'save' ? 'safe' : t.kind] || '•', tx, ty, { color: KIND_ACCENT[t.kind] }); tx += 7; }
      drawText(ctx, t.text, tx, ty, { color: KIND_INK[t.kind], maxWidth: maxTextW });
      // lifetime tick: a thin ledger rule that shortens, so a toast's remaining time is visible
      if (t.total !== Infinity) {
        const frac = Math.max(0, t.left / t.total);
        ctx.fillStyle = COLORS.paper.rule;
        ctx.fillRect(x + 3, y + t.h - 3, Math.round((t.w - 6) * frac), 1);
      }
      ctx.restore();
      y += t.h + 3;
    }
  }

  /** @type {Toasts} */
  const api = {
    show,
    push: show,
    update,
    draw,
    get count() { return live.length + queue.length; },
    get visible() { return live.length; },
    get top() { return top; },
    /** Move the stack (e.g. 4 on screens without a HUD). @param {number} y */
    setTop(y) { top = Math.max(0, y | 0); },
    texts: () => [...live, ...queue].map((t) => t.text),
    clear() { live.length = 0; queue.length = 0; },
    dismiss(id) {
      const li = live.findIndex((t) => t.id === id);
      if (li >= 0) { live.splice(li, 1); return true; }
      const qi = queue.findIndex((t) => t.id === id);
      if (qi >= 0) { queue.splice(qi, 1); return true; }
      return false;
    },
  };
  return api;
}

/**
 * @typedef {Object} Toasts
 * @property {(text: string, opts?: {icon?: string, ms?: number, kind?: Toast['kind']}) => number} show
 * @property {(text: string, opts?: {icon?: string, ms?: number, kind?: Toast['kind']}) => number} push  Alias of `show` (main.js shim name).
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 * @property {number} count
 * @property {number} visible
 * @property {number} top
 * @property {(y: number) => void} setTop
 * @property {() => string[]} texts
 * @property {() => void} clear
 * @property {(id: number) => boolean} dismiss
 */
