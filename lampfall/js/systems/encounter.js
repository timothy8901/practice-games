/**
 * Seeded wild encounters (GDD-00 §4 isles and reed edges, §5 night rules, §8 Errants, §2 the lit
 * point; ARCHITECTURE §4.6, §14.11). [SYS-WORLD]
 *
 * {@link rollStep} is called once per player step on a map. It counts the step, and when the tile
 * holds a spawn (a map `spawns[]` entry) and the steps-since-last floor has passed, rolls the spawn's
 * rate; on a hit it picks a row of the spawn's encounter table:
 *  - rows are filtered by their `cond` exactly as world/roamer filters roamer rows
 *    ({@link rowCondHolds}: phase / tide / weather locally, anything else through the §6.4 DSL), so
 *    visible roamers and step encounters always agree on what is out;
 *  - each row's weight is `w` × its `mods` for day/night, tide state and weather (GDD-00: the night
 *    table leans Hollow / Glass / Rime, high tide brings Brine);
 *  - the level is the row's range, +2 at night (GDD-00 §4, §5), clamped to the encounter bounds.
 * Errants are rows with `errant: true` and never join the weighted pick. A `roam: 'route'` Errant
 * (default) Skyroams: it sits on one of the tables that list it and moves one table per game hour;
 * where it is, each encounter is it with `errantRouteChance` (about 1 in 300). A `roam: 'lit'` row
 * (the lit point after the Relighting; gate it with a `cond` on the flag) appears at night: one
 * `errantLitChance` roll (1 in 120) for the group, then one of the lit Errants that are up. A beaten or caught Errant is down until it returns: the next day
 * (GDD-00 §8), after the next badge, or after 2 hours of play, whichever comes first.
 *
 * Wild encounters only happen on isles and Pellwick's reed edges: interiors never roll, and on a map
 * marked `town: true` (or whose region is) only spawns marked `reeds: true` (or area `'reeds'`) do.
 * Nothing here names a species or a map; every number is a tuning key.
 *
 * Writes `world.encounter` only (`steps` since the last encounter, Errant `seen` / down state).
 * Events (`ctx.bus`): `encounter:start {speciesId, level, errant, tableId, mapId, night}`.
 * Pure: no DOM, no Math.random. Lane: SYS-WORLD.
 * @module systems/encounter
 */

import { hashString } from '../core/rng.js';
import { MINUTES_PER_DAY } from '../core/time.js';
import { rowCondHolds, eligibleRows, rollLevel } from '../world/roamer.js';
import { makeTuning, tuningSource, deepFreeze, V, rowOf, rowsOf } from './fieldLog.js';
import { envFor, modsFor, nowTotal } from './gather.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {import('./fieldLog.js').LaneCtx} LaneCtx */
/** @typedef {import('../world/roamer.js').EncounterRow} EncounterRow */

/**
 * @typedef {Object} EncounterResult   ARCHITECTURE §4.6 shape plus where and when
 * @property {string} speciesId
 * @property {number} level
 * @property {boolean} errant
 * @property {string} tableId
 * @property {string} mapId
 * @property {boolean} night
 */

/**
 * @typedef {LaneCtx & {
 *   x?: number, y?: number, spawn?: object|null, tideState?: string, phase?: string, weather?: string,
 *   total?: number, day?: number, playMs?: number,
 * }} EncounterCtx
 */

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} EncounterTuning
 * @property {number} encounterRateDefault     per-step chance when a spawn gives no `rate`
 * @property {number} encounterMinLevel        level clamp (validator shares it)
 * @property {number} encounterMaxLevel
 * @property {number} encounterMinSteps        steps after an encounter before another can roll ("never chain instantly")
 * @property {number} encounterNightLevelBonus wild levels at night (GDD-00 §4: +2)
 * @property {number} errantRouteChance        an encounter on an Errant's current route is the Errant (GDD-00 task: ~1 in 300)
 * @property {number} errantLitChance          a night encounter at the lit point is an Errant (GDD-00 §2: 1 in 120)
 * @property {number} errantRoamMinutes        Skyroam: game minutes per route (GDD-00 §8: one route per game hour)
 * @property {boolean} errantReturnNextDay     a downed Errant returns the next day (GDD-00 §8)
 * @property {boolean} errantReturnOnBadge     ... or after the next badge
 * @property {number} errantReturnPlayMs       ... or after this much play (0 = never by play time)
 * @property {number} nightStartMinute         game night (GDD-00 §5: 18:00–06:00); same key gather reads
 * @property {number} nightEndMinute
 */

/** @type {Readonly<EncounterTuning>} */
export const DEFAULTS = deepFreeze({
  encounterRateDefault: 0.08,
  encounterMinLevel: 1,
  encounterMaxLevel: 100,
  encounterMinSteps: 8,
  encounterNightLevelBonus: 2,
  errantRouteChance: 1 / 300,
  errantLitChance: 1 / 120,
  errantRoamMinutes: 60,
  errantReturnNextDay: true,
  errantReturnOnBadge: true,
  errantReturnPlayMs: 2 * 60 * 60 * 1000,
  nightStartMinute: 18 * 60,
  nightEndMinute: 6 * 60,
});

const minuteOk = (v) => Number.isInteger(v) && v >= 0 && v < MINUTES_PER_DAY;

/** @type {Record<keyof EncounterTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  encounterRateDefault: [V.unit, '0..1'],
  encounterMinLevel: [V.posInt, 'integer >= 1'],
  encounterMaxLevel: [V.posInt, 'integer >= 1'],
  encounterMinSteps: [V.nonNegInt, 'integer >= 0'],
  encounterNightLevelBonus: [V.int, 'integer'],
  errantRouteChance: [V.unit, '0..1'],
  errantLitChance: [V.unit, '0..1'],
  errantRoamMinutes: [V.pos, 'number > 0'],
  errantReturnNextDay: [V.bool, 'boolean'],
  errantReturnOnBadge: [V.bool, 'boolean'],
  errantReturnPlayMs: [V.nonNeg, 'number >= 0'],
  nightStartMinute: [minuteOk, 'minute 0..1439'],
  nightEndMinute: [minuteOk, 'minute 0..1439'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Resolves this module's tuning. */
export const tuningOf = makeTuning('encounter', DEFAULTS, SPEC);

/** @param {LaneCtx|undefined} ctx */
const T = (ctx) => tuningOf(tuningSource(ctx));

/** `world.encounter.steps` stops counting here (it only has to pass the floor; keeps saves small). */
export const STEPS_CAP = 1_000_000;

/**
 * The stateful stream label for a map's step encounters and roamers (GDD-00 §15).
 * @param {string} mapId
 * @returns {string}
 */
export function streamLabel(mapId) {
  return `encounter:${mapId}`;
}

// ---------------------------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{seen: boolean, downDay: number|null, downBadges: number|null, downPlayMs: number|null}} ErrantState
 */

/** @returns {ErrantState} */
function freshErrant() {
  return { seen: false, downDay: null, downBadges: null, downPlayMs: null };
}

/**
 * The `world.encounter` record (repaired in place when a hand-edited save broke it).
 * @param {World} world
 * @returns {{steps: number, errants: Record<string, ErrantState>}}
 */
function enc(world) {
  let e = world.encounter;
  if (!e || typeof e !== 'object') {
    e = { steps: 0, errants: {} };
    world.encounter = e;
  }
  if (!Number.isInteger(e.steps) || e.steps < 0) e.steps = 0;
  if (!e.errants || typeof e.errants !== 'object') e.errants = {};
  return e;
}

/**
 * Steps taken since the last encounter.
 * @param {World} world
 * @returns {number}
 */
export function stepsSinceLast(world) {
  const s = world?.encounter?.steps;
  return Number.isInteger(s) && s >= 0 ? s : 0;
}

/**
 * Night by game rules at the context's moment.
 * @param {World} world
 * @param {EncounterCtx} [ctx]
 * @returns {boolean}
 */
export function isNight(world, ctx) {
  const t = T(ctx);
  const m = ((nowTotal(world, ctx) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const a = t.nightStartMinute, b = t.nightEndMinute;
  return a <= b ? (m >= a && m < b) : (m >= a || m < b);
}

/**
 * @param {World} world
 * @param {EncounterCtx} [ctx]
 * @returns {number}
 */
function dayNow(world, ctx) {
  return Number.isInteger(ctx?.day) ? ctx.day : Math.floor(nowTotal(world, ctx) / MINUTES_PER_DAY);
}

/**
 * @param {World} world
 * @param {EncounterCtx} [ctx]
 * @returns {number}
 */
function playMsNow(world, ctx) {
  if (typeof ctx?.playMs === 'number' && Number.isFinite(ctx.playMs)) return ctx.playMs;
  const p = world?.stats?.playMs;
  return typeof p === 'number' && Number.isFinite(p) ? p : 0;
}

/**
 * Whether an Errant is up (not down, or returned). A downed Errant returns the next day, after a
 * new badge, or after `errantReturnPlayMs` of play, as the tuning enables.
 * @param {World} world
 * @param {string} speciesId
 * @param {EncounterCtx} [ctx]
 * @returns {boolean}
 */
export function errantUp(world, speciesId, ctx) {
  const st = world?.encounter?.errants?.[speciesId];
  if (!st || st.downDay === null || st.downDay === undefined) return true;
  const t = T(ctx);
  if (t.errantReturnNextDay && dayNow(world, ctx) > st.downDay) return true;
  if (t.errantReturnOnBadge && Number.isInteger(st.downBadges) && (world?.badges?.length ?? 0) > st.downBadges) return true;
  if (t.errantReturnPlayMs > 0 && typeof st.downPlayMs === 'number' && playMsNow(world, ctx) - st.downPlayMs >= t.errantReturnPlayMs) return true;
  return false;
}

/**
 * Records that an Errant was beaten or caught: it is down until it returns ({@link errantUp}).
 * Emits `encounter:errant-down {speciesId}`.
 * @param {World} world
 * @param {string} speciesId
 * @param {EncounterCtx} [ctx]
 * @returns {ErrantState}
 */
export function markErrantDown(world, speciesId, ctx) {
  if (typeof speciesId !== 'string' || !speciesId) throw new TypeError('encounter.markErrantDown: species id must be a non-empty string');
  const e = enc(world);
  const st = e.errants[speciesId] ?? freshErrant();
  st.seen = true;
  st.downDay = dayNow(world, ctx);
  st.downBadges = world?.badges?.length ?? 0;
  st.downPlayMs = playMsNow(world, ctx);
  e.errants[speciesId] = st;
  ctx?.bus?.emit('encounter:errant-down', { speciesId });
  return st;
}

/**
 * Marks an Errant seen (it then shows on the map; Skyroam).
 * @param {World} world
 * @param {string} speciesId
 * @returns {boolean} whether this was the first sighting
 */
export function markErrantSeen(world, speciesId) {
  const e = enc(world);
  const st = e.errants[speciesId] ?? freshErrant();
  const first = !st.seen;
  st.seen = true;
  e.errants[speciesId] = st;
  return first;
}

// ---------------------------------------------------------------------------------------------
// Where encounters may happen
// ---------------------------------------------------------------------------------------------

/**
 * Whether a map is a town map (no wild except the reed edges): `map.town === true`, or its region
 * row says `town: true`.
 * @param {{town?: boolean, region?: string}} map
 * @param {any} data
 * @returns {boolean}
 */
export function isTownMap(map, data) {
  if (map?.town === true) return true;
  const region = typeof map?.region === 'string' ? rowOf(data, 'regions', map.region) : null;
  return region?.town === true;
}

/**
 * The spawn entry under a tile: `ctx.spawn` when given (a RuntimeMap caller passes
 * `map.spawnAt(x, y)`), else `map.spawnAt(x, y)`, else the first rect spawn containing the tile.
 * @param {any} map
 * @param {EncounterCtx} [ctx]
 * @returns {any|null}
 */
export function spawnUnder(map, ctx) {
  if (ctx && Object.prototype.hasOwnProperty.call(ctx, 'spawn')) return ctx.spawn ?? null;
  const x = ctx?.x, y = ctx?.y;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (typeof map?.spawnAt === 'function') return map.spawnAt(x, y) ?? null;
  for (const s of Array.isArray(map?.spawns) ? map.spawns : []) {
    const a = s?.area;
    if (a && typeof a === 'object' && x >= a.x && y >= a.y && x < a.x + a.w && y < a.y + a.h) return s;
  }
  return null;
}

/**
 * Whether a spawn may produce wild encounters on this map (GDD-00 §4: only isles and Pellwick's
 * reed edges): never indoors; on a town map only `reeds` spawns.
 * @param {any} map
 * @param {any} spawn
 * @param {any} data
 * @returns {boolean}
 */
export function wildAllowed(map, spawn, data) {
  if (!spawn || typeof spawn.table !== 'string') return false;
  if (map?.kind === 'interior') return false;
  if (isTownMap(map, data)) return spawn.reeds === true || spawn.area === 'reeds';
  return true;
}

// ---------------------------------------------------------------------------------------------
// Errants: routes and presence
// ---------------------------------------------------------------------------------------------

/**
 * Tables that list an Errant species as a route row, in the data's table order.
 * @param {any} data
 * @param {string} speciesId
 * @returns {string[]}
 */
export function errantRoutes(data, speciesId) {
  const out = [];
  const tables = data && typeof data === 'object' && typeof data.ids === 'function'
    ? (() => { try { return data.ids('encounters'); } catch { return []; } })()
    : Object.keys(data?.encounters ?? {});
  for (const id of tables) {
    const rows = rowOf(data, 'encounters', id);
    if (Array.isArray(rows) && rows.some((r) => r && r.errant === true && r.species === speciesId && (r.roam ?? 'route') === 'route')) out.push(id);
  }
  return out;
}

/**
 * Every Errant species that has route rows anywhere, in first-seen order.
 * @param {any} data
 * @returns {string[]}
 */
export function errantSpecies(data) {
  const seen = new Set();
  for (const rows of rowsOf(data, 'encounters')) {
    if (!Array.isArray(rows)) continue;
    for (const r of rows) if (r && r.errant === true && typeof r.species === 'string') seen.add(r.species);
  }
  return [...seen];
}

/**
 * Skyroam: the table an Errant sits on now. With n route tables it moves one table every
 * `errantRoamMinutes`, starting at a per-seed, per-species offset; one route = always there.
 * @param {World} world
 * @param {string} speciesId
 * @param {EncounterCtx} [ctx]
 * @returns {string|null}
 */
export function errantRouteNow(world, speciesId, ctx) {
  const routes = errantRoutes(ctx?.data, speciesId);
  if (routes.length === 0) return null;
  if (routes.length === 1) return routes[0];
  const t = T(ctx);
  const slot = Math.floor(nowTotal(world, ctx) / t.errantRoamMinutes);
  const offset = hashString(`${world?.run?.seed ?? 0}:skyroam:${speciesId}`) % routes.length;
  return routes[(slot + offset) % routes.length];
}

/**
 * @typedef {{speciesId: string, tableId: string|null, up: boolean, seen: boolean, visible: boolean}} ErrantMarker
 */

/**
 * Map markers for the Errants (Skyroam: shown once seen; the Weatherglass from badge 5 and the
 * loft telescope show them unseen: pass `ctx.reveal = true` when either applies).
 * @param {World} world
 * @param {EncounterCtx & {reveal?: boolean}} [ctx]
 * @returns {ErrantMarker[]}
 */
export function errantMarkers(world, ctx) {
  return errantSpecies(ctx?.data)
    .filter((sp) => errantRoutes(ctx?.data, sp).length > 0)
    .map((sp) => {
      const seen = world?.encounter?.errants?.[sp]?.seen === true;
      const up = errantUp(world, sp, ctx);
      return { speciesId: sp, tableId: errantRouteNow(world, sp, ctx), up, seen, visible: up && (seen || ctx?.reveal === true) };
    });
}

/**
 * Errant rows present on a table now, each with its chance: route rows whose Errant Skyroams here
 * (each `errantRouteChance`), and lit rows at night, which share ONE `errantLitChance` (GDD-00 §2:
 * "1 in 120 night encounters on the point", whichever Errants are up), so each of n present lit rows
 * reports `errantLitChance / n`; both only while the Errant is up and the row's `cond` holds.
 * @param {World} world
 * @param {string} tableId
 * @param {readonly EncounterRow[]} rows
 * @param {object} condCtx   roamer-style cond context
 * @param {boolean} night
 * @param {EncounterCtx} [ctx]
 * @returns {Array<{row: EncounterRow, chance: number, roam: 'route'|'lit'}>}
 */
export function presentErrants(world, tableId, rows, condCtx, night, ctx) {
  const t = T(ctx);
  /** @type {Array<{row: EncounterRow, chance: number, roam: 'route'|'lit'}>} */
  const out = [];
  /** @type {EncounterRow[]} */
  const lit = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!validRow(r) || r.errant !== true) continue;
    if (!rowCondHolds(r.cond, condCtx)) continue;
    if (!errantUp(world, r.species, ctx)) continue;
    const roam = r.roam ?? 'route';
    if (roam === 'lit') {
      if (night) lit.push(r);
    } else if (errantRouteNow(world, r.species, ctx) === tableId) {
      out.push({ row: r, chance: t.errantRouteChance, roam: 'route' });
    }
  }
  for (const r of lit) out.push({ row: r, chance: t.errantLitChance / lit.length, roam: 'lit' });
  return out;
}

/**
 * Whether an encounter row is well formed enough to roll: a species id, a `[lo, hi]` of finite
 * levels and (when present) a finite weight. Malformed rows are skipped, never thrown on (the
 * validator reports them; a bad row must not crash a step).
 * @param {any} r
 * @returns {boolean}
 */
export function validRow(r) {
  return Boolean(r) && typeof r === 'object' && typeof r.species === 'string' && r.species.length > 0
    && Array.isArray(r.levels) && r.levels.length === 2 && r.levels.every((n) => typeof n === 'number' && Number.isFinite(n))
    && (r.w === undefined || (typeof r.w === 'number' && Number.isFinite(r.w)));
}

// ---------------------------------------------------------------------------------------------
// Rows, weights and levels
// ---------------------------------------------------------------------------------------------

/**
 * The level a row gives: its rolled range plus the night bonus, clamped to the encounter bounds.
 * @param {number} rolled
 * @param {boolean} night
 * @param {LaneCtx} [ctx]
 * @returns {number}
 */
export function levelFor(rolled, night, ctx) {
  const t = T(ctx);
  const lv = rolled + (night ? t.encounterNightLevelBonus : 0);
  return Math.min(t.encounterMaxLevel, Math.max(t.encounterMinLevel, lv));
}

/**
 * The effective rows of a table now, for step encounters and roamers alike: non-Errant rows whose
 * `cond` holds, with `w` scaled by `mods` and `levels` shifted by the night bonus (and clamped).
 * Hand the result to `world/roamer.spawn` so visible roamers follow the same rules. With
 * `opts.includeErrants`, Errants present here are appended (weight = their chance × the table's
 * total weight, so roamers show them about as often as steps meet them).
 * @param {World} world
 * @param {any} map
 * @param {string} tableId
 * @param {EncounterCtx} [ctx]
 * @param {{includeErrants?: boolean}} [opts]
 * @returns {EncounterRow[]}
 */
export function effectiveRows(world, map, tableId, ctx, opts = {}) {
  const rows = rowOf(ctx?.data, 'encounters', tableId);
  if (!Array.isArray(rows)) return [];
  const env = envFor(world, map, ctx);
  const night = isNight(world, ctx);
  const condCtx = { phase: env.phase, tideState: env.tideState, weather: env.weather, world, data: ctx?.data, mapId: map?.id };
  const envN = { ...env, night };
  const shift = (r) => {
    const lo = levelFor(r.levels[0], night, ctx), hi = levelFor(r.levels[1], night, ctx);
    return /** @type {[number, number]} */ ([Math.min(lo, hi), Math.max(lo, hi)]);
  };
  const out = eligibleRows(rows.filter((r) => validRow(r) && r.errant !== true), condCtx, [])
    .map((r) => ({ ...r, w: (typeof r.w === 'number' ? r.w : 0) * modsFor(r, envN), levels: shift(r) }))
    .filter((r) => r.w > 0);
  if (opts.includeErrants) {
    const total = out.reduce((s, r) => s + r.w, 0);
    for (const { row, chance } of presentErrants(world, tableId, rows, condCtx, night, ctx)) {
      out.push({ ...row, w: Math.max(Number.MIN_VALUE, chance * (total || 1)), levels: shift(row) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------------------------

/**
 * One player step: counts it, then maybe returns an encounter. In order: no spawn here / wild not
 * allowed / the spawn's `cond` fails / fewer than `encounterMinSteps` since the last -> `null` with
 * no draw. Otherwise one draw for the rate (`spawn.rate`, else `encounterRateDefault`); on a hit one
 * draw per present route Errant (in table order) for its chance, then (when lit Errants are present)
 * one draw for the shared `errantLitChance` plus one pick when more than one is up, else one draw for
 * the weighted row; then one for the level (when the range is wider than one). A hit resets the step count, marks an
 * Errant seen and emits `encounter:start`.
 * @param {World} world
 * @param {any} map         MapDef or RuntimeMap (`id`, `kind`, `region`, `spawns` / `spawnAt`)
 * @param {Rng} rng         the stateful {@link streamLabel} stream
 * @param {EncounterCtx} [ctx]   `x`, `y` (or `spawn`), and optional `tideState` / `phase` / `weather` / `total` overrides
 * @returns {EncounterResult|null}
 */
export function rollStep(world, map, rng, ctx) {
  if (!map || typeof map.id !== 'string') throw new TypeError('encounter.rollStep: map must have an id');
  const e = enc(world);
  e.steps = Math.min(STEPS_CAP, e.steps + 1);
  const spawn = spawnUnder(map, ctx);
  if (!wildAllowed(map, spawn, ctx?.data)) return null;
  const env = envFor(world, map, ctx);
  const condCtx = { phase: env.phase, tideState: env.tideState, weather: env.weather, world, data: ctx?.data, mapId: map.id };
  if (spawn.cond !== undefined && !rowCondHolds(spawn.cond, condCtx)) return null;
  const t = T(ctx);
  if (e.steps <= t.encounterMinSteps) return null;
  const rate = typeof spawn.rate === 'number' && Number.isFinite(spawn.rate) ? spawn.rate : t.encounterRateDefault;
  if (!rng.chance(rate)) return null;

  const rows = rowOf(ctx?.data, 'encounters', spawn.table);
  if (!Array.isArray(rows)) return null;
  const night = isNight(world, ctx);
  /** @type {EncounterRow|null} */
  let row = null;
  let errant = false;
  const present = presentErrants(world, spawn.table, rows, condCtx, night, ctx);
  for (const { row: r, chance } of present) {
    if (r.roam === 'lit') continue;
    if (rng.chance(chance)) { row = r; errant = true; break; }
  }
  const lit = present.filter((p) => p.roam === 'lit');
  if (!row && lit.length > 0 && rng.chance(t.errantLitChance)) {
    row = lit.length === 1 ? lit[0].row : /** @type {{row: EncounterRow}} */ (rng.pick(lit)).row;
    errant = true;
  }
  if (!row) {
    const eff = effectiveRows(world, map, spawn.table, ctx);
    row = rng.weighted(eff.map((r) => ({ w: r.w, v: r }))) ?? null;
    if (!row) return null;
    // `eff` levels already carry the night bonus
    const level = rollLevel(rng, row);
    return finish(world, e, { speciesId: row.species, level, errant: false, tableId: spawn.table, mapId: map.id, night }, ctx);
  }
  const level = levelFor(rollLevel(rng, row), night, ctx);
  return finish(world, e, { speciesId: row.species, level, errant, tableId: spawn.table, mapId: map.id, night }, ctx);
}

/**
 * @param {World} world
 * @param {{steps: number, errants: Record<string, ErrantState>}} e
 * @param {EncounterResult} result
 * @param {EncounterCtx|undefined} ctx
 * @returns {EncounterResult}
 */
function finish(world, e, result, ctx) {
  e.steps = 0;
  if (result.errant) markErrantSeen(world, result.speciesId);
  ctx?.bus?.emit('encounter:start', { ...result });
  return result;
}

/**
 * Records an encounter that did not come from {@link rollStep} (a touched roamer, a hooked
 * creature): resets the step floor and marks an Errant seen. Emits `encounter:start`.
 * @param {World} world
 * @param {{speciesId: string, level: number, errant?: boolean, tableId: string, mapId?: string, night?: boolean}} result
 * @param {EncounterCtx} [ctx]
 * @returns {EncounterResult}
 */
export function noteEncounter(world, result, ctx) {
  if (!result || typeof result.speciesId !== 'string') throw new TypeError('encounter.noteEncounter: result needs a speciesId');
  const e = enc(world);
  return finish(world, e, {
    speciesId: result.speciesId, level: result.level, errant: result.errant === true, tableId: result.tableId,
    mapId: result.mapId ?? world?.player?.mapId ?? '', night: result.night ?? isNight(world, ctx),
  }, ctx);
}
