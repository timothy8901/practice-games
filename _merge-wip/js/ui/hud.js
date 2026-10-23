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
import { drawCurrency, drawKeyGlyph, drawBadge } from './widgets.js';

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
 * @param {CanvasRenderingContext2D} ctx
 * @param {HudState} s
 */
export function drawHud(ctx, s) {
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
    const t = Math.min(1, Math.max(0, Number(s.tide) || 0));
    const word = tideWord(t, s.tideDir);
    const hint = s.tideHint ? `  ${s.tideHint}` : '';
    const label = `tide ${word}${hint}`;
    const gaugeW = 22;
    const tw = measureText(label, { font: 'small' }).w;
    const w = 2 + 8 + 2 + gaugeW + 3 + tw + 4, h = 13;
    chip(ctx, x, y, w, h);
    drawIcon(ctx, s.tideDir === 'falling' ? 'tideDown' : 'tideUp', x + 2, y + 2, { ink: PALETTE.t, light: COLORS.paper.light });
    // five-step gauge with an arrow-shaped marker
    const gx = x + 12, gy = y + 4;
    ctx.fillStyle = COLORS.paper.shade;
    ctx.fillRect(gx, gy, gaugeW, 5);
    ctx.fillStyle = COLORS.paper.rule;
    for (let i = 0; i <= 4; i++) ctx.fillRect(gx + Math.round((gaugeW - 1) * (i / 4)), gy, 1, 5);
    ctx.fillStyle = PALETTE.t;
    const mx = gx + Math.round((gaugeW - 1) * t);
    ctx.fillRect(mx, gy, 1, 5); ctx.fillRect(mx - 1, gy + 1, 3, 3); ctx.fillRect(mx - 2, gy + 2, 5, 1);
    drawText(ctx, label, gx + gaugeW + 3, y + 4, { font: 'small', color: ink });
    x += w + SPACE.sm;
  }

  // ---- wallet + pending shift (top-right) ----
  if (s.wallet !== undefined && s.wallet !== null) {
    const num = measureText(`${s.wallet}`).w;
    const w = 7 + 2 + measureText(formatWallet(s.wallet)).w + 8, h = 13;
    const wx = W - SPACE.sm - w;
    chip(ctx, wx, SPACE.sm, w, h);
    drawCurrency(ctx, s.wallet, wx + 4, SPACE.sm + 3);
    void num;
  }
  const pending = typeof s.pendingShift === 'number' ? s.pendingShift : s.pendingShift ? 1 : 0;
  if (pending > 0) {
    const text = pending > 1 ? `${pending} Shifts pending` : 'Shift pending';
    const tw = measureText(text).w;
    const w = 2 + 9 + tw + 4;
    drawBadge(ctx, text, W - SPACE.sm - w, SPACE.sm + 16, { style: 'shift', iconAccent: PALETTE.m });
  }

  // ---- tool (bottom-left) ----
  if (s.tool !== undefined) {
    const name = s.tool && s.tool.name ? s.tool.name : STRINGS.empty;
    const tw = measureText(name).w;
    const glyphW = measureText(labels.tool, { font: 'small' }).w + 6;
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
    const glyphW = device === 'touch' ? 9 + measureText(key, { font: 'small' }).w : Math.max(9, measureText(key, { font: 'small' }).w + 6);
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

/** @param {number} n */
function formatWallet(n) {
  const v = Math.trunc(Number(n) || 0);
  return String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
