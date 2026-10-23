/**
 * Day/night grading and light sources (ARCHITECTURE §4.7, §8.4). Pure: no DOM, no canvas.
 *
 * Lighting is a palette LUT, not a multiply overlay: {@link gradeFor} returns one of 48 quantized
 * {@link Grade}s per day (one per 30 in-game minutes) and {@link gradeHex} re-grades a palette
 * colour through it (multiply tint -> screen against the night-ink floor -> saturation trim, never
 * below ink). Colours whose palette names start with `!` bypass the LUT upstream (art/atlas), so
 * lamps, bioluminescence, skyglass and lit windows read as light sources at night.
 *
 * {@link lightSources} lists the additive pools the light pass draws (≤ 24 per view, §12) from the
 * map's glowing tiles and props: lamps and windows light after dusk, porches only while the house
 * is occupied (a world flag named by the tile's `glow.flag`), bioluminescent mud only at night on a
 * low tide, runes always.
 *
 * Grades are cached and frozen, so a renderer may key chunk bakes on `grade.id` and compare grades
 * by identity.
 *
 * Lane: WORLD-FX (built by WORLD-MAP per the task split).
 * @module world/lighting
 */

import { MINUTES_PER_DAY } from '../core/time.js';
import { minuteOfDay, tideState as tideStateOf } from '../state/selectors.js';
import { evalCond as dslEvalCond } from '../script/cond.js';
import { tideVariant } from './tide.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('./tilemap.js').RuntimeMap} RuntimeMap */
/** @typedef {import('./tilemap.js').GlowDef} GlowDef */

/** Minutes per grade slot: 48 grades a day (§4.7). */
export const GRADE_STEP_MINUTES = 30;

/** Number of grade slots in a day. */
export const GRADES_PER_DAY = MINUTES_PER_DAY / GRADE_STEP_MINUTES;

/** Night ink: nothing grades below this (art/palette.MASTER.ink; repeated here so world stays pure). */
export const NIGHT_INK = '#141B33';

/** Lamp weight at or above which a `when: 'night'` light source is lit. */
export const LAMP_ON = 0.5;

/** Night weight at or above which `when: 'night-low'` (bioluminescence) is lit. */
export const BIO_ON = 0.5;

/** Weather ids with a grade adjustment; anything else grades as `'clear'` (kinds are [GDD]). */
export const WEATHERS = Object.freeze(['clear', 'rain', 'storm', 'fog', 'overcast', 'snow']);

/**
 * One quantized grade. `mult` is the multiply tint, `floor` the screen floor (ambient), `sat` the
 * saturation, `lamp` how lit lamps and windows are (0..1), `night` the star / glow weight.
 * @typedef {Object} Grade
 * @property {string} id         `'<slot>|<weather>'` or `'indoor'`; chunk-cache key
 * @property {number} slot       0..47 (-1 indoor)
 * @property {number} minute     slot start minute of day (-1 indoor)
 * @property {string} weather
 * @property {boolean} indoor
 * @property {readonly number[]} mult
 * @property {readonly number[]} floor
 * @property {number} sat
 * @property {number} lamp
 * @property {number} night
 */

/**
 * Day-part keyframes (minute of day). Linear between keyframes, then quantized to the slot. Adopted
 * from the tile prototype's hour table (§8.4): deep night, night, dawn (peach over a cool floor),
 * morning, day, golden hour, sunset (amber, never magenta), blue hour, night.
 * @type {readonly Readonly<{m: number, part: string, mult: number[], floor: number[], sat: number, lamp: number, night: number}>[]}
 */
export const DAY_PARTS = Object.freeze([
  Object.freeze({ m: 0, part: 'deep-night', mult: [0.30, 0.36, 0.60], floor: [0.08, 0.10, 0.20], sat: 0.70, lamp: 1, night: 1 }),
  Object.freeze({ m: 255, part: 'deep-night', mult: [0.30, 0.36, 0.60], floor: [0.08, 0.10, 0.20], sat: 0.70, lamp: 1, night: 1 }),
  Object.freeze({ m: 315, part: 'night', mult: [0.38, 0.46, 0.72], floor: [0.08, 0.10, 0.20], sat: 0.78, lamp: 1, night: 0.8 }),
  Object.freeze({ m: 390, part: 'dawn', mult: [0.92, 0.78, 0.72], floor: [0.10, 0.07, 0.12], sat: 0.95, lamp: 0.6, night: 0.2 }),
  Object.freeze({ m: 465, part: 'morning', mult: [0.97, 0.96, 1.0], floor: [0.04, 0.04, 0.06], sat: 1.0, lamp: 0, night: 0 }),
  Object.freeze({ m: 570, part: 'day', mult: [1, 1, 1], floor: [0, 0, 0], sat: 1, lamp: 0, night: 0 }),
  Object.freeze({ m: 930, part: 'day', mult: [1, 1, 1], floor: [0, 0, 0], sat: 1, lamp: 0, night: 0 }),
  Object.freeze({ m: 1035, part: 'golden', mult: [1.04, 0.93, 0.76], floor: [0.08, 0.04, 0.0], sat: 1.05, lamp: 0.25, night: 0 }),
  Object.freeze({ m: 1095, part: 'sunset', mult: [0.98, 0.78, 0.62], floor: [0.08, 0.04, 0.06], sat: 1.0, lamp: 0.75, night: 0.15 }),
  Object.freeze({ m: 1155, part: 'blue-hour', mult: [0.48, 0.54, 0.80], floor: [0.06, 0.08, 0.18], sat: 0.85, lamp: 1, night: 0.6 }),
  Object.freeze({ m: 1200, part: 'night', mult: [0.38, 0.46, 0.72], floor: [0.08, 0.10, 0.20], sat: 0.78, lamp: 1, night: 0.85 }),
  Object.freeze({ m: 1350, part: 'night', mult: [0.38, 0.46, 0.72], floor: [0.08, 0.10, 0.20], sat: 0.78, lamp: 1, night: 1 }),
  Object.freeze({ m: 1440, part: 'deep-night', mult: [0.30, 0.36, 0.60], floor: [0.08, 0.10, 0.20], sat: 0.70, lamp: 1, night: 1 }),
]);

/**
 * Fixed interior grade (§4.7: "interiors use a fixed lamp grade"): warm, fully lit lamps, no night.
 * @type {Grade}
 */
export const INDOOR_GRADE = Object.freeze({
  id: 'indoor',
  slot: -1,
  minute: -1,
  weather: 'clear',
  indoor: true,
  mult: Object.freeze([1.0, 0.96, 0.9]),
  floor: Object.freeze([0.06, 0.04, 0.02]),
  sat: 1,
  lamp: 1,
  night: 0,
});

/** Weather adjustments applied after interpolation. */
const WEATHER_ADJUST = Object.freeze({
  clear: null,
  rain: Object.freeze({ mult: [0.82, 0.86, 0.94], floor: [0, 0, 0], sat: 0.85, lampMin: 0.35 }),
  storm: Object.freeze({ mult: [0.66, 0.70, 0.84], floor: [0.02, 0.02, 0.05], sat: 0.75, lampMin: 0.6 }),
  fog: Object.freeze({ mult: [0.92, 0.93, 0.96], floor: [0.06, 0.07, 0.08], sat: 0.9, lampMin: 0 }),
  overcast: Object.freeze({ mult: [0.9, 0.91, 0.95], floor: [0.03, 0.03, 0.04], sat: 0.88, lampMin: 0.15 }),
  snow: Object.freeze({ mult: [0.96, 0.97, 1.02], floor: [0.10, 0.10, 0.12], sat: 0.8, lampMin: 0.25 }),
});

/** @type {Map<string, Grade>} */
const gradeCache = new Map();

/**
 * The grade for a minute of day. Quantized to {@link GRADE_STEP_MINUTES}; cached and frozen.
 * @param {number} minute   minute of day (any finite number; wraps modulo 1440)
 * @param {string} [weather='clear']   `world.weather.today`; unknown ids grade as clear
 * @param {boolean} [indoor=false]     `map.indoor`: returns {@link INDOOR_GRADE}
 * @returns {Grade}
 */
export function gradeFor(minute, weather, indoor) {
  if (indoor) return INDOOR_GRADE;
  if (!Number.isFinite(minute)) throw new TypeError(`gradeFor: minute must be finite, got ${minute}`);
  // own keys only: `'toString' in WEATHER_ADJUST` is true through the prototype
  const w = typeof weather === 'string' && Object.hasOwn(WEATHER_ADJUST, weather) ? weather : 'clear';
  const slot = gradeSlot(minute);
  const key = `${slot}|${w}`;
  let g = gradeCache.get(key);
  if (g) return g;
  g = buildGrade(slot, w);
  gradeCache.set(key, g);
  return g;
}

/**
 * Grade slot (0..47) for a minute of day.
 * @param {number} minute
 * @returns {number}
 */
export function gradeSlot(minute) {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.floor(m / GRADE_STEP_MINUTES) % GRADES_PER_DAY;
}

/**
 * Name of the day part a minute falls in (`'deep-night' | 'night' | 'dawn' | 'morning' | 'day' |
 * 'golden' | 'sunset' | 'blue-hour'`): the keyframe at or before the minute.
 * @param {number} minute
 * @returns {string}
 */
export function dayPartAt(minute) {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  let part = DAY_PARTS[0].part;
  for (const k of DAY_PARTS) {
    if (k.m <= m) part = k.part;
    else break;
  }
  return part;
}

/**
 * Whether a grade lights the lamps (`grade.lamp >= LAMP_ON`).
 * @param {Grade} grade
 * @returns {boolean}
 */
export function lampsLit(grade) {
  return grade.lamp >= LAMP_ON;
}

/**
 * Applies a grade to one hex colour: multiply -> screen floor -> saturation; never below ink.
 * Pure string math; `art/atlas` caches the results per grade id.
 * @param {string} hex   `#rrggbb`
 * @param {Grade} grade
 * @param {string} [ink=NIGHT_INK]
 * @returns {string} `#rrggbb`
 */
export function gradeHex(hex, grade, ink) {
  const c = hexToRgb01(hex);
  const k = hexToRgb01(ink || NIGHT_INK);
  let r = c[0] * grade.mult[0];
  let g = c[1] * grade.mult[1];
  let b = c[2] * grade.mult[2];
  r = 1 - (1 - r) * (1 - grade.floor[0]);
  g = 1 - (1 - g) * (1 - grade.floor[1]);
  b = 1 - (1 - b) * (1 - grade.floor[2]);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  r = l + (r - l) * grade.sat;
  g = l + (g - l) * grade.sat;
  b = l + (b - l) * grade.sat;
  return rgb01ToHex(Math.max(r, k[0]), Math.max(g, k[1]), Math.max(b, k[2]));
}

/**
 * Sun-driven drop-shadow offset for sprites: always down-right, short at noon, long near the
 * horizon, faded out at night and under lamplight.
 * @param {number} minute minute of day
 * @param {Grade} grade
 * @returns {{dx: number, dy: number, alpha: number}} fresh object (call once per grade change)
 */
export function shadowFor(minute, grade) {
  if (grade.indoor) return { dx: 1, dy: 1, alpha: 0.2 };
  const hour = (((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60;
  const day = 1 - grade.night;
  const a = Math.max(0, Math.min(1, Math.abs(hour - 12.5) / 6));
  return { dx: Math.round(1 + a * 4), dy: Math.round(1 + a * 2), alpha: round3(0.32 * day * (1 - grade.lamp * 0.6)) };
}

/**
 * One additive light pool for `render/lightPass`.
 * @typedef {Object} Light
 * @property {string} id          `'<kind>@<x>,<y>'`
 * @property {string} kind        glow kind ('lamp', 'porch', 'window', 'bio', 'rune', ...)
 * @property {number} x           tile
 * @property {number} y
 * @property {number} px          pool centre in world pixels
 * @property {number} py
 * @property {number} radius      pixels
 * @property {string|null} color  hex or `null` for the renderer's default per kind
 * @property {number} intensity   0..1 (lamps fade in with the grade's `lamp` weight)
 */

/**
 * @typedef {Object} LightOptions
 * @property {number} [minute]        minute of day (default `selectors.minuteOfDay(world)`)
 * @property {string} [weather]       default `world.weather.today`
 * @property {import('../core/time.js').TideState|number} [tide]   default `selectors.tideState(world)`
 * @property {number} [tile=16]       tile size in pixels
 * @property {boolean} [indoor]       default `map.indoor`
 * @property {(world: World, cond: any, ctx: any) => boolean} [evalCond]   evaluates the `cond` of a lit prop
 *   (default: the condition DSL, `script/cond.evalCond`, with `{mapId, x, y}` as context)
 * @property {Light[]} [out]          array to fill (truncated to the result); records from an earlier
 *   call are reused, so a per-frame caller allocates nothing
 */

/**
 * Light sources on a map right now.
 *
 * Rules: `when: 'night'` lights (lamps, windows, porches) are lit once {@link lampsLit}; indoors
 * they are always lit. `when: 'night-low'` (bioluminescent mud) needs `grade.night >= BIO_ON` and a
 * low tide. `when: 'always'` (runes, fire) is always lit. A light with a `flag` is lit only while
 * `world.flags[flag]` is truthy — porches read the occupancy flag of their house this way. A light
 * from a prop whose `cond` fails is dark (the prop is not there).
 * @param {RuntimeMap} map
 * @param {World} world
 * @param {number|LightOptions} [hourOrOpts]   an hour of day (0..24, fractional) or options
 * @returns {Light[]}
 */
export function lightSources(map, world, hourOrOpts) {
  const o = typeof hourOrOpts === 'number' ? { minute: hourOrOpts * 60 } : hourOrOpts || {};
  const minute = o.minute ?? minuteOfDay(world);
  const weather = o.weather ?? world?.weather?.today ?? 'clear';
  const indoor = o.indoor ?? map.indoor;
  const grade = gradeFor(minute, weather, indoor);
  const tile = o.tile ?? 16;
  const out = o.out || [];
  const lit = lampsLit(grade);
  const evalCond = o.evalCond || dslEvalCond;
  let tideV = null;
  let n = 0;
  for (const g of map.glows) {
    const glow = g.glow;
    if (glow.flag && !world?.flags?.[glow.flag]) continue;
    if (g.prop && g.prop.cond !== undefined && g.prop.cond !== null && !evalCond(world, g.prop.cond, { mapId: map.id, x: g.x, y: g.y })) continue;
    let intensity;
    if (glow.when === 'always') intensity = 1;
    else if (glow.when === 'night') {
      if (!lit) continue;
      intensity = grade.indoor ? 1 : clamp01(grade.lamp);
    } else {
      if (grade.night < BIO_ON) continue;
      if (tideV === null) tideV = tideVariant(o.tide ?? tideStateOf(world));
      if (tideV !== 'low') continue;
      intensity = clamp01(grade.night);
    }
    // reuse a record this module created earlier in `out` (no per-frame allocation, §12)
    let light = out[n];
    if (!light || !OWN_LIGHTS.has(light)) {
      light = { id: '', kind: '', x: 0, y: 0, px: 0, py: 0, radius: 0, color: null, intensity: 0 };
      OWN_LIGHTS.add(light);
      out[n] = light;
    }
    light.id = lightId(g);
    light.kind = glow.kind;
    light.x = g.x;
    light.y = g.y;
    light.px = g.x * tile + tile / 2 + glow.ox;
    light.py = g.y * tile + tile / 2 + glow.oy;
    light.radius = glow.radius;
    light.color = glow.color;
    light.intensity = intensity;
    n++;
  }
  out.length = n;
  return out;
}

/** Light records created by {@link lightSources}; only these are recycled from a caller's `out`. */
const OWN_LIGHTS = new WeakSet();

/** @type {WeakMap<object, string>} glow entry -> `'<kind>@<x>,<y>'`, built once per map cell */
const LIGHT_IDS = new WeakMap();

/**
 * @param {{x: number, y: number, glow: GlowDef}} g an entry of `RuntimeMap.glows`
 * @returns {string}
 */
function lightId(g) {
  let id = LIGHT_IDS.get(g);
  if (id === undefined) {
    id = `${g.glow.kind}@${g.x},${g.y}`;
    LIGHT_IDS.set(g, id);
  }
  return id;
}

// --- helpers --------------------------------------------------------------------------------------

/**
 * @param {number} slot
 * @param {string} weather
 * @returns {Grade}
 */
function buildGrade(slot, weather) {
  const m = slot * GRADE_STEP_MINUTES;
  let a = DAY_PARTS[0];
  let b = DAY_PARTS[DAY_PARTS.length - 1];
  for (let i = 0; i < DAY_PARTS.length - 1; i++) {
    if (m >= DAY_PARTS[i].m && m <= DAY_PARTS[i + 1].m) {
      a = DAY_PARTS[i];
      b = DAY_PARTS[i + 1];
      break;
    }
  }
  const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
  let mult = lerp3(a.mult, b.mult, t);
  let floor = lerp3(a.floor, b.floor, t);
  let sat = lerp(a.sat, b.sat, t);
  let lamp = lerp(a.lamp, b.lamp, t);
  const night = lerp(a.night, b.night, t);
  const adj = WEATHER_ADJUST[weather];
  if (adj) {
    mult = [mult[0] * adj.mult[0], mult[1] * adj.mult[1], mult[2] * adj.mult[2]];
    floor = [floor[0] + adj.floor[0], floor[1] + adj.floor[1], floor[2] + adj.floor[2]];
    sat *= adj.sat;
    lamp = Math.max(lamp, adj.lampMin);
  }
  return Object.freeze({
    id: `${slot}|${weather}`,
    slot,
    minute: m,
    weather,
    indoor: false,
    mult: Object.freeze(mult.map(round3)),
    floor: Object.freeze(floor.map(round3)),
    sat: round3(sat),
    lamp: round3(lamp),
    night: round3(night),
  });
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const round3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * @param {string} hex
 * @returns {number[]}
 */
function hexToRgb01(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) throw new TypeError(`lighting: expected #rrggbb, got ${JSON.stringify(hex)}`);
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
function rgb01ToHex(r, g, b) {
  const h = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}
