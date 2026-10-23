/**
 * Shared bits for the SCN-FLOW screens (title, Seed Card, Lease Card, ending, credits, map).
 * [SCN-FLOW]
 *
 * - **Lease answers in the world.** The schema's `player.look` holds `{fur, marks, outfit}` and
 *   validation refuses extra keys, so the lease card writes the rest of its answers as `sys.lease.*`
 *   flags (strings / booleans are valid flag values): eye shape, blush, town name, Your Signal, the
 *   windowsill plant and the blackout wake point. `look.marks` is a bitmask over
 *   `art/chars.MARKINGS`. {@link cardFromWorld} turns all of it back into the art card that
 *   `art/chars.playerSprite` / `registerPlayerArt` draw, and {@link signalOfWorld} feeds the music
 *   director the six chime indices.
 * - **Your Signal.** Six pentatonic chimes D5 E5 F#5 A5 B5 D6 played on the engine's `bell` sfx
 *   (a 660 Hz bell, so each chime is a semitone offset from E5).
 * - **Wax-seal buttons**, the bobbing cursor, pointer hit tests, the device hint and the real hour
 *   for the title.
 *
 * DOM-free at import.
 * @module scenes/flowKit
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE, TIMING, TYPE } from '../ui/theme.js';
import { drawDottedRect } from '../ui/focus.js';
import { MARKINGS, EYE_SHAPES, PLAYER_SPECIES, DEFAULT_CARD } from '../art/chars/player.js';
import { isPorchLit } from '../systems/townCommon.js';
import { PORCH_IDS } from '../data/ids.manifest.js';

/** Flag ids the lease card writes (all in the `sys.` namespace). */
export const LEASE_FLAGS = Object.freeze({
  eyes: 'sys.lease.eyes',
  blush: 'sys.lease.blush',
  town: 'sys.lease.town',
  signal: 'sys.lease.signal',
  plant: 'sys.lease.plant',
  wake: 'sys.lease.wake',
  signed: 'sp.lease-signed',
});

/** The six chimes (GDD-00 §3). */
export const CHIME_NOTES = Object.freeze(['D5', 'E5', 'F#5', 'A5', 'B5', 'D6']);
/** Semitones from the bell sfx's 660 Hz (E5) to each chime. */
export const CHIME_SEMIS = Object.freeze([-2, 0, 2, 5, 7, 10]);
/** The default Signal: D5 F#5 A5 B5 A5 D6 (audio/tracks/letter.js). */
export const DEFAULT_SIGNAL = Object.freeze([0, 2, 3, 4, 3, 5]);

/**
 * Parses a stored Signal (`'0,2,3,4,3,5'` or an array) into six chime indices, or null.
 * @param {unknown} v
 * @returns {number[]|null}
 */
export function parseSignal(v) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : null;
  if (!arr || arr.length !== 6) return null;
  const out = arr.map((n) => Number(n));
  return out.every((n) => Number.isInteger(n) && n >= 0 && n <= 5) ? out : null;
}

/**
 * The player's Signal from a world (the lease flag, then `player.signal`), or null.
 * @param {any} world
 * @returns {number[]|null}
 */
export function signalOfWorld(world) {
  if (!world) return null;
  return parseSignal(world.flags?.[LEASE_FLAGS.signal]) ?? parseSignal(world.player?.signal) ?? null;
}

/**
 * Plays one chime on the engine (never throws; silent before the audio unlock).
 * @param {any} G
 * @param {number} i   chime index 0..5
 * @param {{delay?: number, volume?: number}} [o]
 */
export function playChime(G, i, o = {}) {
  try {
    G?.audio?.sfx?.('bell', { semitones: CHIME_SEMIS[Math.max(0, Math.min(5, i | 0))], volume: o.volume ?? 0.75, delay: o.delay ?? 0 });
  } catch { /* audio must never break a screen */ }
}

/**
 * Plays a whole Signal, one chime every `gapMs`.
 * @param {any} G
 * @param {number[]} notes
 * @param {{gapMs?: number, volume?: number}} [o]
 * @returns {number} total length in ms
 */
export function playSignal(G, notes, o = {}) {
  const gap = o.gapMs ?? 300;
  (notes ?? []).forEach((n, k) => playChime(G, n, { delay: (k * gap) / 1000, volume: o.volume }));
  return (notes?.length ?? 0) * gap;
}

/**
 * Bitmask of markings over `MARKINGS` (pure).
 * @param {string[]} list
 * @returns {number}
 */
export function marksToMask(list) {
  let m = 0;
  MARKINGS.forEach((k, i) => { if (list.includes(k)) m |= 1 << i; });
  return m;
}

/**
 * Markings from a bitmask (pure).
 * @param {number} mask
 * @returns {string[]}
 */
export function maskToMarks(mask) {
  return MARKINGS.filter((_, i) => (mask >> i) & 1);
}

/**
 * The art card (`art/chars/player` shape) for a world's player.
 * @param {any} world
 * @returns {{species: string, fur: number, markings: string[], eyes: string, blush: boolean, outfit: string}}
 */
export function cardFromWorld(world) {
  const p = world?.player ?? {};
  const f = world?.flags ?? {};
  const look = p.look ?? {};
  return {
    species: PLAYER_SPECIES.includes(p.species) ? p.species : DEFAULT_CARD.species,
    fur: Number.isInteger(look.fur) ? Math.max(0, Math.min(7, look.fur)) : 0,
    markings: maskToMarks(Number(look.marks) || 0),
    eyes: EYE_SHAPES.includes(f[LEASE_FLAGS.eyes]) ? f[LEASE_FLAGS.eyes] : 'round',
    blush: f[LEASE_FLAGS.blush] === true,
    outfit: look.outfit === 1 ? 'apron' : 'jumper',
  };
}

/**
 * The town name the player chose (letters and signs use it).
 * @param {any} world
 * @returns {string}
 */
export function townNameOf(world) {
  const v = world?.flags?.[LEASE_FLAGS.town];
  return typeof v === 'string' && v.trim() ? v : 'Pellwick';
}

/**
 * How many of the twenty porches are lit in a world.
 * @param {any} world
 * @param {any} data
 * @returns {number}
 */
export function litPorchCount(world, data) {
  if (!world) return 7;
  let n = 0;
  for (const id of PORCH_IDS) {
    try { if (isPorchLit(world, data, id)) n++; } catch { /* a porch that cannot be read is dark */ }
  }
  return n;
}

/** Minute of the real day (the title's live harbor). */
export function realMinute(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/** Whether reduced motion is on for this world. */
export function reducedMotionOf(G) {
  return Boolean(G?.world?.settings?.reducedMotion);
}

/** Transition length honouring `?noanim=1`. */
export function flowFade(G, ms = 400) {
  return G?.flags?.noanim ? 0 : ms;
}

/**
 * Whether a pointer position lies inside a rect.
 * @param {{x: number, y: number}|null|undefined} p
 * @param {{x: number, y: number, w: number, h: number}|null|undefined} r
 */
export function inRect(p, r) {
  return Boolean(p && r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
}

/**
 * The device the player last used: 'keyboard' | 'gamepad' | 'touch'.
 * @param {any} input
 */
export function deviceOf(input) {
  const d = input?.lastDevice;
  return d === 'gamepad' || d === 'touch' ? d : 'keyboard';
}

/**
 * One frame of a pointer tap against a list of rects with the two-step touch rule (first tap
 * focuses, a tap on the focused item activates; a mouse click does both).
 * @param {any} input
 * @param {Array<{x: number, y: number, w: number, h: number}|null>} rects
 * @param {number} focused
 * @returns {{index: number, activate: boolean}|null}
 */
export function tapRects(input, rects, focused) {
  const p = input?.pointer;
  if (!p || !p.justDown) return null;
  for (let i = 0; i < rects.length; i++) {
    if (!inRect(p, rects[i])) continue;
    const touch = p.type === 'touch' || input.lastDevice === 'touch';
    return { index: i, activate: !touch || i === focused };
  }
  return null;
}

/**
 * Hover: the rect index under a mouse pointer that MOVED since the last call (never for touch, and
 * never while the mouse rests, so the keyboard keeps its focus), or -1.
 * @param {any} input
 * @param {Array<{x: number, y: number, w: number, h: number}|null>} rects
 * @param {{x: number, y: number}} memo   per-scene record of the last pointer position
 */
export function hoverRects(input, rects, memo) {
  const p = input?.pointer;
  if (!p || !p.inside || p.type === 'touch') return -1;
  if (memo) {
    if (memo.x === p.x && memo.y === p.y) return -1;
    memo.x = p.x; memo.y = p.y;
  }
  for (let i = 0; i < rects.length; i++) if (inRect(p, rects[i])) return i;
  return -1;
}

/** Bob offset for the focus cursor (1 px every 520 ms). */
export function bobAt(ms) {
  return Math.floor(ms / TIMING.cursorBobMs) % 2;
}

/**
 * The ▶ cursor left of an item.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  right edge the cursor points at
 * @param {number} y  top of a 7 px cap row
 * @param {number} ms
 * @param {string} [color]
 */
export function drawCursor(ctx, x, y, ms, color = COLORS.focus.cursorOnPaper) {
  drawText(ctx, TYPE.cursor, x - 7 - bobAt(ms), y, { color });
}

/**
 * A wax-seal button (GDD-09 §1): wax red, 16 px tall, cream label, a pressed seal at the left; the
 * focused seal rises 1 px and gains the dotted ring. Disabled seals are grey wax with a dash.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} label
 * @param {{x: number, y: number, w: number, h?: number}} r
 * @param {{focused?: boolean, disabled?: boolean, pressed?: boolean, ms?: number, emblem?: 'plus'|'dot'|'star'|'arrow', dark?: boolean, ring?: boolean}} [o]
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function drawWaxButton(ctx, label, r, o = {}) {
  const h = r.h ?? 16;
  const lift = o.focused && !o.pressed ? 1 : 0;
  const x = Math.round(r.x), y = Math.round(r.y) - lift, w = Math.round(r.w);
  const fill = o.disabled ? PALETTE.e : o.focused ? PALETTE.waxLight : PALETTE.waxRed;
  const dark = o.disabled ? PALETTE.d : PALETTE.waxDark;
  // drop shadow (deeper when raised)
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x + 1, y + 2 + lift, w, h - 1);
  // body with notched corners
  ctx.fillStyle = dark;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 3);
  // lit top edge like pressed wax, a darker lip at the bottom
  ctx.fillStyle = o.disabled ? PALETTE.v : PALETTE.waxLight;
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  if (o.focused && !o.disabled) { ctx.fillStyle = '#E07A82'; ctx.fillRect(x + 2, y + 1, w - 4, 1); }
  // the round seal at the left: a stamped disc with an emblem
  const sx = x + 3, sy = y + 2;
  ctx.fillStyle = dark;
  ctx.fillRect(sx + 1, sy, 9, 11); ctx.fillRect(sx, sy + 1, 11, 9);
  ctx.fillStyle = o.disabled ? PALETTE.v : COLORS.brass.fill;
  ctx.fillRect(sx + 2, sy + 1, 7, 9); ctx.fillRect(sx + 1, sy + 2, 9, 7);
  ctx.fillStyle = o.disabled ? PALETTE.e : COLORS.brass.dark;
  const em = o.emblem ?? 'plus';
  if (em === 'plus') { ctx.fillRect(sx + 5, sy + 3, 1, 5); ctx.fillRect(sx + 3, sy + 5, 5, 1); }
  else if (em === 'dot') { ctx.fillRect(sx + 4, sy + 4, 3, 3); }
  else if (em === 'star') { ctx.fillRect(sx + 5, sy + 2, 1, 7); ctx.fillRect(sx + 2, sy + 5, 7, 1); ctx.fillRect(sx + 4, sy + 4, 3, 3); }
  else if (em === 'arrow') { ctx.fillRect(sx + 3, sy + 5, 5, 1); ctx.fillRect(sx + 6, sy + 4, 1, 3); ctx.fillRect(sx + 5, sy + 3, 1, 1); ctx.fillRect(sx + 5, sy + 7, 1, 1); }
  // label
  const text = o.disabled ? `${label}` : label;
  const tw = measureText(text).w;
  const lx = x + 16 + Math.max(0, Math.floor((w - 18 - tw) / 2));
  drawText(ctx, text, lx, y + Math.floor((h - 1 - TYPE.capH) / 2), { color: o.disabled ? PALETTE.v : PALETTE.paperLightest });
  if (o.disabled) { ctx.fillStyle = PALETTE.v; ctx.fillRect(lx - 1, y + Math.floor(h / 2) - 1, tw + 2, 1); }
  if (o.focused && o.ring !== false) drawDottedRect(ctx, x - 2, y - 2, w + 4, h + 4, o.dark ? COLORS.focus.ringOnDark : COLORS.focus.ringOnPaper);
  return { x, y: y + lift, w, h };
}

/**
 * A small paper key-glyph hint line, e.g. `Z: Choose   X: Back`, picked by device.
 * @param {any} input
 * @param {{keyboard: string, gamepad: string, touch: string}} hints
 */
export function hintFor(input, hints) {
  return hints[deviceOf(input)] ?? hints.keyboard;
}

/**
 * Wraps a seed code typed by hand into a canonical upper-case form (no validation).
 * @param {string} s
 */
export function tidySeed(s) {
  return String(s ?? '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '-');
}
