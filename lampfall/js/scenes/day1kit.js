/**
 * Day-1 drawing and focus helpers shared by the boot-lane scenes. [BOOT]
 *
 * TEMPORARY: a paper panel and a minimal focus list so the title, menu and stubs work before
 * `ui/theme.js`, `ui/panel.js`, `ui/focus.js` and `ui/list.js` land. Scenes should swap to `ui/*`
 * when it exists; nothing outside `js/scenes` may import this file.
 * @module scenes/day1kit
 */
import { drawText, measureText } from '../core/font.js';

/** Colour tokens used until `ui/theme.js` exists (paper / ink / wax / focus). */
export const KIT = Object.freeze({
  paper: '#f1e7cf',
  paperDark: '#d9c9a3',
  ink: '#2a2238',
  inkSoft: '#6b5f7a',
  wax: '#b8373f',
  focus: '#3b6ea5',
  night: '#101420',
  disabled: '#9c927f',
});

/**
 * Draws a paper panel with a dark drop edge.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{color?: string, edge?: string}} [opts]
 */
export function drawPaper(ctx, x, y, w, h, opts = {}) {
  ctx.fillStyle = opts.edge ?? KIT.paperDark;
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = opts.color ?? KIT.paper;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = opts.edge ?? KIT.paperDark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/**
 * Draws a one-line label strip (HUD line, hints).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{color?: string, bg?: string, font?: string}} [opts]
 * @returns {{w: number, h: number}}
 */
export function drawStrip(ctx, text, x, y, opts = {}) {
  const size = measureText(text, { font: opts.font ?? 'main' });
  ctx.fillStyle = opts.bg ?? 'rgba(16,20,32,0.82)';
  ctx.fillRect(x, y, size.w + 8, size.h + 4);
  drawText(ctx, text, x + 4, y + 2, { color: opts.color ?? KIT.paper, font: opts.font ?? 'main' });
  return { w: size.w + 8, h: size.h + 4 };
}

/**
 * @typedef {Object} ListItem
 * @property {string} label
 * @property {boolean} [enabled=true]
 * @property {string} [hint]   right-aligned secondary text
 * @property {any} [value]
 */

/**
 * @typedef {Object} LocalList
 * @property {number} index
 * @property {ListItem[]} items
 * @property {(items: ListItem[]) => void} setItems
 * @property {(input: any) => void} handleInput   up/down with auto-repeat, confirm, left/right, pointer
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 * @property {(x: number, y: number) => number} hit   row index under a game-space point, or -1
 * @property {() => string[]} texts   visible labels (for `__game.text()`)
 */

/**
 * A keyboard + pointer focus list. `onPick(index, item)` fires on confirm or pointer tap;
 * `onAdjust(index, dir, item)` on left/right.
 * @param {{items: ListItem[], x: number, y: number, w: number, rowH?: number,
 *   onPick: (index: number, item: ListItem) => void,
 *   onAdjust?: (index: number, dir: -1|1, item: ListItem) => void,
 *   onMove?: (index: number) => void}} opts
 * @returns {LocalList}
 */
export function createLocalList(opts) {
  const rowH = opts.rowH ?? 14;
  const list = {
    index: 0,
    items: opts.items.slice(),
    setItems(items) {
      list.items = items.slice();
      if (list.index >= list.items.length) list.index = Math.max(0, list.items.length - 1);
    },
    hit(px, py) {
      if (px < opts.x || px >= opts.x + opts.w) return -1;
      const row = Math.floor((py - opts.y) / rowH);
      return row >= 0 && row < list.items.length ? row : -1;
    },
    handleInput(input) {
      const n = list.items.length;
      if (!n) return;
      const before = list.index;
      if (input.repeat('up')) list.index = (list.index + n - 1) % n;
      if (input.repeat('down')) list.index = (list.index + 1) % n;
      const p = input.pointer;
      if (p && p.inside) {
        const row = list.hit(p.x, p.y);
        if (row >= 0 && (p.justDown || row !== list.index) && list.items[row].enabled !== false) list.index = row;
        if (row >= 0 && p.justDown && list.items[row].enabled !== false) {
          opts.onPick(row, list.items[row]);
          return;
        }
      }
      if (list.index !== before && opts.onMove) opts.onMove(list.index);
      const item = list.items[list.index];
      if (input.pressed('confirm')) {
        if (item.enabled !== false) opts.onPick(list.index, item);
      } else if (opts.onAdjust && (input.repeat('left') || input.repeat('right'))) {
        if (item.enabled !== false) opts.onAdjust(list.index, input.repeat('right') || input.pressed('right') ? 1 : -1, item);
      }
    },
    draw(ctx) {
      list.items.forEach((item, i) => {
        const y = opts.y + i * rowH;
        const focused = i === list.index;
        if (focused) {
          ctx.fillStyle = KIT.focus;
          ctx.fillRect(opts.x, y, opts.w, rowH);
        }
        const color = item.enabled === false ? KIT.disabled : focused ? KIT.paper : KIT.ink;
        drawText(ctx, `${focused ? '▶ ' : '  '}${item.label}`, opts.x + 4, y + 3, { color });
        if (item.hint) drawText(ctx, item.hint, opts.x + opts.w - 4, y + 3, { color, align: 'right' });
      });
    },
    texts: () => list.items.map((it) => (it.hint ? `${it.label} ${it.hint}` : it.label)),
  };
  return list;
}
