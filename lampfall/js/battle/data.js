/**
 * The battle data view: turns whatever content the caller injects into the
 * lookups the engine, the AI and the Read card use. [BATTLE-RULES]
 *
 * js/battle never imports a content table. Callers pass `data`:
 * - a plain object `{species, moves, abilities, types}` whose tables are arrays
 *   of rows with ids, objects keyed by id, or Maps; or
 * - a `data/registry` Registry (`get(table, id)` / `list(table)`), with the type
 *   chart under the `types` table's raw value or a separate `typeChart` key.
 *
 * `types` (the type table) may be `{chart, ordinary?, statusImmunity?, cures?}`
 * or a module namespace with `TYPE_CHART` / `ORDINARY_TYPES` (+ optional
 * `STATUS_IMMUNITY` / `STATUS_CURES`); a row array is accepted for the names
 * when the chart comes in `data.typeChart`.
 * - `statusImmunity`: `{burn: 'TypeName', ...}` a creature of that type cannot get that status
 * - `cures`: `[{type, status}]` a damaging hit of `type` cures `status` on the target
 *
 * Optional tables: `items` (rows with a `held` object drive held items, see `battle/heldItems.js`;
 * without an items table every held item is inert) and `weatherKinds` (arena weather rows, see
 * `battle/weather.js`; also accepted as `WEATHER_KINDS`, or a Registry table `weatherKinds`).
 *
 * Species rows follow ARCHITECTURE §14.1 (`learnset: [[level, moveId]]`,
 * `familyId`); the prototype shape (`learnset: [{level, move}]`, `family`) is
 * accepted too. The Scrap move is the first move row whose effect has
 * `scrap: true`; when the data has none a typeless one is synthesized from
 * `scrapPower`.
 *
 * Views are cached per data object (and per tuning object) so building one per
 * battle is cheap. Pure: no DOM, no randomness.
 * @module battle/data
 */

import { createTypeChart, moveProblems, mergeTuning } from './effects.js';
import { getAbilityRuntime, abilityProblems, DEFAULTS as ABILITY_DEFAULTS } from './abilityHooks.js';
import { expForLevel as defaultExpForLevel, levelFromExp as defaultLevelFromExp, DEFAULTS as CREATURE_DEFAULTS } from './creatureOps.js';
import { getHeldRuntime, heldProblems } from './heldItems.js';
import { indexWeatherKinds, weatherKindProblems } from './weather.js';

/**
 * Data-view tunables.
 * @type {Readonly<{scrapPower: number}>}
 */
export const DEFAULTS = Object.freeze({
  /** Power of the synthesized Scrap when the move data has no `scrap` row. */
  scrapPower: 50,
});

/** Every key of {@link DEFAULTS}. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * A normalized species row.
 * @typedef {Object} SpeciesView
 * @property {string} id  @property {string} name  @property {string[]} types  @property {string} familyId
 * @property {number} stage  @property {{hp:number, atk:number, def:number, spa:number, spd:number, spe:number}} base
 * @property {string} ability  @property {ReadonlyArray<{level: number, move: string}>} learnset
 * @property {string|null} heartmark  @property {number} catchRate  @property {number} expYield
 * @property {string} growth  @property {Readonly<Record<string, any>>} flags
 */

/**
 * @typedef {Object} BattleData
 * @property {(id: string) => SpeciesView} species                 throws RangeError for an unknown id
 * @property {(id: string) => import('./effects.js').Move} move    throws RangeError for an unknown id
 * @property {(id: string) => import('./abilityHooks.js').AbilityRuntime} ability   merged with its hook; throws for an unknown id
 * @property {(table: 'species'|'moves'|'abilities', id: string) => boolean} has
 * @property {() => SpeciesView[]} speciesList  @property {() => import('./effects.js').Move[]} moveList
 * @property {() => string[]} abilityIds
 * @property {import('./effects.js').Move} scrap                   the Scrap move
 * @property {import('./effects.js').TypeChart} chart
 * @property {(kind: string, types: readonly string[]) => boolean} typeBlocksStatus
 * @property {(moveType: string|null, status: string) => boolean} cures
 * @property {(itemId: string|null|undefined) => import('./heldItems.js').HeldRuntime|null} held   held-item runtime;
 *   null for no item, a bag item, or any item when no items table was injected; throws for an id unknown to an injected table
 * @property {boolean} hasItems                                    an items table was injected
 * @property {() => ReadonlyMap<string, import('./weather.js').WeatherKind>} weatherKinds   arena weather kinds (empty when none injected)
 * @property {(growth: string, level: number) => number} expForLevel
 * @property {(growth: string, exp: number) => number} levelFromExp
 * @property {() => string[]} problems                             contract problems of the injected tables; empty = ok
 * @property {true} isBattleData
 */

/** @type {WeakMap<object, Map<string|symbol, BattleData>>} */
const CACHE = new WeakMap();
const NO_TUNING = Symbol('no-tuning');

/**
 * Builds (or returns the cached) battle data view.
 * A prebuilt view is returned as is: the tuning it was built with (ability-hook
 * params, `scrapPower`, `maxLevel`) stays in force, so build it with the same
 * tuning the battle gets.
 * @param {any} data `{species, moves, abilities, types}`, a Registry, or a BattleData view (returned as is)
 * @param {{tuning?: Record<string, any>}} [opts] battle tuning (ability-hook and scrap keys are read)
 * @returns {BattleData}
 * @throws {TypeError} when a table or the type chart is missing
 */
export function createBattleData(data, opts = {}) {
  if (data && data.isBattleData === true) return data;
  if (!data || typeof data !== 'object') throw new TypeError('createBattleData: data {species, moves, abilities, types} is required');
  const key = tuningKey(opts.tuning);
  let byTuning = CACHE.get(data);
  if (!byTuning) {
    byTuning = new Map();
    CACHE.set(data, byTuning);
  }
  const hit = byTuning.get(key);
  if (hit) return hit;
  const view = build(data, opts.tuning);
  if (byTuning.size > 32) byTuning.clear();
  byTuning.set(key, view);
  return view;
}

/**
 * Cache key of a tuning table: only the keys the view reads, by value (a caller
 * that mutates and reuses one tuning object never gets a stale view).
 * @param {Record<string, any>|undefined} tuning
 * @returns {string|symbol}
 */
function tuningKey(tuning) {
  if (!tuning) return NO_TUNING;
  const parts = [];
  for (const k of Object.keys(tuning).sort()) {
    if (k in ABILITY_DEFAULTS || k === 'scrapPower' || k === 'maxLevel') parts.push([k, tuning[k]]);
  }
  return parts.length ? JSON.stringify(parts) : NO_TUNING;
}

/**
 * @param {any} data
 * @param {Record<string, any>|undefined} tuning
 * @returns {BattleData}
 */
function build(data, tuning) {
  const isRegistry = typeof data.get === 'function' && typeof data.list === 'function';
  const rowsOf = (table) => {
    if (isRegistry) return data.list(table);
    const t = data[table];
    if (t == null) throw new TypeError(`createBattleData: missing table "${table}"`);
    if (t instanceof Map) return [...t.values()];
    if (Array.isArray(t)) return t.slice();
    if (typeof t === 'object') return Object.values(t);
    throw new TypeError(`createBattleData: table "${table}" must be an array, object or Map`);
  };
  /** @param {string} table @param {any[]} rows */
  const indexOf = (table, rows) => {
    const m = new Map();
    for (const r of rows) {
      if (!r || typeof r.id !== 'string') throw new TypeError(`createBattleData: a ${table} row has no string id`);
      if (!m.has(r.id)) m.set(r.id, r);
    }
    return m;
  };

  const optionalRows = (table, ...alts) => {
    if (isRegistry) return data.tables.includes(table) ? data.list(table) : null;
    for (const k of [table, ...alts]) {
      const t = data[k];
      if (t == null) continue;
      if (t instanceof Map) return [...t.values()];
      if (Array.isArray(t)) return t.slice();
      if (typeof t === 'object') return Object.values(t);
    }
    return null;
  };

  const speciesRows = indexOf('species', rowsOf('species'));
  const moveRows = indexOf('moves', rowsOf('moves'));
  const abilityRows = indexOf('abilities', rowsOf('abilities'));
  const typeInfo = resolveTypes(data, isRegistry);
  const chart = createTypeChart(typeInfo.chart, typeInfo.ordinary);
  const scrapPower = (tuning && tuning.scrapPower) ?? DEFAULTS.scrapPower;
  const abilityTuning = pickKeys(tuning, ABILITY_DEFAULTS);
  const maxLevel = (tuning && tuning.maxLevel) ?? CREATURE_DEFAULTS.maxLevel;

  const itemList = optionalRows('items');
  const itemRows = itemList ? indexOf('items', itemList) : null;
  const weatherKinds = indexWeatherKinds(optionalRows('weatherKinds', 'WEATHER_KINDS'));
  /** @type {Map<string, any>} */
  const heldCache = new Map();
  const held = (itemId) => {
    if (itemId == null || itemId === '' || !itemRows) return null;
    if (heldCache.has(itemId)) return heldCache.get(itemId);
    const row = itemRows.get(itemId);
    if (!row) throw missing('item', itemId, itemRows);
    const rt = getHeldRuntime(row);
    heldCache.set(itemId, rt);
    return rt;
  };

  /** @type {Map<string, SpeciesView>} */
  const speciesCache = new Map();
  /** @type {Map<string, any>} */
  const abilityCache = new Map();

  const missing = (table, id, rows) => {
    const near = closest(String(id), [...rows.keys()]);
    return new RangeError(`battle data: unknown ${table} ${JSON.stringify(id)}${near ? ` (did you mean ${JSON.stringify(near)}?)` : ''}`);
  };

  const species = (id) => {
    const cached = speciesCache.get(id);
    if (cached) return cached;
    const row = speciesRows.get(id);
    if (!row) throw missing('species', id, speciesRows);
    const view = normalizeSpecies(row);
    speciesCache.set(id, view);
    return view;
  };
  const move = (id) => {
    const row = moveRows.get(id);
    if (!row) {
      if (id === scrap.id) return scrap;
      throw missing('move', id, moveRows);
    }
    return row;
  };
  const ability = (id) => {
    const cached = abilityCache.get(id);
    if (cached) return cached;
    const row = abilityRows.get(id);
    if (!row) throw missing('ability', id, abilityRows);
    const rt = getAbilityRuntime(row, { tuning: abilityTuning });
    abilityCache.set(id, rt);
    return rt;
  };

  let scrap = [...moveRows.values()].find((m) => m.effect && m.effect.scrap === true) || null;
  if (!scrap) {
    scrap = Object.freeze({
      id: 'scrap', name: 'Scrap', type: null, category: 'physical', power: scrapPower, accuracy: null, pp: null, priority: 0,
      effect: Object.freeze({ scrap: true, sureHit: true }), text: 'Typeless fallback when every move is out of PP.',
    });
  }

  const immunity = typeInfo.statusImmunity || {};
  const cures = Array.isArray(typeInfo.cures) ? typeInfo.cures : [];
  const expForLevel = typeof data.expForLevel === 'function' ? data.expForLevel : (g, l) => defaultExpForLevel(g, l, maxLevel);
  const levelFromExp = typeof data.levelFromExp === 'function' ? data.levelFromExp : (g, e) => defaultLevelFromExp(g, e, maxLevel);

  const problems = () => {
    const out = [];
    for (const mv of moveRows.values()) out.push(...moveProblems(mv));
    for (const mv of moveRows.values()) if (mv.type !== null && !chart.has(mv.type)) out.push(`move ${mv.id}: unknown type ${String(mv.type)}`);
    for (const ab of abilityRows.values()) out.push(...abilityProblems(ab));
    for (const row of speciesRows.values()) {
      const sp = normalizeSpecies(row);
      for (const t of sp.types) if (!chart.has(t)) out.push(`species ${sp.id}: unknown type ${String(t)}`);
      if (!abilityRows.has(sp.ability)) out.push(`species ${sp.id}: unknown ability ${String(sp.ability)}`);
      for (const e of sp.learnset) if (!moveRows.has(e.move)) out.push(`species ${sp.id}: learnset move ${String(e.move)} does not exist`);
      if (sp.heartmark !== null && !moveRows.has(sp.heartmark)) out.push(`species ${sp.id}: heartmark ${String(sp.heartmark)} does not exist`);
      if (!(sp.catchRate >= 1 && sp.catchRate <= 255)) out.push(`species ${sp.id}: catchRate must be 1..255`);
      if (!(sp.expYield > 0)) out.push(`species ${sp.id}: expYield must be > 0`);
      try { expForLevel(sp.growth, 2); } catch { out.push(`species ${sp.id}: unknown growth ${String(sp.growth)}`); }
    }
    for (const [kind, t] of Object.entries(immunity)) if (!chart.has(t)) out.push(`types: statusImmunity.${kind} names unknown type ${String(t)}`);
    for (const c of cures) if (!chart.has(c.type)) out.push(`types: cure names unknown type ${String(c.type)}`);
    if (itemRows) for (const it of itemRows.values()) out.push(...heldProblems(it, chart));
    for (const w of weatherKinds.values()) out.push(...weatherKindProblems(w, chart));
    return out;
  };

  return Object.freeze({
    isBattleData: true,
    species,
    move,
    ability,
    has: (table, id) => (table === 'species' ? speciesRows.has(id) : table === 'moves' ? moveRows.has(id) || id === scrap.id : table === 'abilities' ? abilityRows.has(id) : false),
    speciesList: () => [...speciesRows.keys()].map(species),
    moveList: () => [...moveRows.values()],
    abilityIds: () => [...abilityRows.keys()],
    scrap,
    chart,
    typeBlocksStatus: (kind, types) => !!immunity[kind] && types.includes(immunity[kind]),
    cures: (moveType, status) => moveType !== null && cures.some((c) => c.type === moveType && c.status === status),
    held,
    hasItems: !!itemRows,
    weatherKinds: () => weatherKinds,
    expForLevel,
    levelFromExp,
    problems,
  });
}

/**
 * @param {any} data
 * @param {boolean} isRegistry
 * @returns {{chart: Record<string, Record<string, number>>, ordinary?: string[], statusImmunity?: Record<string, string>, cures?: Array<{type: string, status: string}>}}
 */
function resolveTypes(data, isRegistry) {
  let t = isRegistry ? (typeof data.raw === 'function' && data.tables.includes('types') ? data.raw('types') : null) : data.types;
  const extra = data.typeChart || null;
  const pickFrom = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const chart = o.chart || o.TYPE_CHART || null;
    if (!chart) return null;
    return {
      chart,
      ordinary: o.ordinary || o.ORDINARY_TYPES || undefined,
      statusImmunity: o.statusImmunity || o.STATUS_IMMUNITY || undefined,
      cures: o.cures || o.STATUS_CURES || undefined,
    };
  };
  const found = pickFrom(extra) || pickFrom(t);
  if (!found) throw new TypeError('createBattleData: a type chart is required (types.chart, types.TYPE_CHART or data.typeChart)');
  return found;
}

/**
 * @param {any} row
 * @returns {SpeciesView}
 */
function normalizeSpecies(row) {
  const learnset = (row.learnset || []).map((e) => (Array.isArray(e) ? { level: e[0], move: e[1] } : { level: e.level, move: e.move }));
  learnset.sort((a, b) => a.level - b.level);
  return Object.freeze({
    id: row.id,
    name: typeof row.name === 'string' ? row.name : row.id,
    types: Object.freeze((row.types || []).slice()),
    familyId: row.familyId ?? row.family ?? row.id,
    stage: row.stage ?? 0,
    base: row.base,
    ability: row.ability,
    learnset: Object.freeze(learnset.map((e) => Object.freeze(e))),
    heartmark: row.heartmark ?? null,
    catchRate: row.catchRate,
    expYield: row.expYield,
    growth: row.growth,
    flags: Object.freeze({ ...(row.flags || {}) }),
  });
}

/**
 * Moves a species knows at a level (learnset entries at or below `level`, in
 * learn order, de-duplicated).
 * @param {SpeciesView} species
 * @param {number} level
 * @returns {string[]}
 */
export function learnableAt(species, level) {
  const out = [];
  for (const e of species.learnset) if (e.level <= level && !out.includes(e.move)) out.push(e.move);
  return out;
}

/**
 * @param {Record<string, any>|undefined} tuning
 * @param {Record<string, any>} defaults
 * @returns {Record<string, any>|undefined}
 */
function pickKeys(tuning, defaults) {
  if (!tuning) return undefined;
  const out = {};
  for (const k of Object.keys(tuning)) if (k in defaults) out[k] = tuning[k];
  return Object.keys(out).length ? mergeTuning(defaults, out, 'abilityHooks') : undefined;
}

/**
 * Closest id by edit distance (<= 3), for readable errors.
 * @param {string} id
 * @param {string[]} ids
 * @returns {string|null}
 */
function closest(id, ids) {
  let best = null;
  let bestD = 4;
  for (const c of ids) {
    const d = editDistance(id, c, bestD);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Levenshtein distance with an early exit above `cap`.
 * @param {string} a @param {string} b @param {number} cap
 * @returns {number}
 */
function editDistance(a, b, cap) {
  if (Math.abs(a.length - b.length) >= cap) return cap;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin >= cap) return cap;
    prev = cur;
  }
  return prev[b.length];
}
