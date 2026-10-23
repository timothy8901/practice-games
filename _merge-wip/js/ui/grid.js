/**
 * Paged grid with a cursor. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `createGrid({rect, cols, rows, cellW, cellH, items, render, onSelect, onCancel})` -> Widget.
 * The focus model navigates the whole item list in `cols` columns; the grid shows the page the
 * cursor is on (`cols * rows` cells) and L/R jump a page. Cells are drawn as small cards; the
 * focused cell gets a lifted band and the dotted ring. A page counter and page dots sit under the
 * grid. Pure helpers (`cellRect`, `pageOf`, `pageIndexRange`) are unit-tested.
 * @module ui/grid
 */
import { drawText } from '../core/font.js';
import { createFocus } from './focus.js';
import { COLORS, SPACE, surfaceFor } from './theme.js';
import { drawIcon, hasIcon } from './icons.js';
import { drawNotchedFrame } from './panel.js';

/** Height reserved under the cells for the pager. */
export const GRID_PAGER_H = 8;

/**
 * Cell rectangle for item `i` on its page.
 * @param {number} i
 * @param {{rect: {x: number, y: number}, cols: number, rows: number, cellW: number, cellH: number, gap?: number}} g
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function cellRect(i, g) {
  const gap = g.gap === undefined ? 2 : g.gap;
  const per = g.cols * g.rows;
  const k = i % per;
  const c = k % g.cols, r = Math.floor(k / g.cols);
  return { x: g.rect.x + c * (g.cellW + gap), y: g.rect.y + r * (g.cellH + gap), w: g.cellW, h: g.cellH };
}

/**
 * @param {number} i @param {number} perPage
 * @returns {number}
 */
export function pageOf(i, perPage) {
  return Math.floor(Math.max(0, i) / Math.max(1, perPage));
}

/**
 * @param {number} page @param {number} perPage @param {number} n
 * @returns {{start: number, end: number}} half-open
 */
export function pageIndexRange(page, perPage, n) {
  const start = page * perPage;
  return { start, end: Math.min(n, start + perPage) };
}

/**
 * @typedef {Object} GridItem
 * @property {string} id
 * @property {string} [label]
 * @property {string} [icon]
 * @property {boolean} [enabled=true]
 * @property {string} [reason]
 * @property {any} [data]
 */

/**
 * @typedef {Object} GridOptions
 * @property {{x: number, y: number, w?: number, h?: number}} rect
 * @property {number} cols @property {number} rows
 * @property {number} cellW @property {number} cellH @property {number} [gap=2]
 * @property {GridItem[]} items
 * @property {(ctx: CanvasRenderingContext2D, item: GridItem, cell: {x: number, y: number, w: number, h: number}, focused: boolean) => void} [render]
 * @property {(item: GridItem, index: number) => void} [onSelect]
 * @property {() => void} [onCancel]
 * @property {(item: GridItem, index: number) => void} [onChange]
 * @property {'paper'|'dark'} [style]
 * @property {boolean} [cards=true]  Draw a card behind each cell.
 * @property {import('../core/input.js').Input} [input]
 */

/**
 * @param {GridOptions} o
 * @returns {GridWidget}
 */
export function createGrid(o) {
  const g = { rect: { ...o.rect }, cols: Math.max(1, o.cols | 0), rows: Math.max(1, o.rows | 0), cellW: o.cellW, cellH: o.cellH, gap: o.gap === undefined ? 2 : o.gap };
  const perPage = g.cols * g.rows;
  const style = o.style === 'dark' ? 'dark' : 'paper';
  const cards = o.cards !== false;
  /** @type {GridItem[]} */
  let items = [];
  /** @type {import('./focus.js').FocusItem[]} */
  let fitems = [];
  let page = 0;

  const focus = createFocus({ cols: g.cols, wrap: true, input: o.input });
  focus.on('activate', (ev) => { if (o.onSelect && ev.item) o.onSelect(items[ev.index], ev.index); });
  focus.on('cancel', () => { if (o.onCancel) o.onCancel(); });
  focus.on('change', (ev) => { syncPage(); if (o.onChange && ev.item) o.onChange(items[ev.index], ev.index); });

  function layout() {
    const { start, end } = pageIndexRange(page, perPage, items.length);
    for (let i = 0; i < fitems.length; i++) fitems[i].rect = i >= start && i < end ? cellRect(i, g) : null;
  }

  function syncPage() {
    const p = pageOf(focus.index, perPage);
    if (p !== page) page = p;
    layout();
  }

  /** @param {GridItem[]} next */
  function setItems(next) {
    items = Array.isArray(next) ? next.slice() : [];
    fitems = items.map((it) => ({ id: String(it.id), enabled: it.enabled !== false, reason: it.reason, rect: null }));
    focus.setItems(fitems);
    syncPage();
  }

  /** @param {number} dir */
  function pageBy(dir) {
    if (!items.length) return;
    const target = Math.min(items.length - 1, Math.max(0, focus.index + dir * perPage));
    focus.set(target);
    syncPage();
  }

  /** @param {import('../core/input.js').Input} [input] */
  function handle(input = o.input) {
    if (!input) return null;
    if (input.pressed('l')) pageBy(-1);
    if (input.pressed('r')) pageBy(1);
    const ev = focus.handle(input);
    syncPage();
    return ev;
  }

  function update(dt) { focus.update(dt); }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    const s = surfaceFor(style);
    layout();
    const { start, end } = pageIndexRange(page, perPage, items.length);
    for (let i = start; i < end; i++) {
      const it = items[i];
      const cell = cellRect(i, g);
      const focused = i === focus.index;
      const enabled = it.enabled !== false;
      if (cards) {
        ctx.fillStyle = focused ? (focus.pointerActive ? s.hover : s.band) : s.dark ? COLORS.dark.inner : COLORS.paper.light;
        ctx.fillRect(cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2);
        drawNotchedFrame(ctx, cell.x, cell.y, cell.w, cell.h, enabled ? s.rule : COLORS.role.disabled);
      }
      if (o.render) { o.render(ctx, it, cell, focused); continue; }
      const ink = enabled ? s.text : COLORS.role.disabled;
      if (it.icon && hasIcon(it.icon)) drawIcon(ctx, it.icon, cell.x + Math.floor((cell.w - 8) / 2), cell.y + SPACE.xs, { ink });
      if (it.label) drawText(ctx, it.label, cell.x + Math.floor(cell.w / 2), cell.y + cell.h - 7, { font: 'small', align: 'center', color: ink, maxWidth: cell.w - 2 });
    }
    // pager
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    if (pages > 1) {
      const py = g.rect.y + g.rows * (g.cellH + g.gap) + 1;
      const gw = g.cols * (g.cellW + g.gap) - g.gap;
      let dx = g.rect.x + Math.floor((gw - (pages * 4 - 1)) / 2);
      for (let p = 0; p < pages; p++) {
        ctx.fillStyle = p === page ? s.cursor : s.soft;
        ctx.fillRect(dx, py + 2, p === page ? 3 : 2, p === page ? 3 : 2);
        dx += 4;
      }
      drawText(ctx, `${page + 1}/${pages}`, g.rect.x + gw, py, { font: 'small', align: 'right', color: s.soft });
    }
    if (!items.length) drawText(ctx, 'EMPTY', g.rect.x + SPACE.xs, g.rect.y + SPACE.xs, { color: COLORS.role.disabled });
    focus.drawCursor(ctx, { style, cursor: false });
  }

  setItems(o.items || []);

  /** @type {GridWidget} */
  const widget = {
    focus,
    get index() { return focus.index; },
    get page() { return page; },
    get pages() { return Math.max(1, Math.ceil(items.length / perPage)); },
    get perPage() { return perPage; },
    get items() { return items; },
    setItems,
    selected: () => items[focus.index] || null,
    select(i) { focus.set(i); syncPage(); },
    pageBy,
    handle,
    update,
    draw,
  };
  return widget;
}

/**
 * @typedef {Object} GridWidget
 * @property {import('./focus.js').Focus} focus
 * @property {number} index @property {number} page @property {number} pages @property {number} perPage
 * @property {GridItem[]} items
 * @property {(items: GridItem[]) => void} setItems
 * @property {() => GridItem|null} selected
 * @property {(i: number) => void} select
 * @property {(dir: number) => void} pageBy
 * @property {(input?: import('../core/input.js').Input) => import('./focus.js').FocusEvent|null} handle
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 */
