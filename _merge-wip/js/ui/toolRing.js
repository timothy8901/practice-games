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
      lastPtr = { x: p.x, y: p.y };
      const dx = p.x - center.x, dy = p.y - center.y;
      if (dx * dx + dy * dy >= 64) focusIndex = socketFromAngle(Math.atan2(dy, dx));
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
    // ring plate
    ctx.fillStyle = COLORS.dim;
    ctx.beginPath(); ctx.arc(center.x, center.y, r + 14, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < SOCKETS; i++) {
      const p = socketPos(i, center.x, center.y, r);
      const t = tools[i];
      const focused = open && i === focusIndex;
      const sx = p.x - 7, sy = p.y - 7 - (focused ? 1 : 0);
      // socket: brass ring on tally wood
      ctx.fillStyle = COLORS.shadow; ctx.fillRect(sx + 1, sy + 2, 14, 14);
      ctx.fillStyle = COLORS.tally.dark; ctx.fillRect(sx + 1, sy, 12, 14); ctx.fillRect(sx, sy + 1, 14, 12);
      ctx.fillStyle = t ? COLORS.tally.light : COLORS.paper.deep; ctx.fillRect(sx + 2, sy + 1, 10, 12); ctx.fillRect(sx + 1, sy + 2, 12, 10);
      drawNotchedFrame(ctx, sx, sy, 14, 14, focused ? COLORS.brass.light : COLORS.brass.fill);
      if (t) {
        drawIcon(ctx, t.icon && hasIcon(t.icon) ? t.icon : 'strike', sx + 3, sy + 3, { ink: COLORS.paper.ink });
        if (t.id === current) { ctx.fillStyle = COLORS.paper.light; ctx.fillRect(sx + 11, sy + 2, 1, 1); ctx.fillRect(sx + 10, sy + 1, 1, 1); }
      } else {
        drawText(ctx, '–', sx + 5, sy + 3, { color: COLORS.paper.edge });
      }
      if (focused) drawDottedRect(ctx, sx - 2, sy - 2, 18, 18, COLORS.paper.light);
    }
    // name strip
    if (open) {
      const t = tools[focusIndex];
      const name = t ? t.name : STRINGS.empty;
      const tw = measureText(name).w;
      const w = tw + 12, h = 12;
      const nx = center.x - Math.floor(w / 2), ny = center.y + r + 20;
      ctx.fillStyle = COLORS.shadow; ctx.fillRect(nx + 1, ny + 1, w, h);
      ctx.fillStyle = COLORS.paper.light; ctx.fillRect(nx + 1, ny + 1, w - 2, h - 2);
      drawNotchedFrame(ctx, nx, ny, w, h, COLORS.paper.edge);
      drawText(ctx, name, nx + 6, ny + 2, { color: t ? COLORS.paper.ink : COLORS.role.disabled });
      if (t && t.id === current) drawText(ctx, 'equipped', center.x, ny + h + 2, { font: 'small', align: 'center', color: COLORS.paper.light });
      // centre: the current tool's icon
      const cur = tools[indexOf(current)];
      if (cur && current) drawIcon(ctx, cur.icon && hasIcon(cur.icon) ? cur.icon : 'strike', center.x - 4, center.y - 4, { ink: COLORS.paper.light, accent: PALETTE.y, light: COLORS.paper.light });
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
