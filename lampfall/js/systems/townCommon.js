/**
 * Shared helpers for the SYS-TOWN lane (letters, schedule, memory, threads, dayPage). [SYS-TOWN]
 *
 * Nothing here writes the world. It holds the small adapters the five town systems would otherwise
 * each re-implement:
 *
 *  - **Tuning**: {@link resolveTuning} merges `opts.tuning ?? data.tuning` over a module's frozen
 *    `DEFAULTS`, validating each known key, cached per source object.
 *  - **Content**: {@link rows} / {@link row} read a table from a Registry (`data/registry.js`) or a
 *    plain object of tables, so tests and tools can pass fixtures.
 *  - **Calendar**: the GDD calendar (GDD-00 §5: day 1 is the arrival day and a Sunday; Saturdays are
 *    days 7, 14, 21). `world.clock` counts core days from 0, so `gameDay = coreDay + calendarDayOffset`
 *    and the weekday of core day 0 is `calendarFirstDow` (0 = Monday). Every stored day in this lane
 *    (`lastTalkDay`, `saidLines`, `lastAdvancedDay`, letter days) is a CORE day; the GDD numbering
 *    is only used for calendar rules (K1 on day 2, Saturday markets).
 *  - **Windows**: half-open minute windows that wrap past midnight ({@link inWindow},
 *    {@link windowStartDay}).
 *  - **Porches**: which porches are lit ({@link isPorchLit}): a `sys.porch.<id>` flag wins, then the
 *    home porch's loan rule, then the porch row's `litAtStart`.
 *  - **Randomness**: {@link rngFor} turns whatever the caller passed (an `Rngs` registry, a
 *    `label -> Rng` function, or nothing) into a labelled fork; nothing here touches `Math.random`.
 *
 * Pure: no DOM, no data imports.
 * @module systems/townCommon
 */

import { day as coreDayOf, minuteOfDay as minuteOfDayOf } from '../state/selectors.js';
import { forkFor } from '../state/rngs.js';
import { evalCond } from '../script/cond.js';
import { MINUTES_PER_DAY } from '../core/time.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {{emit: (evt: string, payload?: any) => any}} Bus */

/** Days in a week. */
export const WEEK = 7;

/**
 * Calendar tuning shared by every town system (GDD-00 §5). [GDD values]
 * @type {Readonly<{calendarDayOffset: number, calendarFirstDow: number, homePorchId: string, homePorchLitTier: number}>}
 */
export const CALENDAR_DEFAULTS = Object.freeze({
  /** GDD day number of core day 0 minus 0: `gameDay = coreDay + calendarDayOffset` (arrival = day 1). */
  calendarDayOffset: 1,
  /** Weekday of core day 0 (0 = Monday … 6 = Sunday). GDD-00 §5: day 1 is a Sunday. */
  calendarFirstDow: 6,
  /** Porch id of the player's own porch (the manifest id, `data/ids.manifest` PORCH_IDS). */
  homePorchId: 'porch-keepers-cottage',
  /** The home porch is lit once `world.loans.tier` reaches this (loan 1 paid -> tier 2; GDD-00 §7). */
  homePorchLitTier: 2,
  /**
   * Porches lit at arrival when no porch row says so (GDD-00 §4: "7 lit at arrival (co-op yard
   * house, Pell's, post office, Archive, Warden's house, Tully's, Linnet's)"). A porch row's
   * `litAtStart: true` also lights it; a `sys.porch.<id>` flag overrides both.
   */
  porchesLitAtStart: Object.freeze([
    'porch-coop-yard', 'porch-pells', 'porch-post-office', 'porch-archive', 'porch-wardens-house', 'porch-tully', 'porch-linnet',
  ]),
});

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Validators for {@link CALENDAR_DEFAULTS}. */
export const CALENDAR_SPEC = Object.freeze({
  calendarDayOffset: [isInt, 'integer'],
  calendarFirstDow: [(v) => isInt(v) && v >= 0 && v <= 6, 'integer 0..6'],
  homePorchId: [(v) => typeof v === 'string' && v.length > 0, 'non-empty string'],
  homePorchLitTier: [(v) => isInt(v) && v >= 1, 'integer >= 1'],
  porchesLitAtStart: [(v) => Array.isArray(v) && v.every((id) => typeof id === 'string' && id.length > 0), 'string[] (porch ids)'],
});

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * The tuning object a call should read: `opts.tuning` if given, else `data.tuning`, else null.
 * @param {any} data
 * @param {{tuning?: Record<string, any>|null}|null|undefined} [opts]
 * @returns {Record<string, any>|null}
 */
export function tuningSource(data, opts) {
  if (opts && opts.tuning != null) return opts.tuning;
  if (data && typeof data === 'object' && data.tuning != null && typeof data.tuning === 'object') return data.tuning;
  return null;
}

/**
 * Merges the known keys of `source` over `defaults`, validating each against `spec`
 * (`key -> [predicate, description]`). Unknown keys are ignored (one flat tuning table serves every
 * system). Results are frozen and cached per source object in `cache`.
 * @template {Record<string, any>} T
 * @param {T} defaults
 * @param {Record<string, [(v: any) => boolean, string]>} spec
 * @param {Record<string, any>|null} source
 * @param {WeakMap<object, T>} cache
 * @param {string} module  name used in error messages
 * @returns {Readonly<T>}
 * @throws {TypeError} when a known key holds a malformed value
 */
export function resolveTuning(defaults, spec, source, cache, module) {
  if (source == null) return defaults;
  if (typeof source !== 'object') throw new TypeError(`${module}: tuning must be an object`);
  const hit = cache.get(source);
  if (hit) return hit;
  /** @type {any} */
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const v = source[key];
    const check = spec[key];
    if (check && !check[0](v)) throw new TypeError(`${module} tuning ${key}: expected ${check[1]}, got ${JSON.stringify(v)}`);
    out[key] = v;
  }
  const frozen = Object.freeze(out);
  cache.set(source, frozen);
  return frozen;
}

// ---------------------------------------------------------------------------------------------
// Content adapter
// ---------------------------------------------------------------------------------------------

/**
 * Every row of a table, in declaration order. Accepts a Registry (`list(table)`) or a plain object
 * whose `table` is an array of rows or an object keyed by id. A missing table yields `[]`.
 * @param {any} data
 * @param {string} table
 * @returns {any[]}
 */
export function rows(data, table) {
  if (!data || typeof data !== 'object') return [];
  if (typeof data.list === 'function') {
    try {
      return data.list(table);
    } catch {
      return [];
    }
  }
  const t = data[table];
  if (Array.isArray(t)) return t;
  if (t && typeof t === 'object') return Object.entries(t).map(([id, v]) => (v && typeof v === 'object' && !Array.isArray(v) && v.id === undefined ? { id, ...v } : v));
  return [];
}

/**
 * One row by id, or null. Never throws.
 * @param {any} data
 * @param {string} table
 * @param {string} id
 * @returns {any|null}
 */
export function row(data, table, id) {
  if (!data || typeof data !== 'object' || typeof id !== 'string') return null;
  if (typeof data.has === 'function' && typeof data.get === 'function') {
    try {
      return data.has(table, id) ? data.get(table, id) : null;
    } catch {
      return null;
    }
  }
  const t = data[table];
  if (Array.isArray(t)) return t.find((r) => r && r.id === id) ?? null;
  if (t && typeof t === 'object' && t[id] !== undefined) return t[id];
  return null;
}

/**
 * The registry-like object `script/cond.evalCond` wants for `{loan}` / `{inRegion}` conds. A plain
 * object of tables is wrapped; a Registry passes through.
 * @param {any} data
 * @returns {any}
 */
export function condData(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.has === 'function' && typeof data.get === 'function') return data;
  return {
    has: (table, id) => row(data, table, id) !== null,
    get: (table, id) => row(data, table, id),
  };
}

/**
 * Evaluates a DSL condition; an absent condition holds.
 * @param {World} world
 * @param {any} cond
 * @param {any} data
 * @param {{npc?: string|null, mapId?: string|null}} [extra]
 * @returns {boolean}
 */
export function holds(world, cond, data, extra = {}) {
  if (cond === undefined || cond === null) return true;
  return evalCond(world, cond, { data: condData(data), ...extra });
}

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

/**
 * Emits a domain event when a bus is present.
 * @param {Bus|null|undefined} bus
 * @param {string} evt
 * @param {any} payload
 */
export function emit(bus, evt, payload) {
  if (bus && typeof bus.emit === 'function') bus.emit(evt, payload);
}

// ---------------------------------------------------------------------------------------------
// Calendar and windows
// ---------------------------------------------------------------------------------------------

/**
 * Integer modulo that is never negative.
 * @param {number} a
 * @param {number} n
 * @returns {number}
 */
export function mod(a, n) {
  return ((a % n) + n) % n;
}

/**
 * Core day (0-based) of the world clock, or `opts.day` when given.
 * @param {World} world
 * @param {{day?: number}} [opts]
 * @returns {number}
 */
export function coreDay(world, opts) {
  if (opts && isInt(opts.day)) return opts.day;
  return coreDayOf(world);
}

/**
 * Whole minute of day of the world clock, or `opts.minute` when given.
 * @param {World} world
 * @param {{minute?: number}} [opts]
 * @returns {number}
 */
export function minuteNow(world, opts) {
  if (opts && isNum(opts.minute)) return Math.floor(mod(opts.minute, MINUTES_PER_DAY));
  return Math.floor(minuteOfDayOf(world));
}

/**
 * GDD day number of a core day (`coreDay + calendarDayOffset`).
 * @param {number} day core day
 * @param {{calendarDayOffset: number}} t
 * @returns {number}
 */
export function gameDay(day, t) {
  return day + t.calendarDayOffset;
}

/**
 * Core day of a GDD day number.
 * @param {number} gd
 * @param {{calendarDayOffset: number}} t
 * @returns {number}
 */
export function coreDayOfGame(gd, t) {
  return gd - t.calendarDayOffset;
}

/**
 * GDD weekday (0 = Monday … 6 = Sunday) of a core day.
 * @param {number} day core day
 * @param {{calendarFirstDow: number}} t
 * @returns {number}
 */
export function dowOf(day, t) {
  return mod(t.calendarFirstDow + day, WEEK);
}

/**
 * Whether `minute` falls in the half-open window `[from, to)`. The window wraps past midnight when
 * `to <= from` (e.g. `[1140, 60]` = 19:00–01:00) or when `to > 1440`. `from === to` is empty.
 * @param {number} minute minute of day
 * @param {[number, number]|readonly number[]} win
 * @returns {boolean}
 */
export function inWindow(minute, win) {
  if (!Array.isArray(win) || win.length !== 2) return false;
  const from = win[0];
  let to = win[1];
  if (to > MINUTES_PER_DAY) to -= MINUTES_PER_DAY;
  if (from === to) return false;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

/**
 * The core day a wrapping window occurrence STARTED on, or null when `minute` is outside it. A
 * window `[19:00, 01:00)` at 00:30 on day 5 started on day 4.
 * @param {number} day core day of `minute`
 * @param {number} minute minute of day
 * @param {[number, number]|readonly number[]} win
 * @returns {number|null}
 */
export function windowStartDay(day, minute, win) {
  if (!inWindow(minute, win)) return null;
  const from = win[0];
  return minute >= from ? day : day - 1;
}

/**
 * Minute-of-day distance from `since` forward to `minute` (0..1439).
 * @param {number} since
 * @param {number} minute
 * @returns {number}
 */
export function minutesSince(since, minute) {
  return mod(minute - since, MINUTES_PER_DAY);
}

// ---------------------------------------------------------------------------------------------
// Porches
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} PorchRow
 * @property {string} id
 * @property {string|null} npcId      resident whose porch it is (null for the home porch / empty houses)
 * @property {string|null} mapId  @property {number} x  @property {number} y  @property {string} [facing]
 * @property {boolean} litAtStart     GDD-00 §4: 7 porches are lit at arrival
 */

/**
 * Every porch the content declares: rows of an optional `porches` table, then each NPC's `porch`
 * object (its id defaults to the NPC id). Later duplicates are ignored.
 * @param {any} data
 * @returns {PorchRow[]}
 */
export function porchesOf(data) {
  /** @type {Map<string, PorchRow>} */
  const out = new Map();
  for (const p of rows(data, 'porches')) {
    if (p && typeof p.id === 'string' && !out.has(p.id)) out.set(p.id, normPorch(p, p.npcId ?? null));
  }
  for (const npc of rows(data, 'npcs')) {
    if (!npc || !npc.porch || typeof npc.porch !== 'object') continue;
    const id = typeof npc.porch.id === 'string' ? npc.porch.id : npc.id;
    if (!out.has(id)) out.set(id, normPorch({ ...npc.porch, id }, npc.id));
  }
  return [...out.values()];
}

/**
 * @param {any} p
 * @param {string|null} npcId
 * @returns {PorchRow}
 */
function normPorch(p, npcId) {
  return {
    id: p.id,
    npcId,
    mapId: typeof p.mapId === 'string' ? p.mapId : null,
    x: isInt(p.x) ? p.x : 0,
    y: isInt(p.y) ? p.y : 0,
    facing: typeof p.facing === 'string' ? p.facing : 'down',
    litAtStart: p.litAtStart === true,
  };
}

/**
 * The flag that records a porch's lit state (`sys.porch.<id>`).
 * @param {string} porchId
 * @returns {string}
 */
export function porchFlag(porchId) {
  return `sys.porch.${porchId}`;
}

/**
 * Whether a porch is lit now. Order: an injected `opts.isPorchLit(id)` answer; the flag
 * `sys.porch.<id>` when it is set (true or false, so Linnet's porch can go dark); for the home
 * porch, `world.loans.tier >= homePorchLitTier`; else the porch row's `litAtStart`, or the id is
 * in `porchesLitAtStart` (the GDD's seven, so a content set without porch rows still works).
 * @param {World} world
 * @param {any} data
 * @param {string} porchId
 * @param {{isPorchLit?: (id: string) => boolean|null|undefined, tuning?: any}} [opts]
 * @returns {boolean}
 */
export function isPorchLit(world, data, porchId, opts = {}) {
  if (typeof porchId !== 'string' || !porchId) return false;
  if (typeof opts.isPorchLit === 'function') {
    const v = opts.isPorchLit(porchId);
    if (typeof v === 'boolean') return v;
  }
  const f = world?.flags?.[porchFlag(porchId)];
  if (f !== undefined) return Boolean(f);
  const src = tuningSource(data, opts) ?? {};
  const pick = (key) => (Object.prototype.hasOwnProperty.call(src, key) && CALENDAR_SPEC[key][0](src[key]) ? src[key] : CALENDAR_DEFAULTS[key]);
  if (porchId === pick('homePorchId')) {
    const tier = world?.loans?.tier;
    return (Number.isFinite(tier) ? tier : 1) >= pick('homePorchLitTier');
  }
  const p = porchesOf(data).find((r) => r.id === porchId);
  if (p && p.litAtStart) return true;
  return pick('porchesLitAtStart').includes(porchId);
}

// ---------------------------------------------------------------------------------------------
// Randomness and creatures
// ---------------------------------------------------------------------------------------------

/**
 * A labelled rng fork from whatever the caller passed: an `Rngs` registry (`fresh(label)`), a
 * function `label -> Rng`, an Rng with `fork` (forked by label), or nothing (a stateless fork of
 * `world.run.seed`, deterministic).
 * @param {any} source
 * @param {World} world
 * @param {string} label
 * @returns {Rng}
 */
export function rngFor(source, world, label) {
  if (source && typeof source.fresh === 'function') return source.fresh(label);
  if (typeof source === 'function') return source(label);
  if (source && typeof source.fork === 'function') return source.fork(label);
  const seed = world?.run?.seed;
  return forkFor(Number.isInteger(seed) && seed >= 0 ? seed : 0, label);
}

/**
 * The weather kind in effect now: systems/weather (v2) keeps it in `current`; older worlds only
 * have `today`.
 * @param {World} world
 * @returns {string|null}
 */
export function weatherNow(world) {
  const w = world?.weather;
  if (!w || typeof w !== 'object') return null;
  if (typeof w.current === 'string' && w.current) return w.current;
  return typeof w.today === 'string' ? w.today : null;
}

/**
 * The party lead (first conscious, else first), or null.
 * @param {World} world
 * @returns {any|null}
 */
export function leadCreature(world) {
  const party = Array.isArray(world?.party) ? world.party : [];
  return party.find((c) => c && c.hp > 0) ?? party[0] ?? null;
}

/**
 * JSON deep copy for result payloads (plain objects and arrays).
 * @template T
 * @param {T} v
 * @returns {T}
 */
export function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

// ---------------------------------------------------------------------------------------------
// The Porch Duel slate (GDD-05 §8; data/town.js PORCH_DUELS)
// ---------------------------------------------------------------------------------------------

/** Flag prefix the slate posts (`sys.duel.<npc>`; `sys.duel.visitor` holds the visitor's trainer id). */
export const PORCH_DUEL_FLAG_PREFIX = 'sys.duel.';
/**
 * The slate history is replayed from core day 0 (at most this many days back), so every evening's
 * slate is the same whichever later evening asked for it: the "no neighbour three days running"
 * rule then holds across the whole run.
 */
const SLATE_HISTORY = 400;

/**
 * What a Porch Duel pays (GDD-05 §8): `payoutPerCurveLevel` (30) × the posted curve of your next Spire
 * by badges held (`curveByBadges`: 210 / 390 / 570 / 780 / 990 / 1,200 / 1,410). Pure.
 * @param {World} world
 * @param {any} table   PORCH_DUELS
 * @param {number} [perLevel]   tuning `porchDuelPerCurve` (the first economy lever); default the table's
 * @returns {number}
 */
export function duelPayout(world, table, perLevel) {
  const T = table && typeof table === 'object' ? table : {};
  const badges = Math.max(0, Math.min(6, Array.isArray(world?.badges) ? world.badges.length : 0));
  const curve = Array.isArray(T.curveByBadges) ? (T.curveByBadges[badges] ?? T.curveByBadges[T.curveByBadges.length - 1] ?? 0) : 0;
  return (isNum(perLevel) ? perLevel : (isNum(T.payoutPerCurveLevel) ? T.payoutPerCurveLevel : 30)) * curve;
}

/**
 * @typedef {Object} DuelOffer
 * @property {'neighbour'|'leader'|'route'} kind
 * @property {string|null} npc        the neighbour or leader npc (null for a route trainer)
 * @property {string} trainer         porch-* / leader / route trainer id
 * @property {string} porch           where it is fought (the visitor venue for visitors)
 * @property {number} creatures       party size by badges held
 * @property {number} payout          30 × the posted curve of your next Spire
 */

/**
 * The Porch Duel slate for an evening (GDD-05 §8): `offersPerDay` friendly offers, two neighbours and
 * one visitor when any visitor (a beaten leader, or a route trainer of an isle whose badge you hold)
 * is eligible, else neighbours only. No opponent twice a day; no neighbour three days running (the
 * slates before are replayed from day 0). Each evening's draw is the labelled fork `shop:<gameDay>/duels`.
 * The evening runs to the 06:00 post, so before 06:00 the slate is the previous day's.
 * Neighbours need their row `cond` and to have been met; visitors are drawn only while the table's
 * `visitorsLive` is not false. Pure.
 * @param {World} world
 * @param {any} table   PORCH_DUELS
 * @param {{day?: number, minute?: number, data?: any, perDay?: number, payoutPerCurveLevel?: number}} [opts]
 * @returns {{day: number, gameDay: number, offers: DuelOffer[], payout: number, creatures: number}}
 */
export function duelSlate(world, table, opts = {}) {
  const T = table && typeof table === 'object' ? table : {};
  const minute = minuteNow(world, opts);
  const day = isInt(opts.day) ? opts.day : coreDay(world) - (minute < 360 ? 1 : 0);
  const badges = Math.max(0, Math.min(6, Array.isArray(world?.badges) ? world.badges.length : 0));
  const payout = duelPayout(world, T, opts.payoutPerCurveLevel);
  const creatures = Array.isArray(T.partySizeByBadges) ? (T.partySizeByBadges[badges] ?? 3) : 1;
  const perDay = isInt(opts.perDay) ? opts.perDay : (isInt(T.offersPerDay) ? T.offersPerDay : 3);
  const ok = (cond) => holds(world, cond, opts.data ?? null);
  const neighbours = (Array.isArray(T.neighbours) ? T.neighbours : [])
    .filter((n) => n && typeof n.npc === 'string' && world?.npcs?.[n.npc]?.met && ok(n.cond));
  /** @type {Array<{kind: 'leader'|'route', npc: string|null, trainer: string}>} */
  const visitors = [];
  const visitorsOn = T.visitorsLive !== false;
  if (visitorsOn) for (const l of Array.isArray(T.leaders) ? T.leaders : []) if (l && ok(l.cond)) visitors.push({ kind: 'leader', npc: l.npc ?? null, trainer: l.trainer });
  if (visitorsOn) for (const p of Array.isArray(T.routePools) ? T.routePools : []) if (p && ok(p.cond)) for (const tr of p.trainers ?? []) visitors.push({ kind: 'route', npc: null, trainer: tr });
  const seed = world?.run?.seed ?? 0;
  const draw = (d, banned) => {
    const rng = forkFor(seed, `shop:${d + 1}/duels`);
    const pool = neighbours.filter((n) => !banned.has(n.npc));
    const visitor = visitors.length ? visitors[rng.int(0, visitors.length - 1)] : null;
    const want = Math.max(0, perDay - (visitor ? 1 : 0));
    const picked = [];
    const left = pool.slice();
    while (picked.length < want && left.length) picked.push(left.splice(rng.int(0, left.length - 1), 1)[0]);
    return { picked, visitor };
  };
  // replay the slates before this one so the three-days-running rule has its history
  let prev2 = new Set(), prev1 = new Set();
  let out = null;
  for (let d = Math.max(0, day - SLATE_HISTORY); d <= day; d++) {
    const banned = new Set([...prev1].filter((n) => prev2.has(n)));
    const r = draw(d, banned);
    prev2 = prev1;
    prev1 = new Set(r.picked.map((n) => n.npc));
    if (d === day) out = r;
  }
  const o = /** @type {{picked: any[], visitor: any}} */ (out);
  /** @type {DuelOffer[]} */
  const offers = o.picked.map((n) => ({ kind: 'neighbour', npc: n.npc, trainer: n.trainer, porch: n.porch, creatures, payout }));
  if (o.visitor) offers.push({ kind: o.visitor.kind, npc: o.visitor.npc, trainer: o.visitor.trainer, porch: typeof T.visitorVenue === 'string' ? T.visitorVenue : 'porch-archive', creatures, payout });
  return { day, gameDay: day + 1, offers, payout, creatures };
}

/** Flag holding the game day whose evening slate is posted (`sys.duel.day`): the slate is frozen for that evening. */
export const PORCH_DUEL_DAY_FLAG = 'sys.duel.day';
/** Flag prefix marking a neighbour's duel won this evening (`sys.duel.done.<npc>` = the evening's game day). */
export const PORCH_DUEL_DONE_PREFIX = 'sys.duel.done.';

/**
 * The game day of the Porch Duel evening `world`'s clock is in (the evening runs to the 06:00 post,
 * so before 06:00 it is the previous day's). Pure.
 * @param {World} world
 * @param {{minute?: number}} [opts]
 * @returns {number}
 */
export function duelEvening(world, opts = {}) {
  return coreDay(world) - (minuteNow(world, opts) < 360 ? 1 : 0) + 1;
}

/**
 * The slate as posted for this evening (the `sys.duel.*` flags), or null when this evening's slate was
 * never posted. Neighbours keep table order; `taken` marks a duel already won tonight. Pure.
 * @param {World} world
 * @param {any} table   PORCH_DUELS
 * @returns {{gameDay: number, neighbours: Array<{npc: string, trainer: string, porch: string, taken: boolean}>, visitor: string|null}|null}
 */
export function postedDuels(world, table) {
  const T = table && typeof table === 'object' ? table : {};
  const f = world?.flags ?? {};
  const gameDay = duelEvening(world);
  if (f[PORCH_DUEL_DAY_FLAG] !== gameDay) return null;
  const neighbours = [];
  for (const n of Array.isArray(T.neighbours) ? T.neighbours : []) {
    if (!n || typeof n.npc !== 'string') continue;
    const taken = f[`${PORCH_DUEL_DONE_PREFIX}${n.npc}`] === gameDay;
    if (taken || f[`${PORCH_DUEL_FLAG_PREFIX}${n.npc}`]) neighbours.push({ npc: n.npc, trainer: n.trainer, porch: n.porch, taken });
  }
  const v = f[`${PORCH_DUEL_FLAG_PREFIX}visitor`];
  return { gameDay, neighbours, visitor: typeof v === 'string' && v ? v : null };
}
