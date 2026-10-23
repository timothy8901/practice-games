/**
 * Tide rules over a runtime map (ARCHITECTURE §4.1, §4.2, §4.8). Pure: no DOM, no data imports.
 *
 * The clock (core/time) owns the tide *height* and *state*; this module turns either into the
 * three render/passability variants (`'low' | 'mid' | 'high'`) and answers the questions the
 * overworld asks about a tile at a given tide:
 *
 *  - {@link flooded}: is this tile under water for a walker right now (a causeway at mid tide,
 *    the flats at high tide, open sea always)?
 *  - {@link awash}: does the tile *draw* as water right now (also true for `tide:'floods'` tiles
 *    that stay walkable but visually flood at high water)?
 *  - {@link nearestDry}: where does a stranded walker get moved to ("the sea came up, you waded",
 *    §4.8): breadth-first through wadeable water to the nearest dry passable tile.
 *  - {@link floodDelta}: which cells change between two tides (the 1 s shoreline dissolve, §12).
 *
 * Thresholds mirror core/time's defaults exactly: `tide < 0.2` is low, `tide > 0.8` is high.
 *
 * Lane: WORLD-MAP.
 * @module world/tide
 */

import { DEFAULT_LOW_TIDE, DEFAULT_HIGH_TIDE } from '../core/time.js';

/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {'low'|'mid'|'high'} TideVariant */
/** @typedef {import('./tilemap.js').RuntimeMap} RuntimeMap */

/** Tide height below which the variant is `'low'` (core/time's `lowTide` default). */
export const LOW_TIDE = DEFAULT_LOW_TIDE;
/** Tide height above which the variant is `'high'` (core/time's `highTide` default). */
export const HIGH_TIDE = DEFAULT_HIGH_TIDE;

/** The three variants, in rising order. @type {readonly TideVariant[]} */
export const TIDE_VARIANTS = Object.freeze(['low', 'mid', 'high']);

/**
 * Per-tile tide classes stored in `RuntimeMap.tideMask` (ARCHITECTURE §4.2), derived from the
 * tile definition's `tide` field: `null` -> NONE, `'low'` -> LOW_ONLY, `'high'` -> HIGH_ONLY,
 * `'floods'` -> FLOODS, `'glow'` -> GLOW.
 *
 * - `LOW_ONLY` (causeways, stepping stones, flats): walkable at low tide, water otherwise.
 * - `HIGH_ONLY` (slipways, boat lanes): open at high tide only.
 * - `FLOODS` (wet sand): always walkable; draws as water at high tide.
 * - `GLOW` (bioluminescent mud): as LOW_ONLY, and glows at night.
 * @enum {number}
 */
export const TIDE_MASK = Object.freeze({ NONE: 0, LOW_ONLY: 1, HIGH_ONLY: 2, FLOODS: 3, GLOW: 4 });

/** Tile-definition `tide` values, by mask code. @type {readonly (string|null)[]} */
export const TIDE_MASK_NAMES = Object.freeze([null, 'low', 'high', 'floods', 'glow']);

/**
 * Converts a tile definition's `tide` field to a {@link TIDE_MASK} code.
 * @param {string|number|boolean|null|undefined} tide
 * @returns {number}
 * @throws {TypeError} on an unknown value
 */
export function tideMaskOf(tide) {
  if (tide === null || tide === undefined || tide === false || tide === 0) return TIDE_MASK.NONE;
  if (typeof tide === 'number') {
    if (Number.isInteger(tide) && tide >= 0 && tide <= 4) return tide;
    throw new TypeError(`tide: mask code ${tide} is not 0..4`);
  }
  const i = TIDE_MASK_NAMES.indexOf(tide);
  if (i < 0) throw new TypeError(`tide: unknown tile tide value ${JSON.stringify(tide)} (want 'low' | 'high' | 'floods' | 'glow' | null)`);
  return i;
}

/**
 * The render/passability variant for a tide.
 *
 * Accepts the clock's height (`0..1`, `clock.tide`), its state (`'low'|'rising'|'high'|'falling'`,
 * `clock.tideState` / `selectors.tideState(world)`) or a variant that is passed straight through.
 * @param {number|TideState|TideVariant} tide
 * @returns {TideVariant}
 * @throws {TypeError} on anything else, so a missing argument is caught at the call site
 */
export function tideVariant(tide) {
  if (typeof tide === 'number') {
    if (Number.isNaN(tide)) throw new TypeError('tideVariant: tide is NaN');
    if (tide < LOW_TIDE) return 'low';
    if (tide > HIGH_TIDE) return 'high';
    return 'mid';
  }
  if (tide === 'low' || tide === 'high' || tide === 'mid') return tide;
  if (tide === 'rising' || tide === 'falling') return 'mid';
  throw new TypeError(`tideVariant: expected a tide height 0..1 or a tide state, got ${JSON.stringify(tide)}`);
}

/**
 * Whether a tile with this tide class is open to a walker at this variant (ignoring `solid`
 * and plain water, which the map handles).
 * @param {number} mask {@link TIDE_MASK} code
 * @param {TideVariant} variant
 * @returns {boolean} `true` for NONE and FLOODS; LOW_ONLY/GLOW only at `'low'`; HIGH_ONLY only at `'high'`
 */
export function gateOpen(mask, variant) {
  switch (mask) {
    case TIDE_MASK.LOW_ONLY:
    case TIDE_MASK.GLOW:
      return variant === 'low';
    case TIDE_MASK.HIGH_ONLY:
      return variant === 'high';
    default:
      return true;
  }
}

/**
 * Whether a tile with this tide class *draws* as water at this variant.
 * @param {number} mask {@link TIDE_MASK} code
 * @param {TideVariant} variant
 * @param {boolean} water the tile definition's own `water` flag
 * @returns {boolean}
 */
export function drawsAsWater(mask, variant, water) {
  switch (mask) {
    case TIDE_MASK.LOW_ONLY:
    case TIDE_MASK.GLOW:
      return variant !== 'low';
    case TIDE_MASK.HIGH_ONLY:
      return variant !== 'high';
    case TIDE_MASK.FLOODS:
      return variant === 'high';
    default:
      return water;
  }
}

/**
 * Whether the tile at `(x, y)` is under water for a walker at this tide: open sea, or a tide
 * gate that is closed. Solid tiles and out-of-bounds cells are not flooded (they are walls),
 * and a `collision` `'.'` override is never flooded (a hidden ford).
 * @param {RuntimeMap} map
 * @param {number} x
 * @param {number} y
 * @param {number|TideState|TideVariant} tide
 * @returns {boolean}
 */
export function flooded(map, x, y, tide) {
  const i = map.index(x, y);
  if (i < 0) return false;
  return floodedAt(map, i, tideVariant(tide));
}

/**
 * {@link flooded} by cell index with a resolved variant (the hot-path form used by the map).
 * @param {RuntimeMap} map
 * @param {number} i cell index `y * w + x`
 * @param {TideVariant} variant
 * @returns {boolean}
 */
export function floodedAt(map, i, variant) {
  const c = map.collision[i];
  if (c === COLLISION.SOLID || c === COLLISION.OPEN) return false;
  if (c === COLLISION.INHERIT && map.solidMask[i] === 1) return false;
  const gate = c === COLLISION.LOW ? TIDE_MASK.LOW_ONLY : c === COLLISION.HIGH ? TIDE_MASK.HIGH_ONLY : map.tideMask[i];
  if (!gateOpen(gate, variant)) return true;
  return gate === TIDE_MASK.NONE && map.waterMask[i] === 1;
}

/**
 * Whether the tile at `(x, y)` draws as water at this tide (its art variant), including
 * `tide:'floods'` tiles at high water. Collision overrides do not change art.
 * @param {RuntimeMap} map
 * @param {number} x
 * @param {number} y
 * @param {number|TideState|TideVariant} tide
 * @returns {boolean}
 */
export function awash(map, x, y, tide) {
  const i = map.index(x, y);
  if (i < 0) return false;
  return drawsAsWater(map.tideMask[i], tideVariant(tide), map.waterMask[i] === 1);
}

/**
 * Whether a walker may stand on `(x, y)` at this tide: in bounds, passable and not flooded.
 * @param {RuntimeMap} map
 * @param {number} x
 * @param {number} y
 * @param {number|TideState|TideVariant} tide
 * @returns {boolean}
 */
export function dry(map, x, y, tide) {
  const i = map.index(x, y);
  if (i < 0) return false;
  const v = tideVariant(tide);
  return map.passable(x, y, v, 'walk') && !floodedAt(map, i, v);
}

/** Breadth-first step order: north, east, south, west (deterministic tie-breaking). */
const STEP_DX = Object.freeze([0, 1, 0, -1]);
const STEP_DY = Object.freeze([-1, 0, 1, 0]);

/**
 * Nearest tile a stranded walker is moved to when the tide rises under them (§4.8).
 *
 * Breadth-first, four-directional, from `(x, y)`; the search wades through flooded water but
 * never through solid tiles or closed `collision` walls, so a player is never teleported through
 * a cliff. The first dry tile in BFS order wins; equal distances tie-break north, east, south,
 * west, then by discovery order, so the answer is deterministic. The start tile itself is
 * returned (distance 0) when it is already dry.
 * @param {RuntimeMap} map
 * @param {number} x
 * @param {number} y
 * @param {number|TideState|TideVariant} tide
 * @param {{maxDist?: number}} [opts] give up beyond this many steps (default: the whole map)
 * @returns {{x: number, y: number, dist: number}|null} `null` when no dry tile is reachable
 */
export function nearestDry(map, x, y, tide, opts) {
  const start = map.index(x, y);
  if (start < 0) return null;
  const v = tideVariant(tide);
  const maxDist = opts && Number.isFinite(opts.maxDist) ? opts.maxDist : Infinity;
  const { w, h } = map;
  const n = w * h;
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  dist[start] = 0;
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    const cx = i % w;
    const cy = (i - cx) / w;
    if (map.passable(cx, cy, v, 'walk') && !floodedAt(map, i, v)) return { x: cx, y: cy, dist: d };
    if (d >= maxDist) continue;
    for (let k = 0; k < 4; k++) {
      const nx = cx + STEP_DX[k];
      const ny = cy + STEP_DY[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j] >= 0) continue;
      if (!wadeable(map, j)) continue;
      dist[j] = d + 1;
      queue[tail++] = j;
    }
  }
  return null;
}

/**
 * Whether a cell can be waded through while looking for dry land: anything that is not a wall.
 * @param {RuntimeMap} map
 * @param {number} i
 * @returns {boolean}
 */
function wadeable(map, i) {
  const c = map.collision[i];
  if (c === COLLISION.SOLID) return false;
  if (c === COLLISION.OPEN || c === COLLISION.LOW || c === COLLISION.HIGH) return true;
  return map.solidMask[i] === 0;
}

/**
 * Cells whose water appearance changes between two tides, for the shoreline dissolve.
 * @param {RuntimeMap} map
 * @param {number|TideState|TideVariant} from
 * @param {number|TideState|TideVariant} to
 * @returns {number[]} cell indexes (`y * w + x`), ascending; empty when the variants are equal
 */
export function floodDelta(map, from, to) {
  const a = tideVariant(from);
  const b = tideVariant(to);
  const out = [];
  if (a === b) return out;
  const n = map.w * map.h;
  for (let i = 0; i < n; i++) {
    const water = map.waterMask[i] === 1;
    const m = map.tideMask[i];
    if (drawsAsWater(m, a, water) !== drawsAsWater(m, b, water)) out.push(i);
  }
  return out;
}

/**
 * Validator helper (§4.1): every tile a walker can stand on at low tide must have a dry tile
 * reachable at high tide, or the rising sea would trap them. Returns the offenders.
 * @param {RuntimeMap} map
 * @returns {{x: number, y: number}[]} tide-gated tiles with no `nearestDry` at `'high'`
 */
export function strandedTiles(map) {
  const out = [];
  const { w, h } = map;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!map.passable(x, y, 'low', 'walk')) continue;
      if (!floodedAt(map, i, 'high')) continue;
      if (nearestDry(map, x, y, 'high') === null) out.push({ x, y });
    }
  }
  return out;
}

/**
 * Codes stored in `RuntimeMap.collision` from the optional `collision` layer (§4.1):
 * `'-'` INHERIT (from the tile definitions), `'#'` SOLID, `'.'` OPEN, `'L'` LOW (open only at
 * low tide), `'H'` HIGH (open only at high tide, boats).
 * @enum {number}
 */
export const COLLISION = Object.freeze({ INHERIT: 0, SOLID: 1, OPEN: 2, LOW: 3, HIGH: 4 });

/** Collision layer characters, by {@link COLLISION} code. */
export const COLLISION_CHARS = Object.freeze(['-', '#', '.', 'L', 'H']);
