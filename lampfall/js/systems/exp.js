/**
 * EXP rules: growth curves and level thresholds, the post-battle award split (participants, bench,
 * Big-Sibling-style ability shares, Training Yard, catch-up, over-curve damping) and Shift window
 * detection (WILDSHIFT rules §2.2, §2.4, §4.8, §12.1). [RULES-CREATURE]
 *
 * Every designer-tunable number is a key of the frozen {@link DEFAULTS}; every function takes an
 * optional `opts.tuning` (a partial override, merged over DEFAULTS by {@link tuningOf}). Content
 * (species, abilities, families) arrives through the `data` argument: a Registry
 * (`get(table, id)` / `has(table, id)`) or a plain object of tables; see {@link dataLookup}.
 *
 * Windows (rules §2.2): a creature opens a window the first time it reaches each configured curve
 * level. Levels come from `opts.levels`, else the creature's family row `windows` (when
 * `USE_FAMILY_WINDOWS`), else `WINDOW_LEVELS`. `creature.windowsUsed` records the levels already
 * resolved (accepted, anchored or skipped). Levels at or below the level a creature is caught at
 * are skipped ({@link skipPassedWindows}). A window never opens in battle: the battle engine works on
 * deep copies and never sees `world`; only {@link detectWindows} (called by `party.applyOutcome`
 * and `party.giveExp` after the battle) pushes a uid into `world.pendingShifts`, once.
 *
 * This module is the lowest of the lane (creature.js and party.js import it), so it also hosts
 * {@link dataLookup}, the one adapter over the content `data` argument that all three use.
 *
 * Writes: `world.pendingShifts` (co-owned with systems/forecast.js) and `creature.windowsUsed`.
 * Pure: no DOM, no randomness.
 * @module systems/exp
 */

import { LEVEL_MAX } from '../state/schema.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Creature} Creature */
/** @typedef {{from: number, num: number[], den: number}} CurveStep  the cubic used from level `from` up */
/**
 * @typedef {{num: number[], den: number, steps?: CurveStep[]}} GrowthCurve  EXP(n) = floor((num[0]·n³ + num[1]·n² + num[2]·n + num[3]) / den),
 * clamped ≥ 0; level 1 is always 0. Optional `steps` (ascending `from`) replace the cubic from their level up, so a
 * curve can keep one shape for the early levels and steepen later (data/tuning.js keeps GDD-00's 8 × L² through Lv8).
 */
/** @typedef {{bus?: {emit: (evt: string, payload: any) => any}|null, tuning?: Partial<ExpTuning>|null, levels?: number[]}} ExpOpts */

/**
 * @typedef {Object} ExpTuning
 * @property {number} MAX_LEVEL                 highest level (≤ schema LEVEL_MAX)
 * @property {Record<string, GrowthCurve>} GROWTH_CURVES   growth id -> cubic with an integer denominator
 * @property {number} EXP_DIVISOR               base yield = floor(expYield × foe level / EXP_DIVISOR)
 * @property {number} TRAINER_EXP_MULT          × on base yield for trainer battles
 * @property {number} PARTICIPANT_SHARE         share for creatures that battled
 * @property {number} BENCH_SHARE               share for every other conscious party member
 * @property {number} FAINTED_EXP_SHARE         share for fainted party members (0 = none)
 * @property {number} SIBLING_SHARE             ability expShare fraction when the ability row says only `true`
 * @property {number} YARD_SHARE                Training Yard: each listed creature gets this × total party EXP
 * @property {number} YARD_CAP                  max Training Yard creatures
 * @property {number} CATCH_UP_STEP_LEVELS      catch-up: one step per this many levels under the curve
 * @property {number} CATCH_UP_STEP             catch-up: + this per step
 * @property {number} CATCH_UP_CAP              catch-up multiplier cap
 * @property {number} DAMP_START                damping applies above curve + DAMP_START
 * @property {number} DAMP_FACTOR               damping multiplier
 * @property {string[]} DAMP_SOURCES            battle sources that are damped (rules: Rematch board only)
 * @property {number[]} WINDOW_LEVELS           default Shift window curve levels
 * @property {boolean} USE_FAMILY_WINDOWS       a family row's `windows` overrides WINDOW_LEVELS
 * @property {boolean} SKIP_WINDOW_AT_CATCH_LEVEL  true: a window at exactly the catch level is skipped too
 * @property {boolean} HOLD_WINDOWS_IN_BOX      stored creatures hold an open window until they rejoin the party
 * @property {'consume'|'hold'} STILL_KNOT_MODE   windows reached under a Still Knot are used up | wait for the Knot to come off
 * @property {number} PIP_LEAD_LEVELS           "Shift pending" pip shows this many levels before a window
 */

/**
 * Designer-tunable defaults (sources: rules §2.2, §12.1, §22.4; prototype engine for the yield and
 * curve shapes). [GDD values]
 * @type {Readonly<ExpTuning>}
 */
export const DEFAULTS = deepFreeze({
  MAX_LEVEL: 100,
  GROWTH_CURVES: {
    fast: { num: [4, 0, 0, 0], den: 5 },
    'medium-fast': { num: [1, 0, 0, 0], den: 1 },
    'medium-slow': { num: [6, -75, 500, -700], den: 5 },
    slow: { num: [5, 0, 0, 0], den: 4 },
  },
  EXP_DIVISOR: 7,
  TRAINER_EXP_MULT: 1.5,
  PARTICIPANT_SHARE: 1,
  BENCH_SHARE: 0.6,
  FAINTED_EXP_SHARE: 0,
  SIBLING_SHARE: 0.3,
  YARD_SHARE: 0.25,
  YARD_CAP: 3,
  CATCH_UP_STEP_LEVELS: 5,
  CATCH_UP_STEP: 0.5,
  CATCH_UP_CAP: 3,
  DAMP_START: 10,
  DAMP_FACTOR: 0.5,
  DAMP_SOURCES: ['rematch'],
  WINDOW_LEVELS: [9, 20, 34],
  USE_FAMILY_WINDOWS: true,
  SKIP_WINDOW_AT_CATCH_LEVEL: true,
  HOLD_WINDOWS_IN_BOX: true,
  STILL_KNOT_MODE: 'consume',
  PIP_LEAD_LEVELS: 1,
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v) => isNum(v) && v >= 0;
const posInt = (v) => Number.isInteger(v) && v >= 1;
const intList = (v) => Array.isArray(v) && v.every(posInt);
const cubicOk = (c) => !!c && Array.isArray(c.num) && c.num.length === 4 && c.num.every(Number.isInteger) && posInt(c.den);

/** @type {Record<keyof ExpTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  MAX_LEVEL: [(v) => posInt(v) && v <= LEVEL_MAX, `integer 1..${LEVEL_MAX}`],
  GROWTH_CURVES: [(v) => v && typeof v === 'object' && Object.values(v).every(
    (c) => cubicOk(c) && (c.steps === undefined || (Array.isArray(c.steps) && c.steps.every(
      (st, i) => cubicOk(st) && Number.isInteger(st.from) && st.from >= 2 && (i === 0 || st.from > c.steps[i - 1].from),
    ))),
  ), '{id: {num: [4 integers], den: positive integer, steps?: [{from: integer ≥ 2 ascending, num, den}]}}'],
  EXP_DIVISOR: [(v) => isNum(v) && v > 0, 'number > 0'],
  TRAINER_EXP_MULT: [nonNeg, 'number ≥ 0'],
  PARTICIPANT_SHARE: [nonNeg, 'number ≥ 0'],
  BENCH_SHARE: [nonNeg, 'number ≥ 0'],
  FAINTED_EXP_SHARE: [nonNeg, 'number ≥ 0'],
  SIBLING_SHARE: [nonNeg, 'number ≥ 0'],
  YARD_SHARE: [nonNeg, 'number ≥ 0'],
  YARD_CAP: [(v) => Number.isInteger(v) && v >= 0, 'integer ≥ 0'],
  CATCH_UP_STEP_LEVELS: [posInt, 'integer ≥ 1'],
  CATCH_UP_STEP: [nonNeg, 'number ≥ 0'],
  CATCH_UP_CAP: [(v) => isNum(v) && v >= 1, 'number ≥ 1'],
  DAMP_START: [isNum, 'number'],
  DAMP_FACTOR: [nonNeg, 'number ≥ 0'],
  DAMP_SOURCES: [(v) => Array.isArray(v) && v.every((s) => typeof s === 'string'), 'string[]'],
  WINDOW_LEVELS: [intList, 'positive integer[]'],
  USE_FAMILY_WINDOWS: [(v) => typeof v === 'boolean', 'boolean'],
  SKIP_WINDOW_AT_CATCH_LEVEL: [(v) => typeof v === 'boolean', 'boolean'],
  HOLD_WINDOWS_IN_BOX: [(v) => typeof v === 'boolean', 'boolean'],
  STILL_KNOT_MODE: [(v) => v === 'consume' || v === 'hold', "'consume' | 'hold'"],
  PIP_LEAD_LEVELS: [(v) => Number.isInteger(v) && v >= 0, 'integer ≥ 0'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** @type {WeakMap<object, Readonly<ExpTuning>>} */
const TUNING_CACHE = new WeakMap();

/**
 * Resolves a partial tuning override over {@link DEFAULTS}. Keys this module does not know are
 * ignored (one flat tuning object is shared by creature/exp/party; `party.checkTuning` reports
 * unknown keys). Results are cached per override object only when that object is frozen (a
 * mutable override is re-read on every call, so later edits are never masked by a stale cache).
 * @param {Partial<ExpTuning>|null|undefined} [tuning]
 * @returns {Readonly<ExpTuning>}
 * @throws {TypeError} when a known key has a malformed value
 */
export function tuningOf(tuning) {
  if (tuning == null) return DEFAULTS;
  if (typeof tuning !== 'object') throw new TypeError('exp.tuningOf: tuning must be an object');
  const cacheable = Object.isFrozen(tuning);
  const hit = cacheable ? TUNING_CACHE.get(tuning) : undefined;
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(tuning, key)) continue;
    const v = /** @type {any} */ (tuning)[key];
    const [pred, desc] = SPEC[/** @type {keyof ExpTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`exp tuning ${key}: expected ${desc}, got ${JSON.stringify(v)}`);
    out[key] = v;
  }
  const frozen = deepFreeze(out);
  if (cacheable) TUNING_CACHE.set(tuning, frozen);
  return frozen;
}

// ---------------------------------------------------------------------------------------------
// Content adapter (shared by creature.js / party.js)
// ---------------------------------------------------------------------------------------------

/**
 * A species row normalized to one shape, whatever the data lane's spelling (`familyId` or
 * `family`; learnset entries as `[level, move]` or `{level, move}`).
 * @typedef {Object} SpeciesInfo
 * @property {string} id  @property {string} name  @property {string[]} types  @property {string} familyId
 * @property {number} stage  @property {{hp:number,atk:number,def:number,spa:number,spd:number,spe:number}} base
 * @property {string} ability  @property {ReadonlyArray<{level: number, move: string}>} learnset
 * @property {string|null} heartmark  @property {number} catchRate  @property {number} expYield
 * @property {string} growth  @property {Record<string, any>} flags
 */

/**
 * @typedef {Object} DataLookup
 * @property {(id: string) => SpeciesInfo} species          throws RangeError for an unknown id
 * @property {(id: string) => SpeciesInfo|null} speciesOrNull
 * @property {(id: string) => any} move                     throws RangeError for an unknown id
 * @property {(id: string) => any|null} moveOrNull
 * @property {(id: string) => any} ability                  throws RangeError for an unknown id
 * @property {(id: string) => any|null} abilityOrNull
 * @property {(id: string) => any|null} familyOrNull
 * @property {(id: string) => any|null} itemOrNull
 * @property {() => string[]} typeNames                     every type name in the types table (empty when absent)
 */

/** @type {WeakMap<object, DataLookup>} */
const LOOKUP_CACHE = new WeakMap();
/** @type {WeakMap<object, SpeciesInfo>} */
const SPECIES_CACHE = new WeakMap();

/**
 * Builds (and caches per `data` object) the adapter every function of this lane uses to read
 * content. Accepts a Registry (`get(table, id)` and `has(table, id)`, as `data/registry.js` builds)
 * or a plain object of tables `{species, moves, abilities, families?, items?, types?}` where each
 * table is an array of rows with `id`, an object keyed by id, or a function `id -> row|undefined`.
 * @param {any} data
 * @returns {DataLookup}
 * @throws {TypeError} when `data` is not an object
 */
export function dataLookup(data) {
  if (!data || (typeof data !== 'object' && typeof data !== 'function')) {
    throw new TypeError('dataLookup: data must be a Registry or an object of tables');
  }
  const hit = LOOKUP_CACHE.get(data);
  if (hit) return hit;

  /** @type {(table: string, id: string) => any|null} */
  let rowOf;
  /** @type {() => any[]} */
  let typeRows;
  if (typeof data.get === 'function' && typeof data.has === 'function') {
    rowOf = (table, id) => (typeof id === 'string' && data.has(table, id) ? data.get(table, id) : null);
    typeRows = () => {
      try { return typeof data.list === 'function' ? data.list('types') : []; } catch { return []; }
    };
  } else {
    // One getter per table, rebuilt when the table is replaced or an array table changes length
    // (plain test tables are often mutable; a frozen DATA never rebuilds).
    /** @type {Map<string, {t: any, len: number, g: (id: string) => any}>} */
    const getters = new Map();
    const getter = (table) => {
      const t = data[table];
      const len = Array.isArray(t) ? t.length : -1;
      const hit = getters.get(table);
      if (hit && hit.t === t && hit.len === len) return hit.g;
      /** @type {(id: string) => any} */
      let g;
      if (typeof t === 'function') g = (id) => t(id) ?? null;
      else if (Array.isArray(t)) {
        const index = new Map(t.filter((r) => r && typeof r === 'object' && typeof r.id === 'string').map((r) => [r.id, r]));
        g = (id) => index.get(id) ?? null;
      } else if (t && typeof t === 'object') g = (id) => (Object.prototype.hasOwnProperty.call(t, id) ? t[id] : null);
      else g = () => null;
      getters.set(table, { t, len, g });
      return g;
    };
    rowOf = (table, id) => (typeof id === 'string' ? getter(table)(id) : null);
    typeRows = () => {
      const t = data.types;
      if (Array.isArray(t)) return t;
      if (t && typeof t === 'object' && typeof t !== 'function') return Object.values(t);
      return [];
    };
  }

  const must = (table, what) => (id) => {
    const row = rowOf(table, id);
    if (row == null) throw new RangeError(`unknown ${what} ${JSON.stringify(id)}`);
    return row;
  };
  const speciesOrNull = (id) => {
    const row = rowOf('species', id);
    return row == null ? null : normalizeSpecies(row);
  };

  /** @type {DataLookup} */
  const look = Object.freeze({
    species: (id) => normalizeSpecies(must('species', 'species')(id)),
    speciesOrNull,
    move: must('moves', 'move'),
    moveOrNull: (id) => rowOf('moves', id),
    ability: must('abilities', 'ability'),
    abilityOrNull: (id) => rowOf('abilities', id),
    familyOrNull: (id) => rowOf('families', id),
    itemOrNull: (id) => rowOf('items', id),
    typeNames: () => typeRows()
      .map((r) => (typeof r === 'string' ? r : r && typeof r === 'object' ? (r.name ?? r.id) : null))
      .filter((n) => typeof n === 'string'),
  });
  LOOKUP_CACHE.set(data, look);
  return look;
}

/**
 * @param {any} row
 * @returns {SpeciesInfo}
 */
function normalizeSpecies(row) {
  const hit = SPECIES_CACHE.get(row);
  if (hit) return hit;
  const learnset = (Array.isArray(row.learnset) ? row.learnset : []).map((e) => (Array.isArray(e)
    ? Object.freeze({ level: e[0], move: e[1] })
    : Object.freeze({ level: e.level, move: e.move })));
  const info = Object.freeze({
    id: row.id,
    name: typeof row.name === 'string' ? row.name : row.id,
    types: Object.freeze((row.types || []).slice()),
    familyId: row.familyId ?? row.family ?? '',
    stage: row.stage ?? 0,
    base: row.base,
    ability: row.ability,
    learnset: Object.freeze(learnset),
    heartmark: row.heartmark ?? null,
    catchRate: row.catchRate ?? 0,
    expYield: row.expYield ?? 0,
    growth: row.growth,
    flags: row.flags || {},
  });
  SPECIES_CACHE.set(row, info);
  return info;
}

// ---------------------------------------------------------------------------------------------
// Growth curves and level thresholds
// ---------------------------------------------------------------------------------------------

/**
 * Total EXP needed to stand at `level` on a growth curve (0 at level 1). Integer arithmetic, so the
 * thresholds are exact.
 * @param {string} growth      curve id (a key of GROWTH_CURVES)
 * @param {number} level       clamped to 1..MAX_LEVEL and floored
 * @param {ExpOpts} [opts]
 * @returns {number}
 * @throws {RangeError} for an unknown curve
 */
export function expForLevel(growth, level, opts = {}) {
  const t = tuningOf(opts.tuning);
  const curve = t.GROWTH_CURVES[growth];
  if (!curve) throw new RangeError(`exp.expForLevel: unknown growth curve ${JSON.stringify(growth)}`);
  const n = Math.max(1, Math.min(t.MAX_LEVEL, Math.floor(isNum(level) ? level : 1)));
  if (n === 1) return 0;
  let seg = curve;
  if (Array.isArray(curve.steps)) for (const st of curve.steps) if (n >= st.from) seg = st;
  const [a, b, c, d] = seg.num;
  return Math.max(0, Math.floor((a * n ** 3 + b * n ** 2 + c * n + d) / seg.den));
}

/**
 * Level reached with `exp` total EXP (1..MAX_LEVEL).
 * @param {string} growth
 * @param {number} exp
 * @param {ExpOpts} [opts]
 * @returns {number}
 */
export function levelFromExp(growth, exp, opts = {}) {
  const t = tuningOf(opts.tuning);
  let lv = 1;
  while (lv < t.MAX_LEVEL && expForLevel(growth, lv + 1, opts) <= exp) lv++;
  return lv;
}

/**
 * The EXP band of a level: `[min, max]` total EXP that still reads as `level` (max = min at the cap).
 * @param {string} growth
 * @param {number} level
 * @param {ExpOpts} [opts]
 * @returns {[number, number]}
 */
export function expBand(growth, level, opts = {}) {
  const t = tuningOf(opts.tuning);
  const lo = expForLevel(growth, level, opts);
  if (level >= t.MAX_LEVEL) return [lo, lo];
  return [lo, Math.max(lo, expForLevel(growth, level + 1, opts) - 1)];
}

// ---------------------------------------------------------------------------------------------
// Award split
// ---------------------------------------------------------------------------------------------

/**
 * Catch-up multiplier for a creature under the curve: +CATCH_UP_STEP per CATCH_UP_STEP_LEVELS
 * levels under, capped at CATCH_UP_CAP. 1 when the curve is unknown.
 * @param {number} level
 * @param {number|null|undefined} curveLevel
 * @param {ExpOpts} [opts]
 * @returns {number}
 */
export function catchUpMult(level, curveLevel, opts = {}) {
  if (curveLevel == null || !isNum(curveLevel)) return 1;
  const t = tuningOf(opts.tuning);
  const under = Math.max(0, curveLevel - level);
  return Math.min(t.CATCH_UP_CAP, 1 + t.CATCH_UP_STEP * Math.floor(under / t.CATCH_UP_STEP_LEVELS));
}

/**
 * Over-curve damping: DAMP_FACTOR when `source` is in DAMP_SOURCES and the creature is more than
 * DAMP_START levels over the curve; else 1 (story, route and Spire EXP is never damped).
 * @param {number} level
 * @param {number|null|undefined} curveLevel
 * @param {string|null|undefined} source
 * @param {ExpOpts} [opts]
 * @returns {number}
 */
export function dampMult(level, curveLevel, source, opts = {}) {
  if (curveLevel == null || !isNum(curveLevel) || typeof source !== 'string') return 1;
  const t = tuningOf(opts.tuning);
  if (!t.DAMP_SOURCES.includes(source)) return 1;
  return level > curveLevel + t.DAMP_START ? t.DAMP_FACTOR : 1;
}

/**
 * Base EXP one defeated foe is worth, before shares.
 * @param {number} expYield     the foe species' yield
 * @param {number} level        the foe's level
 * @param {'wild'|'trainer'|string} kind
 * @param {ExpOpts} [opts]
 * @returns {number}
 */
export function baseYield(expYield, level, kind, opts = {}) {
  const t = tuningOf(opts.tuning);
  const y = nonNeg(expYield) ? expYield : 0;
  const l = nonNeg(level) ? level : 0;
  return Math.floor((y * l) / t.EXP_DIVISOR) * (kind === 'trainer' ? t.TRAINER_EXP_MULT : 1);
}

/**
 * @typedef {Object} AwardInput
 * @property {'wild'|'trainer'|string} kind
 * @property {string} [source]                               'route' | 'story' | 'spire' | 'rematch' | 'duel'
 * @property {number|null} [curveLevel]
 * @property {Array<{speciesId?: string, expYield?: number, level: number}>} defeated   foes KO'd or caught
 * @property {Array<{uid: string, level: number, fainted?: boolean, participated?: boolean, ability?: string|null}>} party   in party order
 * @property {string[]} [participants]                       uids that battled (alternative to `participated`)
 * @property {Array<{uid: string, level: number}>} [yard]     Training Yard creatures (stored, not in the party)
 */

/** @typedef {{uid: string, amount: number, share: 'battler'|'bench'|'fainted'|'sibling'|'yard'}} AwardLine */
/** @typedef {{lines: AwardLine[], totals: Array<{uid: string, amount: number}>}} Award */

/**
 * Splits the EXP of a battle (rules §12.1). For each defeated foe, every party member gets
 * `floor(base × share × catchUp × damping)` where share is PARTICIPANT_SHARE for creatures that
 * battled, BENCH_SHARE for the rest and FAINTED_EXP_SHARE for fainted ones. Then each conscious
 * participant whose ability row has `expShare` gives the lowest-level other party member that
 * fraction of its own gain (`expShare.toLowest`, a number, or SIBLING_SHARE for `true`). Then each
 * Training Yard creature (first YARD_CAP, never one also in the party) gets YARD_SHARE × the party
 * total. Lines with amount 0 are dropped. Pure; deterministic order.
 * @param {AwardInput} input
 * @param {any} [data]     Registry or tables (species expYield when a foe gives only `speciesId`; ability expShare)
 * @param {ExpOpts} [opts]
 * @returns {Award}
 * @throws {TypeError} for malformed input
 */
export function computeAward(input, data, opts = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('exp.computeAward: input must be an object');
  const t = tuningOf(opts.tuning);
  const party = Array.isArray(input.party) ? input.party : [];
  const defeated = Array.isArray(input.defeated) ? input.defeated : [];
  const participants = Array.isArray(input.participants) ? new Set(input.participants) : null;
  const look = data ? dataLookup(data) : null;
  for (const m of party) {
    if (!m || typeof m.uid !== 'string') throw new TypeError('exp.computeAward: party entries need a string uid');
    if (!isNum(m.level)) throw new TypeError(`exp.computeAward: party entry ${JSON.stringify(m.uid)} needs a finite level`);
  }
  if (input.curveLevel != null && !isNum(input.curveLevel)) throw new TypeError('exp.computeAward: curveLevel must be a finite number or null');
  const battled = (m) => (m.participated !== undefined ? !!m.participated : participants ? participants.has(m.uid) : false);

  /** @type {AwardLine[]} */
  const lines = [];
  /** @type {Map<string, number>} */
  const gains = new Map();
  const add = (uid, amount, share) => {
    if (!(amount > 0)) return;
    lines.push({ uid, amount, share });
    gains.set(uid, (gains.get(uid) || 0) + amount);
  };

  for (const foe of defeated) {
    if (!foe || typeof foe !== 'object') throw new TypeError('exp.computeAward: defeated entries must be objects');
    if (!isNum(foe.level)) throw new TypeError('exp.computeAward: a defeated foe needs a finite level');
    let yieldV = foe.expYield;
    if (!nonNeg(yieldV)) {
      if (!look || typeof foe.speciesId !== 'string') throw new TypeError('exp.computeAward: a defeated foe needs expYield, or speciesId plus data');
      yieldV = look.species(foe.speciesId).expYield;
    }
    const base = baseYield(yieldV, foe.level, input.kind, opts);
    for (const m of party) {
      const kind = m.fainted ? 'fainted' : battled(m) ? 'battler' : 'bench';
      const share = kind === 'fainted' ? t.FAINTED_EXP_SHARE : kind === 'battler' ? t.PARTICIPANT_SHARE : t.BENCH_SHARE;
      // Rounded in the battle engine's order (floor, then damping, then floor) so the "gained N EXP"
      // lines the engine shows in battle equal what is applied here, whatever DAMP_FACTOR is.
      let amount = Math.floor(base * share * catchUpMult(m.level, input.curveLevel, opts));
      const damp = dampMult(m.level, input.curveLevel, input.source, opts);
      if (damp !== 1) amount = Math.floor(amount * damp);
      add(m.uid, amount, kind);
    }
  }

  if (look && defeated.length) {
    for (const m of party) {
      if (m.fainted || !battled(m) || !m.ability) continue;
      const ab = look.abilityOrNull(m.ability);
      if (!ab || !ab.expShare) continue;
      const frac = typeof ab.expShare === 'object' && nonNeg(ab.expShare.toLowest) ? ab.expShare.toLowest
        : nonNeg(ab.expShare) && ab.expShare !== true ? /** @type {number} */ (ab.expShare) : t.SIBLING_SHARE;
      const others = party.filter((o) => o !== m);
      if (!others.length) continue;
      const lowest = others.reduce((a, b) => (b.level < a.level ? b : a));
      add(lowest.uid, Math.floor((gains.get(m.uid) || 0) * frac), 'sibling');
    }
  }

  const partyTotal = [...gains.values()].reduce((a, b) => a + b, 0);
  const inParty = new Set(party.map((m) => m.uid));
  const yard = (Array.isArray(input.yard) ? input.yard : []).filter((y) => y && typeof y.uid === 'string' && !inParty.has(y.uid));
  const seen = new Set();
  for (const y of yard) {
    if (seen.size >= t.YARD_CAP) break;
    if (seen.has(y.uid)) continue;
    seen.add(y.uid);
    add(y.uid, Math.floor(partyTotal * t.YARD_SHARE), 'yard');
  }

  const order = [...party.map((m) => m.uid), ...seen];
  const totals = [];
  const done = new Set();
  for (const uid of order) {
    if (done.has(uid)) continue;
    done.add(uid);
    const amount = gains.get(uid) || 0;
    if (amount > 0) totals.push({ uid, amount });
  }
  return { lines, totals };
}

// ---------------------------------------------------------------------------------------------
// Shift windows
// ---------------------------------------------------------------------------------------------

/**
 * The curve levels at which this creature's windows sit, ascending and unique.
 * @param {Creature} c
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {number[]}
 */
export function windowLevels(c, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  let levels = t.WINDOW_LEVELS;
  if (Array.isArray(opts.levels)) {
    if (!intList(opts.levels)) throw new TypeError('exp.windowLevels: opts.levels must be positive integers');
    levels = opts.levels;
  } else if (t.USE_FAMILY_WINDOWS && data && c && c.familyId) {
    const fam = dataLookup(data).familyOrNull(c.familyId);
    if (fam && intList(fam.windows) && fam.windows.length) levels = fam.windows;
  }
  return [...new Set(levels)].sort((a, b) => a - b);
}

/**
 * Whether a creature can have windows at all (its current form is not flagged `neverShifts`).
 * Unknown species (no data) count as shifting.
 * @param {Creature} c
 * @param {any} [data]
 * @returns {boolean}
 */
export function canEverShift(c, data) {
  if (!data) return true;
  const sp = dataLookup(data).speciesOrNull(c.speciesId);
  return !(sp && sp.flags && sp.flags.neverShifts);
}

/**
 * Window levels reached and not yet resolved, ascending. Empty while a Still Knot is held or for a
 * form that never Shifts.
 * @param {Creature} c
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {number[]}
 */
export function openWindows(c, data, opts = {}) {
  if (!c || c.stillKnot || !canEverShift(c, data)) return [];
  const used = new Set(c.windowsUsed || []);
  return windowLevels(c, data, opts).filter((L) => c.level >= L && !used.has(L));
}

/**
 * The next window level above the creature's level that is not resolved, or `null`.
 * @param {Creature} c
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {number|null}
 */
export function nextWindowLevel(c, data, opts = {}) {
  if (!c || !canEverShift(c, data)) return null;
  const used = new Set(c.windowsUsed || []);
  return windowLevels(c, data, opts).find((L) => L > c.level && !used.has(L)) ?? null;
}

/**
 * Whether the party screen should show the "Shift pending" pip (rules §2.4): the next window is at
 * most PIP_LEAD_LEVELS levels away and no Still Knot is held.
 * @param {Creature} c
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {boolean}
 */
export function windowSoon(c, data, opts = {}) {
  if (!c || c.stillKnot) return false;
  const t = tuningOf(opts.tuning);
  const next = nextWindowLevel(c, data, opts);
  return next !== null && next - c.level <= t.PIP_LEAD_LEVELS;
}

/**
 * Marks the windows a creature has already passed as resolved: call once when it is caught or
 * given (rules §2.2: a creature caught past a point skips that window). Mutates `c.windowsUsed`.
 * @param {Creature} c
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {number[]} the levels skipped
 */
export function skipPassedWindows(c, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  if (!Array.isArray(c.windowsUsed)) c.windowsUsed = [];
  const used = new Set(c.windowsUsed);
  const skipped = windowLevels(c, data, opts).filter((L) => (t.SKIP_WINDOW_AT_CATCH_LEVEL ? L <= c.level : L < c.level) && !used.has(L));
  if (skipped.length) c.windowsUsed = [...used, ...skipped].sort((a, b) => a - b);
  return skipped;
}

/**
 * Where a uid lives in the world.
 * @param {World} world
 * @param {string} uid
 * @returns {{c: Creature|null, inParty: boolean}}
 */
function locate(world, uid) {
  const p = world.party.find((x) => x.uid === uid);
  if (p) return { c: p, inParty: true };
  return { c: world.box.find((x) => x.uid === uid) ?? null, inParty: false };
}

/**
 * Brings `world.pendingShifts` in line for one uid: present (once) iff the creature has an open
 * window and is in the party (or HOLD_WINDOWS_IN_BOX is off); absent otherwise, including for a uid
 * no longer in the world. Idempotent.
 * @param {World} world
 * @param {string} uid
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {{pending: boolean, changed: boolean}}
 */
export function refreshPending(world, uid, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const { c, inParty } = locate(world, uid);
  const should = !!c && openWindows(c, data, opts).length > 0 && (inParty || !t.HOLD_WINDOWS_IN_BOX);
  const at = world.pendingShifts.indexOf(uid);
  if (should && at < 0) {
    world.pendingShifts.push(uid);
    return { pending: true, changed: true };
  }
  if (!should && at >= 0) {
    // remove every copy (a hand-edited save could hold duplicates)
    for (let i = world.pendingShifts.length - 1; i >= 0; i--) if (world.pendingShifts[i] === uid) world.pendingShifts.splice(i, 1);
    return { pending: false, changed: true };
  }
  let changed = false;
  if (should) {
    // keep the first copy only
    for (let i = world.pendingShifts.length - 1; i > at; i--) {
      if (world.pendingShifts[i] === uid) {
        world.pendingShifts.splice(i, 1);
        changed = true;
      }
    }
  }
  return { pending: should, changed };
}

/**
 * Detects windows opened by a level gain from `fromLevel` to the creature's current level and
 * updates `world.pendingShifts` (rules §2.2, §4.8). Under a Still Knot with STILL_KNOT_MODE
 * 'consume' the windows reached are used up instead. Emits `shift:window` `{uid, level, held}` per
 * newly opened window (`held`: stored creature waiting to rejoin the party). Call after the battle,
 * never during it.
 * @param {World} world
 * @param {string} uid
 * @param {number} fromLevel   level before the gain
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {{opened: number[], consumed: number[], pending: boolean}}
 */
export function detectWindows(world, uid, fromLevel, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const { c, inParty } = locate(world, uid);
  if (!c) return { opened: [], consumed: [], pending: false };
  if (!Array.isArray(c.windowsUsed)) c.windowsUsed = [];
  const used = new Set(c.windowsUsed);
  const reached = canEverShift(c, data)
    ? windowLevels(c, data, opts).filter((L) => L > fromLevel && L <= c.level && !used.has(L))
    : [];
  /** @type {number[]} */
  let consumed = [];
  /** @type {number[]} */
  let opened = [];
  if (c.stillKnot) {
    if (t.STILL_KNOT_MODE === 'consume' && reached.length) {
      consumed = reached;
      c.windowsUsed = [...used, ...reached].sort((a, b) => a - b);
    }
  } else {
    opened = reached;
  }
  const { pending } = refreshPending(world, uid, data, opts);
  const held = !inParty && t.HOLD_WINDOWS_IN_BOX;
  for (const level of opened) opts.bus?.emit('shift:window', { uid, level, held });
  return { opened, consumed, pending };
}

/**
 * Resolves the lowest open window (the Forecast was accepted or anchored): records its level in
 * `windowsUsed` and refreshes `pendingShifts` (the uid stays when another window is still open).
 * Called by systems/forecast.
 * @param {World} world
 * @param {string} uid
 * @param {any} [data]
 * @param {ExpOpts} [opts]
 * @returns {number|null} the level resolved, or null when no window was open
 */
export function resolveWindow(world, uid, data, opts = {}) {
  const { c } = locate(world, uid);
  if (!c) {
    refreshPending(world, uid, data, opts);
    return null;
  }
  const open = openWindows(c, data, opts);
  if (!open.length) {
    refreshPending(world, uid, data, opts);
    return null;
  }
  const level = open[0];
  c.windowsUsed = [...(c.windowsUsed || []), level].sort((a, b) => a - b);
  refreshPending(world, uid, data, opts);
  return level;
}

/**
 * @template T
 * @param {T} o
 * @returns {T}
 */
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
