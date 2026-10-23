/**
 * Tool ring. [UI-HUD] — ARCHITECTURE-DRAFT §7, porchlight-visuals §9.4.
 *
 * `createToolRing({tools, current, last, onEquip, onSwap, onCancel})` -> Widget.
 *  - Hold the `tool` action for `holdMs` (220 ms, read through `input.heldFor`) to open the ring of
 *    8 brass sockets. While open, the d-pad / stick (8 directions = 8 sockets) or the pointer angle
 *    moves a radial focus; releasing `tool` equips the focused socket; `confirm` equips too (touch);
 *    `cancel` closes without change and never drops anything.
 *  - A tap (release before `holdMs`) swaps the current tool with the last one.
 *  - Empty sockets read `EMPTY`; the focused tool's name sits on a paper strip under the ring.
 * Pure: `socketFromDir`, `socketFromAngle`, `socketPos`.
 * @module ui/toolRing
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE, STRINGS, TIMING } from './theme.js';
import { drawIcon, hasIcon } from './icons.js';
import { drawNotchedFrame } from './panel.js';
import { drawDottedRect } from './focus.js';

export const SOCKETS = 8;

/**
 * Socket index (0 = up, clockwise) for a direction vector; -1 when zero.
 * @param {number} dx @param {number} dy
 * @returns {number}
 */
export function socketFromDir(dx, dy) {
  if (!dx && !dy) return -1;
  return socketFromAngle(Math.atan2(dy, dx));
}

/**
 * Socket index for an angle in radians (canvas convention: 0 = right, +y down). Up is socket 0.
 * @param {number} angle
 * @returns {number}
 */
export function socketFromAngle(angle) {
  const step = (Math.PI * 2) / SOCKETS;
  let a = angle + Math.PI / 2; // rotate so up = 0
  a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / step) % SOCKETS;
}

/**
 * Centre of socket `i` on a ring of `radius` around (cx, cy).
 * @param {number} i @param {number} cx @param {number} cy @param {number} radius
 * @returns {{x: number, y: number}}
 */
export function socketPos(i, cx, cy, radius) {
  const a = (i / SOCKETS) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.round(cx + Math.cos(a) * radius), y: Math.round(cy + Math.sin(a) * radius) };
}

/**
 * Pixel-exact filled disc (scanline spans), so the plate stays crisp at 1x.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy @param {number} r @param {string} color
 */
export function fillDisc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/**
 * 1px circle outline, pixel-exact (each pixel plotted once).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy @param {number} r @param {string} color
 */
export function ringPixels(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const seen = new Set();
  const n = Math.max(16, Math.round(r * 2 * Math.PI));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(a) * r), py = Math.round(cy + Math.sin(a) * r);
    const k = px * 4096 + py;
    if (seen.has(k)) continue;
    seen.add(k);
    ctx.fillRect(px, py, 1, 1);
  }
}

/**
 * @typedef {Object} RingTool
 * @property {string} id @property {string} name @property {string} [icon]
 */

/**
 * @typedef {Object} ToolRingOptions
 * @property {(RingTool|null)[]} tools   Up to 8 entries; null = empty socket.
 * @property {string|null} [current]     Equipped tool id.
 * @property {string|null} [last]        Previously equipped tool id (for the tap swap).
 * @property {(id: string) => void} [onEquip]
 * @property {(current: string|null, last: string|null) => void} [onSwap]
 * @property {() => void} [onCancel]
 * @property {number} [holdMs=220]
 * @property {{x: number, y: number}} [center]
 * @property {number} [radius=30]
 * @property {import('../core/input.js').Input} [input]
 */

/**
 * @param {ToolRingOptions} o
 * @returns {ToolRing}
 */
export function createToolRing(o) {
  const holdMs = o.holdMs === undefined ? TIMING.toolRingHoldMs : o.holdMs;
  const radius = o.radius || 30;
  const center = o.center || { x: 240, y: 135 };
  /** @type {(RingTool|null)[]} */
  let tools = normalize(o.tools);
  let current = o.current ?? null;
  let last = o.last ?? null;
  let open = false;
  let pressSeen = false;
  let focusIndex = indexOf(current);
  let anim = 0; // 0 closed .. 1 open
  let lastPtr = { x: NaN, y: NaN };

  function normalize(list) {
    const out = [];
    for (let i = 0; i < SOCKETS; i++) out.push((list && list[i]) || null);
    return out;
  }
  function indexOf(id) { const i = tools.findIndex((t) => t && t.id === id); return i < 0 ? 0 : i; }

  function openRing() {
    open = true;
    focusIndex = indexOf(current);
    lastPtr = { x: NaN, y: NaN };
  }

  function equip(i) {
    const t = tools[i];
    open = false;
    pressSeen = false;
    if (!t || t.id === current) return;
    last = current;
    current = t.id;
    if (o.onEquip) o.onEquip(current);
  }

  function swap() {
    if (last === null || last === current || indexOfOrMinus(last) < 0) return false;
    const c = current;
    current = last;
    last = c;
    focusIndex = indexOf(current);
    if (o.onSwap) o.onSwap(current, last);
    return true;
  }
  function indexOfOrMinus(id) { return tools.findIndex((t) => t && t.id === id); }

  function close() {
    open = false;
    pressSeen = false;
    if (o.onCancel) o.onCancel();
  }

  /** @param {import('../core/input.js').Input} [input] */
  function handle(input = o.input) {
    if (!input) return;
    if (!open) {
      if (input.pressed('tool')) pressSeen = true;
      if (input.held('tool') && input.heldFor('tool') >= holdMs) { openRing(); return; }
      if (input.released('tool') && pressSeen) { pressSeen = false; swap(); }
      return;
    }
    // open
    const ax = input.axis();
    const s = socketFromDir(ax.x, ax.y);
    if (s >= 0) focusIndex = s;
    const p = input.pointer;
    if (p && p.inside && (p.x !== lastPtr.x || p.y !== lastPtr.y)) {
      // The first frame after opening only records the resting pointer; aiming needs real movement.
      const primed = !Number.isNaN(lastPtr.x);
      lastPtr = { x: p.x, y: p.y };
      const dx = p.x - center.x, dy = p.y - center.y;
      if (primed && dx * dx + dy * dy >= 64) focusIndex = socketFromAngle(Math.atan2(dy, dx));
    }
    if (input.pressed('cancel')) { close(); return; }
    if (input.released('tool') || input.pressed('confirm') || (p && p.inside && p.justDown)) {
      if (p && p.inside && p.justDown) {
        const dx = p.x - center.x, dy = p.y - center.y;
        if (dx * dx + dy * dy >= 64) focusIndex = socketFromAngle(Math.atan2(dy, dx));
      }
      equip(focusIndex);
    }
  }

  function update(dt) {
    const target = open ? 1 : 0;
    const step = dt / TIMING.toolRingOpenMs;
    anim = anim < target ? Math.min(target, anim + step) : Math.max(target, anim - step);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (anim <= 0) return;
    const r = Math.round(radius * (0.6 + 0.4 * anim));
    ctx.save();
    ctx.globalAlpha *= anim;
    // ring plate: a crisp pixel disc of night ink with a 1px brass rim (no anti-aliased arcs)
    fillDisc(ctx, center.x, center.y, r + 14, COLORS.dim);
    ringPixels(ctx, center.x, center.y, r + 14, COLORS.brass.dark);
    ringPixels(ctx, center.x, center.y, r, COLORS.tally.dark);
    for (let i = 0; i < SOCKETS; i++) {
      const p = socketPos(i, center.x, center.y, r);
      const t = tools[i];
      const focused = open && i === focusIndex;
      const S = 18;
      const sx = p.x - 9, sy = p.y - 9 - (focused ? 1 : 0);
      // socket: brass rim, recessed well (paper when filled, dark when empty)
      ctx.fillStyle = COLORS.shadow; ctx.fillRect(sx + 1, sy + 2 + (focused ? 1 : 0), S, S);
      ctx.fillStyle = focused ? COLORS.brass.light : COLORS.brass.fill;
      ctx.fillRect(sx + 1, sy + 1, S - 2, S - 2);
      drawNotchedFrame(ctx, sx, sy, S, S, COLORS.brass.dark);
      ctx.fillStyle = COLORS.brass.dark;
      ctx.fillRect(sx + 3, sy + 3, S - 6, 1); ctx.fillRect(sx + 3, sy + 3, 1, S - 6); // inner bevel (shadow side)
      ctx.fillStyle = t ? COLORS.paper.light : COLORS.tally.dark;
      ctx.fillRect(sx + 4, sy + 4, S - 7, S - 7);
      if (t) {
        drawIcon(ctx, t.icon && hasIcon(t.icon) ? t.icon : 'strike', sx + 5, sy + 5, { ink: COLORS.paper.ink });
        if (t.id === current) { ctx.fillStyle = COLORS.wax.fill; ctx.fillRect(sx + S - 5, sy + 1, 3, 3); ctx.fillStyle = COLORS.wax.light; ctx.fillRect(sx + S - 5, sy + 1, 1, 1); }
      } else {
        drawText(ctx, '–', sx + 7, sy + 5, { color: COLORS.tally.light });
      }
      if (focused) drawDottedRect(ctx, sx - 2, sy - 2, S + 4, S + 4, COLORS.paper.light);
    }
    // name strip
    if (open) {
      const t = tools[focusIndex];
      const name = t ? t.name : STRINGS.empty;
      const tw = measureText(name).w;
      const w = tw + 12, h = 12;
      const nx = center.x - Math.floor(w / 2), ny = center.y + r + 22;
      ctx.fillStyle = COLORS.shadow; ctx.fillRect(nx + 1, ny + 1, w, h);
      ctx.fillStyle = COLORS.paper.light; ctx.fillRect(nx + 1, ny + 1, w - 2, h - 2);
      drawNotchedFrame(ctx, nx, ny, w, h, COLORS.paper.edge);
      drawText(ctx, name, nx + 6, ny + 2, { color: t ? COLORS.paper.ink : COLORS.role.disabled });
      if (t && t.id === current) drawText(ctx, 'equipped', center.x, ny + h + 2, { font: 'small', align: 'center', color: COLORS.paper.light });
      // centre: the focused tool, large, so the choice reads before release
      if (t) drawIcon(ctx, t.icon && hasIcon(t.icon) ? t.icon : 'strike', center.x - 8, center.y - 8, { ink: COLORS.paper.light, accent: COLORS.brass.light, light: COLORS.paper.light, scale: 2 });
      else drawText(ctx, STRINGS.empty, center.x, center.y - 3, { font: 'small', align: 'center', color: COLORS.paper.deep });
    }
    ctx.restore();
  }

  /** @type {ToolRing} */
  const ring = {
    get open() { return open; },
    get anim() { return anim; },
    get current() { return current; },
    get last() { return last; },
    get focusIndex() { return focusIndex; },
    get tools() { return tools; },
    get center() { return center; },
    get radius() { return radius; },
    setTools(list) { tools = normalize(list); focusIndex = indexOf(current); },
    setCurrent(id, lastId) { current = id ?? null; if (lastId !== undefined) last = lastId; focusIndex = indexOf(current); },
    openRing,
    close,
    equip,
    swap,
    focusSocket(i) { focusIndex = ((i % SOCKETS) + SOCKETS) % SOCKETS; },
    selected: () => tools[focusIndex],
    setItems(list) { ring.setTools(list); },
    handle,
    update,
    draw,
  };
  return ring;
}

/**
 * @typedef {Object} ToolRing
 * @property {boolean} open @property {number} anim
 * @property {string|null} current @property {string|null} last @property {number} focusIndex
 * @property {(RingTool|null)[]} tools @property {{x: number, y: number}} center @property {number} radius
 * @property {(list: (RingTool|null)[]) => void} setTools
 * @property {(id: string|null, last?: string|null) => void} setCurrent
 * @property {() => void} openRing @property {() => void} close
 * @property {(i: number) => void} equip @property {() => boolean} swap @property {(i: number) => void} focusSocket
 * @property {() => RingTool|null} selected
 * @property {(list: (RingTool|null)[]) => void} setItems
 * @property {(input?: import('../core/input.js').Input) => void} handle
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 */
