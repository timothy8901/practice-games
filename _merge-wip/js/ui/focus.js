/**
 * One focus model for d-pad, pointer and touch. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `createFocus(input, opts)` (architecture signature) or `createFocus({items, cols, wrap, ...})`.
 * The model owns an index into a flat list of items laid out in `cols` columns. One `handle(input)`
 * call per frame reads:
 *  - d-pad through `input.repeat()` (menu auto-repeat), confirm/cancel through `input.pressed()`;
 *  - pointer hover (moves focus to an enabled item under the pointer; the hover highlight is only
 *    drawn while the pointer is the active device, so keyboard users never see a stray hover);
 *  - two-step touch: the first tap on an unfocused item focuses it, a tap on the focused item
 *    activates. A mouse click focuses and activates in one go.
 * Disabled items are skipped by the d-pad. When a move is blocked by disabled items, or confirm
 * lands on a disabled item, the item's `reason` is shown as a tooltip for `TIMING.tooltipMs`
 * (`focus.tooltip`), so the player always learns *why*.
 *
 * Pure helpers (`navigate`, `hitTest`, `layoutIndex`) carry the maths and are unit-tested in Node.
 * Nothing here touches the DOM.
 * @module ui/focus
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, TIMING, TYPE, surfaceFor } from './theme.js';

/**
 * @typedef {Object} Rect
 * @property {number} x @property {number} y @property {number} w @property {number} h
 */

/**
 * @typedef {Object} FocusItem
 * @property {string} id
 * @property {Rect|null} [rect]       Hit rectangle in game pixels (null while scrolled out of view).
 * @property {boolean} [enabled=true]
 * @property {string} [reason]        Why it is disabled, shown as a tooltip.
 * @property {() => void} [onActivate]
 * @property {string} [group]
 */

/**
 * @typedef {Object} FocusEvent
 * @property {'move'|'activate'|'cancel'|'blocked'|'hover'} type
 * @property {FocusItem|null} item
 * @property {number} index
 * @property {number} [from]
 * @property {string} [reason]
 * @property {'keyboard'|'gamepad'|'touch'|'pointer'} device
 */

/**
 * @typedef {Object} FocusOptions
 * @property {FocusItem[]} [items]
 * @property {number} [cols=1]
 * @property {boolean} [wrap=true]
 * @property {number} [index=0]
 * @property {boolean} [horizontalPaging=false] With cols=1, left/right are left to the owner.
 * @property {(ev: FocusEvent) => void} [onChange]
 * @property {(ev: FocusEvent) => void} [onActivate]
 * @property {(ev: FocusEvent) => void} [onCancel]
 * @property {(ev: FocusEvent) => void} [onBlocked]
 * @property {import('../core/input.js').Input} [input]
 * @property {{delay?: number, rate?: number}} [repeat]
 */

const DIRS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

/**
 * @param {FocusItem|undefined|null} item
 * @returns {boolean}
 */
export function isEnabled(item) {
  return !!item && item.enabled !== false;
}

/**
 * Row/column of an index in a `cols`-wide layout.
 * @param {number} index
 * @param {number} cols
 * @returns {{row: number, col: number}}
 */
export function layoutIndex(index, cols) {
  const c = Math.max(1, cols | 0);
  return { row: Math.floor(index / c), col: index % c };
}

/**
 * First enabled index at or after `from` (then wrapping to the start); -1 when none is enabled.
 * @param {FocusItem[]} items
 * @param {number} [from=0]
 * @returns {number}
 */
export function firstEnabled(items, from = 0) {
  const n = items.length;
  for (let k = 0; k < n; k++) {
    const i = (from + k + n) % n;
    if (isEnabled(items[i])) return i;
  }
  return -1;
}

/**
 * Pure d-pad navigation with disabled skipping and optional wrapping. Vertical moves stay in the
 * column (a ragged last row clamps to its last cell); horizontal moves stay in the row. When every
 * reachable cell in that direction is disabled, the index is unchanged and `blocked` names the
 * first disabled item met so the caller can show its reason.
 *
 * @param {FocusItem[]} items
 * @param {number} index
 * @param {number} dx -1 | 0 | 1
 * @param {number} dy -1 | 0 | 1
 * @param {{cols?: number, wrap?: boolean}} [opts]
 * @returns {{index: number, moved: boolean, blocked: FocusItem|null}}
 */
export function navigate(items, index, dx, dy, opts) {
  const n = items.length;
  const cols = Math.max(1, (opts && opts.cols) | 0 || 1);
  const wrap = !opts || opts.wrap !== false;
  if (n === 0 || (dx === 0 && dy === 0)) return { index, moved: false, blocked: null };
  const start = Math.min(Math.max(0, index | 0), n - 1);
  const rows = Math.ceil(n / cols);
  const { row, col } = layoutIndex(start, cols);
  let blocked = null;

  if (dy !== 0) {
    let r = row;
    for (let k = 0; k < rows; k++) {
      r += dy;
      if (r < 0 || r >= rows) {
        if (!wrap) break;
        r = (r + rows) % rows;
      }
      const cand = Math.min(r * cols + col, n - 1);
      if (cand === start) break;
      if (isEnabled(items[cand])) return { index: cand, moved: true, blocked: null };
      if (!blocked) blocked = items[cand];
    }
    return { index: start, moved: false, blocked };
  }

  const rowStart = row * cols;
  const rowLen = Math.min(cols, n - rowStart);
  if (cols === 1) {
    // Single column: left/right belong to the owner (paging) unless the list is a single row.
    return { index: start, moved: false, blocked: null };
  }
  let c = col;
  for (let k = 0; k < rowLen; k++) {
    c += dx;
    if (c < 0 || c >= rowLen) {
      if (!wrap) break;
      c = (c + rowLen) % rowLen;
    }
    const cand = rowStart + c;
    if (cand === start) break;
    if (isEnabled(items[cand])) return { index: cand, moved: true, blocked: null };
    if (!blocked) blocked = items[cand];
  }
  return { index: start, moved: false, blocked };
}

/**
 * Index of the item whose rect contains the point, or -1.
 * @param {FocusItem[]} items
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function hitTest(items, x, y) {
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i] && items[i].rect;
    if (r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return i;
  }
  return -1;
}

/**
 * @param {import('../core/input.js').Input|FocusOptions} [a]
 * @param {FocusOptions} [b]
 * @returns {Focus}
 */
export function createFocus(a, b) {
  const looksLikeInput = a && typeof a.pressed === 'function' && typeof a.repeat === 'function';
  /** @type {FocusOptions} */
  const opts = looksLikeInput ? { ...(b || {}), input: a } : { ...(a || {}) };
  /** @type {FocusItem[]} */
  let items = Array.isArray(opts.items) ? opts.items.slice() : [];
  const cols = Math.max(1, opts.cols | 0 || 1);
  const wrap = opts.wrap !== false;
  const repeatOpts = { delay: TIMING.repeatDelayMs, rate: TIMING.repeatRateMs, ...(opts.repeat || {}) };
  let index = clampIndex(opts.index | 0);
  let pointerActive = false;
  let lastPtr = { x: NaN, y: NaN };
  let armed = -1; // touch two-step: the item that received its first tap
  /** @type {{text: string, left: number, index: number}|null} */
  let tooltip = null;
  let bob = 0;
  /** @type {'keyboard'|'gamepad'|'touch'|'pointer'} */
  let device = 'keyboard';
  const handlers = {
    change: opts.onChange || null,
    activate: opts.onActivate || null,
    cancel: opts.onCancel || null,
    blocked: opts.onBlocked || null,
  };

  function clampIndex(i) {
    if (items.length === 0) return 0;
    return Math.min(Math.max(0, i), items.length - 1);
  }

  function settle() {
    index = clampIndex(index);
    if (items.length && !isEnabled(items[index])) {
      const i = firstEnabled(items, index);
      if (i >= 0) index = i;
    }
  }

  /**
   * @param {FocusEvent['type']} type
   * @param {Partial<FocusEvent>} [extra]
   * @returns {FocusEvent}
   */
  function emit(type, extra) {
    const ev = /** @type {FocusEvent} */ ({ type, item: items[index] || null, index, device, ...(extra || {}) });
    const h = handlers[type === 'move' || type === 'hover' ? 'change' : type];
    if (h) h(ev);
    if (type === 'activate') {
      const item = ev.item;
      if (item && typeof item.onActivate === 'function') item.onActivate();
    }
    return ev;
  }

  function showReason(item, i) {
    const text = (item && item.reason) || '';
    tooltip = text ? { text, left: TIMING.tooltipMs, index: i } : null;
    return emit('blocked', { item: item || null, index: i, reason: text });
  }

  /**
   * @param {number} i
   * @param {boolean} fromPointer
   * @returns {FocusEvent|null}
   */
  function moveTo(i, fromPointer) {
    if (i === index || i < 0 || i >= items.length) return null;
    const from = index;
    index = i;
    tooltip = null;
    return emit(fromPointer ? 'hover' : 'move', { from });
  }

  /**
   * Try to activate the focused item (or `i`), honouring disabled state.
   * @param {number} [i]
   * @returns {FocusEvent|null}
   */
  function activate(i = index) {
    if (!items.length) return null;
    const item = items[i];
    if (!isEnabled(item)) return showReason(item, i);
    if (i !== index) moveTo(i, device === 'pointer' || device === 'touch');
    armed = -1;
    return emit('activate');
  }

  /**
   * Pure-ish step in a direction (used by the d-pad path and by owners that want to drive focus).
   * @param {number} dx @param {number} dy
   * @returns {FocusEvent|null}
   */
  function move(dx, dy) {
    const r = navigate(items, index, dx, dy, { cols, wrap });
    pointerActive = false;
    armed = -1;
    if (r.moved) return moveTo(r.index, false);
    if (r.blocked) return showReason(r.blocked, items.indexOf(r.blocked));
    return null;
  }

  /**
   * Pointer hover / tap at a game-space point. `kind` is 'hover', 'mouse' (click) or 'touch' (tap).
   * @param {number} x @param {number} y @param {'hover'|'mouse'|'touch'} kind
   * @returns {FocusEvent|null}
   */
  function point(x, y, kind) {
    const i = hitTest(items, x, y);
    if (kind === 'hover') {
      if (i < 0) return null;
      pointerActive = true;
      device = 'pointer';
      if (!isEnabled(items[i])) {
        if (!tooltip || tooltip.index !== i) tooltip = items[i].reason ? { text: items[i].reason, left: TIMING.tooltipMs, index: i } : null;
        return null;
      }
      return moveTo(i, true);
    }
    if (i < 0) return null;
    device = kind === 'touch' ? 'touch' : 'pointer';
    pointerActive = kind !== 'touch';
    if (!isEnabled(items[i])) return showReason(items[i], i);
    if (kind === 'touch') {
      if (i === index && armed === i) return activate(i);
      const ev = moveTo(i, true);
      armed = i;
      // Already focused but not armed: arming is silent (no onChange), the next tap activates.
      return ev || /** @type {FocusEvent} */ ({ type: 'hover', item: items[i], index: i, device });
    }
    return activate(i);
  }

  /**
   * Read one frame of input. Returns the most significant event this frame (or null).
   * @param {import('../core/input.js').Input} [input]
   * @returns {FocusEvent|null}
   */
  function handle(input = opts.input) {
    if (!input) return null;
    let ev = null;
    // d-pad
    for (const dir of Object.keys(DIRS)) {
      if (input.repeat(dir, repeatOpts)) {
        const [dx, dy] = DIRS[dir];
        if (cols === 1 && dx !== 0 && !opts.horizontalPaging) continue; // owner handles paging
        device = input.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
        const r = move(dx, dy);
        ev = r || ev;
      }
    }
    if (input.pressed('confirm')) {
      device = input.lastDevice === 'touch' ? 'touch' : input.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
      pointerActive = false;
      ev = activate() || ev;
    } else if (input.pressed('cancel')) {
      device = input.lastDevice === 'touch' ? 'touch' : input.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
      pointerActive = false;
      armed = -1;
      ev = emit('cancel') || ev;
    }
    // pointer
    const p = input.pointer;
    if (p && p.inside) {
      const isTouch = p.type === 'touch';
      // A pointer already resting on the canvas when the model starts is not a hover: the first
      // frame only records where it is, so a menu never opens with its safe default stolen.
      const primed = !Number.isNaN(lastPtr.x);
      if (p.justDown) {
        ev = point(p.x, p.y, isTouch ? 'touch' : 'mouse') || ev;
      } else if (primed && !isTouch && (p.x !== lastPtr.x || p.y !== lastPtr.y)) {
        ev = point(p.x, p.y, 'hover') || ev;
      }
      lastPtr = { x: p.x, y: p.y };
    }
    return ev;
  }

  /** @param {number} dt */
  function update(dt) {
    bob = (bob + dt) % TIMING.cursorBobMs;
    if (tooltip) {
      tooltip.left -= dt;
      if (tooltip.left <= 0) tooltip = null;
    }
  }

  /**
   * Draw the dotted focus ring + ▶ cursor around the focused item, the hover band when the pointer
   * is active, and the reason tooltip. Call after the owner has drawn its rows.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{style?: 'paper'|'dark', cursor?: boolean, ring?: boolean, band?: boolean, inset?: number}} [o]
   */
  function drawCursor(ctx, o) {
    const item = items[index];
    const opt = o || {};
    const s = surfaceFor(opt.style === 'dark' ? 'dark' : 'paper');
    if (item && item.rect) {
      const r = item.rect;
      const inset = opt.inset || 0;
      if (opt.ring !== false) drawDottedRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, s.ring);
      if (opt.cursor !== false) {
        const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
        drawText(ctx, TYPE.cursor, r.x - 7 + lift, r.y + Math.floor((r.h - TYPE.capH) / 2), { color: s.cursor });
      }
    }
    if (tooltip) drawTooltip(ctx, tooltip, items[tooltip.index], s);
  }

  /**
   * @param {FocusItem[]} next
   * @param {{keepId?: boolean}} [o] keepId (default true) re-finds the focused item by id.
   */
  function setItems(next, o) {
    const keepId = !o || o.keepId !== false;
    const prevId = items[index] && items[index].id;
    items = Array.isArray(next) ? next.slice() : [];
    if (keepId && prevId !== undefined) {
      const i = items.findIndex((it) => it && it.id === prevId);
      if (i >= 0) index = i;
    }
    settle();
    armed = -1;
    if (tooltip && tooltip.index >= items.length) tooltip = null;
  }

  settle();

  /** @type {Focus} */
  const focus = {
    get index() { return index; },
    set index(i) { index = clampIndex(i | 0); },
    get items() { return items; },
    get cols() { return cols; },
    get wrap() { return wrap; },
    get pointerActive() { return pointerActive; },
    get tooltip() { return tooltip; },
    get device() { return device; },
    get armed() { return armed; },
    get bob() { return bob; },
    setItems,
    set(i, o) {
      const target = clampIndex(i | 0);
      if (!items.length) return;
      if (isEnabled(items[target]) || (o && o.force)) {
        if (target !== index) moveTo(target, false);
      } else {
        const alt = firstEnabled(items, target);
        if (alt >= 0 && alt !== index) moveTo(alt, false);
      }
    },
    current: () => items[index] || null,
    move,
    activate,
    cancel: () => emit('cancel'),
    point,
    handle,
    update,
    drawCursor,
    clearTooltip: () => { tooltip = null; },
    on(type, fn) {
      if (!(type in handlers)) throw new RangeError(`focus.on: unknown event ${JSON.stringify(type)}`);
      handlers[type] = fn;
      return focus;
    },
  };
  return focus;
}

/**
 * @typedef {Object} Focus
 * @property {number} index
 * @property {FocusItem[]} items
 * @property {number} cols
 * @property {boolean} wrap
 * @property {boolean} pointerActive
 * @property {{text: string, left: number, index: number}|null} tooltip
 * @property {'keyboard'|'gamepad'|'touch'|'pointer'} device
 * @property {number} armed
 * @property {number} bob
 * @property {(items: FocusItem[], o?: {keepId?: boolean}) => void} setItems
 * @property {(i: number, o?: {force?: boolean}) => void} set
 * @property {() => FocusItem|null} current
 * @property {(dx: number, dy: number) => FocusEvent|null} move
 * @property {(i?: number) => FocusEvent|null} activate
 * @property {() => FocusEvent} cancel
 * @property {(x: number, y: number, kind: 'hover'|'mouse'|'touch') => FocusEvent|null} point
 * @property {(input?: import('../core/input.js').Input) => FocusEvent|null} handle
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D, o?: {style?: 'paper'|'dark', cursor?: boolean, ring?: boolean, inset?: number}) => void} drawCursor
 * @property {() => void} clearTooltip
 * @property {(type: 'change'|'activate'|'cancel'|'blocked', fn: (ev: FocusEvent) => void) => Focus} on
 */

/**
 * 1px dotted rectangle (every other pixel), crisp at 1x.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {string} color
 */
export function drawDottedRect(ctx, x, y, w, h, color) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  for (let i = 0; i < w; i += 2) {
    ctx.fillRect(x + i, y, 1, 1);
    ctx.fillRect(x + w - 1 - i, y + h - 1, 1, 1);
  }
  for (let j = 2; j < h - 1; j += 2) {
    ctx.fillRect(x, y + j, 1, 1);
    ctx.fillRect(x + w - 1, y + h - 1 - j, 1, 1);
  }
}

/**
 * The disabled-reason slip: a small torn-paper tag beside the item.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{text: string, left: number}} tip
 * @param {FocusItem|undefined} item
 * @param {ReturnType<typeof surfaceFor>} s
 */
function drawTooltip(ctx, tip, item, s) {
  const r = item && item.rect;
  const canvasW = (ctx.canvas && ctx.canvas.width) || 480;
  const canvasH = (ctx.canvas && ctx.canvas.height) || 270;
  const padX = 4;
  const text = tip.text;
  const w = Math.min(canvasW - 8, textWidth(text) + padX * 2 + 10);
  const h = 13;
  let x = r ? r.x + r.w - w : 8;
  let y = r ? r.y - h - 2 : 8;
  if (y < 2) y = r ? r.y + r.h + 2 : 2;
  x = Math.max(2, Math.min(canvasW - w - 2, x));
  y = Math.max(2, Math.min(canvasH - h - 2, y));
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x + 1, y + 1, w, h);
  ctx.fillStyle = COLORS.paper.light;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.paper.edge;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  // torn nick on the top edge
  ctx.fillStyle = COLORS.paper.light;
  ctx.fillRect(x + 3, y, 2, 1); ctx.fillRect(x + w - 6, y, 2, 1);
  drawText(ctx, '×', x + padX - 1, y + 3, { color: COLORS.role.danger });
  drawText(ctx, text, x + padX + 7, y + 3, { color: s.dark ? COLORS.paper.ink : COLORS.paper.ink });
}

function textWidth(text) {
  return measureText(text).w;
}
