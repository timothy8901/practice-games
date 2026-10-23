/**
 * Tab strip. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `createTabs({tabs: [{id, label, icon}], rect, onChange})` -> Widget & {active}. L/R (shoulder
 * actions) cycle tabs with wrap; a pointer tap picks one directly. Draw the owning panel first,
 * then `tabs.draw(ctx)`: the active tab is paper with its bottom edge opened into the panel, the
 * others sit one pixel lower in paper shade. Device hints for L/R are drawn at the strip's ends.
 * Pure helpers: `tabLayout`, `nextTab`.
 * @module ui/tabs
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, DEVICE_LABELS, SPACE, surfaceFor } from './theme.js';
import { drawIcon, hasIcon } from './icons.js';
import { drawNotchedFrame } from './panel.js';
import { drawKeyGlyph } from './widgets.js';

/** Height of the strip (tab body + 1px merge row). */
export const TAB_H = 14;
/** Space reserved at each end for the L/R hint. */
const HINT_W = 14;

/**
 * X positions and widths for a tab row, left to right from `rect.x + HINT_W`.
 * @param {{id: string, label: string, icon?: string}[]} tabs
 * @param {{x: number, w: number}} rect
 * @param {{hints?: boolean}} [o]
 * @returns {{id: string, x: number, w: number}[]}
 */
export function tabLayout(tabs, rect, o) {
  const hints = !o || o.hints !== false;
  let x = rect.x + (hints ? HINT_W : 0);
  return tabs.map((t) => {
    const w = (t.icon ? 10 : 0) + measureText(t.label).w + SPACE.md;
    const entry = { id: t.id, x, w };
    x += w + 1;
    return entry;
  });
}

/**
 * Next tab id in `dir` with wrap.
 * @param {string[]} ids @param {string} active @param {number} dir
 * @returns {string}
 */
export function nextTab(ids, active, dir) {
  if (!ids.length) return active;
  const i = Math.max(0, ids.indexOf(active));
  return ids[(i + (dir < 0 ? -1 : 1) + ids.length) % ids.length];
}

/**
 * @typedef {Object} TabsOptions
 * @property {{id: string, label: string, icon?: string}[]} tabs
 * @property {{x: number, y: number, w: number}} rect
 * @property {string} [active]
 * @property {(id: string, prev: string) => void} [onChange]
 * @property {'paper'|'dark'} [style]
 * @property {boolean} [hints=true]
 * @property {boolean} [dpad=false]  Also switch with left/right (for strips that own no list).
 * @property {import('../core/input.js').Input} [input]
 */

/**
 * @param {TabsOptions} o
 * @returns {TabsWidget}
 */
export function createTabs(o) {
  const tabs = o.tabs.slice();
  const rect = { ...o.rect };
  const style = o.style === 'dark' ? 'dark' : 'paper';
  const hints = o.hints !== false;
  let active = o.active && tabs.some((t) => t.id === o.active) ? o.active : (tabs[0] && tabs[0].id) || '';
  let device = 'keyboard';

  function setActive(id) {
    if (id === active || !tabs.some((t) => t.id === id)) return;
    const prev = active;
    active = id;
    if (o.onChange) o.onChange(id, prev);
  }

  /** @param {import('../core/input.js').Input} [input] */
  function handle(input = o.input) {
    if (!input) return;
    device = input.lastDevice || device;
    const ids = tabs.map((t) => t.id);
    if (input.pressed('l') || (o.dpad && input.repeat('left'))) setActive(nextTab(ids, active, -1));
    if (input.pressed('r') || (o.dpad && input.repeat('right'))) setActive(nextTab(ids, active, 1));
    const p = input.pointer;
    if (p && p.inside && p.justDown && p.y >= rect.y && p.y < rect.y + TAB_H) {
      for (const t of tabLayout(tabs, rect, { hints })) {
        if (p.x >= t.x && p.x < t.x + t.w) { setActive(t.id); break; }
      }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    const s = surfaceFor(style);
    const lay = tabLayout(tabs, rect, { hints });
    // Active tab: full height, bottom opened into the panel. Inactive: 2px lower, its bottom edge
    // sitting on the panel's top border, label clear of every frame line.
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i], L = lay[i];
      const on = t.id === active;
      const y = rect.y + (on ? 0 : 2);
      const h = on ? TAB_H : TAB_H - 2;
      const fill = on ? (s.dark ? COLORS.dark.fill : COLORS.paper.fill) : (s.dark ? COLORS.dark.inner : COLORS.paper.shade);
      ctx.fillStyle = fill;
      ctx.fillRect(L.x + 1, y + 1, L.w - 2, h - 1);
      drawNotchedFrame(ctx, L.x, y, L.w, h + (on ? 1 : 0), on ? (s.dark ? COLORS.dark.border : COLORS.paper.edge) : s.rule);
      if (on) {
        ctx.fillStyle = fill;
        ctx.fillRect(L.x + 1, y + h - 1, L.w - 2, 2);
      } else {
        ctx.fillStyle = s.dark ? COLORS.dark.border : COLORS.paper.edge; // sits on the panel's top border
        ctx.fillRect(L.x, y + h - 1, L.w, 1);
      }
      let tx = L.x + SPACE.sm;
      const ink = on ? s.text : s.soft;
      const ty = y + (on ? 3 : 2);
      if (t.icon && hasIcon(t.icon)) { drawIcon(ctx, t.icon, tx, ty, { ink }); tx += 10; }
      drawText(ctx, t.label, tx, ty, { color: ink });
    }
    if (hints && tabs.length > 1) {
      const dev = device === 'gamepad' ? 'gamepad' : device === 'touch' ? 'touch' : 'keyboard';
      const labels = DEVICE_LABELS[dev];
      drawKeyGlyph(ctx, dev, labels.l, rect.x, rect.y + 3, { dark: s.dark });
      const last = lay[lay.length - 1];
      drawKeyGlyph(ctx, dev, labels.r, last.x + last.w + 3, rect.y + 3, { dark: s.dark });
    }
  }

  /** @type {TabsWidget} */
  const widget = {
    get active() { return active; },
    set active(id) { setActive(id); },
    get tabs() { return tabs; },
    get rect() { return rect; },
    get height() { return TAB_H; },
    setActive,
    next: () => setActive(nextTab(tabs.map((t) => t.id), active, 1)),
    prev: () => setActive(nextTab(tabs.map((t) => t.id), active, -1)),
    handle,
    update() {},
    draw,
    selected: () => tabs.find((t) => t.id === active) || null,
    setItems(next) { tabs.splice(0, tabs.length, ...next); if (!tabs.some((t) => t.id === active)) active = tabs[0] ? tabs[0].id : ''; },
    layout: () => tabLayout(tabs, rect, { hints }),
  };
  return widget;
}

/**
 * @typedef {Object} TabsWidget
 * @property {string} active
 * @property {{id: string, label: string, icon?: string}[]} tabs
 * @property {{x: number, y: number, w: number}} rect
 * @property {number} height
 * @property {(id: string) => void} setActive
 * @property {() => void} next @property {() => void} prev
 * @property {(input?: import('../core/input.js').Input) => void} handle
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 * @property {() => {id: string, label: string, icon?: string}|null} selected
 * @property {(tabs: {id: string, label: string, icon?: string}[]) => void} setItems
 * @property {() => {id: string, x: number, w: number}[]} layout
 */
