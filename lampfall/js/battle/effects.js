/**
 * The move-effect vocabulary the battle engine implements, plus the pure,
 * table-free formulas it is built from (damage, crit, stat stages, capture
 * odds, catch-up EXP) and the Ward / type-chart checks. [BATTLE-RULES]
 *
 * Nothing here names content: type names, the chart and every move row arrive
 * as data (see {@link createTypeChart} and `battle/data.js`). Every
 * designer-tunable number lives in {@link DEFAULTS} and can be overridden per
 * call through a `tuning` argument (a partial object with the same keys).
 * Nested objects in a tuning override replace the default wholesale.
 *
 * Pure: no DOM, no clock, no randomness (callers pass any random roll in).
 * @module battle/effects
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Every key a move's `effect` object may carry (ARCHITECTURE §5.1). The data
 * validator rejects any other key.
 * - `stat: [{target:'self'|'foe', stat, stages}]` (+ optional `chance` for a secondary roll)
 * - `status: {kind, chance}`; `recovery: {fraction, delay, cancelledBy?}` (spends a Mend)
 * - `guard`, `evasion: n`, `sureHit`, `plumbline`, `scrap`, `clearRaised`, `flinch: p`,
 *   `popsDecoy: n`, `highCrit: stages`, `revealMoves`, `charge: 1`, `spread`, `queuedType`,
 *   `multiHit: [min, max]`, `drain: fraction`, `selfKo`, `contact`, `chance`
 * - `weather: kindId | {kind, turns?}` sets the arena weather (`battle/weather.js`) for `turns`
 *   turns (default tuning.weatherMoveTurns); on a status move it is a field move that never misses
 *   and no Ward or guard stops; on a damaging move it follows a hit that lands
 * @type {ReadonlyArray<string>}
 */
export const EFFECT_KEYS = Object.freeze([
  'stat', 'status', 'recovery', 'guard', 'evasion', 'sureHit', 'plumbline', 'scrap', 'clearRaised', 'flinch',
  'popsDecoy', 'highCrit', 'revealMoves', 'charge', 'spread', 'queuedType', 'multiHit', 'drain', 'selfKo',
  'contact', 'chance', 'weather',
]);

/** Status kinds a move may inflict. `trap` is volatile; the other four are major conditions. */
export const STATUS_KINDS = Object.freeze(['burn', 'poison', 'chill', 'numb', 'trap']);
/** Major (one-at-a-time, persists after battle) conditions. */
export const MAJOR_STATUS = Object.freeze(['burn', 'poison', 'chill', 'numb']);
/** Chip kinds: indirect damage that every Ward lets through. */
export const CHIP_KINDS = Object.freeze(['poison', 'burn', 'trap']);
/** Stat keys a stage can move (`eva` is evasion). */
export const STAGE_KEYS = Object.freeze(['atk', 'def', 'spa', 'spd', 'spe', 'eva']);
/** Move categories. */
export const CATEGORIES = Object.freeze(['physical', 'special', 'status']);
/** Ward kinds an ability row's `ward.kind` may name. */
export const WARD_KINDS = Object.freeze(['strong-only', 'no-status', 'min-power']);
/** Effectiveness words the UI shows (always with an icon, never colour alone). */
export const WORDS = Object.freeze({ STRONG: 'Strong', NEUTRAL: 'Neutral', WEAK: 'Weak', BLOCKED: 'Blocked' });

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Designer-tunable numbers used by the formulas in this module. Values are the
 * prototype's estimates; the GDD sets the final ones through `tuning`.
 * @type {Readonly<{
 *   stab: number, critMult: number, critRates: readonly number[], burnAttackMult: number, damageRollMin: number,
 *   captureFailBonus: number, captureFailCap: number, captureOddsMin: number, captureOddsMax: number,
 *   captureStatusMult: Readonly<Record<string, number>>, captureBands: ReadonlyArray<readonly [number, string]>,
 *   lantern: Readonly<Record<string, Readonly<{mult: number, price: number|null, name: string}>>>,
 *   catchUpStep: number, catchUpEvery: number, catchUpCap: number,
 * }>}
 */
export const DEFAULTS = Object.freeze({
  /** Same-type bonus. */
  stab: 1.5,
  /** Crit damage multiplier. */
  critMult: 1.5,
  /** Crit chance by crit stage (clamped to the table). */
  critRates: Object.freeze([1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2]),
  /** Physical damage multiplier while the attacker is burned. */
  burnAttackMult: 0.5,
  /** Low end of the damage roll; the roll is uniform in [damageRollMin, 1). */
  damageRollMin: 0.85,
  /** Capture: odds bonus per failed attempt on the same creature, and its cap. */
  captureFailBonus: 0.03,
  captureFailCap: 0.15,
  /** Capture odds clamp for ordinary Lanterns. */
  captureOddsMin: 0.01,
  captureOddsMax: 0.99,
  /** Capture odds multiplier per condition (`trap` applies when the target is trapped). */
  captureStatusMult: Object.freeze({ chill: 1.5, numb: 1.5, trap: 1.5, burn: 1.25, poison: 1.25 }),
  /** Bands shown instead of exact odds (Freefall): `[upperLimit, word]`, first match wins. */
  captureBands: Object.freeze([Object.freeze([0.25, 'Low']), Object.freeze([0.6, 'Fair']), Object.freeze([Infinity, 'Good'])]),
  /** Lantern grades: odds multiplier, shop price and display name. `sure` never fails. */
  lantern: Object.freeze({
    1: Object.freeze({ mult: 1, price: 250, name: 'Lantern' }),
    2: Object.freeze({ mult: 1.5, price: 700, name: 'Bright Lantern' }),
    3: Object.freeze({ mult: 2, price: 1400, name: 'Beacon Lantern' }),
    sure: Object.freeze({ mult: Infinity, price: null, name: 'Keepsake Lantern' }),
  }),
  /** Catch-up EXP: +catchUpStep per catchUpEvery levels under the curve, capped at catchUpCap. */
  catchUpStep: 0.5,
  catchUpEvery: 5,
  catchUpCap: 3,
});

/** Every key of {@link DEFAULTS} (the names a `tuning` override may use here). */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * Merges a partial `tuning` override onto a frozen defaults table. Unknown keys
 * throw so a typo in a GDD table fails loudly instead of being ignored.
 * Nested objects and arrays are replaced, not merged.
 * @template {Record<string, any>} T
 * @param {T} defaults
 * @param {Partial<T>|null|undefined} tuning
 * @param {string} [where='tuning'] label for error messages
 * @param {ReadonlyArray<string>} [extraKeys] keys accepted (and passed through) although not in `defaults`
 * @returns {Readonly<T>} a frozen merged table (`defaults` itself when there is nothing to merge)
 * @throws {TypeError} when `tuning` is not a plain object
 * @throws {RangeError} for an unknown key or an undefined value
 */
export function mergeTuning(defaults, tuning, where = 'tuning', extraKeys = []) {
  if (tuning == null) return defaults;
  if (typeof tuning !== 'object' || Array.isArray(tuning)) throw new TypeError(`${where}: tuning must be an object, got ${typeof tuning}`);
  const keys = Object.keys(tuning);
  if (keys.length === 0) return defaults;
  for (const k of keys) {
    if (!(k in defaults) && !extraKeys.includes(k)) throw new RangeError(`${where}: unknown tuning key "${k}"`);
    if (tuning[k] === undefined) throw new RangeError(`${where}: tuning key "${k}" is undefined`);
    if (k in defaults) {
      const want = kindOf(defaults[k]);
      const got = kindOf(tuning[k]);
      if (want !== got) throw new TypeError(`${where}: tuning key "${k}" must be ${want}, got ${got === 'number' ? String(tuning[k]) : got}`);
    }
  }
  return Object.freeze({ ...defaults, ...tuning });
}

/**
 * The shape class of a tuning value, for {@link mergeTuning}'s type check:
 * 'number' (NaN is 'NaN'), 'boolean', 'string', 'array', 'object', 'null' or the typeof.
 * @param {any} v
 * @returns {string}
 */
function kindOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : 'number';
  return typeof v;
}

/**
 * @param {Partial<typeof DEFAULTS>|undefined} tuning
 * @returns {typeof DEFAULTS}
 */
function tun(tuning) {
  return tuning ? /** @type {any} */ ({ ...DEFAULTS, ...tuning }) : DEFAULTS;
}

// ---------------------------------------------------------------------------
// Move classification
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Move
 * @property {string} id  @property {string} name
 * @property {string|null} type                 type name, or null for typeless
 * @property {'physical'|'special'|'status'} category
 * @property {number} power  @property {number|null} accuracy  @property {number|null} pp  @property {number} priority
 * @property {Record<string, any>} effect       keys ⊂ {@link EFFECT_KEYS}
 * @property {string} [text]
 */

/** @param {Move} mv @returns {boolean} whether the move deals direct damage */
export function isDamaging(mv) {
  return mv.category !== 'status' && mv.power > 0;
}

/** @param {Move} mv @returns {boolean} whether the move never misses */
export function isSureHit(mv) {
  return mv.accuracy === null || mv.effect.sureHit === true;
}

/** @param {Move} mv @returns {boolean} whether the move can inflict chip damage (poison / burn / trap) */
export function isChipMove(mv) {
  const s = mv.effect.status;
  return !!s && CHIP_KINDS.includes(s.kind);
}

/** @param {Move} mv @returns {boolean} whether the move targets only its user */
export function isSelfTargeting(mv) {
  if (mv.category !== 'status') return false;
  const e = mv.effect;
  if (e.guard || e.evasion || e.recovery) return true;
  if (e.weather && !e.status && !e.plumbline && !e.clearRaised && !e.revealMoves) return !e.stat || e.stat.every((s) => s.target === 'self');
  return !!(e.stat && e.stat.every((s) => s.target === 'self') && !e.status && !e.plumbline && !e.clearRaised);
}

/**
 * The type a move hits with for a given user: a `queuedType` move takes the
 * next type in the user's type loop (Unfixed); every other move keeps its own.
 * @param {Move} mv
 * @param {{typeQueue?: string[]|null, typeIndex?: number}} [user]
 * @returns {string|null}
 */
export function moveTypeFor(mv, user) {
  if (mv.effect.queuedType && user && Array.isArray(user.typeQueue) && user.typeQueue.length) {
    return user.typeQueue[((user.typeIndex || 0) + 1) % user.typeQueue.length];
  }
  return mv.type;
}

/**
 * Structural problems of one move row against the vocabulary (unknown effect
 * keys, bad category, bad status kind...). Used by tools/validate-data and the
 * battle data view; empty means valid.
 * @param {any} mv
 * @returns {string[]}
 */
export function moveProblems(mv) {
  const out = [];
  const id = mv && typeof mv.id === 'string' ? mv.id : '?';
  if (!mv || typeof mv !== 'object') return [`move ${id}: not an object`];
  if (!CATEGORIES.includes(mv.category)) out.push(`move ${id}: bad category ${String(mv.category)}`);
  if (typeof mv.power !== 'number' || !Number.isFinite(mv.power) || mv.power < 0) out.push(`move ${id}: power must be a finite number >= 0`);
  if (mv.accuracy !== null && !(typeof mv.accuracy === 'number' && mv.accuracy > 0 && mv.accuracy <= 100)) out.push(`move ${id}: accuracy must be null or 1..100`);
  if (mv.pp !== null && !(Number.isInteger(mv.pp) && mv.pp > 0)) out.push(`move ${id}: pp must be null or a positive integer`);
  if (!Number.isInteger(mv.priority)) out.push(`move ${id}: priority must be an integer`);
  const e = mv.effect;
  if (!e || typeof e !== 'object') return out.concat(`move ${id}: effect must be an object`);
  for (const k of Object.keys(e)) if (!EFFECT_KEYS.includes(k)) out.push(`move ${id}: unknown effect key "${k}"`);
  if (e.status && !STATUS_KINDS.includes(e.status.kind)) out.push(`move ${id}: unknown status kind ${String(e.status.kind)}`);
  if (e.stat) {
    if (!Array.isArray(e.stat)) out.push(`move ${id}: effect.stat must be an array`);
    else for (const s of e.stat) if (!STAGE_KEYS.includes(s.stat) || !['self', 'foe'].includes(s.target) || !Number.isInteger(s.stages)) out.push(`move ${id}: bad stat entry ${JSON.stringify(s)}`);
  }
  if (e.multiHit && !(Array.isArray(e.multiHit) && e.multiHit.length === 2 && e.multiHit[0] >= 1 && e.multiHit[1] >= e.multiHit[0])) out.push(`move ${id}: multiHit must be [min, max]`);
  if (e.recovery && !(e.recovery.fraction > 0 && e.recovery.fraction <= 1 && Number.isInteger(e.recovery.delay ?? 0))) out.push(`move ${id}: bad recovery`);
  for (const k of ['flinch', 'drain', 'chance']) if (e[k] !== undefined && !(typeof e[k] === 'number' && e[k] >= 0 && e[k] <= 1)) out.push(`move ${id}: ${k} must be 0..1`);
  if (e.weather !== undefined && weatherOf(e) === null) out.push(`move ${id}: weather must be a kind id or {kind, turns?: positive integer}`);
  return out;
}

/**
 * The weather a move's `weather` effect sets, normalized (`turns` null = the tuning default).
 * @param {Record<string, any>} effect
 * @returns {{kind: string, turns: number|null}|null} null when the move sets none (or the value is malformed)
 */
export function weatherOf(effect) {
  const w = effect && effect.weather;
  if (w == null) return null;
  if (typeof w === 'string') return w ? { kind: w, turns: null } : null;
  if (typeof w === 'object' && typeof w.kind === 'string' && w.kind && (w.turns == null || (Number.isInteger(w.turns) && w.turns > 0))) return { kind: w.kind, turns: w.turns ?? null };
  return null;
}

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

/**
 * Stat-stage multiplier: +1 is x1.5, +2 x2, -1 x0.67, -2 x0.5.
 * @param {number} stage
 * @returns {number}
 */
export function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/**
 * Crit chance for a crit stage (clamped to the table).
 * @param {number} stage
 * @param {Partial<typeof DEFAULTS>} [tuning]
 * @returns {number}
 */
export function critChance(stage, tuning) {
  const rates = tun(tuning).critRates;
  return rates[Math.max(0, Math.min(rates.length - 1, Math.floor(stage) || 0))];
}

/**
 * The damage roll for a uniform draw `u` in [0, 1).
 * @param {number} u
 * @param {Partial<typeof DEFAULTS>} [tuning]
 * @returns {number} damageRollMin..1
 */
export function damageRoll(u, tuning) {
  const min = tun(tuning).damageRollMin;
  return min + u * (1 - min);
}

/**
 * Level-scaled damage formula.
 * @param {Object} p
 * @param {number} p.level attacker level
 * @param {number} p.power
 * @param {number} p.attack effective attacking stat
 * @param {number} p.defense effective defending stat
 * @param {number} p.typeMult chart multiplier (0 returns 0)
 * @param {boolean} p.stab
 * @param {boolean} p.crit
 * @param {number} p.rand damage roll (see {@link damageRoll})
 * @param {boolean} [p.burned] attacker burned and move physical
 * @param {number} [p.extra=1] ability multipliers
 * @param {Partial<typeof DEFAULTS>} [tuning]
 * @returns {number} integer damage (>= 1 unless typeMult or power is 0)
 */
export function damageFormula({ level, power, attack, defense, typeMult, stab, crit, rand, burned = false, extra = 1 }, tuning) {
  // a zero multiplier anywhere (an immunity, or a weather that smothers the type) deals nothing, never the 1-HP floor
  if (typeMult === 0 || power <= 0 || extra === 0) return 0;
  const t = tun(tuning);
  const base = Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / Math.max(1, defense) / 50) + 2;
  let mods = typeMult * rand * extra;
  if (stab) mods *= t.stab;
  if (crit) mods *= t.critMult;
  if (burned) mods *= t.burnAttackMult;
  return Math.max(1, Math.floor(base * mods));
}

/**
 * Capture odds (shown before a Lantern is spent).
 * @param {Object} p
 * @param {number} p.catchRate species catch rate, 3..255
 * @param {number} p.hp
 * @param {number} p.maxHp
 * @param {string|null} p.status major status kind
 * @param {boolean} [p.trapped]
 * @param {number|string} p.grade Lantern grade key of `tuning.lantern`
 * @param {number} [p.fails=0] failed attempts on this creature
 * @param {Partial<typeof DEFAULTS>} [tuning]
 * @returns {number} captureOddsMin..captureOddsMax, or 1 for a never-failing Lantern
 * @throws {RangeError} for an unknown Lantern grade
 */
export function captureOdds({ catchRate, hp, maxHp, status, trapped = false, grade, fails = 0 }, tuning) {
  const t = tun(tuning);
  const lantern = t.lantern[grade];
  if (!lantern) throw new RangeError(`captureOdds: unknown Lantern grade ${String(grade)}`);
  if (lantern.mult === Infinity) return 1;
  const max = Math.max(1, maxHp);
  const hpFactor = (3 * max - 2 * Math.max(1, Math.min(max, hp))) / (3 * max);
  let statusMult = 1;
  if (status && t.captureStatusMult[status]) statusMult = t.captureStatusMult[status];
  if (trapped && t.captureStatusMult.trap) statusMult = Math.max(statusMult, t.captureStatusMult.trap);
  const raw = (catchRate / 255) * hpFactor * lantern.mult * statusMult;
  const bonus = Math.min(t.captureFailCap, Math.max(0, fails) * t.captureFailBonus);
  return Math.max(t.captureOddsMin, Math.min(t.captureOddsMax, raw + bonus));
}

/**
 * The band word shown instead of exact odds (Freefall).
 * @param {number} odds
 * @param {Partial<typeof DEFAULTS>} [tuning]
 * @returns {string}
 */
export function captureBand(odds, tuning) {
  const bands = tun(tuning).captureBands;
  for (const [limit, word] of bands) if (odds < limit) return word;
  return bands[bands.length - 1][1];
}

/**
 * Catch-up EXP multiplier for a creature `level` against the island curve.
 * Never below 1: over-curve damping is a separate, Rematch-only rule.
 * @param {number} level
 * @param {number|null} curveLevel
 * @param {Partial<typeof DEFAULTS>} [tuning]
 * @returns {number}
 */
export function catchUpMult(level, curveLevel, tuning) {
  if (curveLevel == null) return 1;
  const t = tun(tuning);
  const under = Math.max(0, curveLevel - level);
  return Math.min(t.catchUpCap, 1 + t.catchUpStep * Math.floor(under / t.catchUpEvery));
}

// ---------------------------------------------------------------------------
// Type chart
// ---------------------------------------------------------------------------

/**
 * @param {number} mult
 * @returns {'Strong'|'Neutral'|'Weak'|'Blocked'}
 */
export function wordFor(mult) {
  if (mult === 0) return WORDS.BLOCKED;
  if (mult > 1) return WORDS.STRONG;
  if (mult < 1) return WORDS.WEAK;
  return WORDS.NEUTRAL;
}

/**
 * @typedef {Object} TypeChart
 * @property {readonly string[]} types       every type name, chart order
 * @property {readonly string[]} ordinary    the types a Ward readout lists (defaults to `types`)
 * @property {(attack: string|null, defend: string) => number} mult   single pair; `null` attack is typeless (1)
 * @property {(moveType: string|null, defenderTypes: readonly string[]) => {mult: number, word: string}} effectiveness
 * @property {(type: string) => boolean} has
 */

/**
 * Builds the chart lookups from a data table: rows attack, columns defend, dual
 * types multiply. Throws a readable RangeError for an unknown type at lookup.
 * @param {Readonly<Record<string, Readonly<Record<string, number>>>>} table
 * @param {readonly string[]} [ordinary] types shown in Ward readouts (default: every row)
 * @returns {TypeChart}
 * @throws {TypeError} when the table is missing or not square
 */
export function createTypeChart(table, ordinary) {
  if (!table || typeof table !== 'object') throw new TypeError('createTypeChart: a chart table {attack: {defend: mult}} is required');
  const types = Object.freeze(Object.keys(table));
  for (const a of types) {
    const row = table[a];
    if (!row || typeof row !== 'object') throw new TypeError(`createTypeChart: row ${a} is not an object`);
    for (const d of types) {
      const v = row[d];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new TypeError(`createTypeChart: ${a} -> ${d} must be a finite number >= 0, got ${String(v)}`);
    }
  }
  const ord = Object.freeze((ordinary || types).slice());
  for (const t of ord) if (!table[t]) throw new TypeError(`createTypeChart: ordinary type ${t} is not in the chart`);
  const mult = (attack, defend) => {
    if (attack == null) {
      if (!table[defend]) throw new RangeError(`chart: unknown defending type ${String(defend)}`);
      return 1;
    }
    const row = table[attack];
    if (!row) throw new RangeError(`chart: unknown attacking type ${String(attack)}`);
    const v = row[defend];
    if (v === undefined) throw new RangeError(`chart: unknown defending type ${String(defend)}`);
    return v;
  };
  const effectiveness = (moveType, defenderTypes) => {
    let m = 1;
    for (const d of defenderTypes) m *= mult(moveType, d);
    return { mult: m, word: wordFor(m) };
  };
  return Object.freeze({ types, ordinary: ord, mult, effectiveness, has: (t) => Object.prototype.hasOwnProperty.call(table, t) });
}

/**
 * Ordinary types that hit the given defender for Strong damage.
 * @param {TypeChart} chart
 * @param {readonly string[]} defenderTypes
 * @returns {string[]}
 */
export function strongTypesAgainst(chart, defenderTypes) {
  return chart.ordinary.filter((t) => chart.effectiveness(t, defenderTypes).mult > 1);
}

/**
 * Ordinary types the given defender is immune to (chart 0).
 * @param {TypeChart} chart
 * @param {readonly string[]} defenderTypes
 * @returns {string[]}
 */
export function immuneTypesOf(chart, defenderTypes) {
  return chart.ordinary.filter((t) => chart.effectiveness(t, defenderTypes).mult === 0);
}

// ---------------------------------------------------------------------------
// Wards
// ---------------------------------------------------------------------------

/**
 * @typedef {{kind: 'strong-only'|'no-status'|'min-power', minPower?: number}} Ward
 * @typedef {{name: string, ward?: Ward|null}} WardHolder
 */

/** @param {WardHolder|null|undefined} ability @returns {boolean} */
export function isWard(ability) {
  return !!(ability && ability.ward);
}

/**
 * Whether a Ward lets a given technique through. Immune (mult 0) hits never
 * land either way; Scrap never pierces a Ward; chip damage is not a hit and is
 * never checked here.
 * - `strong-only`: only Strong hits land (status moves pass)
 * - `no-status`: status moves aimed at the holder fail
 * - `min-power`: hits under `ward.minPower` do nothing
 * @param {WardHolder|null} ability the defender's effective ability (may be a non-Ward or null)
 * @param {Move} move
 * @param {readonly string[]} defenderTypes
 * @param {string|null} moveType the type the move hits with (see {@link moveTypeFor})
 * @param {TypeChart} chart
 * @param {{plumblineIgnoresWards?: boolean}} [opts] `plumblineIgnoresWards`: a `plumbline` move passes every Ward
 *   (GDD-00 ruling: the Mirror Spire's disc must answer Mirrorveil); the engine passes its tuning flag
 * @returns {{lands: boolean, reason: 'ward'|'immune'|null, eff: {mult: number, word: string}}}
 */
export function wardCheck(ability, move, defenderTypes, moveType, chart, opts = {}) {
  const eff = move.category === 'status' ? { mult: 1, word: WORDS.NEUTRAL } : chart.effectiveness(moveType, defenderTypes);
  if (move.category !== 'status' && eff.mult === 0) return { lands: false, reason: 'immune', eff };
  const ward = ability && ability.ward;
  if (!ward) return { lands: true, reason: null, eff };
  if (move.effect.scrap) return { lands: false, reason: 'ward', eff };
  if (move.effect.plumbline && opts.plumblineIgnoresWards) return { lands: true, reason: null, eff };
  switch (ward.kind) {
    case 'strong-only':
      if (move.category === 'status') return { lands: true, reason: null, eff };
      return eff.mult > 1 ? { lands: true, reason: null, eff } : { lands: false, reason: 'ward', eff };
    case 'no-status':
      return move.category === 'status' ? { lands: false, reason: 'ward', eff } : { lands: true, reason: null, eff };
    case 'min-power':
      if (move.category === 'status') return { lands: true, reason: null, eff };
      return move.power < (ward.minPower ?? 0) ? { lands: false, reason: 'ward', eff } : { lands: true, reason: null, eff };
    default:
      return { lands: true, reason: null, eff };
  }
}

/**
 * The one-line header of a Ward readout, e.g.
 * "Glasshide held. Only Strong hits get through."
 * @param {WardHolder} ability
 * @returns {string}
 */
export function wardHeldText(ability) {
  switch (ability.ward && ability.ward.kind) {
    case 'strong-only': return `${ability.name} held. Only Strong hits get through.`;
    case 'no-status': return `${ability.name} held. Status techniques fail against it.`;
    case 'min-power': return `${ability.name} held. Hits under ${ability.ward.minPower} power do nothing.`;
    default: return `${ability.name} held.`;
  }
}

/**
 * The indirect damage a Ward lets through, for the readout.
 * @param {WardHolder} ability
 * @returns {string[]}
 */
export function wardIndirect(ability) {
  return ability.ward && ability.ward.kind === 'no-status'
    ? ['poison (from a damaging hit)', 'burn (from a damaging hit)']
    : CHIP_KINDS.slice();
}
