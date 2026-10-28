/**
 * The Field Log and the Archive collections (GDD-00 §3, §9; ARCHITECTURE §1 manifest). [SYS-GATHER]
 *
 * Owns `world.fieldLog` (forms Seen / Read / Held, the per-seed ability recorded on Read, fish tells
 * learned) and `world.collections` (fish / bugs / finds with counts and bests, the Patient record
 * board, Barnaby's donations, the Kiln clean-on-the-spot day). String-wall pins are checked here
 * and recorded by systems/letters (`world.letters.pinned`) through the injected `ctx.pinFind`.
 *
 * Also the shared base of the SYS-GATHER / SYS-WORLD lane (fishing, gather, encounter import it):
 *  - {@link rowsOf} / {@link rowOf} / {@link collectionRows}: one adapter over the content `data`
 *    argument (a `data/registry` Registry or a plain object of tables);
 *  - {@link makeTuning}: every designer number read from `ctx.tuning` (else `data.tuning`) by a
 *    documented key with a DEFAULTS fallback equal to the GDD-00 value;
 *  - {@link leadBonuses}: the Crossovers table (GDD-00 §9 "Town verbs made creature-aware"); the
 *    party lead's types pick rows of `tuning.creatureBonuses`; bonuses never lock content.
 *
 * Rules: every mutating export is `fn(world, ...args, ctx?)`, mutates only `fieldLog` /
 * `collections`, and emits `fieldLog:*` domain events through `ctx.bus` after mutating. Cross-lane
 * effects go through injected callbacks: `ctx.take(itemId, n) -> boolean` (bag), `ctx.earn(amount,
 * source)` (wallet), `ctx.pinFind(findId)` (letters). No species, fish or find is named here.
 *
 * Pure: no DOM, no randomness. Lane: SYS-GATHER.
 * @module systems/fieldLog
 */

import { lead as selectLead, day as selectDay } from '../state/selectors.js';
import { setFlag } from './flags.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Creature} Creature */
/** @typedef {{emit: (evt: string, payload: any) => any}} Bus */

/**
 * Context every system in this lane accepts. All fields optional.
 * @typedef {Object} LaneCtx
 * @property {any} [data]                       Registry or object of tables (collections, species, encounters, ...)
 * @property {Record<string, any>|null} [tuning] tuning overrides (else `data.tuning`, else module DEFAULTS)
 * @property {Bus|null} [bus]                   domain-event bus
 * @property {{types?: string[]}|null} [lead]   party-lead override (defaults to `selectors.lead(world)`)
 */

// ---------------------------------------------------------------------------------------------
// Data adapter
// ---------------------------------------------------------------------------------------------

/**
 * Every row of a table, whether `data` is a Registry (`list`) or an object of tables (array rows,
 * or an object keyed by id whose values are returned). Unknown table -> `[]`. Never throws.
 * @param {any} data
 * @param {string} table
 * @returns {any[]}
 */
export function rowsOf(data, table) {
  if (!data || typeof data !== 'object') return [];
  if (typeof data.list === 'function' && typeof data.has === 'function') {
    try { return data.list(table) ?? []; } catch { return []; }
  }
  const t = data[table];
  if (Array.isArray(t)) return t;
  if (t && typeof t === 'object') return Object.values(t);
  return [];
}

/**
 * One row by id (`null` when absent). Object tables (`encounters`) return the value at the key.
 * @param {any} data
 * @param {string} table
 * @param {string} id
 * @returns {any|null}
 */
export function rowOf(data, table, id) {
  if (!data || typeof data !== 'object' || typeof id !== 'string') return null;
  if (typeof data.get === 'function' && typeof data.has === 'function') {
    try { return data.has(table, id) ? data.get(table, id) : null; } catch { return null; }
  }
  const t = data[table];
  if (Array.isArray(t)) return t.find((r) => r && r.id === id) ?? null;
  if (t && typeof t === 'object') return Object.prototype.hasOwnProperty.call(t, id) ? t[id] : null;
  return null;
}

/**
 * Collection rows of one kind (`'fish' | 'bug' | 'relic' | 'fruit'`).
 * @param {any} data
 * @param {string} kind
 * @returns {any[]}
 */
export function collectionRows(data, kind) {
  return rowsOf(data, 'collections').filter((r) => r && r.kind === kind);
}

/**
 * Whether a collection row counts toward Field Log completion (rows may opt out with `log: false`,
 * e.g. cockles, which are shore food and not one of the 18 finds).
 * @param {any} row
 * @returns {boolean}
 */
export function isLogged(row) {
  return Boolean(row) && row.log !== false;
}

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * The tuning source a call reads: `ctx.tuning`, else `ctx.data.tuning`, else `null` (defaults).
 * @param {LaneCtx|undefined} ctx
 * @returns {Record<string, any>|null}
 */
export function tuningSource(ctx) {
  if (ctx && ctx.tuning && typeof ctx.tuning === 'object') return ctx.tuning;
  const d = ctx?.data;
  if (d && typeof d === 'object' && d.tuning && typeof d.tuning === 'object') return d.tuning;
  return null;
}

/**
 * Builds a module tuning resolver: overrides for known keys are validated and merged over the
 * frozen defaults; results are cached per source object. Unknown keys are ignored (they belong to
 * other modules).
 * @template {Record<string, any>} T
 * @param {string} name                        module name for error messages
 * @param {T} defaults                         frozen defaults (GDD-00 values)
 * @param {Record<keyof T, [(v: any) => boolean, string]>} spec   validators
 * @returns {(src: Record<string, any>|null|undefined) => Readonly<T>}
 */
export function makeTuning(name, defaults, spec) {
  /** @type {WeakMap<object, Readonly<T>>} */
  const cache = new WeakMap();
  const keys = Object.keys(defaults);
  return (src) => {
    if (src == null) return defaults;
    if (typeof src !== 'object') throw new TypeError(`${name} tuning must be an object`);
    const hit = cache.get(src);
    if (hit) return hit;
    /** @type {any} */
    const out = { ...defaults };
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      const v = src[key];
      const [pred, desc] = spec[key];
      if (!pred(v)) throw new TypeError(`${name} tuning ${key}: expected ${desc}, got ${JSON.stringify(v)}`);
      out[key] = v;
    }
    const frozen = deepFreeze(out);
    cache.set(src, frozen);
    return frozen;
  };
}

/**
 * Freezes an object tree in place and returns it.
 * @template T
 * @param {T} o
 * @returns {T}
 */
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Validators shared by the lane's tuning specs. */
export const V = Object.freeze({
  num: (v) => typeof v === 'number' && Number.isFinite(v),
  nonNeg: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  pos: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  unit: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  int: (v) => Number.isInteger(v),
  nonNegInt: (v) => Number.isInteger(v) && v >= 0,
  posInt: (v) => Number.isInteger(v) && v >= 1,
  bool: (v) => typeof v === 'boolean',
  range: (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) && v[0] <= v[1],
  intRange: (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0) && v[0] <= v[1],
  str: (v) => typeof v === 'string' && v.length > 0,
  obj: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
});

// ---------------------------------------------------------------------------------------------
// Crossovers: the party lead's type bonuses (GDD-00 §9)
// ---------------------------------------------------------------------------------------------

/**
 * One merged Crossovers row. Every field is optional in data; absent = no bonus.
 * @typedef {Object} LeadBonus
 * @property {boolean} fishNameSpecies      Brine: names every shadow's species
 * @property {number}  tellCatches          Brine: catches needed to learn a tell (0 = use the base)
 * @property {number}  biteWindowMult       Brine: bite window multiplier (1 = none)
 * @property {boolean} shakeAllFruit        Gust: one shake drops every fruit on a tree
 * @property {boolean} hiveBlowClear        Gust: blows a bee nest clear (honeycomb, no sting)
 * @property {boolean} markCracks           Grit/Stone: today's cracks show on the map
 * @property {number}  extraCracks          Grit/Stone: extra cracks opened per day
 * @property {number}  glintSeeRadius       Grit/Stone: the Glint shows from this many tiles (0 = base)
 * @property {number}  skyglassSeeRadius    Glass/Hollow: skyglass relics show from this many tiles (0 = base)
 * @property {boolean} skyglassByDay        Glass/Hollow: relics show dimly by day (still dug only at a night low)
 * @property {number}  humRadius            Bolt: Tailhum within this many tiles of a purse, the Glint or a night headliner
 * @property {number}  mothLightMult        Bolt: moth weight multiplier at lit spots (1 = none)
 * @property {number}  graftNightsSooner    Moss: a Greenhouse graft takes this many nights sooner
 * @property {number}  extraShadows         Rime: extra shadows per reach
 * @property {number}  cleanFindsPerDay     Kiln: fossils cleaned on the spot per day
 */

/** The zero row: what a lead with no matching type gives. */
export const NO_BONUS = deepFreeze({
  fishNameSpecies: false, tellCatches: 0, biteWindowMult: 1,
  shakeAllFruit: false, hiveBlowClear: false,
  markCracks: false, extraCracks: 0, glintSeeRadius: 0,
  skyglassSeeRadius: 0, skyglassByDay: false,
  humRadius: 0, mothLightMult: 1,
  graftNightsSooner: 0, extraShadows: 0, cleanFindsPerDay: 0,
});

/**
 * Lane-wide tuning (the Crossovers table plus the Field Log's own numbers).
 * @typedef {Object} FieldLogTuning
 * @property {Record<string, Partial<LeadBonus>>} creatureBonuses   lowercase type id -> bonus row (GDD-00 §9 Crossovers)
 * @property {number} fishTellCatches       catches of one species to learn its tell (GDD-00 §9: 3)
 * @property {number} findCleanMult         value multiplier of a cleaned find (GDD-00 §7: +40%)
 */

/** GDD-00 values. @type {Readonly<FieldLogTuning>} */
export const DEFAULTS = deepFreeze({
  creatureBonuses: {
    brine: { fishNameSpecies: true, tellCatches: 1, biteWindowMult: 1.5 },
    gust: { shakeAllFruit: true, hiveBlowClear: true },
    grit: { markCracks: true, extraCracks: 1, glintSeeRadius: 3 },
    stone: { markCracks: true, extraCracks: 1, glintSeeRadius: 3 },
    glass: { skyglassSeeRadius: 5, skyglassByDay: true },
    hollow: { skyglassSeeRadius: 5, skyglassByDay: true },
    bolt: { humRadius: 4, mothLightMult: 2 },
    moss: { graftNightsSooner: 1 },
    rime: { extraShadows: 1 },
    kiln: { cleanFindsPerDay: 1 },
  },
  fishTellCatches: 3,
  findCleanMult: 1.4,
});

const BONUS_KEYS = Object.keys(NO_BONUS);

/** @type {Record<keyof FieldLogTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  creatureBonuses: [(v) => V.obj(v) && Object.values(v).every((row) => V.obj(row) && Object.keys(row).every((k) => BONUS_KEYS.includes(k))), `{type: {${BONUS_KEYS.join('|')}}}`],
  fishTellCatches: [V.posInt, 'integer >= 1'],
  findCleanMult: [V.pos, 'number > 0'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Resolves this module's tuning. */
export const tuningOf = makeTuning('fieldLog', DEFAULTS, SPEC);

/** @type {WeakMap<object, Map<string, Readonly<LeadBonus>>>} */
const BONUS_CACHE = new WeakMap();

/**
 * The lead creature whose type drives the Crossovers bonuses: `ctx.lead` when given (an object
 * with `types`, or `null` for "no lead"), else `selectors.lead(world)`.
 * @param {World} world
 * @param {LaneCtx} [ctx]
 * @returns {{types?: string[]}|null}
 */
export function leadOf(world, ctx) {
  if (ctx && Object.prototype.hasOwnProperty.call(ctx, 'lead')) return ctx.lead ?? null;
  return selectLead(world);
}

/**
 * Merged Crossovers row for a list of types: numbers take the largest value, booleans OR together.
 * Type ids compare case-insensitively (`'Brine'` and `'brine'` are the same row).
 * @param {readonly string[]} types
 * @param {LaneCtx} [ctx]
 * @returns {Readonly<LeadBonus>}
 */
export function bonusForTypes(types, ctx) {
  const t = tuningOf(tuningSource(ctx));
  const table = t.creatureBonuses;
  const key = (Array.isArray(types) ? types : []).map((s) => String(s).toLowerCase()).sort().join('/');
  let perTable = BONUS_CACHE.get(table);
  if (!perTable) { perTable = new Map(); BONUS_CACHE.set(table, perTable); }
  const hit = perTable.get(key);
  if (hit) return hit;
  /** @type {any} */
  const out = { ...NO_BONUS };
  for (const type of key ? key.split('/') : []) {
    const row = table[type];
    if (!row) continue;
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(out[k], v);
    }
  }
  const frozen = Object.freeze(out);
  perTable.set(key, frozen);
  return frozen;
}

/**
 * The Crossovers bonuses the party lead gives right now (GDD-00 §9: "the party lead decides").
 * @param {World} world
 * @param {LaneCtx} [ctx]
 * @returns {Readonly<LeadBonus>}
 */
export function leadBonuses(world, ctx) {
  const lead = leadOf(world, ctx);
  return bonusForTypes(lead && Array.isArray(lead.types) ? lead.types : [], ctx);
}

// ---------------------------------------------------------------------------------------------
// Forms: Seen / Read / Held
// ---------------------------------------------------------------------------------------------

/** @returns {import('../state/schema.js').FieldLogEntry} */
function freshEntry() {
  return { seen: false, read: false, held: false, ability: null };
}

/**
 * @param {World} world
 * @param {string} formId
 */
function entryFor(world, formId) {
  if (typeof formId !== 'string' || formId.length === 0) throw new TypeError(`fieldLog: form id must be a non-empty string, got ${String(formId)}`);
  let e = world.fieldLog.forms[formId];
  if (!e || typeof e !== 'object') {
    e = freshEntry();
    world.fieldLog.forms[formId] = e;
  }
  return e;
}

/**
 * The entry of a form (a read-only fresh view when the form was never met; never writes).
 * @param {World} world
 * @param {string} formId
 * @returns {Readonly<import('../state/schema.js').FieldLogEntry>}
 */
export function formEntry(world, formId) {
  return world?.fieldLog?.forms?.[formId] ?? Object.freeze(freshEntry());
}

/**
 * Marks a form Seen (a wild encounter, a trainer's creature sent out, a porch visitor).
 * Emits `fieldLog:seen {formId, first}` the first time.
 * @param {World} world
 * @param {string} formId
 * @param {LaneCtx} [ctx]
 * @returns {{formId: string, first: boolean}}
 */
export function markSeen(world, formId, ctx) {
  const e = entryFor(world, formId);
  const first = !e.seen;
  if (first) {
    e.seen = true;
    ctx?.bus?.emit('fieldLog:seen', { formId, first: true });
  }
  return { formId, first };
}

/**
 * Marks a form Read with the Reading Glass (implies Seen) and records the ability the Read revealed.
 * Abilities are per seed (`run.gen.abilities[formId]`), so `ability` defaults to that pick, then to
 * the species row's `ability`, then to whatever was recorded before. Emits `fieldLog:read
 * {formId, first, ability}` when anything changed.
 * @param {World} world
 * @param {string} formId
 * @param {string|null} [ability]   the revealed ability id (null = look it up)
 * @param {LaneCtx} [ctx]
 * @returns {{formId: string, first: boolean, ability: string|null}}
 */
export function markRead(world, formId, ability = null, ctx) {
  const e = entryFor(world, formId);
  const resolved = (typeof ability === 'string' && ability) ? ability
    : (world.run?.gen?.abilities?.[formId] ?? rowOf(ctx?.data, 'species', formId)?.ability ?? e.ability ?? null);
  const first = !e.read;
  const changed = first || !e.seen || e.ability !== resolved;
  e.seen = true;
  e.read = true;
  e.ability = typeof resolved === 'string' ? resolved : null;
  if (changed) ctx?.bus?.emit('fieldLog:read', { formId, first, ability: e.ability });
  return { formId, first, ability: e.ability };
}

/**
 * Marks a form Held (caught, Shifted into, or returned by a family letter; implies Seen).
 * Emits `fieldLog:held {formId, first}` the first time.
 * @param {World} world
 * @param {string} formId
 * @param {LaneCtx} [ctx]
 * @returns {{formId: string, first: boolean}}
 */
export function markHeld(world, formId, ctx) {
  const e = entryFor(world, formId);
  const first = !e.held;
  e.seen = true;
  if (first) {
    e.held = true;
    ctx?.bus?.emit('fieldLog:held', { formId, first: true });
  }
  return { formId, first };
}

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

/**
 * @param {unknown} v
 * @param {string} what
 * @returns {string}
 */
function assertId(v, what) {
  if (typeof v !== 'string' || v.length === 0) throw new TypeError(`fieldLog: ${what} must be a non-empty string, got ${String(v)}`);
  return v;
}

/**
 * Logs a landed fish (kept or released: both count as caught). Updates the count, the best size,
 * the Patient record board when `opts.patient`, and learns the species' tell once the catches reach
 * the threshold (3, or the Brine lead's `tellCatches` when `opts.brineLead` / the current lead is
 * Brine). Emits `fieldLog:fish {id, first, size, best, record, patient}` and, when learned,
 * `fieldLog:tell {id}`.
 * @param {World} world
 * @param {string} fishId
 * @param {number} size              size in the row's unit (cm), finite, >= 0
 * @param {{patient?: boolean, tellCatches?: number}} [opts]   `tellCatches` overrides the threshold (fishing passes the lead's)
 * @param {LaneCtx} [ctx]
 * @returns {{id: string, n: number, first: boolean, best: number, record: boolean, patientRecord: boolean, tellLearned: boolean, tellNew: boolean}}
 */
export function recordFish(world, fishId, size, opts = {}, ctx) {
  assertId(fishId, 'fish id');
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) throw new TypeError(`fieldLog.recordFish: size must be a finite number >= 0, got ${String(size)}`);
  const col = world.collections;
  const prev = col.fish[fishId];
  const first = !prev;
  const rec = prev ?? { n: 0, best: 0 };
  rec.n += 1;
  const record = size > rec.best;
  if (record) rec.best = size;
  col.fish[fishId] = rec;
  let patientRecord = false;
  if (opts.patient) {
    const pb = col.patientBest?.[fishId] ?? 0;
    if (size > pb || !(fishId in (col.patientBest ?? {}))) {
      patientRecord = true;
      if (!col.patientBest || typeof col.patientBest !== 'object') col.patientBest = {};
      col.patientBest[fishId] = Math.max(size, pb);
    }
  }
  const t = tuningOf(tuningSource(ctx));
  const lb = leadBonuses(world, ctx);
  const threshold = Math.max(1, Number.isInteger(opts.tellCatches) && opts.tellCatches > 0 ? opts.tellCatches
    : (lb.tellCatches > 0 ? lb.tellCatches : t.fishTellCatches));
  const known = (world.fieldLog.tells[fishId] ?? 0) >= 1;
  let tellNew = false;
  if (!known && rec.n >= threshold) {
    world.fieldLog.tells[fishId] = 1;
    tellNew = true;
  }
  ctx?.bus?.emit('fieldLog:fish', { id: fishId, first, size, best: rec.best, record, patient: Boolean(opts.patient) });
  if (tellNew) ctx?.bus?.emit('fieldLog:tell', { id: fishId });
  return { id: fishId, n: rec.n, first, best: rec.best, record, patientRecord, tellLearned: known || tellNew, tellNew };
}

/**
 * Whether the tell of a fish species is learned.
 * @param {World} world
 * @param {string} fishId
 * @returns {boolean}
 */
export function tellLearned(world, fishId) {
  return (world?.fieldLog?.tells?.[fishId] ?? 0) >= 1;
}

/**
 * Catches still needed before a species' tell is learned (0 once learned), given the current lead.
 * @param {World} world
 * @param {string} fishId
 * @param {LaneCtx} [ctx]
 * @returns {number}
 */
export function tellCatchesLeft(world, fishId, ctx) {
  if (tellLearned(world, fishId)) return 0;
  const t = tuningOf(tuningSource(ctx));
  const lb = leadBonuses(world, ctx);
  const threshold = lb.tellCatches > 0 ? lb.tellCatches : t.fishTellCatches;
  return Math.max(0, threshold - (world?.collections?.fish?.[fishId]?.n ?? 0));
}

/**
 * Logs a netted bug. Emits `fieldLog:bug {id, first, n}`.
 * @param {World} world
 * @param {string} bugId
 * @param {LaneCtx} [ctx]
 * @returns {{id: string, n: number, first: boolean}}
 */
export function recordBug(world, bugId, ctx) {
  assertId(bugId, 'bug id');
  const prev = world.collections.bugs[bugId];
  const rec = prev ?? { n: 0 };
  rec.n += 1;
  world.collections.bugs[bugId] = rec;
  ctx?.bus?.emit('fieldLog:bug', { id: bugId, first: !prev, n: rec.n });
  return { id: bugId, n: rec.n, first: !prev };
}

/**
 * Logs a find (fossil, relic, skyglass relic, shore find, cockle...). Emits `fieldLog:find
 * {id, first, n}`.
 * @param {World} world
 * @param {string} findId
 * @param {LaneCtx} [ctx]
 * @returns {{id: string, n: number, first: boolean}}
 */
export function recordFind(world, findId, ctx) {
  assertId(findId, 'find id');
  const prev = world.collections.relics[findId];
  const rec = prev ?? { n: 0, cleaned: false };
  rec.n += 1;
  world.collections.relics[findId] = rec;
  ctx?.bus?.emit('fieldLog:find', { id: findId, first: !prev, n: rec.n });
  return { id: findId, n: rec.n, first: !prev };
}

/**
 * Lifetime count of a collected id in any collection (0 when never collected).
 * @param {World} world
 * @param {string} id
 * @returns {number}
 */
export function collectedCount(world, id) {
  const c = world?.collections;
  return c?.fish?.[id]?.n ?? c?.bugs?.[id]?.n ?? c?.relics?.[id]?.n ?? 0;
}

/**
 * Whether an id has been donated to the Archive.
 * @param {World} world
 * @param {string} id
 * @returns {boolean}
 */
export function isDonated(world, id) {
  return (world?.collections?.donated ?? []).includes(id);
}

/**
 * Donates the first specimen of a fish, bug or find to Barnaby's Archive. The item leaves the bag
 * through `ctx.take(id, 1)` (when given; a `false` return refuses the donation). Emits
 * `fieldLog:donated {id}`.
 * @param {World} world
 * @param {string} id
 * @param {LaneCtx & {take?: (id: string, n: number) => boolean}} [ctx]
 * @returns {{ok: true, id: string} | {ok: false, id: string, reason: 'not-collected'|'already-donated'|'not-in-bag'}}
 */
export function donate(world, id, ctx) {
  assertId(id, 'id');
  if (collectedCount(world, id) < 1) return { ok: false, id, reason: 'not-collected' };
  if (isDonated(world, id)) return { ok: false, id, reason: 'already-donated' };
  if (typeof ctx?.take === 'function' && ctx.take(id, 1) === false) return { ok: false, id, reason: 'not-in-bag' };
  world.collections.donated.push(id);
  ctx?.bus?.emit('fieldLog:donated', { id });
  return { ok: true, id };
}

/**
 * Sells duplicates to Barnaby: only ids already donated (so every copy sold is a duplicate). The
 * price is the collection row's `archivePrice` (e.g. a skyglass relic's 900), else its `price`,
 * times `findCleanMult` when `opts.cleaned`. Items leave through `ctx.take(id, n)` and the buttons
 * arrive through `ctx.earn(amount, 'archive')`. Emits `fieldLog:sold {id, n, amount}`.
 * @param {World} world
 * @param {string} id
 * @param {number} [n=1]
 * @param {{cleaned?: boolean}} [opts]
 * @param {LaneCtx & {take?: (id: string, n: number) => boolean, earn?: (amount: number, source: string) => any}} [ctx]
 * @returns {{ok: true, id: string, n: number, amount: number} | {ok: false, id: string, reason: 'not-donated'|'unknown'|'bad-count'|'not-in-bag'}}
 */
export function sellDuplicates(world, id, n = 1, opts = {}, ctx) {
  assertId(id, 'id');
  if (!Number.isInteger(n) || n < 1) return { ok: false, id, reason: 'bad-count' };
  if (!isDonated(world, id)) return { ok: false, id, reason: 'not-donated' };
  const row = rowOf(ctx?.data, 'collections', id);
  if (!row) return { ok: false, id, reason: 'unknown' };
  const t = tuningOf(tuningSource(ctx));
  const unit = typeof row.archivePrice === 'number' ? row.archivePrice : (typeof row.price === 'number' ? row.price : 0);
  const amount = Math.round(unit * (opts.cleaned ? t.findCleanMult : 1)) * n;
  if (typeof ctx?.take === 'function' && ctx.take(id, n) === false) return { ok: false, id, reason: 'not-in-bag' };
  if (typeof ctx?.earn === 'function' && amount > 0) ctx.earn(amount, 'archive');
  ctx?.bus?.emit('fieldLog:sold', { id, n, amount });
  return { ok: true, id, n, amount };
}

/**
 * Whether a find is pinned on Barnaby's string wall. The wall itself is `world.letters.pinned`
 * (written by systems/letters.pinFind, which unlocks the find's town letter).
 * @param {World} world
 * @param {string} findId
 * @returns {boolean}
 */
export function isPinned(world, findId) {
  const list = world?.letters?.pinned;
  return Array.isArray(list) && list.includes(findId);
}

/**
 * Pins a donated find on Barnaby's string wall (GDD-00 §9: each find pinned unlocks its town
 * letter). The Field Log checks the find was donated and is not pinned yet, then hands it to the
 * injected `ctx.pinFind(findId)` (systems/letters.pinFind), which records the pin and returns the
 * letter it unlocked. Without `ctx.pinFind` nothing can be recorded and the call is refused. Emits
 * `fieldLog:pinned {id, letter}` (`letter` = whatever `pinFind` returned, or `null`).
 * @param {World} world
 * @param {string} findId
 * @param {LaneCtx & {pinFind?: (findId: string) => any}} [ctx]
 * @returns {{ok: true, id: string, letter: any} | {ok: false, id: string, reason: 'not-donated'|'already-pinned'|'not-a-find'|'no-wall'|'refused'}}
 */
export function pinFind(world, findId, ctx) {
  assertId(findId, 'find id');
  if (!world.collections.relics[findId]) return { ok: false, id: findId, reason: 'not-a-find' };
  if (!isDonated(world, findId)) return { ok: false, id: findId, reason: 'not-donated' };
  if (isPinned(world, findId)) return { ok: false, id: findId, reason: 'already-pinned' };
  if (typeof ctx?.pinFind !== 'function') return { ok: false, id: findId, reason: 'no-wall' };
  const out = ctx.pinFind(findId);
  if (out === false || (out && typeof out === 'object' && out.ok === false)) return { ok: false, id: findId, reason: 'refused' };
  const letter = out && typeof out === 'object' && 'letter' in out ? (out.letter ?? null) : (out === undefined || out === true ? null : out);
  ctx?.bus?.emit('fieldLog:pinned', { id: findId, letter });
  return { ok: true, id: findId, letter };
}

/**
 * Kiln lead: cleans one fossil on the spot, once per day (GDD-00 §9 Crossovers). Marks the find
 * cleaned in the log and returns the value multiplier for the item lane to apply. Rows opt in with
 * `group: 'fossil'` (or `cleanable: true`). Emits `fieldLog:cleaned {id, mult}`.
 * @param {World} world
 * @param {string} findId
 * @param {LaneCtx & {day?: number}} [ctx]   `day` defaults to the world clock's day
 * @returns {{ok: true, id: string, mult: number} | {ok: false, id: string, reason: 'no-kiln-lead'|'used-today'|'not-a-find'|'not-cleanable'}}
 */
export function kilnClean(world, findId, ctx) {
  assertId(findId, 'find id');
  const lb = leadBonuses(world, ctx);
  if (lb.cleanFindsPerDay < 1) return { ok: false, id: findId, reason: 'no-kiln-lead' };
  if (!world.collections.relics[findId]) return { ok: false, id: findId, reason: 'not-a-find' };
  const row = rowOf(ctx?.data, 'collections', findId);
  if (row && !(row.group === 'fossil' || row.cleanable === true)) return { ok: false, id: findId, reason: 'not-cleanable' };
  const today = Number.isInteger(ctx?.day) ? ctx.day : selectDay(world);
  if (world.collections.cleanedDay === today) return { ok: false, id: findId, reason: 'used-today' };
  world.collections.cleanedDay = today;
  world.collections.relics[findId].cleaned = true;
  const mult = tuningOf(tuningSource(ctx)).findCleanMult;
  ctx?.bus?.emit('fieldLog:cleaned', { id: findId, mult });
  return { ok: true, id: findId, mult };
}

/**
 * The Workshop bench (GDD-00 §7 rooms): a fossil left overnight comes back cleaned, worth
 * `findCleanMult` (+40%) to Barnaby. Marks the find cleaned in the log (the record is made when
 * missing). Rows opt in with `group: 'fossil'` (or `cleanable: true`). Emits `fieldLog:cleaned {id, mult}`.
 * @param {World} world
 * @param {string} findId
 * @param {LaneCtx} [ctx]
 * @returns {{ok: true, id: string, mult: number} | {ok: false, id: string, reason: 'not-cleanable'}}
 */
export function benchClean(world, findId, ctx) {
  assertId(findId, 'find id');
  const row = rowOf(ctx?.data, 'collections', findId);
  if (row && !(row.group === 'fossil' || row.cleanable === true)) return { ok: false, id: findId, reason: 'not-cleanable' };
  if (!world.collections.relics[findId]) world.collections.relics[findId] = { n: 0, cleaned: false };
  world.collections.relics[findId].cleaned = true;
  const mult = tuningOf(tuningSource(ctx)).findCleanMult;
  ctx?.bus?.emit('fieldLog:cleaned', { id: findId, mult, bench: true });
  return { ok: true, id: findId, mult };
}

/**
 * Whether a find has a cleaned specimen waiting (the Workshop bench or a Kiln lead cleaned it).
 * @param {World} world @param {string} findId
 * @returns {boolean}
 */
export function hasCleaned(world, findId) {
  return world?.collections?.relics?.[findId]?.cleaned === true;
}

/**
 * The cleaned specimen leaves (sold): the find's `cleaned` mark is spent, so the next copy sells at
 * the plain price. Call inside a tx.
 * @param {World} world @param {string} findId
 * @returns {boolean} whether a cleaned specimen was there
 */
export function spendCleaned(world, findId) {
  const rec = world?.collections?.relics?.[findId];
  if (!rec || rec.cleaned !== true) return false;
  rec.cleaned = false;
  // the Field Log keeps saying "Cleaned once" after the cleaned specimen is sold
  setFlag(world, `${CLEANED_SOLD_PREFIX}${findId}`, true);
  return true;
}

/** Flag prefix marking a find whose cleaned specimen has been sold (`sys.cleaned-sold.<findId>`). */
export const CLEANED_SOLD_PREFIX = 'sys.cleaned-sold.';

/**
 * Whether a find was ever cleaned and sold (the Field Log's "Cleaned once").
 * @param {World} world @param {string} findId
 * @returns {boolean}
 */
export function cleanedOnce(world, findId) {
  return world?.flags?.[`${CLEANED_SOLD_PREFIX}${findId}`] === true;
}

/**
 * The value multiplier a cleaned find sells at (`findCleanMult`, +40%).
 * @param {any} [ctx]
 * @returns {number}
 */
export function cleanMult(ctx) {
  return tuningOf(tuningSource(ctx)).findCleanMult;
}

// ---------------------------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{have: number, total: number, pct: number}} Part   `pct` is an integer 0..100 (floor; 100 only when complete)
 * @typedef {Object} Completion
 * @property {{seen: Part, read: Part, held: Part}} forms
 * @property {Part} fish  @property {Part} bugs  @property {Part} finds  @property {Part} tells
 * @property {Part} donated     donated ids out of every logged fish, bug and find
 * @property {number} overall   integer 0..100: mean of forms.held, fish, bugs and finds (parts with no rows skipped)
 */

/**
 * @param {number} have
 * @param {number} total
 * @returns {Part}
 */
function part(have, total) {
  const pct = total > 0 ? (have >= total ? 100 : Math.min(99, Math.floor((have / total) * 100))) : 0;
  return { have, total, pct };
}

/**
 * Field Log completion against the content tables: forms from `species` (rows may opt out with
 * `log: false`), fish / bugs / finds from `collections` rows of kind fish / bug / relic that count
 * ({@link isLogged}). Ids logged in the world but absent from data are ignored.
 * @param {World} world
 * @param {any} data
 * @returns {Completion}
 */
export function completion(world, data) {
  const forms = rowsOf(data, 'species').filter(isLogged).map((r) => r.id);
  const fe = world?.fieldLog?.forms ?? {};
  const count = (pred) => forms.reduce((n, id) => n + (fe[id] && pred(fe[id]) ? 1 : 0), 0);
  const ids = (kind) => collectionRows(data, kind).filter(isLogged).map((r) => r.id);
  const fishIds = ids('fish');
  const bugIds = ids('bug');
  const findIds = ids('relic');
  const col = world?.collections ?? {};
  const have = (rec, list) => list.reduce((n, id) => n + ((rec?.[id]?.n ?? 0) > 0 ? 1 : 0), 0);
  const donatedSet = new Set(col.donated ?? []);
  const all = [...fishIds, ...bugIds, ...findIds];
  const out = {
    forms: { seen: part(count((e) => e.seen), forms.length), read: part(count((e) => e.read), forms.length), held: part(count((e) => e.held), forms.length) },
    fish: part(have(col.fish, fishIds), fishIds.length),
    bugs: part(have(col.bugs, bugIds), bugIds.length),
    finds: part(have(col.relics, findIds), findIds.length),
    tells: part(fishIds.reduce((n, id) => n + (tellLearned(world, id) ? 1 : 0), 0), fishIds.length),
    donated: part(all.reduce((n, id) => n + (donatedSet.has(id) ? 1 : 0), 0), all.length),
    overall: 0,
  };
  const parts = [out.forms.held, out.fish, out.bugs, out.finds].filter((p) => p.total > 0);
  const haveSum = parts.reduce((s, p) => s + p.have / p.total, 0);
  out.overall = parts.length === 0 ? 0 : (parts.every((p) => p.have >= p.total) ? 100 : Math.min(99, Math.floor((haveSum / parts.length) * 100)));
  return out;
}
