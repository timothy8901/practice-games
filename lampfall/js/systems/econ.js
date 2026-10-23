/**
 * Shared plumbing for the economy systems (`bag`, `wallet`, `loans`, `shops`). [RULES-ECON]
 *
 * Nothing here touches the world. It answers four questions every economy call asks:
 *  - **Which tuning?** {@link makeTuning} builds a per-module resolver over that module's frozen
 *    `DEFAULTS` (the GDD-00 values). The source is `ctx.tuning` when given, else `data.tuning`
 *    (a tables object carrying the `js/data/tuning.js` table), else `data.raw('tuning')` when the
 *    registry has a `tuning` table, else the defaults. Only the module's own keys are read; each is
 *    checked against the module's spec, so a malformed designer value fails loudly at first use.
 *  - **Which content?** {@link lookup} reads rows from a Registry (`has/get/list`) or a plain tables
 *    object (arrays of rows with `id`, or objects keyed by id). No table is imported.
 *  - **What time is it?** {@link nowOf} is `ctx.now` (total game minutes) or `world.clock.total`.
 *  - **Which economy day?** {@link econDay}: days run from `econDayStartMinute` (06:00, when the
 *    mailbox, the Ledger Board, the Commons slip and the Crate result all turn over) to the same
 *    minute next day, so Ludo's 22:00-08:00 shift is one shop day and the Starsalt cap cannot be
 *    doubled across midnight. The arrival evening is economy day 0 = GDD day 1 ({@link gameDay}).
 *
 * Pure: no DOM, no randomness.
 * @module systems/econ
 */

import { MINUTES_PER_DAY } from '../core/time.js';

/** @typedef {import('../state/schema.js').World} World */

/**
 * The context every economy function takes as its last argument. Every field is optional.
 * @typedef {Object} EconCtx
 * @property {any} [data]          Registry (`createRegistry(DATA)`) or a tables object (`{items: [...], shops: [...]}`)
 * @property {Record<string, any>|null} [tuning]   explicit tuning table (wins over `data.tuning`)
 * @property {{emit: (event: string, payload: any) => any}|null} [bus]   domain events go here (§3.4)
 * @property {number} [now]        total game minutes (defaults to `world.clock.total`)
 * @property {number} [day]        economy day override (defaults to {@link econDay} of `now`)
 * @property {boolean} [confirm]   the player already confirmed spending a one-of-a-kind item
 * @property {string} [source]     what caused the change, forwarded in event payloads
 * @property {import('../core/rng.js').Rng} [rng]   explicit rng (shops; defaults to the labelled fork)
 * @property {{mapId: string, x: number, y: number}} [at]   where an overflow basket lands (defaults to the player)
 * @property {string} [dial]       dial override (defaults to `world.run.dial`)
 */

/** Economy-wide tuning keys (read by every economy module through {@link makeTuning}). */
export const ECON_DEFAULTS = Object.freeze({
  /** Minute of day the economy day turns over (06:00). [GDD §5 anchors: 06:00 boards, Crate result] */
  econDayStartMinute: 6 * 60,
});

/** @type {Record<string, [(v: any) => boolean, string]>} */
const ECON_SPEC = {
  econDayStartMinute: [(v) => Number.isInteger(v) && v >= 0 && v < MINUTES_PER_DAY, 'integer minute 0..1439'],
};

/**
 * Deep-freezes plain objects and arrays in place.
 * @template T
 * @param {T} v
 * @returns {T}
 */
export function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(/** @type {any} */ (v)[k]);
  }
  return v;
}

/**
 * The tuning table carried by `data`, if any: `data.tuning` (plain object) or `data.raw('tuning')`.
 * @param {any} data
 * @returns {Record<string, any>|null}
 */
export function tuningSource(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.tuning && typeof data.tuning === 'object' && !Array.isArray(data.tuning)) return data.tuning;
  if (typeof data.raw === 'function' && Array.isArray(data.tables) && data.tables.includes('tuning')) {
    try {
      const t = data.raw('tuning');
      if (t && typeof t === 'object' && !Array.isArray(t)) return t;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Builds a tuning resolver for one module. The resolver returns a frozen object holding every key of
 * `defaults` (plus {@link ECON_DEFAULTS}), each taken from the source when present and valid.
 *
 * @template {Record<string, any>} T
 * @param {string} moduleName                      used in error messages
 * @param {T} defaults                             the module's frozen DEFAULTS (GDD-00 values)
 * @param {Record<string, [(v: any) => boolean, string]>} spec   validator per key
 * @returns {(ctx?: EconCtx|null) => Readonly<T & typeof ECON_DEFAULTS>}
 */
export function makeTuning(moduleName, defaults, spec) {
  const all = { ...ECON_DEFAULTS, ...defaults };
  const allSpec = { ...ECON_SPEC, ...spec };
  for (const key of Object.keys(all)) {
    if (!allSpec[key]) throw new Error(`${moduleName}: tuning key ${key} has no spec`);
    if (!allSpec[key][0](all[key])) throw new Error(`${moduleName}: default for ${key} fails its own spec (${allSpec[key][1]})`);
  }
  const base = deepFreeze(all);
  /** @type {WeakMap<object, any>} */
  const cache = new WeakMap();
  return function tuningOf(ctx) {
    const src = (ctx && ctx.tuning && typeof ctx.tuning === 'object') ? ctx.tuning : tuningSource(ctx?.data);
    if (!src) return /** @type {any} */ (base);
    const hit = cache.get(src);
    if (hit) return hit;
    /** @type {Record<string, any>} */
    const out = { ...base };
    for (const key of Object.keys(base)) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      const v = src[key];
      const [pred, desc] = allSpec[key];
      if (!pred(v)) throw new TypeError(`${moduleName} tuning ${key}: expected ${desc}, got ${safeJson(v)}`);
      out[key] = v;
    }
    const frozen = deepFreeze(out);
    cache.set(src, frozen);
    return /** @type {any} */ (frozen);
  };
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function safeJson(v) {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/**
 * @typedef {Object} Lookup
 * @property {(table: string, id: string) => any|null} row    the row or null (never throws)
 * @property {(table: string) => any[]} list                  every row, declaration order ([] when the table is absent)
 * @property {(table: string) => boolean} hasTable            whether the source knows the table
 */

/** @type {WeakMap<object, Lookup>} */
const LOOKUP_CACHE = new WeakMap();
/** @type {Lookup} */
const EMPTY_LOOKUP = Object.freeze({ row: () => null, list: () => [], hasTable: () => false });

/**
 * Content access over a Registry or a plain tables object; `null`/`undefined` gives an empty lookup.
 * @param {any} data
 * @returns {Lookup}
 */
export function lookup(data) {
  if (!data || (typeof data !== 'object' && typeof data !== 'function')) return EMPTY_LOOKUP;
  const hit = LOOKUP_CACHE.get(data);
  if (hit) return hit;
  /** @type {Lookup} */
  let out;
  if (typeof data.has === 'function' && typeof data.get === 'function') {
    const tables = Array.isArray(data.tables) ? data.tables : null;
    const hasTable = (table) => (tables ? tables.includes(table) : safeList(data, table) !== null);
    out = {
      row: (table, id) => (typeof id === 'string' && data.has(table, id) ? data.get(table, id) : null),
      list: (table) => (hasTable(table) ? safeList(data, table) ?? [] : []),
      hasTable,
    };
  } else {
    /** @type {Map<string, Map<string, any>>} */
    const indexes = new Map();
    const indexOf = (table) => {
      let idx = indexes.get(table);
      if (idx) return idx;
      idx = new Map();
      const t = data[table];
      if (Array.isArray(t)) {
        for (const r of t) if (r && typeof r === 'object' && typeof r.id === 'string' && !idx.has(r.id)) idx.set(r.id, r);
      } else if (t && typeof t === 'object') {
        for (const [k, v] of Object.entries(t)) idx.set(k, v);
      }
      indexes.set(table, idx);
      return idx;
    };
    out = {
      row: (table, id) => (typeof id === 'string' ? indexOf(table).get(id) ?? null : null),
      list: (table) => [...indexOf(table).values()],
      hasTable: (table) => data[table] !== undefined && data[table] !== null && typeof data[table] === 'object',
    };
  }
  Object.freeze(out);
  LOOKUP_CACHE.set(data, out);
  return out;
}

/**
 * @param {any} registry
 * @param {string} table
 * @returns {any[]|null}
 */
function safeList(registry, table) {
  if (typeof registry.list !== 'function') return null;
  try {
    return registry.list(table);
  } catch {
    return null;
  }
}

/**
 * Total game minutes: `ctx.now`, else `world.clock.total`, else 0.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function nowOf(world, ctx) {
  const n = ctx?.now ?? world?.clock?.total;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Minute of day of a total.
 * @param {number} total
 * @returns {number}
 */
export function minuteOfDay(total) {
  return ((Math.floor(total) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Calendar (clock) day of a total, 0-based.
 * @param {number} total
 * @returns {number}
 */
export function clockDay(total) {
  return Math.floor(total / MINUTES_PER_DAY);
}

/**
 * Economy day of a total: days turn over at `startMinute`; never negative.
 * @param {number} total
 * @param {number} [startMinute=360]
 * @returns {number}
 */
export function econDay(total, startMinute = ECON_DEFAULTS.econDayStartMinute) {
  return Math.max(0, Math.floor((total - startMinute) / MINUTES_PER_DAY));
}

/**
 * The economy day a call works in: `ctx.day` when it is an integer, else {@link econDay} of {@link nowOf}.
 * @param {World} world
 * @param {EconCtx|undefined} ctx
 * @param {{econDayStartMinute: number}} tuning
 * @returns {number}
 */
export function dayOf(world, ctx, tuning) {
  if (Number.isInteger(ctx?.day)) return /** @type {number} */ (ctx.day);
  return econDay(nowOf(world, ctx), tuning.econDayStartMinute);
}

/**
 * GDD day number (1 = the arrival day) of an economy day.
 * @param {number} day economy day
 * @returns {number}
 */
export function gameDay(day) {
  return day + 1;
}

/**
 * Emits a domain event when the context carries a bus.
 * @param {EconCtx|undefined} ctx
 * @param {string} event
 * @param {Record<string, any>} payload
 */
export function emit(ctx, event, payload) {
  ctx?.bus?.emit(event, payload);
}

/**
 * Validates a positive integer count.
 * @param {unknown} n
 * @param {string} where
 * @returns {number}
 * @throws {RangeError}
 */
export function assertCount(n, where) {
  if (!Number.isInteger(n) || /** @type {number} */ (n) < 1) throw new RangeError(`${where}: count must be a positive integer, got ${safeJson(n)}`);
  return /** @type {number} */ (n);
}

/**
 * Validates a non-negative integer amount.
 * @param {unknown} n
 * @param {string} where
 * @returns {number}
 * @throws {RangeError}
 */
export function assertAmount(n, where) {
  if (!Number.isInteger(n) || /** @type {number} */ (n) < 0) throw new RangeError(`${where}: amount must be a non-negative integer, got ${safeJson(n)}`);
  return /** @type {number} */ (n);
}

/**
 * Validates a non-empty id string.
 * @param {unknown} id
 * @param {string} where
 * @returns {string}
 * @throws {TypeError}
 */
export function assertId(id, where) {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError(`${where}: id must be a non-empty string, got ${safeJson(id)}`);
  return id;
}

/** Spec helpers shared by the module SPEC tables. */
export const is = Object.freeze({
  int: (v) => Number.isInteger(v),
  nonNegInt: (v) => Number.isInteger(v) && v >= 0,
  posInt: (v) => Number.isInteger(v) && v >= 1,
  fraction: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  posNum: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  minute: (v) => Number.isInteger(v) && v >= 0 && v < MINUTES_PER_DAY,
  id: (v) => typeof v === 'string' && v.length > 0,
  ids: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0),
  flagId: (v) => typeof v === 'string' && /^(sp|th|np|sys|seen)\..+/.test(v),
  intRecord: (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => Number.isInteger(x) && x >= 0),
});
