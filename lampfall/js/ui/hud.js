/**
 * Overworld HUD. [UI-HUD] — ARCHITECTURE-DRAFT §7.
 *
 * `drawHud(ctx, {clockText, tide, wallet, tool, contextVerb, pendingShift, device, showClock})`.
 * Reads plain values, draws:
 *  - top-left: clock chip (sun/moon icon + text, hidden when `showClock` is false) and the tide
 *    gauge (an arrow-shaped marker on a 5-step scale plus the word `low`/`rising`/`high`/`falling`
 *    and a "low in 12m" hint when given);
 *  - top-right: wallet (`◉ 1,240`) and, beneath it, the pending-Shift pip (✦ badge + the word);
 *  - bottom-left: the equipped tool (icon + name) with the device glyph for the tool action;
 *  - bottom-centre: the context verb — device glyph + verb icon + word ("[Z] Talk").
 * Everything is a word plus a glyph; nothing reads by colour alone. Pure: `tideWord()`.
 * @module ui/hud
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, DEVICE_LABELS, PALETTE, SPACE, STRINGS } from './theme.js';
import { drawIcon, hasIcon } from './icons.js';
import { drawNotchedFrame } from './panel.js';
import { drawCurrency, drawKeyGlyph, drawBadge, keyGlyphWidth, formatNumber } from './widgets.js';

/**
 * Word for a tide level (0 = low, 1 = high) and its direction.
 * @param {number} tide @param {'rising'|'falling'|''} [dir]
 * @returns {string}
 */
export function tideWord(tide, dir) {
  const t = Math.min(1, Math.max(0, Number(tide) || 0));
  if (t <= 0.2) return 'low';
  if (t >= 0.8) return 'high';
  return dir === 'falling' ? 'falling' : 'rising';
}

/**
 * @typedef {Object} HudState
 * @property {string} [clockText]           "4:52 pm"
 * @property {boolean} [night]              Moon instead of sun.
 * @property {boolean} [showClock=true]
 * @property {number} [tide]                0..1
 * @property {'rising'|'falling'} [tideDir]
 * @property {string} [tideHint]            "low in 12m"
 * @property {number} [wallet]
 * @property {{id?: string, name: string, icon?: string}|null} [tool]
 * @property {{verb: string, label?: string, icon?: string, enabled?: boolean, reason?: string}|null} [contextVerb]
 * @property {number|boolean} [pendingShift]  Count of deferred Forecasts (true = 1).
 * @property {'keyboard'|'gamepad'|'touch'} [device]
 * @property {number} [width] @property {number} [height]
 */

/**
 * Chip background: light paper with an ink edge, sized to content.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w @param {number} h
 */
function chip(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x + 1, y + 1, w, h);
  ctx.fillStyle = COLORS.paper.light;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawNotchedFrame(ctx, x, y, w, h, COLORS.paper.ink);
}

/**
 * Draw the HUD. Takes the plain HudState (`drawHud(ctx, state)`), or the architecture's call shape
 * `drawHud(ctx, G, {verb, showClock, ...state})`, where only `G.display`'s size is read and every
 * value comes from the third argument (the HUD never reads world state itself).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HudState|{display?: {width?: number, height?: number}}} a
 * @param {HudState & {verb?: HudState['contextVerb']}} [b]
 */
export function drawHud(ctx, a, b) {
  /** @type {HudState} */
  const s = b === undefined ? (a || {}) : {
    ...b,
    contextVerb: b.contextVerb !== undefined ? b.contextVerb : (b.verb || null),
    width: b.width || (a && a.display && a.display.width) || undefined,
    height: b.height || (a && a.display && a.display.height) || undefined,
  };
  const W = s.width || (ctx.canvas && ctx.canvas.width) || 480;
  const H = s.height || (ctx.canvas && ctx.canvas.height) || 270;
  const device = s.device === 'gamepad' || s.device === 'touch' ? s.device : 'keyboard';
  const labels = DEVICE_LABELS[device];
  const ink = COLORS.paper.ink;

  // ---- clock + tide (top-left) ----
  let x = SPACE.sm, y = SPACE.sm;
  if (s.showClock !== false && s.clockText) {
    const tw = measureText(s.clockText).w;
    const w = 2 + 8 + 3 + tw + 4, h = 13;
    chip(ctx, x, y, w, h);
    drawIcon(ctx, s.night ? 'moon' : 'sun', x + 2, y + 2, { ink: s.night ? PALETTE.n : COLORS.brass.dark, accent: s.night ? PALETTE.v : COLORS.brass.light, light: COLORS.paper.light });
    drawText(ctx, s.clockText, x + 13, y + 3, { color: ink });
    x += w + SPACE.sm;
  }
  if (s.tide !== undefined && s.tide !== null) {
    // Tide: direction arrow + a water gauge (number of quarters readable from the ticks) + the word,
    // then the relative hint in the small face ("low in 12m"). Shape + word, never colour alone.
    const t = Math.min(1, Math.max(0, Number(s.tide) || 0));
    const word = capitalize(tideWord(t, s.tideDir));
    const hint = s.tideHint || '';
    const gaugeW = 24;
    const ww = measureText(word).w;
    const hw = hint ? measureText(hint, { font: 'small' }).w + 5 : 0;
    const w = 2 + 8 + 3 + gaugeW + 4 + ww + hw + 4, h = 13;
    chip(ctx, x, y, w, h);
    drawIcon(ctx, s.tideDir === 'falling' ? 'tideDown' : 'tideUp', x + 2, y + 2, { ink: PALETTE.t, light: COLORS.paper.light });
    const gx = x + 13, gy = y + 3;
    ctx.fillStyle = ink;
    ctx.fillRect(gx, gy, gaugeW, 7);
    ctx.fillStyle = COLORS.paper.shade;
    ctx.fillRect(gx + 1, gy + 1, gaugeW - 2, 5);
    const fw = Math.round((gaugeW - 2) * t);
    if (fw > 0) {
      ctx.fillStyle = PALETTE.t;
      ctx.fillRect(gx + 1, gy + 2, fw, 4);
      ctx.fillStyle = PALETTE.s; // wave crest: every other pixel on the top row
      for (let i = 0; i < fw; i += 2) ctx.fillRect(gx + 1 + i, gy + 1, 1, 1);
    }
    ctx.fillStyle = ink;
    for (let q = 1; q < 4; q++) ctx.fillRect(gx + Math.round((gaugeW * q) / 4), gy + 5, 1, 1);
    drawText(ctx, word, gx + gaugeW + 4, y + 3, { color: ink });
    if (hint) drawText(ctx, hint, gx + gaugeW + 4 + ww + 5, y + 4, { font: 'small', color: COLORS.paper.inkSoft });
    x += w + SPACE.sm;
  }

  // ---- wallet + pending shift (top-right) ----
  if (s.wallet !== undefined && s.wallet !== null) {
    const w = 7 + 2 + measureText(formatNumber(s.wallet)).w + 8, h = 13;
    const wx = W - SPACE.sm - w;
    chip(ctx, wx, SPACE.sm, w, h);
    drawCurrency(ctx, s.wallet, wx + 4, SPACE.sm + 3);
  }
  const pending = typeof s.pendingShift === 'number' ? s.pendingShift : s.pendingShift ? 1 : 0;
  if (pending > 0) {
    const text = pending > 1 ? `${pending} Shifts pending` : 'Shift pending';
    const tw = measureText(text).w;
    const w = 2 + 9 + tw + 4;
    drawBadge(ctx, text, W - SPACE.sm - w, SPACE.sm + 16, { style: 'shift', icon: 'heartmark', iconAccent: PALETTE.m });
  }

  // ---- tool (bottom-left) ----
  if (s.tool !== undefined) {
    const name = s.tool && s.tool.name ? s.tool.name : STRINGS.empty;
    const tw = measureText(name).w;
    const glyphW = keyGlyphWidth(device, labels.tool);
    const w = 2 + glyphW + 3 + 8 + 3 + tw + 4, h = 13;
    const tx = SPACE.sm, ty = H - SPACE.sm - h;
    chip(ctx, tx, ty, w, h);
    drawKeyGlyph(ctx, device, labels.tool, tx + 2, ty + 2);
    const icon = s.tool && s.tool.icon && hasIcon(s.tool.icon) ? s.tool.icon : 'strike';
    drawIcon(ctx, icon, tx + 2 + glyphW + 3, ty + 2, { ink: s.tool ? ink : COLORS.role.disabled });
    drawText(ctx, name, tx + 2 + glyphW + 3 + 11, ty + 3, { color: s.tool ? ink : COLORS.role.disabled });
  }

  // ---- context verb (bottom-centre) ----
  if (s.contextVerb) {
    const v = s.contextVerb;
    const enabled = v.enabled !== false;
    const word = v.label || v.verb;
    const icon = v.icon || (hasIcon(v.verb) ? v.verb : null);
    const key = labels.confirm;
    const glyphW = keyGlyphWidth(device, key);
    const tw = measureText(word).w;
    const reason = !enabled && v.reason ? v.reason : '';
    const rw = reason ? measureText(reason, { font: 'small' }).w + 6 : 0;
    const w = 2 + glyphW + 3 + (icon ? 11 : 0) + tw + rw + 4, h = 13;
    const cx = Math.floor((W - w) / 2), cy = H - SPACE.sm - h;
    chip(ctx, cx, cy, w, h);
    drawKeyGlyph(ctx, device, key, cx + 2, cy + 2);
    let lx = cx + 2 + glyphW + 3;
    if (icon) { drawIcon(ctx, icon, lx, cy + 2, { ink: enabled ? ink : COLORS.role.disabled }); lx += 11; }
    drawText(ctx, word, lx, cy + 3, { color: enabled ? ink : COLORS.role.disabled });
    if (reason) drawText(ctx, reason, lx + tw + 4, cy + 4, { font: 'small', color: COLORS.role.disabled });
  }
}

/** @param {string} w */
function capitalize(w) {
  return w ? w[0].toUpperCase() + w.slice(1) : w;
}
