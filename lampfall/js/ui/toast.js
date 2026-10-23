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
 *
 * Toasts never cover the dialogue box: the stack lives between `top` (36, under the HUD's
 * top-right column) and `bottom` (height - 84, above a bottom-docked textbox; scenes with a
 * different layout call `setBottom(textbox.rect.y - 4)`). A slip that would cross `bottom` waits
 * in the queue, and each slip is capped at three lines (`…` marks the cut), so one long message
 * can never grow over the box either.
 *
 * Given `G` (or `{bus}`), the queue subscribes to the bus event `'toast'` with a string or
 * `{text, icon, ms, kind}` payload; `destroy()` unsubscribes.
 * @module ui/toast
 */
import { drawText, measureText, wrapText } from '../core/font.js';
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

/** Lines a single slip may show before its text is cut with `…`. */
export const TOAST_MAX_LINES = 3;
/** Vertical gap between stacked slips. */
const STACK_GAP = 3;

/**
 * Wrap `text` to `maxW` and cap it at `maxLines`, ending the last kept line with `…` (trimmed until
 * it fits). Pure.
 * @param {string} text @param {number} maxW @param {number} [maxLines=TOAST_MAX_LINES]
 * @returns {string[]}
 */
export function clampLines(text, maxW, maxLines = TOAST_MAX_LINES) {
  const lines = wrapText(text, maxW);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1].replace(/\s+$/, '');
  while (last.length && measureText(last + '…').w > maxW) last = Array.from(last).slice(0, -1).join('').replace(/\s+$/, '');
  kept[maxLines - 1] = last + '…';
  return kept;
}

/**
 * @param {{width?: number, height?: number, ms?: number, max?: number, maxWidth?: number, top?: number, bottom?: number,
 *   display?: {width?: number, height?: number}, bus?: {on: (evt: string, fn: Function) => (() => void)|void}}} [opts]
 * @returns {Toasts}
 */
export function createToasts(opts = {}) {
  // Accepts plain options or the game context G (architecture signature `createToasts(G)`).
  const width = opts.width || (opts.display && opts.display.width) || 480;
  const height = opts.height || (opts.display && opts.display.height) || 270;
  const defaultMs = opts.ms || TIMING.toastMs;
  const max = opts.max || 3;
  const maxTextW = opts.maxWidth || 176;
  // First slip sits under the HUD's top-right column (wallet + pending-Shift badge end at y=32).
  let top = opts.top === undefined ? 36 : opts.top;
  // Last pixel row a slip may use: above a bottom-docked textbox (y = height - 84 by default).
  let bottom = opts.bottom === undefined ? height - 84 : opts.bottom;
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
    const lines = clampLines(str, maxTextW);
    const m = measureText(lines.join('\n'));
    const iconW = icon ? 10 : kind !== 'info' ? 7 : 0;
    const t = {
      id: nextId++, text: str, icon, kind, total: ms, left: ms, age: 0,
      w: m.w + iconW + SPACE.md + 4, h: Math.max(14, m.h + 6), lines,
    };
    queue.push(t);
    promote();
    return t.id;
  }

  /** Height the live stack uses (slips + gaps). */
  function stackH() {
    let h = 0;
    for (const t of live) h += t.h + STACK_GAP;
    return h;
  }

  /** Move waiting slips onto the stack while they fit under `max` and above `bottom`. */
  function promote() {
    while (queue.length && live.length < max) {
      const next = queue[0];
      const fits = live.length === 0 || top + stackH() + next.h <= bottom;
      if (!fits) break;
      live.push(queue.shift());
    }
  }

  /** @param {number} dt */
  function update(dt) {
    for (const t of live) { t.age += dt; t.left -= dt; }
    for (let i = live.length - 1; i >= 0; i--) if (live[i].left <= 0) live.splice(i, 1);
    promote();
  }

  const off = opts.bus && typeof opts.bus.on === 'function'
    ? opts.bus.on('toast', (p) => {
      if (p && typeof p === 'object') show(p.text, p);
      else show(String(p ?? ''));
    })
    : null;

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
      drawText(ctx, t.lines.join('\n'), tx, ty, { color: KIND_INK[t.kind] });
      // lifetime tick: a thin ledger rule that shortens, so a toast's remaining time is visible
      if (t.total !== Infinity) {
        const frac = Math.max(0, t.left / t.total);
        ctx.fillStyle = COLORS.paper.rule;
        ctx.fillRect(x + 3, y + t.h - 3, Math.round((t.w - 6) * frac), 1);
      }
      ctx.restore();
      y += t.h + STACK_GAP;
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
    get bottom() { return bottom; },
    /** Move the stack (e.g. 4 on screens without a HUD). @param {number} y */
    setTop(y) { top = Math.max(0, y | 0); },
    /** Lowest row slips may reach (e.g. `textbox.rect.y - 4`). @param {number} y */
    setBottom(y) { bottom = Math.max(top + 14, y | 0); },
    /** Live slip rectangles, top to bottom (layout checks; ignores the slide-in offset). */
    rects() {
      let y = top;
      return live.map((t) => { const r = { x: width - SPACE.sm - t.w, y, w: t.w, h: t.h }; y += t.h + STACK_GAP; return r; });
    },
    destroy() { if (typeof off === 'function') off(); },
    texts: () => [...live, ...queue].map((t) => t.text),
    clear() { live.length = 0; queue.length = 0; },
    dismiss(id) {
      const li = live.findIndex((t) => t.id === id);
      if (li >= 0) { live.splice(li, 1); promote(); return true; }
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
 * @property {number} bottom
 * @property {(y: number) => void} setTop
 * @property {(y: number) => void} setBottom
 * @property {() => {x: number, y: number, w: number, h: number}[]} rects
 * @property {() => void} destroy
 * @property {() => string[]} texts
 * @property {() => void} clear
 * @property {(id: number) => boolean} dismiss
 */
