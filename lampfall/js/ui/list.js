/**
 * Scrolling list with paging. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `createList({rect, rowH, items, render, focus, onSelect, onCancel})` -> Widget. Rows carry a
 * label, an optional right-aligned value, an optional marker glyph/icon in a fixed column and an
 * enabled flag with a reason. The focus model (`ui/focus`) drives the cursor; the list keeps the
 * focused row in view, pages with left/right (or L/R), draws a tally-wood scrollbar with
 * more-arrows and a `page/pages` counter. Disabled rows draw in the disabled grey with a `–` glyph
 * and their reason, so the state is never colour alone.
 *
 * Pure helpers (`visibleRows`, `scrollFor`, `pageOf`, `pageCount`) are unit-tested in Node.
 * @module ui/list
 */
import { drawText, measureText } from '../core/font.js';
import { createFocus } from './focus.js';
import { COLORS, ROLE_GLYPH, SPACE, TYPE, surfaceFor } from './theme.js';
import { drawIcon, hasIcon } from './icons.js';
import { drawRule } from './panel.js';

/** Height reserved under the rows for the page counter. */
export const PAGER_H = 8;
/** Width of the cursor gutter left of each row. */
export const CURSOR_W = 8;
/** Width of the scrollbar column. */
export const SCROLLBAR_W = 5;

/**
 * Rows that fit in `h` pixels.
 * @param {number} h @param {number} rowH @param {boolean} [pager=true]
 * @returns {number}
 */
export function visibleRows(h, rowH, pager = true) {
  const usable = Math.max(0, h - (pager ? PAGER_H : 0));
  return Math.max(1, Math.floor(usable / Math.max(1, rowH)));
}

/**
 * New top index that keeps `index` visible given the current `top`.
 * @param {number} top @param {number} index @param {number} visible @param {number} n
 * @returns {number}
 */
export function scrollFor(top, index, visible, n) {
  const maxTop = Math.max(0, n - visible);
  let t = Math.min(Math.max(0, top), maxTop);
  if (index < t) t = index;
  else if (index >= t + visible) t = index - visible + 1;
  return Math.min(Math.max(0, t), maxTop);
}

/**
 * @param {number} index @param {number} visible
 * @returns {number} zero-based page
 */
export function pageOf(index, visible) {
  return Math.floor(Math.max(0, index) / Math.max(1, visible));
}

/**
 * @param {number} n @param {number} visible
 * @returns {number}
 */
export function pageCount(n, visible) {
  return Math.max(1, Math.ceil(n / Math.max(1, visible)));
}

/**
 * @typedef {Object} ListItem
 * @property {string} id
 * @property {string} [label]
 * @property {string|number} [value]   Right-aligned.
 * @property {string} [marker]         Glyph (e.g. '✦', '•') or icon id drawn in the marker column.
 * @property {string} [icon]           Icon id drawn before the label.
 * @property {boolean} [enabled=true]
 * @property {string} [reason]
 * @property {any} [data]
 */

/**
 * @typedef {Object} ListOptions
 * @property {{x: number, y: number, w: number, h: number}} rect
 * @property {number} [rowH=12]
 * @property {ListItem[]} items
 * @property {(ctx: CanvasRenderingContext2D, item: ListItem, x: number, y: number, w: number, focused: boolean, rowH: number) => void} [render]
 * @property {import('./focus.js').Focus} [focus]   Share a focus model (rare); one is created otherwise.
 * @property {(item: ListItem, index: number) => void} [onSelect]
 * @property {() => void} [onCancel]
 * @property {(item: ListItem, index: number) => void} [onChange]
 * @property {'paper'|'dark'} [style='paper']
 * @property {boolean} [pager=true]
 * @property {boolean} [markers=true]  Reserve the marker column.
 * @property {boolean} [rules=true]    Dotted ledger rule under each row.
 * @property {import('../core/input.js').Input} [input]
 */

/**
 * @param {ListOptions} o
 * @returns {ListWidget}
 */
export function createList(o) {
  let rect = { ...o.rect };
  const rowH = o.rowH || 12;
  const style = o.style === 'dark' ? 'dark' : 'paper';
  const pager = o.pager !== false;
  const markers = o.markers !== false;
  const rules = o.rules !== false;
  /** @type {ListItem[]} */
  let items = [];
  /** @type {import('./focus.js').FocusItem[]} */
  let fitems = [];
  let top = 0;
  let visible = visibleRows(rect.h, rowH, pager);
  let bob = 0;

  const focus = o.focus || createFocus({ cols: 1, wrap: true, input: o.input });
  focus.on('activate', (ev) => { if (o.onSelect && ev.item) o.onSelect(items[ev.index], ev.index); });
  focus.on('cancel', () => { if (o.onCancel) o.onCancel(); });
  focus.on('change', (ev) => { keepInView(); if (o.onChange && ev.item) o.onChange(items[ev.index], ev.index); });

  function rowRect(i) {
    const sb = items.length > visible ? SCROLLBAR_W + 1 : 0;
    return { x: rect.x + CURSOR_W, y: rect.y + (i - top) * rowH, w: rect.w - CURSOR_W - sb, h: rowH };
  }

  function layout() {
    for (let i = 0; i < fitems.length; i++) {
      fitems[i].rect = i >= top && i < top + visible ? rowRect(i) : null;
    }
  }

  function keepInView() {
    const next = scrollFor(top, focus.index, visible, items.length);
    if (next !== top) top = next;
    layout();
  }

  /** @param {ListItem[]} next */
  function setItems(next) {
    items = Array.isArray(next) ? next.slice() : [];
    fitems = items.map((it) => ({ id: String(it.id), enabled: it.enabled !== false, reason: it.reason, rect: null }));
    focus.setItems(fitems);
    keepInView();
  }

  /** @param {number} dir -1 page up, +1 page down */
  function page(dir) {
    if (!items.length) return;
    const step = dir < 0 ? -1 : 1;
    const target = Math.min(items.length - 1, Math.max(0, focus.index + step * visible));
    // Land on the target or the nearest enabled row past it in the paging direction, else back.
    let pick = -1;
    for (let i = target; i >= 0 && i < items.length; i += step) if (fitems[i].enabled) { pick = i; break; }
    if (pick < 0) for (let i = target - step; i >= 0 && i < items.length; i -= step) if (fitems[i].enabled) { pick = i; break; }
    if (pick >= 0 && pick !== focus.index) focus.set(pick);
    keepInView();
  }

  /** @param {import('../core/input.js').Input} [input] */
  function handle(input = o.input) {
    if (!input) return null;
    if (input.repeat('left') || input.pressed('l')) page(-1);
    if (input.repeat('right') || input.pressed('r')) page(1);
    const ev = focus.handle(input);
    keepInView();
    return ev;
  }

  function update(dt) {
    focus.update(dt);
    bob = (bob + dt) % 1000;
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    const s = surfaceFor(style);
    layout();
    const sb = items.length > visible ? SCROLLBAR_W + 1 : 0;
    const end = Math.min(items.length, top + visible);
    for (let i = top; i < end; i++) {
      const it = items[i];
      const r = rowRect(i);
      const focused = i === focus.index;
      const enabled = it.enabled !== false;
      if (focused) {
        ctx.fillStyle = focus.pointerActive ? s.hover : s.band;
        ctx.fillRect(r.x - 1, r.y, r.w + 2, r.h);
      }
      if (rules && i < end - 1) drawRule(ctx, r.x, r.y + r.h - 1, r.w, { dark: s.dark, dotted: true });
      if (o.render) {
        o.render(ctx, it, r.x, r.y, r.w, focused, rowH);
        continue;
      }
      let lx = r.x + SPACE.xs;
      const ty = r.y + Math.floor((rowH - TYPE.capH) / 2);
      if (markers) {
        // Markers carry their meaning by shape (✦ new, ★ one of a kind); brass ink keeps them apart
        // from the wax-red ▶ cursor that sits right beside them on the focused row.
        const mk = s.dark ? COLORS.brass.light : COLORS.brass.dark;
        if (it.marker) {
          if (hasIcon(it.marker)) drawIcon(ctx, it.marker, lx, r.y + Math.floor((rowH - 8) / 2), { ink: mk });
          else drawText(ctx, it.marker, lx, ty, { color: mk });
        }
        lx += 9;
      }
      if (it.icon) { drawIcon(ctx, it.icon, lx, r.y + Math.floor((rowH - 8) / 2), { ink: enabled ? s.text : COLORS.role.disabled }); lx += 12; }
      const ink = enabled ? s.text : COLORS.role.disabled;
      const label = enabled ? String(it.label ?? it.id) : `${ROLE_GLYPH.disabled} ${it.label ?? it.id}`;
      const valueTxt = it.value === undefined || it.value === null ? '' : String(it.value);
      const vw = valueTxt ? measureText(valueTxt).w : 0;
      const labelMax = r.w - (lx - r.x) - (vw ? vw + 6 : 2);
      drawText(ctx, label, lx, ty, { color: ink, maxWidth: Math.max(8, labelMax) });
      if (valueTxt) drawText(ctx, valueTxt, r.x + r.w - SPACE.xs, ty, { align: 'right', color: ink });
      else if (!enabled && it.reason) drawText(ctx, it.reason, r.x + r.w - SPACE.xs, ty + 1, { align: 'right', font: 'small', color: COLORS.role.disabled });
    }
    // scrollbar: a tally-wood thumb in a recessed track, with the more-arrows capping the column
    if (sb) {
      const bx = rect.x + rect.w - SCROLLBAR_W, listH = visible * rowH;
      const by = rect.y + 7, bh = listH - 14;
      ctx.fillStyle = s.dark ? COLORS.dark.inner : COLORS.paper.shade;
      ctx.fillRect(bx + 1, by, SCROLLBAR_W - 2, bh);
      const thumbH = Math.max(4, Math.round((visible / items.length) * bh));
      const thumbY = by + Math.round((top / Math.max(1, items.length - visible)) * (bh - thumbH));
      ctx.fillStyle = COLORS.tally.dark;
      ctx.fillRect(bx, thumbY, SCROLLBAR_W, thumbH);
      ctx.fillStyle = COLORS.tally.light;
      ctx.fillRect(bx + 1, thumbY + 1, SCROLLBAR_W - 2, Math.max(1, thumbH - 2));
      const lift = bob < 500 ? 0 : 1;
      const on = s.cursor, off = s.dark ? COLORS.dark.inner : COLORS.paper.deep;
      drawText(ctx, '▲', bx, rect.y + 1 - (top > 0 ? lift : 0), { font: 'small', color: top > 0 ? on : off });
      drawText(ctx, '▼', bx, rect.y + listH - 6 + (end < items.length ? lift : 0), { font: 'small', color: end < items.length ? on : off });
    }
    if (pager && items.length > visible) {
      const txt = `${pageOf(focus.index, visible) + 1}/${pageCount(items.length, visible)}`;
      drawText(ctx, txt, rect.x + rect.w, rect.y + rect.h - 6, { font: 'small', align: 'right', color: s.soft });
    }
    if (!items.length) {
      drawText(ctx, 'EMPTY', rect.x + CURSOR_W + SPACE.xs, rect.y + SPACE.xs, { color: COLORS.role.disabled });
    }
    focus.drawCursor(ctx, { style, ring: false });
  }

  setItems(o.items || []);

  /** @type {ListWidget} */
  const widget = {
    focus,
    get index() { return focus.index; },
    get top() { return top; },
    get visible() { return visible; },
    get page() { return pageOf(focus.index, visible); },
    get pages() { return pageCount(items.length, visible); },
    get items() { return items; },
    get rect() { return rect; },
    setRect(r) { rect = { ...r }; visible = visibleRows(rect.h, rowH, pager); keepInView(); },
    setItems,
    selected: () => items[focus.index] || null,
    select(i) { focus.set(i); keepInView(); },
    pageBy: page,
    handle,
    update,
    draw,
  };
  return widget;
}

/**
 * @typedef {Object} ListWidget
 * @property {import('./focus.js').Focus} focus
 * @property {number} index @property {number} top @property {number} visible @property {number} page @property {number} pages
 * @property {ListItem[]} items
 * @property {{x: number, y: number, w: number, h: number}} rect
 * @property {(r: {x: number, y: number, w: number, h: number}) => void} setRect
 * @property {(items: ListItem[]) => void} setItems
 * @property {() => ListItem|null} selected
 * @property {(i: number) => void} select
 * @property {(dir: number) => void} pageBy
 * @property {(input?: import('../core/input.js').Input) => import('./focus.js').FocusEvent|null} handle
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 */
