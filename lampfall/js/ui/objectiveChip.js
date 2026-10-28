/**
 * The HUD's "Next:" chip (first-hour review FH-09 / top10 #4). [UI-HUD]
 *
 * - {@link objectiveFor} is the pause menu's objective picker (`scenes/menuModel.currentObjective`)
 *   with one ranking fix: optional neighbour meets (`meet-*` beats) rank below every other ready
 *   story beat (the errands) and below a loan step Wren is waiting on, so the chip never says "Meet
 *   the neighbours" while the mail sack, the Field Log or the fish are still to do.
 * - {@link createObjectiveChip} decides when the chip shows: for {@link CHIP_SHOW_MS} after the
 *   objective's text changes and after the player comes back from a menu, sliding in and fading out.
 * - {@link drawObjectiveChip} draws the slim chip under the clock: "Next: <line>", word + glyph.
 *
 * Pure apart from the draw call (which needs only a 2D context). The HUD reads; it never writes.
 * @module ui/objectiveChip
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE } from './theme.js';
import { drawNotchedFrame } from './panel.js';
import { t, has } from '../data/strings.js';
import { currentObjective, readyBeats, YARD_COUNTER } from '../scenes/menuModel.js';
import * as loansSys from '../systems/loans.js';

/** How long the chip stays up after a change or a menu closing (ms). */
export const CHIP_SHOW_MS = 6000;
/** Slide-in and fade-out length (ms). */
export const CHIP_FADE_MS = 300;
/** How often the field re-reads the objective (ms; it walks every story trigger). */
export const CHIP_POLL_MS = 1000;

/** Optional beats: met-the-neighbours steps (story ids `meet-*`). */
export const isOptionalBeat = (beat) => !!beat && typeof beat.id === 'string' && beat.id.startsWith('meet-');

/**
 * Ready beats with the optional meets moved after everything else (stable within each group).
 * @template {{id: string}} B
 * @param {B[]} beats
 * @returns {B[]}
 */
export function rankBeats(beats) {
  const list = Array.isArray(beats) ? beats : [];
  return [...list.filter((b) => !isOptionalBeat(b)), ...list.filter(isOptionalBeat)];
}

/**
 * The objective of one story beat, worded as the pause menu words it.
 * @param {{id: string, script: string, mapId: string, x: number, y: number}} beat
 * @param {any} data
 */
function beatObjective(beat, data) {
  const key = has(`objective.story.${beat.id}`) ? `objective.story.${beat.id}` : has(`objective.story.${beat.script}`) ? `objective.story.${beat.script}` : null;
  let place = beat.mapId;
  try { if (data && typeof data.has === 'function' && data.has('maps', beat.mapId)) place = data.get('maps', beat.mapId)?.name ?? place; } catch { /* fixture */ }
  return { kind: 'story', text: key ? t(key) : t('objective.story', { place }), mapId: beat.mapId, x: beat.x, y: beat.y };
}

/**
 * A loan step Wren is waiting on (a room to pick, a loan the satchel can clear), or null.
 * @param {any} world @param {any} data
 */
function loanStep(world, data) {
  const ctx = { data };
  try {
    const pick = loansSys.pendingPickTier(world, ctx);
    if (pick !== null) return { kind: 'room', text: t('objective.room', { n: pick }), ...YARD_COUNTER };
    if (!loansSys.isPaidOff(world, ctx)) {
      const owed = loansSys.balance(world, ctx);
      const tier = world?.loans?.tier ?? 1;
      if (owed > 0 && (world?.wallet?.main ?? 0) >= owed) return { kind: 'loan', text: t('objective.loanReady', { n: tier }), ...YARD_COUNTER };
    }
  } catch { /* loans tables missing in a fixture */ }
  return null;
}

/**
 * What to do next (the pause menu's picker, errands and loan steps before optional meets).
 * @param {any} world
 * @param {any} data
 * @returns {{kind: string, text: string, mapId: string|null, x: number|null, y: number|null}}
 */
export function objectiveFor(world, data) {
  const cur = currentObjective(world, data);
  if (!cur || cur.kind !== 'story') return cur;
  let beats = [];
  try { beats = readyBeats(world, data); } catch { beats = []; }
  if (!beats.length || !isOptionalBeat(beats[0])) return cur;
  // only re-rank what the picker took from the ready beats (never the pre-starter "the causeway" line)
  const f = world?.flags;
  if (f && !f['sp.starter-chosen'] && (f['sp.arrived'] || !(world.party?.length))) return cur;
  const real = rankBeats(beats)[0];
  if (real && !isOptionalBeat(real)) return beatObjective(real, data);
  return loanStep(world, data) ?? cur;
}

/**
 * When the chip shows. Feed it the objective's text as it is read and tell it when a menu closed.
 * @param {{showMs?: number, fadeMs?: number}} [o]
 */
export function createObjectiveChip(o = {}) {
  const showMs = o.showMs ?? CHIP_SHOW_MS;
  const fadeMs = o.fadeMs ?? CHIP_FADE_MS;
  let text = '';
  let shownAt = -Infinity;
  let armed = false;
  return {
    /**
     * The objective as read now; a changed line shows the chip.
     * @param {string|null|undefined} line @param {number} now ms
     * @returns {boolean} whether the line changed
     */
    observe(line, now) {
      const next = typeof line === 'string' ? line : '';
      if (next === text) return false;
      text = next;
      if (next) shownAt = now;
      return true;
    },
    /** Show the chip again now (the player came back from a menu). @param {number} now */
    bump(now) { if (text) shownAt = now; },
    /** Remember that a menu is opening, so the next resume bumps. */
    arm() { armed = true; },
    /** The scene resumed: bump when a menu had been opened. @param {number} now @returns {boolean} */
    resumed(now) { const was = armed; armed = false; if (was) this.bump(now); return was; },
    /** Hide at once (a cutscene, a dialogue). */
    hide() { shownAt = -Infinity; },
    get text() { return text; },
    /**
     * 0..1 presence at `now` (slide/fade in, hold, fade out); 0 = hidden.
     * @param {number} now
     */
    alpha(now) {
      const e = now - shownAt;
      if (!text || !(e >= 0) || e >= showMs) return 0;
      if (e < fadeMs) return e / fadeMs;
      if (e > showMs - fadeMs) return (showMs - e) / fadeMs;
      return 1;
    },
  };
}

/**
 * The chip's line under its own "Next:" label: a line that starts "Next seal:" / "Next:" drops that
 * prefix so the chip never reads "NEXT: Next seal: Ward Spire…" (LF-22). Pure.
 * @param {string} line
 * @returns {string}
 */
export function chipBody(line) {
  const s = typeof line === 'string' ? line : '';
  const out = s.replace(/^\s*next(\s+seal)?\s*:\s*/i, '');
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : s;
}

/**
 * Draws the chip: a slim paper strip at (x, y), "Next:" in amber-ink and the line, clipped to `maxW`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} line
 * @param {{x?: number, y?: number, maxW?: number, alpha?: number}} [o]
 * @returns {{x: number, y: number, w: number, h: number}|null}
 */
export function drawObjectiveChip(ctx, line, o = {}) {
  const a = Math.max(0, Math.min(1, o.alpha ?? 1));
  if (!line || a <= 0) return null;
  const label = t('menu.next');
  const lw = measureText(label, { font: 'small' }).w;
  const maxW = o.maxW ?? 300;
  const full = chipBody(line);
  let body = full;
  while (body.length > 4 && measureText(body).w + lw + 16 > maxW) body = body.slice(0, -2);
  if (body !== full) body = `${body.replace(/\s+$/, '')}…`;
  const w = 4 + 6 + 3 + lw + 4 + measureText(body).w + 5;
  const h = 13;
  const x = Math.round((o.x ?? 4) - (1 - a) * 12);
  const y = o.y ?? 21;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x + 1, y + 1, w, h);
  ctx.fillStyle = COLORS.paper.light;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawNotchedFrame(ctx, x, y, w, h, COLORS.paper.ink);
  // a pin glyph (shape, not colour alone)
  ctx.fillStyle = PALETTE.r;
  ctx.fillRect(x + 5, y + 3, 4, 4);
  ctx.fillRect(x + 6, y + 7, 2, 3);
  ctx.fillStyle = COLORS.paper.light;
  ctx.fillRect(x + 6, y + 4, 1, 1);
  drawText(ctx, label, x + 13, y + 4, { font: 'small', color: COLORS.paper.inkSoft });
  drawText(ctx, body, x + 13 + lw + 4, y + 3, { color: COLORS.paper.ink });
  ctx.restore();
  return { x, y, w, h };
}
