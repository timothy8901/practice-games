/**
 * Town gathering verbs on one clock (GDD-00 §5 night rules, §6 Keeper's Purse, §7 income, §9 town
 * life and its Crossovers tables; ARCHITECTURE §1 manifest, §9 seeds). [SYS-GATHER]
 *
 *  - Trees: {@link shakeTree} drops one fruit a press (three a tree; a Gust lead drops them all),
 *    the day's purse (to the wallet through the injected `ctx.earn`), an occasional shell, or wakes a
 *    bee nest: a `hum` event (1 s warning) comes back *before* the outcome; a net (or a Gust lead
 *    blowing it clear) saves the honeycomb. {@link treeState} reads the regrow / ripe timers
 *    (regrow 2 days after a tree is stripped, ripe a day later).
 *  - The flats and dig sites: ~4 {@link cracksFor cracks} a day (a fifth with a Grit/Stone lead),
 *    the one {@link glintFor Glint} a day dug at any low (500 + 60 × day, plus the Keeper's Purse
 *    refund through `ctx.takePurse`), 3 {@link sparklesFor sparkles} per low, up to 3
 *    {@link skyglassFor skyglass relics} per NIGHT low, and {@link rakeCockles cockles}. One
 *    {@link dig} verb dispatches by what lies under the shovel.
 *  - Bugs: {@link rollBugs} places bugs at spots (more at lit porches, string lights and in rain;
 *    a Bolt lead draws moths to lights); movement signatures spook them ({@link isSpooked}: walking at
 *    2 tiles, running from farthest, creeping or standing never); {@link netBug} nets one.
 *  - {@link senses}: what the party lead lets you notice (the Glint from 3 tiles, skyglass from 5 and
 *    dimly by day, the Tailhum near a purse, the Glint or a night headliner, today's cracks marked).
 *
 * Determinism. Placement (cracks, the Glint, sparkles, skyglass) depends only on the run seed, the
 * map and the day or low: functions take a *base* `rng` and derive position-independent forks by
 * label (`rng.fork('glint:<day>')`, `cracks:<mapId>:<day>`, `sparkle:<mapId>:<low>`,
 * `skyglass:<mapId>:<low>`). Pass the run's master `makeRng(world.run.seed)` (see {@link planRng})
 * and `glint:<day>` here is the same stream as `rngs.day('glint', day)`. Drops that should advance
 * (purse amounts, shells, cockle counts, bug spawns and escapes) draw from the `rng` given to that
 * verb, normally the stateful `loot` stream.
 *
 * Writes: `world.maps[mapId]` (`trees`, `picked`, `cracks`; co-owned with systems/fishing), the
 * Field Log through systems/fieldLog, `stats.treesShaken` through systems/stats. Cross-lane effects
 * are injected: `ctx.earn(amount, source)`, `ctx.give(itemId, n)`, `ctx.collectGlint({gameDay})`
 * (systems/wallet) or `ctx.takePurse() -> number`.
 * Events (`ctx.bus`): `gather:shake|fruit|purse|shell|bare|hum|honey|stung|quiet|dig|glint|find|
 * skyglass|cockles|bug|bug-escaped`.
 *
 * Pure: no DOM, no Math.random. Lane: SYS-GATHER.
 * @module systems/gather
 */

import { makeRng } from '../core/rng.js';
import { scheduleForSeed, TIDE_PERIOD_MINUTES, MINUTES_PER_DAY } from '../core/time.js';
import { mapStateDefaults } from '../state/schema.js';
import { totalMinutes, phase as selectPhase, tideState as selectTideState } from '../state/selectors.js';
import { rowCondHolds } from '../world/roamer.js';
import * as stats from './stats.js';
import {
  makeTuning, tuningSource, deepFreeze, V, rowsOf, collectionRows, rowOf, leadBonuses, recordFind, recordBug,
} from './fieldLog.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').MapState} MapState */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {import('./fieldLog.js').LaneCtx} LaneCtx */

/**
 * Context of the gathering verbs.
 * @typedef {LaneCtx & {
 *   day?: number, total?: number, tideState?: string, weather?: string, phase?: string, tideOffset?: number,
 *   earn?: (amount: number, source: string) => any, give?: (itemId: string, n: number) => any,
 *   takePurse?: () => number, net?: boolean,
 *   collectGlint?: (opts: {gameDay: number}) => {total: number, refund?: number},
 * }} GatherCtx
 */

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} GatherTuning
 * @property {number} regrowDaysDefault      days after a tree is stripped until its fruit is back (GDD-00 §7: 2)
 * @property {number} fruitRipeDays          days after a tree is stripped until its fruit is ripe (GDD-00 §7: 3)
 * @property {number} fruitPerTree           fruit on a full tree; one per press (GDD-00 §9: 3)
 * @property {number} fruitRipeMult          ripe fruit value multiplier (GDD-00 §7: 150 / 120)
 * @property {[number, number]} purseRange   buttons in a tree purse (GDD-00 §7: 200–600)
 * @property {number} purseStep              purse amounts are multiples of this
 * @property {number} hiveHumMs              warning hum before a bee nest drops (GDD-00 §9: 1 s)
 * @property {number} shellChance            chance a shake of a tree with `shells` drops one
 * @property {number} cracksPerDay           dig cracks per day on a dig site (GDD-00 §7: ~4)
 * @property {number} glintBase              the Glint: base buttons (GDD-00 §7: 500)
 * @property {number} glintPerDay            the Glint: buttons per day number (GDD-00 §7: 60)
 * @property {number} glintRevealRadius      tiles from which the exposed Glint shows without a bonus
 * @property {number} sparklesPerLow         sparkle finds per low (GDD-00 §7: 3)
 * @property {[number, number]} skyglassPerNightLow   skyglass relics per night low (GDD-00 §5: max 3)
 * @property {number} skyglassRevealRadius   tiles from which a surfaced relic shows without a bonus
 * @property {number} flatsWindowMinutes     flats, sparkles and the Glint are open this long either side of a low (GDD-00 §4: ±1.5 h)
 * @property {number} nightStartMinute       game night starts (GDD-00 §5: 18:00)
 * @property {number} nightEndMinute         game night ends (GDD-00 §5: 06:00)
 * @property {number} cockleRakesPerLow      cockle rakes per map per low
 * @property {[number, number]} cockleRange  cockles per rake
 * @property {{still: number, creep: number, walk: number, run: number}} bugSpookRadius  tiles at which a gait spooks a bug (GDD-00: walking 2, running most)
 * @property {number} netReach               tiles the net reaches
 * @property {number} bugSpawnChance         chance a bug spot holds a bug
 * @property {number} bugLightMult           spawn and light-loving weight multiplier at lit spots (GDD-00 §9: "more at lit porches")
 * @property {number} bugRainMult            spawn multiplier in rain (GDD-00 §9: "rain brings bugs")
 */

/** GDD-00 values where GDD-00 states one; the rest are starting values for GDD-05. @type {Readonly<GatherTuning>} */
export const DEFAULTS = deepFreeze({
  regrowDaysDefault: 2,
  fruitRipeDays: 3,
  fruitPerTree: 3,
  fruitRipeMult: 1.25,
  purseRange: [200, 600],
  purseStep: 50,
  hiveHumMs: 1000,
  shellChance: 0.15,
  cracksPerDay: 4,
  glintBase: 500,
  glintPerDay: 60,
  glintRevealRadius: 1,
  sparklesPerLow: 3,
  skyglassPerNightLow: [1, 3],
  skyglassRevealRadius: 2,
  flatsWindowMinutes: 90,
  nightStartMinute: 18 * 60,
  nightEndMinute: 6 * 60,
  cockleRakesPerLow: 4,
  cockleRange: [1, 3],
  bugSpookRadius: { still: 0, creep: 0, walk: 2, run: 4 },
  netReach: 1,
  bugSpawnChance: 0.25,
  bugLightMult: 2,
  bugRainMult: 1.5,
});

const minuteOk = (v) => Number.isInteger(v) && v >= 0 && v < MINUTES_PER_DAY;

/** @type {Record<keyof GatherTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  regrowDaysDefault: [V.nonNegInt, 'integer >= 0'],
  fruitRipeDays: [V.nonNegInt, 'integer >= 0'],
  fruitPerTree: [V.posInt, 'integer >= 1'],
  fruitRipeMult: [V.pos, 'number > 0'],
  purseRange: [V.intRange, '[min, max] integers >= 0'],
  purseStep: [V.posInt, 'integer >= 1'],
  hiveHumMs: [V.nonNeg, 'number >= 0'],
  shellChance: [V.unit, '0..1'],
  cracksPerDay: [V.nonNegInt, 'integer >= 0'],
  glintBase: [V.nonNegInt, 'integer >= 0'],
  glintPerDay: [V.nonNegInt, 'integer >= 0'],
  glintRevealRadius: [V.nonNegInt, 'integer >= 0'],
  sparklesPerLow: [V.nonNegInt, 'integer >= 0'],
  skyglassPerNightLow: [V.intRange, '[min, max] integers >= 0'],
  skyglassRevealRadius: [V.nonNegInt, 'integer >= 0'],
  flatsWindowMinutes: [(v) => V.nonNeg(v) && v <= TIDE_PERIOD_MINUTES / 2, `number 0..${TIDE_PERIOD_MINUTES / 2}`],
  nightStartMinute: [minuteOk, 'minute 0..1439'],
  nightEndMinute: [minuteOk, 'minute 0..1439'],
  cockleRakesPerLow: [V.nonNegInt, 'integer >= 0'],
  cockleRange: [V.intRange, '[min, max] integers >= 0'],
  bugSpookRadius: [(v) => V.obj(v) && ['still', 'creep', 'walk', 'run'].every((k) => V.nonNeg(v[k])), '{still, creep, walk, run} numbers >= 0'],
  netReach: [V.nonNegInt, 'integer >= 0'],
  bugSpawnChance: [V.unit, '0..1'],
  bugLightMult: [V.nonNeg, 'number >= 0'],
  bugRainMult: [V.nonNeg, 'number >= 0'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Resolves this module's tuning. */
export const tuningOf = makeTuning('gather', DEFAULTS, SPEC);

/** @param {LaneCtx|undefined} ctx */
const T = (ctx) => tuningOf(tuningSource(ctx));

// ---------------------------------------------------------------------------------------------
// Clock, tide and night helpers (shared with fishing and encounter)
// ---------------------------------------------------------------------------------------------

/**
 * The run's master generator (`makeRng(world.run.seed)`): the base to hand placement functions so
 * `rng.fork('glint:<day>')` equals `rngs.day('glint', day)`. Nobody draws from it directly.
 * @param {World} world
 * @returns {Rng}
 */
export function planRng(world) {
  return makeRng(Number.isInteger(world?.run?.seed) ? world.run.seed : 0);
}

/**
 * Current total minutes: `ctx.total` when finite, else `world.clock.total`.
 * @param {World} world
 * @param {{total?: number}} [ctx]
 * @returns {number}
 */
export function nowTotal(world, ctx) {
  return typeof ctx?.total === 'number' && Number.isFinite(ctx.total) && ctx.total >= 0 ? ctx.total : totalMinutes(world);
}

/**
 * Day number (0-based, the clock's) at `ctx.day`, else from the clock.
 * @param {World} world
 * @param {{day?: number, total?: number}} [ctx]
 * @returns {number}
 */
export function dayOf(world, ctx) {
  return Number.isInteger(ctx?.day) ? ctx.day : Math.floor(nowTotal(world, ctx) / MINUTES_PER_DAY);
}

/**
 * Whether a minute of day is game night (GDD-00 §5: 18:00–06:00 by default).
 * @param {number} minuteOfDay
 * @param {LaneCtx} [ctx]
 * @returns {boolean}
 */
export function isNightMinute(minuteOfDay, ctx) {
  const t = T(ctx);
  const m = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const a = t.nightStartMinute, b = t.nightEndMinute;
  return a <= b ? (m >= a && m < b) : (m >= a || m < b);
}

/**
 * Whether it is game night now.
 * @param {World} world
 * @param {LaneCtx & {total?: number}} [ctx]
 * @returns {boolean}
 */
export function isNightNow(world, ctx) {
  return isNightMinute(nowTotal(world, ctx) % MINUTES_PER_DAY, ctx);
}

/**
 * @typedef {Object} LowInfo
 * @property {number} total            the moment evaluated
 * @property {number} lowIndex         index of the nearest low water (lows sit at `tideOffset + n × period`)
 * @property {number} lowTotal         total minute of that low
 * @property {number} minutesFromLow   signed: negative before the low, positive after
 * @property {boolean} inWindow        within `flatsWindowMinutes` of that low (flats, sparkles, the Glint open)
 * @property {boolean} night           it is game night now
 * @property {boolean} nightLow        `inWindow && night`: the flats glow and give up skyglass
 */

/**
 * Where the moment sits relative to the nearest low water, by the same tide model core/time runs
 * (offset from `world.clock.seed`, or `ctx.tideOffset`).
 * @param {World} world
 * @param {LaneCtx & {total?: number, tideOffset?: number}} [ctx]
 * @returns {LowInfo}
 */
export function lowInfo(world, ctx) {
  const total = nowTotal(world, ctx);
  let offset = 0;
  if (typeof ctx?.tideOffset === 'number' && Number.isFinite(ctx.tideOffset)) offset = ctx.tideOffset;
  else {
    try { offset = scheduleForSeed(world?.clock?.seed ?? null).tideOffset; } catch { offset = 0; }
  }
  const P = TIDE_PERIOD_MINUTES;
  const k = Math.floor((total - offset) / P);
  const since = total - (offset + k * P);
  const lowIndex = since <= P / 2 ? k : k + 1;
  const lowTotal = offset + lowIndex * P;
  const minutesFromLow = total - lowTotal;
  const inWindow = Math.abs(minutesFromLow) <= T(ctx).flatsWindowMinutes;
  const night = isNightMinute(total % MINUTES_PER_DAY, ctx);
  return { total, lowIndex, lowTotal, minutesFromLow, inWindow, night, nightLow: inWindow && night };
}

/**
 * Whether the flats window of a low (±`flatsWindowMinutes`) touches game night, i.e. whether its
 * skyglass can ever be dug. Night and day are each longer than the window, so the window touches
 * night exactly when one of its ends is night.
 * @param {number} lowTotal
 * @param {LaneCtx} [ctx]
 * @returns {boolean}
 */
export function lowTouchesNight(lowTotal, ctx) {
  const W = T(ctx).flatsWindowMinutes;
  return isNightMinute((lowTotal - W) % MINUTES_PER_DAY, ctx) || isNightMinute((lowTotal + W) % MINUTES_PER_DAY, ctx);
}

/**
 * The low whose skyglass is next diggable: the current one when its window touches night, else the
 * next low that does (searched up to four lows ahead; two consecutive lows are 12 h 25 m apart, so
 * one of any two touches night). Used for the Glass/Hollow lead's dim by-day view.
 * @param {World} world
 * @param {LaneCtx & {total?: number, tideOffset?: number}} [ctx]
 * @returns {{lowIndex: number, lowTotal: number}}
 */
export function nextNightLow(world, ctx) {
  const li = lowInfo(world, ctx);
  const P = TIDE_PERIOD_MINUTES;
  for (let k = li.lowIndex; k <= li.lowIndex + 4; k++) {
    const lowTotal = li.lowTotal + (k - li.lowIndex) * P;
    if (lowTotal + T(ctx).flatsWindowMinutes < li.total) continue; // already over
    if (lowTouchesNight(lowTotal, ctx)) return { lowIndex: k, lowTotal };
  }
  return { lowIndex: li.lowIndex, lowTotal: li.lowTotal };
}

/**
 * The environment a row's conditions are checked against.
 * @typedef {{phase: string, tideState: string, weather: string, night: boolean, world: World, data: any, mapId: string|null, region: string|null}} Env
 */

/**
 * Builds the environment for row filtering: `ctx` values win over the world's clock and weather.
 * @param {World} world
 * @param {{id?: string, region?: string}|null} map
 * @param {GatherCtx} [ctx]
 * @returns {Env}
 */
export function envFor(world, map, ctx) {
  const total = nowTotal(world, ctx);
  let phase = ctx?.phase;
  let tide = ctx?.tideState;
  try { if (!phase) phase = selectPhase({ clock: { total } }); } catch { phase = 'midday'; }
  try { if (!tide) tide = selectTideState(world, total); } catch { tide = 'rising'; }
  const weather = ctx?.weather ?? world?.weather?.current ?? world?.weather?.today ?? 'clear';
  return {
    phase, tideState: tide, weather, night: isNightMinute(total % MINUTES_PER_DAY, ctx),
    world, data: ctx?.data ?? null, mapId: map?.id ?? null, region: map?.region ?? null,
  };
}

/**
 * Whether a content row (fish, bug, find) is active here and now: `where` (ids of maps, regions or
 * reach ids / kinds; absent = anywhere), `night: true` / `day: true`, `tide` ('any' or a tide state /
 * list), `weather` list, and `when` / `cond` (the §6.4 DSL; `phase` / `tide` / `weather` checked
 * locally as world/roamer does, so roamers, encounters and gathering agree on what is out).
 * @param {any} row
 * @param {Env} env
 * @param {string[]} [places]   extra place tags that satisfy `where` (reach id and kind)
 * @returns {boolean}
 */
export function rowActive(row, env, places = []) {
  if (!row) return false;
  if (Array.isArray(row.where) && row.where.length > 0) {
    const ok = row.where.some((w) => w === env.mapId || w === env.region || places.includes(w));
    if (!ok) return false;
  }
  if (row.night === true && !env.night) return false;
  if (row.day === true && env.night) return false;
  if (row.tide !== undefined && row.tide !== 'any' && row.tide !== null) {
    const list = Array.isArray(row.tide) ? row.tide : [row.tide];
    if (!list.includes(env.tideState)) return false;
  }
  if (Array.isArray(row.weather) && !row.weather.includes(env.weather)) return false;
  const condCtx = { phase: env.phase, tideState: env.tideState, weather: env.weather, world: env.world, data: env.data, mapId: env.mapId };
  if (row.when !== undefined && !rowCondHolds(row.when, condCtx)) return false;
  if (row.cond !== undefined && !rowCondHolds(row.cond, condCtx)) return false;
  return true;
}

/**
 * Weight multiplier from a row's `mods` table: every key of `{day, night, low, rising, high,
 * falling, <weather>}` that matches the environment multiplies (GDD-00: night tables lean, high tide
 * brings Brine, fog pulls silver schools in).
 * @param {any} row
 * @param {Env} env
 * @returns {number}
 */
export function modsFor(row, env) {
  const m = row?.mods;
  if (!m || typeof m !== 'object') return 1;
  let mult = 1;
  const apply = (k) => { const v = m[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0) mult *= v; };
  apply(env.night ? 'night' : 'day');
  apply(env.tideState);
  if (env.weather) apply(env.weather);
  return mult;
}

/**
 * Chebyshev distance ("within N tiles").
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function tileDist(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Normalizes a spot list: `[[x, y], ...]`, `[{x, y}]` or rects `{x, y, w, h}` (expanded row-major).
 * Duplicates are kept once, order preserved.
 * @param {any} list
 * @returns {{x: number, y: number}[]}
 */
export function spotsOf(list) {
  /** @type {{x: number, y: number}[]} */
  const out = [];
  const seen = new Set();
  const add = (x, y) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    const k = `${x},${y}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y });
  };
  if (!Array.isArray(list)) return out;
  for (const s of list) {
    if (Array.isArray(s)) add(s[0], s[1]);
    else if (s && typeof s === 'object') {
      if (Number.isInteger(s.w) && Number.isInteger(s.h)) {
        for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) add(x, y);
      } else add(s.x, s.y);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Map state
// ---------------------------------------------------------------------------------------------

/**
 * The world's state record for a map, created with defaults on first write.
 * @param {World} world
 * @param {string} mapId
 * @returns {MapState}
 */
export function ensureMap(world, mapId) {
  if (typeof mapId !== 'string' || mapId.length === 0) throw new TypeError(`gather: map id must be a non-empty string, got ${String(mapId)}`);
  let m = world.maps[mapId];
  if (!m || typeof m !== 'object') {
    m = mapStateDefaults();
    world.maps[mapId] = m;
  }
  if (!m.picked || typeof m.picked !== 'object') m.picked = {};
  if (!m.trees || typeof m.trees !== 'object') m.trees = {};
  if (!m.cracks || typeof m.cracks !== 'object') m.cracks = {};
  return m;
}

/**
 * Read-only view of a map's state (never writes).
 * @param {World} world
 * @param {string} mapId
 * @returns {MapState}
 */
function viewMap(world, mapId) {
  return world?.maps?.[mapId] ?? mapStateDefaults();
}

/** Low-indexed `picked` keys: `s<low>#<i>` (sparkle), `k<low>#<i>` (skyglass), `r<low>@<x>,<y>` (rake). */
const LOW_KEY_RE = /^(?:[sk](-?\d+)#\d+|r(-?\d+)@-?\d+,-?\d+)$/;

/**
 * Drops low-indexed `picked` keys older than `low - 1` so the record never grows without bound.
 * Only exact low keys match ({@link LOW_KEY_RE}), so a tree whose id looks like `s3` keeps its
 * `s3#f0` / `s3#purse` / `s3#hive` keys.
 * @param {MapState} m
 * @param {number} low
 */
function pruneLowKeys(m, low) {
  for (const k of Object.keys(m.picked)) {
    const mt = LOW_KEY_RE.exec(k);
    if (mt && Number(mt[1] ?? mt[2]) < low - 1) delete m.picked[k];
  }
}

/**
 * @param {string} k
 * @param {number} day
 * @returns {boolean} whether a crack key belongs to a day before `day`
 */
function crackKeyStale(k, day) {
  const mt = /^c(-?\d+)@/.exec(k);
  return Boolean(mt) && Number(mt[1]) < day;
}

/**
 * Emits each event on the bus as `gather:<type>` (payload = the event).
 * @param {GatherCtx|undefined} ctx
 * @param {Array<{type: string}>} events
 */
function emitAll(ctx, events) {
  const bus = ctx?.bus;
  if (!bus) return;
  for (const e of events) bus.emit(`gather:${e.type}`, e);
}

/**
 * Weighted pick among `{id, w}` entries (one draw; `null` when none is eligible).
 * @param {Rng} rng
 * @param {Array<{id: string, w?: number}>} pool
 * @returns {string|null}
 */
function pickWeighted(rng, pool) {
  const entries = pool.filter((p) => p && typeof p.id === 'string').map((p) => ({ w: typeof p.w === 'number' && Number.isFinite(p.w) ? p.w : 1, v: p.id }));
  return rng.weighted(entries) ?? null;
}

/**
 * Finds a source may yield on a map: explicit `override` entries (`[{id, w}]` or ids), else
 * collection rows of kind `relic` whose `source` names this source (string or list) and whose
 * `where` (absent = anywhere) names the map or its region; rows' `w` weights (default 1).
 * @param {any} data
 * @param {{id?: string, region?: string}} map
 * @param {string} source   'crack' | 'sparkle' | 'skyglass' | 'tree' | 'rake'
 * @param {any} [override]
 * @returns {Array<{id: string, w: number}>}
 */
export function findPool(data, map, source, override) {
  if (Array.isArray(override) && override.length > 0) {
    return override.map((e) => (typeof e === 'string' ? { id: e, w: 1 } : { id: e?.id, w: typeof e?.w === 'number' ? e.w : 1 })).filter((e) => typeof e.id === 'string');
  }
  return collectionRows(data, 'relic')
    .filter((r) => {
      const src = Array.isArray(r.source) ? r.source : (typeof r.source === 'string' ? [r.source] : []);
      if (!src.includes(source)) return false;
      if (Array.isArray(r.where) && r.where.length > 0 && !r.where.includes(map?.id) && !r.where.includes(map?.region)) return false;
      return true;
    })
    .map((r) => ({ id: r.id, w: typeof r.w === 'number' ? r.w : 1 }));
}

// ---------------------------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------------------------

/**
 * A tree as a map entity carries it (ARCHITECTURE §4.1 `entities`, kind `'tree'`).
 * @typedef {Object} TreeDef
 * @property {string} id
 * @property {number} [x]  @property {number} [y]
 * @property {string} [fruit]                 fruit collection row id
 * @property {boolean|[number, number]} [purse]   purse tree; optional own [min, max]
 * @property {string|boolean} [hive]          bee tree; the honeycomb item id
 * @property {Array<string|{id: string, w?: number}>} [shells]   ids a shake may knock loose
 */

/**
 * @param {{entities?: any[]}} map
 * @param {string|TreeDef} tree
 * @returns {TreeDef|null}
 */
function treeDefOf(map, tree) {
  if (tree && typeof tree === 'object') return tree;
  if (typeof tree !== 'string') return null;
  return (Array.isArray(map?.entities) ? map.entities : []).find((e) => e && e.kind === 'tree' && e.id === tree) ?? null;
}

/** Resolve authored native-fruit trees from the run seed without consuming the loot stream. */
function treeFruit(world, def, ctx) {
  if (def.fruit) return def.fruit;
  if (def.fruitFrom !== 'native') return null;
  const pool = collectionRows(ctx?.data, 'fruit').filter(row => row.origin === 'native').map(row => row.id).sort();
  return pool.length ? makeRng(world.run.seed).fork('worldgen:native-fruit').pick(pool) : null;
}

/**
 * Fruit slots taken from a tree since it last regrew.
 * @param {MapState} m
 * @param {string} id
 * @returns {number[]} slot indices
 */
function takenSlots(m, id) {
  const out = [];
  const prefix = `${id}#f`;
  for (const k of Object.keys(m.picked)) if (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length))) out.push(Number(k.slice(prefix.length)));
  return out.sort((a, b) => a - b);
}

/**
 * @typedef {Object} TreeState
 * @property {number} fruitLeft     fruit on the tree now
 * @property {boolean} ripe         the fruit on it is ripe
 * @property {number} regrowDay     day the fruit came (or comes) back
 * @property {number} ripeDay       day the fruit ripens
 * @property {boolean} purseReady   a purse tree that has not dropped today's purse
 * @property {boolean} hiveReady    a bee tree whose nest is up today
 */

/**
 * Regrow / ripe timers of a tree. A tree never shaken grew on day 0, so its fruit ripens on day 1.
 * @param {World} world
 * @param {{id: string, entities?: any[]}} map
 * @param {string|TreeDef} tree
 * @param {GatherCtx} [ctx]
 * @returns {TreeState}
 */
export function treeState(world, map, tree, ctx) {
  const def = treeDefOf(map, tree);
  if (!def) throw new TypeError(`gather.treeState: unknown tree ${String(tree)}`);
  const t = T(ctx);
  const day = dayOf(world, ctx);
  const m = viewMap(world, map.id);
  const regrowDay = Number.isInteger(m.trees?.[def.id]) ? m.trees[def.id] : 0;
  const ripeDay = regrowDay + Math.max(0, t.fruitRipeDays - t.regrowDaysDefault);
  let fruitLeft = 0;
  if (treeFruit(world, def, ctx) && day >= regrowDay) fruitLeft = Math.max(0, t.fruitPerTree - takenSlots(/** @type {MapState} */ ({ picked: m.picked ?? {} }), def.id).length);
  return {
    fruitLeft,
    ripe: fruitLeft > 0 && day >= ripeDay,
    regrowDay,
    ripeDay,
    purseReady: Boolean(def.purse) && m.picked?.[`${def.id}#purse`] !== day,
    hiveReady: Boolean(def.hive) && m.picked?.[`${def.id}#hive`] !== day,
  };
}

/**
 * @typedef {Object} ShakeResult
 * @property {boolean} ok
 * @property {string} treeId
 * @property {Array<{type: string, [k: string]: any}>} events   in play order; a hive's `hum` (with `delayMs`) always precedes its outcome
 * @property {{id: string, n: number, ripe: boolean, value: number}|null} fruit   `value` is per fruit
 * @property {number} purse
 * @property {string[]} shells
 * @property {null|{outcome: 'netted'|'blown-clear'|'stung', item: string|null}} hive
 */

/**
 * Shakes a tree (one press). In order: a bee tree whose nest is up warns (`hum`, `hiveHumMs`) and
 * then resolves (Gust lead: blown clear; `ctx.net`: netted; else stung; honeycomb to `ctx.give`), and
 * that press does nothing else; otherwise one fruit drops (every fruit with a Gust lead; ripe when a
 * day past regrowth; when the last fruit goes the tree regrows in `regrowDaysDefault` days), the
 * day's purse drops to `ctx.earn` (amount from `rng`), and a tree with `shells` may knock one loose.
 * Draws from `rng`: one for the purse amount (when due), one for the shell chance and one for its
 * pick (when the tree has shells).
 * @param {World} world
 * @param {{id: string, region?: string, entities?: any[]}} map
 * @param {string|TreeDef} tree
 * @param {Rng} rng     the `loot` stream
 * @param {GatherCtx} [ctx]
 * @returns {ShakeResult}
 */
export function shakeTree(world, map, tree, rng, ctx) {
  const def = treeDefOf(map, tree);
  if (!def || typeof def.id !== 'string') throw new TypeError(`gather.shakeTree: unknown tree ${String(tree)}`);
  const t = T(ctx);
  const day = dayOf(world, ctx);
  const m = ensureMap(world, map.id);
  const lb = leadBonuses(world, ctx);
  /** @type {ShakeResult} */
  const res = { ok: true, treeId: def.id, events: [{ type: 'shake', treeId: def.id, mapId: map.id }], fruit: null, purse: 0, shells: [], hive: null };
  stats.inc(world, 'treesShaken', 1, ctx);

  if (def.hive && m.picked[`${def.id}#hive`] !== day) {
    m.picked[`${def.id}#hive`] = day;
    res.events.push({ type: 'hum', treeId: def.id, delayMs: t.hiveHumMs });
    const outcome = lb.hiveBlowClear ? 'blown-clear' : (ctx?.net ? 'netted' : 'stung');
    const item = typeof def.hive === 'string' ? def.hive : null;
    res.hive = { outcome, item };
    if (outcome === 'stung') res.events.push({ type: 'stung', treeId: def.id });
    else {
      if (item && typeof ctx?.give === 'function') ctx.give(item, 1);
      res.events.push({ type: 'honey', treeId: def.id, item, outcome });
    }
    emitAll(ctx, res.events);
    return res;
  }

  const fruit = treeFruit(world, def, ctx);
  if (fruit) {
    const regrowDay = Number.isInteger(m.trees[def.id]) ? m.trees[def.id] : 0;
    if (day >= regrowDay) {
      const taken = takenSlots(m, def.id);
      const left = t.fruitPerTree - taken.length;
      if (left > 0) {
        const n = lb.shakeAllFruit ? left : 1;
        const ripeDay = regrowDay + Math.max(0, t.fruitRipeDays - t.regrowDaysDefault);
        const ripe = day >= ripeDay;
        const row = rowOf(ctx?.data, 'collections', fruit);
        const base = typeof row?.price === 'number' ? row.price : 0;
        const value = ripe ? (typeof row?.ripePrice === 'number' ? row.ripePrice : Math.round(base * t.fruitRipeMult)) : base;
        let slot = 0;
        for (let i = 0; i < n; i++) {
          while (taken.includes(slot)) slot++;
          taken.push(slot);
          m.picked[`${def.id}#f${slot}`] = day;
        }
        if (taken.length >= t.fruitPerTree) {
          m.trees[def.id] = day + t.regrowDaysDefault;
          for (const s of taken) delete m.picked[`${def.id}#f${s}`];
        }
        res.fruit = { id: fruit, n, ripe, value };
        if (typeof ctx?.give === 'function') ctx.give(fruit, n);
        res.events.push({ type: 'fruit', treeId: def.id, id: fruit, n, ripe, value });
      }
    }
  }

  if (def.purse && m.picked[`${def.id}#purse`] !== day) {
    const [lo, hi] = Array.isArray(def.purse) && V.intRange(def.purse) ? def.purse : t.purseRange;
    const steps = Math.floor((hi - lo) / t.purseStep);
    const amount = lo + t.purseStep * rng.int(0, Math.max(0, steps));
    m.picked[`${def.id}#purse`] = day;
    res.purse = amount;
    if (typeof ctx?.earn === 'function') ctx.earn(amount, 'purse');
    res.events.push({ type: 'purse', treeId: def.id, amount });
  }

  if (Array.isArray(def.shells) && def.shells.length > 0) {
    if (rng.chance(t.shellChance)) {
      const id = pickWeighted(rng, def.shells.map((s) => (typeof s === 'string' ? { id: s } : s)));
      if (id) {
        res.shells.push(id);
        if (rowOf(ctx?.data, 'collections', id)) recordFind(world, id, ctx);
        if (typeof ctx?.give === 'function') ctx.give(id, 1);
        res.events.push({ type: 'shell', treeId: def.id, id });
      }
    }
  }

  if (res.events.length === 1) res.events.push({ type: 'bare', treeId: def.id });
  emitAll(ctx, res.events);
  return res;
}

// ---------------------------------------------------------------------------------------------
// Cracks, the Glint, sparkles, skyglass, cockles
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Crack
 * @property {string} key     `c<day>@<x>,<y>` (the `maps[].cracks` key)
 * @property {number} x  @property {number} y
 * @property {string|null} findId   what is under it (`null` when the map has no find pool)
 * @property {boolean} opened
 * @property {boolean} extra  the Grit/Stone lead's extra crack
 * @property {boolean} marked shows on the map (Grit/Stone lead)
 */

/**
 * Today's dig cracks on a map with a `dig` site (`dig: {spots, cracks?, finds?}`): `cracks`
 * (default `cracksPerDay`) spots drawn without replacement, plus the lead's `extraCracks`; each
 * holds a find from the map's pool. Stable for the whole day and across reloads: the order and the
 * finds come from `rng.fork('cracks:<mapId>:<day>')`, and the extra crack never moves the others.
 * @param {World} world
 * @param {{id: string, region?: string, dig?: any}} map
 * @param {Rng} rng   base generator (see module doc; {@link planRng})
 * @param {GatherCtx} [ctx]
 * @returns {Crack[]}
 */
export function cracksFor(world, map, rng, ctx) {
  const spots = spotsOf(map?.dig?.spots);
  if (spots.length === 0) return [];
  const t = T(ctx);
  const day = dayOf(world, ctx);
  const lb = leadBonuses(world, ctx);
  const base = Number.isInteger(map.dig.cracks) && map.dig.cracks >= 0 ? map.dig.cracks : t.cracksPerDay;
  const want = Math.min(spots.length, base + lb.extraCracks);
  const fork = rng.fork(`cracks:${map.id}:${day}`);
  const order = fork.shuffle(spots);
  const pool = findPool(ctx?.data, map, 'crack', map.dig.finds);
  const findRng = fork.fork('finds');
  const opened = viewMap(world, map.id).cracks ?? {};
  /** @type {Crack[]} */
  const out = [];
  for (let i = 0; i < want; i++) {
    const s = order[i];
    const key = `c${day}@${s.x},${s.y}`;
    out.push({ key, x: s.x, y: s.y, findId: pool.length ? pickWeighted(findRng, pool) : null, opened: opened[key] === true, extra: i >= base, marked: lb.markCracks });
  }
  return out;
}

/**
 * @typedef {Object} GlintSpot
 * @property {number} x  @property {number} y
 * @property {number} amount   buttons before the Keeper's Purse refund (`glintBase + glintPerDay × day number`, day number 1-based)
 * @property {boolean} dug
 */

/**
 * Today's Glint on a map whose `flats.glint` is true (exactly one a day; its spot comes from
 * `rng.fork('glint:<day>')`, the GDD-00 §15 stream).
 * @param {World} world
 * @param {{id: string, flats?: any}} map
 * @param {Rng} rng   base generator
 * @param {GatherCtx} [ctx]
 * @returns {GlintSpot|null}
 */
export function glintFor(world, map, rng, ctx) {
  if (!map?.flats?.glint) return null;
  const spots = spotsOf(map.flats.spots);
  if (spots.length === 0) return null;
  const t = T(ctx);
  const day = dayOf(world, ctx);
  const s = rng.fork(`glint:${day}`).pick(spots);
  return { x: s.x, y: s.y, amount: t.glintBase + t.glintPerDay * (day + 1), dug: viewMap(world, map.id).picked?.glint === day };
}

/**
 * @typedef {{key: string, x: number, y: number, findId: string|null, taken: boolean}} LowFind
 */

/**
 * @param {World} world
 * @param {any} map
 * @param {Rng} rng
 * @param {number} low
 * @param {number} count
 * @param {string} tag      'sparkle' | 'skyglass'
 * @param {string} keyTag   's' | 'k'
 * @param {GatherCtx|undefined} ctx
 * @returns {LowFind[]}
 */
function lowFinds(world, map, rng, low, count, tag, keyTag, ctx) {
  const spots = spotsOf(map?.flats?.spots);
  if (spots.length === 0 || count <= 0) return [];
  const fork = rng.fork(`${tag}:${map.id}:${low}`);
  const order = fork.shuffle(spots);
  const pool = findPool(ctx?.data, map, tag);
  const findRng = fork.fork('finds');
  const picked = viewMap(world, map.id).picked ?? {};
  const out = [];
  for (let i = 0; i < Math.min(count, order.length); i++) {
    const key = `${keyTag}${low}#${i}`;
    out.push({ key, x: order[i].x, y: order[i].y, findId: pool.length ? pickWeighted(findRng, pool) : null, taken: Number.isInteger(picked[key]) });
  }
  return out;
}

/**
 * Sparkle spots (finds) for a low on a map with `flats` (`flats.sparkles` overrides the count).
 * @param {World} world
 * @param {{id: string, region?: string, flats?: any}} map
 * @param {Rng} rng   base generator
 * @param {number} lowIndex   from {@link lowInfo}
 * @param {GatherCtx} [ctx]
 * @returns {LowFind[]}
 */
export function sparklesFor(world, map, rng, lowIndex, ctx) {
  if (!map?.flats) return [];
  const n = Number.isInteger(map.flats.sparkles) && map.flats.sparkles >= 0 ? map.flats.sparkles : T(ctx).sparklesPerLow;
  return lowFinds(world, map, rng, lowIndex, n, 'sparkle', 's', ctx);
}

/**
 * Skyglass relics placed for a low on a map whose `flats.skyglass` is true: between
 * `skyglassPerNightLow[0]` and `[1]` (GDD-00: max 3). They can be dug only at a NIGHT low
 * ({@link LowInfo.nightLow}); a Glass/Hollow lead sees the day low's dimly.
 * @param {World} world
 * @param {{id: string, region?: string, flats?: any}} map
 * @param {Rng} rng   base generator
 * @param {number} lowIndex
 * @param {GatherCtx} [ctx]
 * @returns {LowFind[]}
 */
export function skyglassFor(world, map, rng, lowIndex, ctx) {
  if (!map?.flats?.skyglass) return [];
  const [lo, hi] = T(ctx).skyglassPerNightLow;
  const n = rng.fork(`skyglass:${map.id}:${lowIndex}`).fork('count').int(lo, hi);
  return lowFinds(world, map, rng, lowIndex, n, 'skyglass', 'k', ctx);
}

/**
 * @typedef {Object} DigResult
 * @property {boolean} ok
 * @property {'glint'|'skyglass'|'sparkle'|'crack'|null} kind
 * @property {string|null} findId
 * @property {number} amount        buttons (the Glint, including the Keeper's Purse refund)
 * @property {string} [reason]      when not ok: 'nothing'
 * @property {Array<{type: string, [k: string]: any}>} events
 */

/**
 * The shovel: digs the tile and takes what lies under it, in priority order: the Glint (at any low
 * window), a skyglass relic (night low only), a sparkle (low window), today's crack. Finds are logged
 * (systems/fieldLog) and handed to `ctx.give`. The Glint pays through `ctx.collectGlint({gameDay})`
 * when given (systems/wallet.collectGlint: value + the Keeper's Purse share; its `total` is reported),
 * else `amount + ctx.takePurse()` through `ctx.earn(…, 'glint')`.
 * @param {World} world
 * @param {{id: string, region?: string, dig?: any, flats?: any}} map
 * @param {number} x
 * @param {number} y
 * @param {Rng} rng   base generator (placement only; digging itself draws nothing)
 * @param {GatherCtx} [ctx]
 * @returns {DigResult}
 */
export function dig(world, map, x, y, rng, ctx) {
  if (!map || typeof map.id !== 'string') throw new TypeError('gather.dig: map must have an id');
  const li = lowInfo(world, ctx);
  const day = dayOf(world, ctx);
  /** @type {DigResult} */
  const res = { ok: false, kind: null, findId: null, amount: 0, events: [] };
  const at = (s) => s.x === x && s.y === y;
  const give = (id) => { if (id && typeof ctx?.give === 'function') ctx.give(id, 1); };

  if (li.inWindow) {
    const g = glintFor(world, map, rng, ctx);
    if (g && !g.dug && at(g)) {
      const m = ensureMap(world, map.id);
      m.picked.glint = day;
      let amount = g.amount;
      let refund = 0;
      if (typeof ctx?.collectGlint === 'function') {
        const paid = ctx.collectGlint({ gameDay: day + 1 });
        refund = Math.max(0, Math.floor(Number(paid?.refund) || 0));
        amount = Number.isFinite(paid?.total) ? paid.total : g.amount + refund;
      } else {
        refund = typeof ctx?.takePurse === 'function' ? Math.max(0, Math.floor(Number(ctx.takePurse()) || 0)) : 0;
        amount = g.amount + refund;
        if (typeof ctx?.earn === 'function') ctx.earn(amount, 'glint');
      }
      Object.assign(res, { ok: true, kind: 'glint', amount });
      res.events.push({ type: 'dig', mapId: map.id, x, y }, { type: 'glint', mapId: map.id, x, y, amount, refund });
      emitAll(ctx, res.events);
      return res;
    }
  }
  if (li.nightLow) {
    const hit = skyglassFor(world, map, rng, li.lowIndex, ctx).find((s) => !s.taken && at(s));
    if (hit) {
      const m = ensureMap(world, map.id);
      pruneLowKeys(m, li.lowIndex);
      m.picked[hit.key] = day;
      if (hit.findId) recordFind(world, hit.findId, ctx);
      give(hit.findId);
      Object.assign(res, { ok: true, kind: 'skyglass', findId: hit.findId });
      // `gather:skyglass {n}` (emitAll) counts toward the Glowing Flats stamp (data/town.js STAMPS)
      res.events.push({ type: 'dig', mapId: map.id, x, y }, { type: 'skyglass', mapId: map.id, x, y, id: hit.findId, n: 1 });
      emitAll(ctx, res.events);
      return res;
    }
  }
  if (li.inWindow) {
    const hit = sparklesFor(world, map, rng, li.lowIndex, ctx).find((s) => !s.taken && at(s));
    if (hit) {
      const m = ensureMap(world, map.id);
      pruneLowKeys(m, li.lowIndex);
      m.picked[hit.key] = day;
      if (hit.findId) recordFind(world, hit.findId, ctx);
      give(hit.findId);
      Object.assign(res, { ok: true, kind: 'sparkle', findId: hit.findId });
      res.events.push({ type: 'dig', mapId: map.id, x, y }, { type: 'find', mapId: map.id, x, y, id: hit.findId, from: 'sparkle' });
      emitAll(ctx, res.events);
      return res;
    }
  }
  const crack = cracksFor(world, map, rng, ctx).find((c) => !c.opened && at(c));
  if (crack) {
    const m = ensureMap(world, map.id);
    for (const k of Object.keys(m.cracks)) if (crackKeyStale(k, day)) delete m.cracks[k];
    m.cracks[crack.key] = true;
    if (crack.findId) recordFind(world, crack.findId, ctx);
    give(crack.findId);
    Object.assign(res, { ok: true, kind: 'crack', findId: crack.findId });
    res.events.push({ type: 'dig', mapId: map.id, x, y }, { type: 'find', mapId: map.id, x, y, id: crack.findId, from: 'crack' });
    emitAll(ctx, res.events);
    return res;
  }
  res.reason = 'nothing';
  return res;
}

/**
 * Rakes cockles from a flats spot at a low (map `flats.cockles: {item}`): each spot once per low,
 * at most `cockleRakesPerLow` rakes per low on the map; `cockleRange` cockles (one draw) to
 * `ctx.give`. Logged as a find when the item is a collection row.
 * @param {World} world
 * @param {{id: string, flats?: any}} map
 * @param {number} x
 * @param {number} y
 * @param {Rng} rng   the `loot` stream
 * @param {GatherCtx} [ctx]
 * @returns {{ok: true, item: string, n: number} | {ok: false, reason: 'no-cockles'|'not-flats'|'tide'|'raked'|'spent'}}
 */
export function rakeCockles(world, map, x, y, rng, ctx) {
  const item = map?.flats?.cockles?.item;
  if (typeof item !== 'string') return { ok: false, reason: 'no-cockles' };
  if (!spotsOf(map.flats.spots).some((s) => s.x === x && s.y === y)) return { ok: false, reason: 'not-flats' };
  const li = lowInfo(world, ctx);
  if (!li.inWindow) return { ok: false, reason: 'tide' };
  const t = T(ctx);
  const m = viewMap(world, map.id);
  const key = `r${li.lowIndex}@${x},${y}`;
  if (Number.isInteger(m.picked?.[key])) return { ok: false, reason: 'raked' };
  const used = Object.keys(m.picked ?? {}).filter((k) => k.startsWith(`r${li.lowIndex}@`)).length;
  if (used >= t.cockleRakesPerLow) return { ok: false, reason: 'spent' };
  const n = rng.int(t.cockleRange[0], t.cockleRange[1]);
  const w = ensureMap(world, map.id);
  pruneLowKeys(w, li.lowIndex);
  w.picked[key] = dayOf(world, ctx);
  if (n > 0) {
    if (rowOf(ctx?.data, 'collections', item)) recordFind(world, item, ctx);
    if (typeof ctx?.give === 'function') ctx.give(item, n);
  }
  emitAll(ctx, [{ type: 'cockles', mapId: map.id, x, y, item, n }]);
  return { ok: true, item, n };
}

// ---------------------------------------------------------------------------------------------
// Senses: what the party lead lets you notice
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Senses
 * @property {{x: number, y: number, dist: number}|null} glint   shown (exposed at a low and within the reveal radius)
 * @property {Crack[]} cracks       today's unopened cracks to mark on the map (Grit/Stone lead), else `[]`
 * @property {Array<{x: number, y: number, dim: boolean, findId: string|null}>} skyglass   relics shown (`dim` = by day, not diggable)
 * @property {boolean} hum          Bolt lead's Tailhum: a purse, the Glint or a night headliner is within `humRadius`
 * @property {Array<{kind: 'purse'|'glint'|'headliner', x: number, y: number}>} humTargets
 */

/**
 * What the player notices from `pos` with the current lead (GDD-00 §9 Crossovers): the Glint from 3
 * tiles (Grit/Stone; base `glintRevealRadius`), today's cracks marked, skyglass from 5 tiles and
 * dimly by day: the next night low's relics (Glass/Hollow; base `skyglassRevealRadius` at a night
 * low only), the Tailhum within 4
 * tiles of a ready purse tree, the undug Glint or any `ctx.headliners` position (Bolt).
 * @param {World} world
 * @param {{id: string, region?: string, entities?: any[], dig?: any, flats?: any}} map
 * @param {{x: number, y: number}} pos
 * @param {Rng} rng   base generator
 * @param {GatherCtx & {headliners?: Array<{x: number, y: number}>}} [ctx]
 * @returns {Senses}
 */
export function senses(world, map, pos, rng, ctx) {
  const t = T(ctx);
  const lb = leadBonuses(world, ctx);
  const li = lowInfo(world, ctx);
  /** @type {Senses} */
  const out = { glint: null, cracks: [], skyglass: [], hum: false, humTargets: [] };
  const g = glintFor(world, map, rng, ctx);
  if (g && !g.dug && li.inWindow) {
    const r = lb.glintSeeRadius > 0 ? Math.max(lb.glintSeeRadius, t.glintRevealRadius) : t.glintRevealRadius;
    const d = tileDist(pos, g);
    if (d <= r) out.glint = { x: g.x, y: g.y, dist: d };
  }
  if (lb.markCracks) out.cracks = cracksFor(world, map, rng, ctx).filter((c) => !c.opened);
  if (map?.flats?.skyglass) {
    const relics = skyglassFor(world, map, rng, li.lowIndex, ctx).filter((s) => !s.taken);
    if (li.nightLow) {
      const r = Math.max(lb.skyglassSeeRadius, t.skyglassRevealRadius);
      for (const s of relics) if (tileDist(pos, s) <= r) out.skyglass.push({ x: s.x, y: s.y, dim: false, findId: s.findId });
    } else if (lb.skyglassByDay && !li.night) {
      // by day the relics of the next NIGHT low show dimly (those are the ones that can be dug)
      const nl = nextNightLow(world, ctx);
      const ahead = nl.lowIndex === li.lowIndex ? relics : skyglassFor(world, map, rng, nl.lowIndex, ctx).filter((s) => !s.taken);
      for (const s of ahead) if (tileDist(pos, s) <= lb.skyglassSeeRadius) out.skyglass.push({ x: s.x, y: s.y, dim: true, findId: s.findId });
    }
  }
  if (lb.humRadius > 0) {
    const R = lb.humRadius;
    const day = dayOf(world, ctx);
    const picked = viewMap(world, map.id).picked ?? {};
    for (const e of Array.isArray(map?.entities) ? map.entities : []) {
      if (e && e.kind === 'tree' && e.purse && picked[`${e.id}#purse`] !== day && Number.isInteger(e.x) && tileDist(pos, e) <= R) out.humTargets.push({ kind: 'purse', x: e.x, y: e.y });
    }
    if (g && !g.dug && tileDist(pos, g) <= R) out.humTargets.push({ kind: 'glint', x: g.x, y: g.y });
    for (const h of Array.isArray(ctx?.headliners) ? ctx.headliners : []) {
      if (h && Number.isFinite(h.x) && Number.isFinite(h.y) && tileDist(pos, h) <= R) out.humTargets.push({ kind: 'headliner', x: h.x, y: h.y });
    }
    out.hum = out.humTargets.length > 0;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bugs
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Bug
 * @property {string} id     bug collection row id
 * @property {number} x  @property {number} y
 * @property {boolean} lit   placed at a lit spot
 */

/**
 * Places bugs at spots for the moment: each spot holds a bug with `bugSpawnChance` (× `bugLightMult`
 * at a lit spot, × `bugRainMult` in rain; capped at 1); the bug is a weighted pick among the active
 * bug rows ({@link rowActive}; `w`, `mods`), light-loving rows (`light: true`) weigh `bugLightMult`
 * more at lit spots and moths (`moth: true`) a further `mothLightMult` with a Bolt lead. A spot with
 * a `habitat` only holds rows whose `habitat` (string or list) names it; rows without a `habitat`
 * live anywhere. Draws two per spot that holds a bug, one per spot that does not (a spot whose
 * habitat no active row lives at still draws its one spawn roll, so spots never shift each other).
 * @param {World} world
 * @param {{id: string, region?: string}} map
 * @param {Array<{x: number, y: number, lit?: boolean, habitat?: string}>} spots
 * @param {Rng} rng   the `loot` stream (or a per-visit fork)
 * @param {GatherCtx} [ctx]
 * @returns {Bug[]}
 */
export function rollBugs(world, map, spots, rng, ctx) {
  const t = T(ctx);
  const lb = leadBonuses(world, ctx);
  const env = envFor(world, map, ctx);
  const rows = collectionRows(ctx?.data, 'bug').filter((r) => rowActive(r, env));
  /** @type {Bug[]} */
  const out = [];
  if (rows.length === 0 || !Array.isArray(spots)) return out;
  const rain = env.weather === 'rain' || env.weather === 'storm';
  for (const s of spots) {
    if (!s || !Number.isInteger(s.x) || !Number.isInteger(s.y)) continue;
    const lit = Boolean(s.lit);
    const p = Math.min(1, t.bugSpawnChance * (lit ? t.bugLightMult : 1) * (rain ? t.bugRainMult : 1));
    if (!rng.chance(p)) continue;
    const habitat = typeof s.habitat === 'string' ? s.habitat : null;
    const here = habitat === null ? rows : rows.filter((r) => {
      const h = Array.isArray(r.habitat) ? r.habitat : (typeof r.habitat === 'string' ? [r.habitat] : null);
      return h === null || h.includes(habitat);
    });
    if (here.length === 0) continue;
    const entries = here.map((r) => {
      let w = (typeof r.w === 'number' && Number.isFinite(r.w) ? r.w : 1) * modsFor(r, env);
      if (lit && r.light) w *= t.bugLightMult;
      if (lit && r.moth) w *= lb.mothLightMult;
      return { w, v: r.id };
    });
    const id = rng.weighted(entries);
    if (id) out.push({ id, x: s.x, y: s.y, lit });
  }
  return out;
}

/**
 * Tiles within which a gait spooks a bug: `bugSpookRadius[gait]` × the row's `spook` multiplier.
 * Gaits: `'still' | 'creep' | 'walk' | 'run'` (unknown gaits count as walking).
 * @param {any} bugRow
 * @param {string} gait
 * @param {LaneCtx} [ctx]
 * @returns {number}
 */
export function spookRadius(bugRow, gait, ctx) {
  const radii = T(ctx).bugSpookRadius;
  const base = Object.prototype.hasOwnProperty.call(radii, gait) ? radii[gait] : radii.walk;
  const mult = typeof bugRow?.spook === 'number' && Number.isFinite(bugRow.spook) && bugRow.spook >= 0 ? bugRow.spook : 1;
  return Math.round(base * mult);
}

/**
 * Whether the player's movement signature spooks a bug: within {@link spookRadius} tiles
 * (Chebyshev) of it with a gait whose radius is above zero.
 * @param {Bug} bug
 * @param {{x: number, y: number, gait: string}} player
 * @param {LaneCtx} [ctx]
 * @returns {boolean}
 */
export function isSpooked(bug, player, ctx) {
  const r = spookRadius(rowOf(ctx?.data, 'collections', bug.id), player.gait, ctx);
  return r > 0 && tileDist(bug, player) <= r;
}

/**
 * Swings the net at a bug: out of reach (`netReach` tiles), spooked by the swing's approach gait, or
 * a wary bug (`wary` 0..1 on its row, one draw) slipping away all miss; otherwise it is netted,
 * logged and given (`ctx.give`).
 * @param {World} world
 * @param {Bug} bug
 * @param {{x: number, y: number, gait: string}} player
 * @param {Rng} rng   the `loot` stream
 * @param {GatherCtx} [ctx]
 * @returns {{ok: true, id: string, first: boolean} | {ok: false, id: string, reason: 'out-of-reach'|'spooked'|'escaped'}}
 */
export function netBug(world, bug, player, rng, ctx) {
  if (!bug || typeof bug.id !== 'string') throw new TypeError('gather.netBug: bug must have an id');
  const t = T(ctx);
  if (tileDist(bug, player) > t.netReach) return { ok: false, id: bug.id, reason: 'out-of-reach' };
  if (isSpooked(bug, player, ctx)) {
    emitAll(ctx, [{ type: 'bug-escaped', id: bug.id, reason: 'spooked' }]);
    return { ok: false, id: bug.id, reason: 'spooked' };
  }
  const row = rowOf(ctx?.data, 'collections', bug.id);
  const wary = typeof row?.wary === 'number' && Number.isFinite(row.wary) ? Math.min(1, Math.max(0, row.wary)) : 0;
  if (rng.chance(wary)) {
    emitAll(ctx, [{ type: 'bug-escaped', id: bug.id, reason: 'escaped' }]);
    return { ok: false, id: bug.id, reason: 'escaped' };
  }
  const r = recordBug(world, bug.id, ctx);
  if (typeof ctx?.give === 'function') ctx.give(bug.id, 1);
  emitAll(ctx, [{ type: 'bug', id: bug.id, x: bug.x, y: bug.y, first: r.first }]);
  return { ok: true, id: bug.id, first: r.first };
}

/** Rows of a table (re-exported for scenes that list what a map can hold). */
export { rowsOf };
