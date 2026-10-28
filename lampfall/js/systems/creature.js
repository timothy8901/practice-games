/**
 * Creature records: build, stats, moves and Memory, EXP gain, Shift recompute with the per-stat
 * floor, healing, Bond, held item, Heartmark technique, (de)serialization. [RULES-CREATURE]
 *
 * Adopted from `proto/battle/creature.js` with the ARCHITECTURE §8.4 / §5.1 changes:
 *  - `makeCreature` takes a string `uid` (allocated by `party.nextUid`) and never generates one;
 *  - the record is exactly the World `Creature` typedef (`state/schema.creatureDefaults` keys), with
 *    `familyId`, `mark`, `windowsUsed`, `stillKnot`, `caughtDay`, `caughtMap` added;
 *  - content arrives as a `data` argument (Registry or tables, see {@link dataLookup}); no table
 *    is imported and no species, move or type is named here;
 *  - every tunable number is a key of the frozen {@link DEFAULTS}, overridable per call with
 *    `opts.tuning` (level cap and growth curves are read from `systems/exp`'s tuning);
 *  - `shiftTo` does not touch `shiftCount` (that counts Shift-stream draws and belongs to
 *    systems/forecast), and keeps `familyId` (the individual's family, not the form's);
 *  - levels and EXP sit on the individual's growth curve (its first form's, {@link growthOf}), not
 *    the current form's, so a Shift never re-levels a creature (rules §2.6).
 *
 * Randomness: only the injected `rng` (`core/rng` Rng). `makeCreature` draws the per-individual
 * Heartmark placement from `rng.fork('heartmark:<uid>')` and an Unfixed type loop from
 * `rng.fork('unfixed:<uid>')` ({@link creatureStream}), so neither consumes draws from the caller's
 * stream and two creatures built from one rng still differ; without an rng the mark is `{x:0, y:0}`
 * and the loop is a fixed pick.
 *
 * Functions mutate the creature passed in (callers run them inside `store.tx` on a world creature,
 * or on a battle copy) and return a plain result. Pure: no DOM.
 * @module systems/creature
 */

import { LEVEL_MAX, MOVE_SLOTS as SCHEMA_MOVE_SLOTS, TRAINED_MAX as SCHEMA_TRAINED_MAX, STAT_KEYS, STATUS_KINDS, creatureDefaults } from '../state/schema.js';
import { dataLookup, expForLevel, levelFromExp, expBand, tuningOf as expTuningOf } from './exp.js';

export { dataLookup, STAT_KEYS };

/** @typedef {import('../state/schema.js').Creature} Creature */
/** @typedef {import('../state/schema.js').StatBlock} StatBlock */
/** @typedef {import('./exp.js').SpeciesInfo} SpeciesInfo */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {'drift'|'flux'|'freefall'} Dial */

/**
 * @typedef {Object} CreatureTuning
 * @property {number} MOVE_SLOTS             move slots (≤ schema MOVE_SLOTS)
 * @property {number} MENDS_PER_BATTLE       Mends budget restored by healFull / at battle start
 * @property {number} MAX_BOND               Bond pips cap (≤ 5, the schema bound)
 * @property {number} TRAINED_MAX            trained points cap per stat (≤ schema TRAINED_MAX)
 * @property {number} TRAINED_DIVISOR        stat formula: trained points / this add to 2 × base
 * @property {number} HP_FLAT                stat formula: HP = core + level + HP_FLAT
 * @property {number} STAT_FLAT              stat formula: other stats = core + STAT_FLAT
 * @property {Record<string, number|null>} STAT_FLOOR   per dial: max fraction any one base stat may drop in one Shift (null = no floor)
 * @property {{x: number, y: number}} MARK_SPREAD      Heartmark placement offset drawn in [-x, x] × [-y, y] sprite pixels
 * @property {number} UNFIXED_PICKS          seeded types after the lead type in an Unfixed loop
 * @property {string|null} FALLBACK_MOVE     move given when a creature would have none (null = the form's first learnset move)
 * @property {number} DEFAULT_LEVEL          level when makeCreature gets none
 * @property {number} PP_RESTORE_DEFAULT     PP restored per move by restorePp without an amount
 */

/**
 * Designer-tunable defaults (rules §2.7, §4.3, §9.3, §22.3; prototype stat formula). [GDD values]
 * @type {Readonly<CreatureTuning>}
 */
export const DEFAULTS = deepFreeze({
  MOVE_SLOTS: 4,
  MENDS_PER_BATTLE: 3,
  MAX_BOND: 5,
  TRAINED_MAX: 252,
  TRAINED_DIVISOR: 4,
  HP_FLAT: 10,
  STAT_FLAT: 5,
  STAT_FLOOR: { drift: 0.1, flux: 0.2, freefall: null },
  MARK_SPREAD: { x: 2, y: 2 },
  UNFIXED_PICKS: 3,
  FALLBACK_MOVE: null,
  DEFAULT_LEVEL: 5,
  PP_RESTORE_DEFAULT: 10,
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const nonNegInt = (v) => Number.isInteger(v) && v >= 0;
const posInt = (v) => Number.isInteger(v) && v >= 1;

/** @type {Record<keyof CreatureTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  MOVE_SLOTS: [(v) => posInt(v) && v <= SCHEMA_MOVE_SLOTS, `integer 1..${SCHEMA_MOVE_SLOTS}`],
  MENDS_PER_BATTLE: [nonNegInt, 'integer ≥ 0'],
  MAX_BOND: [(v) => nonNegInt(v) && v <= 5, 'integer 0..5'],
  TRAINED_MAX: [(v) => nonNegInt(v) && v <= SCHEMA_TRAINED_MAX, `integer 0..${SCHEMA_TRAINED_MAX}`],
  TRAINED_DIVISOR: [posInt, 'integer ≥ 1'],
  HP_FLAT: [Number.isInteger, 'integer'],
  STAT_FLAT: [Number.isInteger, 'integer'],
  STAT_FLOOR: [(v) => v && typeof v === 'object' && Object.values(v).every((f) => f === null || (isNum(f) && f >= 0 && f <= 1)), '{dial: fraction 0..1 | null}'],
  MARK_SPREAD: [(v) => v && nonNegInt(v.x) && nonNegInt(v.y), '{x: integer ≥ 0, y: integer ≥ 0}'],
  UNFIXED_PICKS: [nonNegInt, 'integer ≥ 0'],
  FALLBACK_MOVE: [(v) => v === null || (typeof v === 'string' && v.length > 0), 'move id | null'],
  DEFAULT_LEVEL: [(v) => posInt(v) && v <= LEVEL_MAX, `integer 1..${LEVEL_MAX}`],
  PP_RESTORE_DEFAULT: [nonNegInt, 'integer ≥ 0'],
};

/** Every tuning key this module reads (MAX_LEVEL and GROWTH_CURVES come from systems/exp). */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** @type {WeakMap<object, Readonly<CreatureTuning>>} */
const TUNING_CACHE = new WeakMap();

/**
 * Resolves a partial tuning override over {@link DEFAULTS}. Keys of other modules are ignored.
 * Cached per override object only when that object is frozen (mutable overrides are re-read).
 * @param {Partial<CreatureTuning>|null|undefined} [tuning]
 * @returns {Readonly<CreatureTuning>}
 * @throws {TypeError} when a known key has a malformed value
 */
export function tuningOf(tuning) {
  if (tuning == null) return DEFAULTS;
  if (typeof tuning !== 'object') throw new TypeError('creature.tuningOf: tuning must be an object');
  const cacheable = Object.isFrozen(tuning);
  const hit = cacheable ? TUNING_CACHE.get(tuning) : undefined;
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(tuning, key)) continue;
    const v = /** @type {any} */ (tuning)[key];
    const [pred, desc] = SPEC[/** @type {keyof CreatureTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`creature tuning ${key}: expected ${desc}, got ${JSON.stringify(v)}`);
    out[key] = v;
  }
  const frozen = deepFreeze(out);
  if (cacheable) TUNING_CACHE.set(tuning, frozen);
  return frozen;
}

/** @typedef {{tuning?: Record<string, any>|null}} TuningOpts */

// ---------------------------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------------------------

/** @returns {StatBlock} */
function zeroStats() {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/**
 * Computes the six stats: `core = floor((2·base + floor(trained / TRAINED_DIVISOR)) · level / 100)`;
 * HP = core + level + HP_FLAT (then × hpMultiplier, at least 1); others = core + STAT_FLAT.
 * @param {StatBlock} base
 * @param {number} level
 * @param {Partial<StatBlock>} trained
 * @param {number} [hpMultiplier=1]   species flag (e.g. a quartered-HP form)
 * @param {TuningOpts} [opts]
 * @returns {StatBlock}
 */
export function computeStats(base, level, trained, hpMultiplier = 1, opts = {}) {
  const t = tuningOf(opts.tuning);
  /** @type {any} */
  const out = {};
  for (const k of STAT_KEYS) {
    const tr = (trained && trained[k]) || 0;
    const core = Math.floor(((2 * base[k] + Math.floor(tr / t.TRAINED_DIVISOR)) * level) / 100);
    out[k] = k === 'hp' ? core + level + t.HP_FLAT : core + t.STAT_FLAT;
  }
  out.hp = Math.max(1, Math.floor(out.hp * (isNum(hpMultiplier) ? hpMultiplier : 1)));
  return out;
}

/** @param {SpeciesInfo} sp */
function hpMult(sp) {
  return isNum(sp.flags.hpMultiplier) ? sp.flags.hpMultiplier : 1;
}

/**
 * Recomputes stats after a level, base or trained change, keeping the HP ratio (a creature at half
 * HP stays at half HP; a fainted one stays at 0; a conscious one keeps at least 1).
 * @param {Creature} c
 * @param {any} data
 * @param {TuningOpts} [opts]
 * @returns {Creature}
 */
export function recomputeStats(c, data, opts = {}) {
  const sp = dataLookup(data).species(c.speciesId);
  const ratio = hpRatio(c);
  const fainted = c.hp <= 0;
  c.stats = computeStats(c.base, c.level, c.trained, hpMult(sp), opts);
  c.hp = fainted ? 0 : Math.max(1, Math.min(c.stats.hp, Math.round(c.stats.hp * ratio)));
  return c;
}

/**
 * The creature's current form, normalized.
 * @param {Creature} c
 * @param {any} data
 * @returns {SpeciesInfo}
 */
export function speciesOf(c, data) {
  return dataLookup(data).species(c.speciesId);
}

/** @param {Creature} c @returns {boolean} */
export function isFainted(c) {
  return c.hp <= 0;
}

/** @param {Creature} c @returns {number} 0..1 */
export function hpRatio(c) {
  return c.stats && c.stats.hp > 0 ? Math.max(0, Math.min(1, c.hp / c.stats.hp)) : 0;
}

/**
 * Current type list (an Unfixed loop shows its current entry).
 * @param {Creature} c
 * @returns {string[]}
 */
export function currentTypes(c) {
  if (Array.isArray(c.typeQueue) && c.typeQueue.length) return [c.typeQueue[c.typeIndex % c.typeQueue.length]];
  return c.types;
}

// ---------------------------------------------------------------------------------------------
// Learnsets and moves
// ---------------------------------------------------------------------------------------------

/**
 * Moves a form knows by `level` (learnset entries at or below it, in learn order, de-duplicated).
 * @param {SpeciesInfo} sp   from {@link speciesOf} or `dataLookup(data).species(id)`
 * @param {number} level
 * @returns {string[]}
 */
export function learnableAt(sp, level) {
  const out = [];
  for (const e of sp.learnset) if (e.level <= level && !out.includes(e.move)) out.push(e.move);
  return out;
}

/**
 * Whether a form can learn a move: its learnset or its disc list `flags.teachable` (GDD-03 §6.2).
 * Read by Shifts (a move the new form can learn keeps its slot), Memory relearn and disc teaching.
 * @param {SpeciesInfo} sp
 * @param {string} moveId
 * @returns {boolean}
 */
export function canLearn(sp, moveId) {
  return sp.learnset.some((e) => e.move === moveId) || (Array.isArray(sp.flags?.teachable) && sp.flags.teachable.includes(moveId));
}

/**
 * Where a creature stands for a disc (the learner strip): already knows the move, its current form
 * can be taught it ({@link canLearn}), or not. A form missing from `data` reads as `'cannot'`.
 * @param {Pick<Creature, 'speciesId'|'moves'>} c
 * @param {string} moveId
 * @param {any} data
 * @returns {'knows'|'can'|'cannot'}
 */
export function canTeach(c, moveId, data) {
  if ((c?.moves ?? []).some((m) => m.id === moveId)) return 'knows';
  const sp = c ? dataLookup(data).speciesOrNull(c.speciesId) : null;
  return sp && canLearn(sp, moveId) ? 'can' : 'cannot';
}

/**
 * Teaches a move by disc (systems/bag `teach` effect) with the rules checked here, not only in the
 * menu: refuses an unknown move, a move already known, a move the current form cannot learn
 * ({@link canTeach}), a full set without a valid `opts.replaceIndex`, and a replacement aimed at the
 * Heartmark technique; otherwise {@link learnMove}. Nothing changes on a refusal.
 * @param {Creature} c
 * @param {string} moveId
 * @param {any} data
 * @param {TuningOpts & {replaceIndex?: number}} [opts]
 * @returns {{ok: true, move: string, replaced: string|null}|{ok: false, reason: 'unknown-move'|'knows'|'cannot-learn'|'full'|'heartmark'}}
 */
export function teachMove(c, moveId, data, opts = {}) {
  if (typeof moveId !== 'string' || !dataLookup(data).moveOrNull(moveId)) return { ok: false, reason: 'unknown-move' };
  const state = canTeach(c, moveId, data);
  if (state === 'knows') return { ok: false, reason: 'knows' };
  if (state === 'cannot') return { ok: false, reason: 'cannot-learn' };
  const full = c.moves.length >= tuningOf(opts.tuning).MOVE_SLOTS;
  const i = opts.replaceIndex;
  if (full && !(Number.isInteger(i) && /** @type {number} */ (i) >= 0 && /** @type {number} */ (i) < c.moves.length)) return { ok: false, reason: 'full' };
  const replaced = full ? c.moves[/** @type {number} */ (i)].id : null;
  if (full && replaced === c.heartmark) return { ok: false, reason: 'heartmark' };
  if (!learnMove(c, moveId, data, opts)) return { ok: false, reason: 'full' };
  return { ok: true, move: moveId, replaced };
}

/**
 * The move a creature gets when it would otherwise have none: FALLBACK_MOVE, else the form's
 * first move learnable at `level`, else its lowest-level learnset move, else null.
 * @param {SpeciesInfo} sp
 * @param {number} level
 * @param {Readonly<CreatureTuning>} t
 * @returns {string|null}
 */
function fallbackMove(sp, level, t) {
  if (t.FALLBACK_MOVE) return t.FALLBACK_MOVE;
  const at = learnableAt(sp, level);
  if (at.length) return at[0];
  const sorted = sp.learnset.slice().sort((a, b) => a.level - b.level);
  return sorted.length ? sorted[0].move : null;
}

/**
 * Default move slots: the last MOVE_SLOTS learnset moves at this level, with the Heartmark
 * technique pinned into the first slot when the creature has one.
 * @param {string} speciesId
 * @param {number} level
 * @param {string|null} heartmark
 * @param {any} data
 * @param {TuningOpts} [opts]
 * @returns {string[]}
 */
export function defaultMoves(speciesId, level, heartmark, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const sp = dataLookup(data).species(speciesId);
  let ids = learnableAt(sp, level).slice(-t.MOVE_SLOTS);
  if (heartmark && !ids.includes(heartmark)) {
    if (ids.length >= t.MOVE_SLOTS) ids = ids.slice(1);
    ids.unshift(heartmark);
  }
  if (ids.length === 0) {
    const fb = fallbackMove(sp, level, t);
    if (fb) ids = [fb];
  }
  return ids;
}

/**
 * @param {import('./exp.js').DataLookup} look
 * @param {string} id
 * @returns {{id: string, pp: number, maxPp: number}}
 */
function slot(look, id) {
  const mv = look.move(id);
  const pp = nonNegInt(mv.pp) ? mv.pp : 0;
  return { id, pp, maxPp: pp };
}

/**
 * Puts a move into a free slot, or over `opts.replaceIndex` when all slots are full. Refuses a move
 * already known, a full set without a valid replacement index, and replacing the Heartmark technique.
 * @param {Creature} c
 * @param {string} moveId
 * @param {any} data
 * @param {TuningOpts & {replaceIndex?: number}} [opts]
 * @returns {boolean}
 * @throws {RangeError} for an unknown move
 */
export function learnMove(c, moveId, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const look = dataLookup(data);
  look.move(moveId);
  if (c.moves.some((m) => m.id === moveId)) return false;
  if (c.moves.length < t.MOVE_SLOTS) {
    c.moves.push(slot(look, moveId));
    return true;
  }
  const i = opts.replaceIndex;
  if (!Number.isInteger(i) || i < 0 || i >= c.moves.length) return false;
  if (c.moves[i].id === c.heartmark) return false;
  c.moves[i] = slot(look, moveId);
  return true;
}

/**
 * Forgets the move in slot `index`. Refuses the Heartmark technique and the last move.
 * @param {Creature} c
 * @param {number} index
 * @returns {boolean}
 */
export function forgetMove(c, index) {
  if (!Number.isInteger(index) || index < 0 || index >= c.moves.length) return false;
  if (c.moves.length <= 1 || c.moves[index].id === c.heartmark) return false;
  c.moves.splice(index, 1);
  return true;
}

/**
 * Memory moves the current form can use again (rules §5.3: relearned free at a Shelter).
 * @param {Creature} c
 * @param {any} data
 * @returns {string[]}
 */
export function relearnable(c, data) {
  const sp = speciesOf(c, data);
  return c.memory.filter((id, i) => c.memory.indexOf(id) === i && canLearn(sp, id) && !c.moves.some((m) => m.id === id));
}

/**
 * Relearns a Memory move the current form can learn (into a free slot or over
 * `opts.replaceIndex`) and removes it from Memory.
 * @param {Creature} c
 * @param {string} moveId
 * @param {any} data
 * @param {TuningOpts & {replaceIndex?: number}} [opts]
 * @returns {boolean}
 */
export function relearnFromMemory(c, moveId, data, opts = {}) {
  const i = c.memory.indexOf(moveId);
  if (i < 0 || !canLearn(speciesOf(c, data), moveId)) return false;
  if (!learnMove(c, moveId, data, opts)) return false;
  c.memory.splice(i, 1);
  return true;
}

/**
 * Pins the Heartmark technique (rules §5.2: chosen at the first Shift; usable in every form). The
 * move must be one of the creature's current moves. Refuses when one is already pinned unless
 * `opts.force`. `heartmarkStab` records whether it matched the creature's types when pinned (it then
 * keeps the same-type bonus in every body, Proposed rule).
 * @param {Creature} c
 * @param {string} moveId
 * @param {any} data
 * @param {{force?: boolean}} [opts]
 * @returns {{ok: true}|{ok: false, reason: 'not-known'|'already-pinned'}}
 * @throws {RangeError} for an unknown move
 */
export function pinHeartmarkTechnique(c, moveId, data, opts = {}) {
  const mv = dataLookup(data).move(moveId);
  if (!c.moves.some((m) => m.id === moveId)) return { ok: false, reason: 'not-known' };
  if (c.heartmark !== null && c.heartmark !== moveId && !opts.force) return { ok: false, reason: 'already-pinned' };
  c.heartmark = moveId;
  c.heartmarkStab = c.types.includes(mv.type);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------------------------

/**
 * Fork label prefixes. Labels carry the creature's uid (`heartmark:c17`, GDD-00's stream name), so
 * creatures built from the same rng still get their own placement and Unfixed loop.
 */
export const FORK_LABELS = Object.freeze({ mark: 'heartmark', unfixed: 'unfixed' });

/**
 * The per-creature sub-stream for one purpose: `rng.fork('<prefix>:<uid>')` when the rng can fork
 * (no draw is consumed from `rng`), else `rng` itself; null without an rng.
 * @param {Rng|null|undefined} rng
 * @param {'mark'|'unfixed'} purpose
 * @param {string} uid
 * @returns {Rng|null}
 */
export function creatureStream(rng, purpose, uid) {
  if (!rng) return null;
  return typeof rng.fork === 'function' ? rng.fork(`${FORK_LABELS[purpose]}:${uid}`) : rng;
}

/**
 * Draws a per-individual Heartmark placement: integer offsets in [-MARK_SPREAD.x, x] ×
 * [-MARK_SPREAD.y, y] from the form's Heartmark anchor, kept through every Shift (art/heartmark.js
 * adds the form's anchor). `{x:0, y:0}` without an rng.
 * @param {Rng|null} rng
 * @param {TuningOpts} [opts]
 * @returns {{x: number, y: number}}
 */
export function drawMark(rng, opts = {}) {
  const t = tuningOf(opts.tuning);
  if (!rng) return { x: 0, y: 0 };
  const x = rng.int(-t.MARK_SPREAD.x, t.MARK_SPREAD.x);
  const y = rng.int(-t.MARK_SPREAD.y, t.MARK_SPREAD.y);
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y }; // never -0 (JSON round-trips must be equal)
}

/**
 * The four Heartmark body anchors, in roll order (GDD-00 §14; the same list as
 * `art/heartmark.ANCHOR_KEYS` and the schema's `mark.anchor` values; pure rules never import js/art).
 */
const MARK_ANCHORS = Object.freeze(['head', 'chest', 'back', 'tail']);

/** A lifetime body-part choice; old saves can still carry a legacy x/y offset. */
export function drawBodyMark(uid, rng) {
  let hash = 0x811c9dc5;
  for (const ch of `heartmark:${uid}`) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  const index = creatureStream(rng, 'mark', uid)?.int(0, MARK_ANCHORS.length - 1) ?? ((hash >>> 0) % MARK_ANCHORS.length);
  return { x: 0, y: 0, anchor: MARK_ANCHORS[index] };
}

/**
 * Whether an ability row is an Unfixed type loop (`unfixed: true`, or hook key `'unfixed'`).
 * @param {any} ability
 * @returns {boolean}
 */
export function isUnfixedAbility(ability) {
  return !!ability && (ability.unfixed === true || ability.hook === 'unfixed');
}

/**
 * Builds an Unfixed loop: the form's first type, then UNFIXED_PICKS distinct types drawn from the
 * types table minus the form's own types.
 * @param {readonly string[]} formTypes
 * @param {readonly string[]} typeNames
 * @param {Rng|null} rng   null = a fixed, deterministic pick
 * @param {TuningOpts} [opts]
 * @returns {string[]}
 */
export function buildTypeQueue(formTypes, typeNames, rng, opts = {}) {
  const t = tuningOf(opts.tuning);
  const pool = typeNames.filter((n, i) => !formTypes.includes(n) && typeNames.indexOf(n) === i);
  const picks = [];
  const n = Math.min(t.UNFIXED_PICKS, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = rng ? rng.int(0, pool.length - 1) : (i * 5) % pool.length;
    picks.push(pool.splice(idx, 1)[0]);
  }
  return [formTypes[0], ...picks];
}

/**
 * @typedef {Object} MakeCreatureOpts
 * @property {string} uid                      required; from `party.nextUid(world)` (or a battle-local id for foes)
 * @property {string} speciesId
 * @property {number} [level]                  default DEFAULT_LEVEL; clamped to 1..MAX_LEVEL
 * @property {number} [exp]                    total EXP; clamped into the level's band (default: the level's threshold)
 * @property {string} [nickname]               default: the form's name
 * @property {Rng|null} [rng]                  Heartmark placement + Unfixed loop (forked by label + uid)
 * @property {Partial<StatBlock>} [trained]
 * @property {string|null} [heldItem]          a held item whose row stops Shifts ({@link itemBlocksShift}) sets `stillKnot`
 * @property {number} [bond]
 * @property {string[]} [moves]                explicit move ids (max MOVE_SLOTS)
 * @property {string|null} [heartmark]         default: the form's fixed Heartmark technique
 * @property {{x: number, y: number}} [mark]   explicit placement (skips the draw)
 * @property {boolean} [wild]
 * @property {number} [caughtDay]
 * @property {string} [caughtMap]
 * @property {Record<string, any>|null} [tuning]
 */

/**
 * Builds a creature record with every World `Creature` key, at full HP.
 * @param {MakeCreatureOpts} opts
 * @param {any} data
 * @returns {Creature}
 * @throws {TypeError} without a non-empty string uid; {RangeError} for unknown content ids
 */
export function makeCreature(opts, data) {
  if (!opts || typeof opts !== 'object') throw new TypeError('makeCreature: opts must be an object');
  if (typeof opts.uid !== 'string' || opts.uid.length === 0) {
    throw new TypeError('makeCreature: opts.uid must be a non-empty string (allocate it with party.nextUid)');
  }
  if (opts.moves !== undefined && opts.moves !== null && !(Array.isArray(opts.moves) && opts.moves.every((id) => typeof id === 'string'))) {
    throw new TypeError('makeCreature: opts.moves must be an array of move ids');
  }
  if (opts.heldItem !== undefined && opts.heldItem !== null && typeof opts.heldItem !== 'string') {
    throw new TypeError('makeCreature: opts.heldItem must be an item id or null');
  }
  const t = tuningOf(opts.tuning);
  const et = expTuningOf(opts.tuning);
  const look = dataLookup(data);
  const sp = look.species(opts.speciesId);
  const rawLevel = isNum(opts.level) ? opts.level : t.DEFAULT_LEVEL;
  const level = Math.max(1, Math.min(et.MAX_LEVEL, Math.floor(rawLevel)));
  const trained = clampTrained(opts.trained, t);
  const heartmark = opts.heartmark === undefined ? sp.heartmark : opts.heartmark;
  const hmMove = heartmark ? look.move(heartmark) : null;
  const base = { ...sp.base };
  const stats = computeStats(base, level, trained, hpMult(sp), opts);

  let moveIds = opts.moves
    ? opts.moves.filter((id, i) => opts.moves.indexOf(id) === i).slice(0, t.MOVE_SLOTS)
    : defaultMoves(sp.id, level, heartmark, data, opts);
  if (heartmark && !moveIds.includes(heartmark)) {
    if (moveIds.length >= t.MOVE_SLOTS) moveIds = moveIds.slice(1);
    moveIds.unshift(heartmark);
  }
  if (moveIds.length === 0) {
    const fb = fallbackMove(sp, level, t);
    if (fb) moveIds = [fb];
  }

  const rng = opts.rng || null;
  const mark = opts.mark && Number.isInteger(opts.mark.x) && Number.isInteger(opts.mark.y)
    ? { x: opts.mark.x, y: opts.mark.y, ...(MARK_ANCHORS.includes(opts.mark.anchor) ? { anchor: opts.mark.anchor } : {}) }
    : drawBodyMark(opts.uid, rng);
  const typeQueue = isUnfixedAbility(look.ability(sp.ability))
    ? buildTypeQueue(sp.types, look.typeNames(), creatureStream(rng, 'unfixed', opts.uid), opts)
    : null;

  const [lo, hi] = expBand(sp.growth, level, opts);
  const exp = isNum(opts.exp) ? Math.max(lo, Math.min(hi, Math.floor(opts.exp))) : lo;
  const heldItem = opts.heldItem || null;

  return {
    uid: opts.uid,
    speciesId: sp.id,
    familyId: sp.familyId,
    nickname: typeof opts.nickname === 'string' && opts.nickname ? opts.nickname : sp.name,
    types: sp.types.slice(),
    ability: sp.ability,
    level,
    exp,
    base,
    trained,
    stats,
    hp: stats.hp,
    moves: moveIds.map((id) => slot(look, id)),
    memory: [],
    status: null,
    mends: t.MENDS_PER_BATTLE,
    bond: clampInt(opts.bond ?? 0, 0, t.MAX_BOND),
    heartmark: heartmark || null,
    heartmarkStab: !!hmMove && sp.types.includes(hmMove.type),
    mark,
    starTouched: opts.starTouched === true,
    shiftlog: [sp.id],
    shiftCount: 0,
    windowsUsed: [],
    stillKnot: blocksShifts(look, heldItem),
    heldItem,
    wild: !!opts.wild,
    typeQueue,
    typeIndex: 0,
    caughtDay: Number.isInteger(opts.caughtDay) ? opts.caughtDay : 0,
    caughtMap: typeof opts.caughtMap === 'string' ? opts.caughtMap : '',
  };
}

/**
 * @param {Partial<StatBlock>|undefined} trained
 * @param {Readonly<CreatureTuning>} t
 * @returns {StatBlock}
 */
function clampTrained(trained, t) {
  const out = zeroStats();
  for (const k of STAT_KEYS) {
    const v = trained && trained[k];
    out[k] = isNum(v) ? clampInt(v, 0, t.TRAINED_MAX) : 0;
  }
  return out;
}

/** @param {number} v @param {number} lo @param {number} hi */
function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.floor(isNum(v) ? v : lo)));
}

/**
 * Whether an item row stops every Shift while held (the Still Knot, GDD-00 §8). Item rows spell it
 * `held: {blocksShift: true}` (data/items.js, battle/heldItems); the older rule spelling
 * `blocksShifts: true` on the row (and the `held.blocksShifts` / row `blocksShift` variants the party
 * screen also reads) is accepted, so fixtures and older content keep working.
 * @param {any} row   an item row (null/undefined = not a Knot)
 * @returns {boolean}
 */
export function itemBlocksShift(row) {
  if (!row || typeof row !== 'object') return false;
  const held = row.held && typeof row.held === 'object' ? row.held : null;
  return row.blocksShifts === true || row.blocksShift === true || held?.blocksShift === true || held?.blocksShifts === true;
}

/**
 * @param {import('./exp.js').DataLookup} look
 * @param {string|null} itemId
 */
function blocksShifts(look, itemId) {
  if (!itemId) return false;
  return itemBlocksShift(look.itemOrNull(itemId));
}

// ---------------------------------------------------------------------------------------------
// Shift
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} ShiftResult
 * @property {string} from  @property {string} to
 * @property {string[]} kept        move ids kept in slots
 * @property {string[]} toMemory    move ids parked in Memory
 * @property {number} statDelta     base stat total after − before (floor applied)
 * @property {string[]} floored     stat keys the floor raised
 */

/**
 * Applies a Shift to a new form (rules §2.6, §2.7, §5.3). Level, EXP, held item, nickname, Bond,
 * trained points, the Heartmark technique (and its PP), Heartmark placement, family and Shift-stream
 * position are untouched. Per-stat floor: no base stat drops more than STAT_FLOOR[dial] of its
 * current value (null = no floor). Moves the new form can learn stay, the Heartmark technique always
 * stays, the rest go to Memory (no duplicates); a creature left with no move gets the fallback move.
 * Types and ability follow the form; an Unfixed form gets a loop (from `opts.rng`), others lose it.
 * The HP ratio is kept.
 * @param {Creature} c
 * @param {string} formId
 * @param {any} data
 * @param {Dial|string} dial
 * @param {TuningOpts & {heartmark?: string, rng?: Rng|null}} [opts]   `heartmark` pins a technique now (first Shift) when none is pinned
 * @returns {ShiftResult}
 * @throws {Error} when the current form never Shifts or the pinned technique is not a current move; {RangeError} for an unknown dial or form
 */
export function shiftTo(c, formId, data, dial, opts = {}) {
  const t = tuningOf(opts.tuning);
  const look = dataLookup(data);
  const from = look.species(c.speciesId);
  if (from.flags.neverShifts) throw new Error(`shiftTo: form ${JSON.stringify(from.id)} never Shifts`);
  if (typeof dial !== 'string' || !Object.prototype.hasOwnProperty.call(t.STAT_FLOOR, dial)) {
    throw new RangeError(`shiftTo: unknown dial ${JSON.stringify(dial)}`);
  }
  const to = look.species(formId);
  if (opts.heartmark !== undefined && c.heartmark === null) {
    const r = pinHeartmarkTechnique(c, opts.heartmark, data);
    if (!r.ok) throw new Error('shiftTo: the Heartmark technique must be one of the creature\'s current moves');
  }

  const floor = t.STAT_FLOOR[dial];
  const before = STAT_KEYS.reduce((a, k) => a + c.base[k], 0);
  /** @type {string[]} */
  const floored = [];
  /** @type {any} */
  const newBase = {};
  for (const k of STAT_KEYS) {
    let v = to.base[k];
    if (floor !== null) {
      const min = Math.ceil(c.base[k] * (1 - floor) - 1e-9);
      if (v < min) {
        v = min;
        floored.push(k);
      }
    }
    newBase[k] = v;
  }

  const kept = [];
  const toMemory = [];
  const moves = [];
  for (const m of c.moves) {
    if (m.id === c.heartmark || canLearn(to, m.id)) {
      kept.push(m.id);
      moves.push(m);
    } else {
      toMemory.push(m.id);
    }
  }
  if (moves.length === 0) {
    const fb = fallbackMove(to, c.level, t);
    if (fb) moves.push(slot(look, fb));
  }
  c.moves = moves;
  for (const id of toMemory) if (!c.memory.includes(id)) c.memory.push(id);
  // a move back in a slot is no longer parked
  c.memory = c.memory.filter((id) => !moves.some((m) => m.id === id));
  c.base = newBase;
  c.speciesId = to.id;
  c.starTouched = false;
  c.types = to.types.slice();
  c.ability = to.ability;
  if (isUnfixedAbility(look.ability(to.ability))) {
    if (!Array.isArray(c.typeQueue) || !c.typeQueue.length) c.typeQueue = buildTypeQueue(to.types, look.typeNames(), creatureStream(opts.rng, 'unfixed', c.uid), opts);
  } else {
    c.typeQueue = null;
  }
  c.typeIndex = 0;
  c.shiftlog.push(to.id);
  recomputeStats(c, data, opts);
  const after = STAT_KEYS.reduce((a, k) => a + c.base[k], 0);
  return { from: from.id, to: to.id, kept, toMemory, statDelta: after - before, floored };
}

// ---------------------------------------------------------------------------------------------
// EXP
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} GainResult
 * @property {number} gained       EXP actually added (0 at the cap)
 * @property {number} from  @property {number} to
 * @property {string[]} learned    learnset moves put into free slots on the way
 * @property {string[]} offers     learnset moves that found the slots full (resolve with learnMove)
 * @property {StatBlock} statsBefore  @property {StatBlock} statsAfter
 */

/**
 * Adds EXP, levels up (stats recomputed, HP ratio kept) and surfaces learnset moves of each new
 * level (from the current form's learnset). Levels follow the creature's own growth curve
 * ({@link growthOf}), which a Shift never changes. EXP stops at the MAX_LEVEL threshold. Does not open Shift windows: that is
 * `exp.detectWindows`, run on the world after a battle.
 * @param {Creature} c
 * @param {number} amount   negative counts as 0
 * @param {any} data
 * @param {TuningOpts} [opts]
 * @returns {GainResult}
 * @throws {TypeError} for a non-finite amount
 */
export function gainExp(c, amount, data, opts = {}) {
  if (!isNum(amount)) throw new TypeError(`gainExp: amount must be a finite number, got ${String(amount)}`);
  const et = expTuningOf(opts.tuning);
  const sp = speciesOf(c, data);
  const growth = growthOf(c, data);
  const from = c.level;
  const statsBefore = { ...c.stats };
  const cap = expForLevel(growth, et.MAX_LEVEL, opts);
  const prevExp = c.exp;
  c.exp = Math.max(c.exp, Math.min(cap, c.exp + Math.max(0, Math.floor(amount))));
  const target = Math.min(et.MAX_LEVEL, levelFromExp(growth, c.exp, opts));
  const learned = [];
  const offers = [];
  while (c.level < target) {
    c.level++;
    for (const e of sp.learnset) {
      if (e.level !== c.level || c.moves.some((m) => m.id === e.move) || learned.includes(e.move) || offers.includes(e.move)) continue;
      if (learnMove(c, e.move, data, opts)) learned.push(e.move);
      else offers.push(e.move);
    }
  }
  if (c.level !== from) recomputeStats(c, data, opts);
  return { gained: c.exp - prevExp, from, to: c.level, learned, offers, statsBefore, statsAfter: { ...c.stats } };
}

/**
 * EXP still needed for the next level (0 at the cap), on the creature's own curve ({@link growthOf}).
 * @param {Creature} c
 * @param {any} data
 * @param {TuningOpts} [opts]
 * @returns {number}
 */
export function expToNext(c, data, opts = {}) {
  const et = expTuningOf(opts.tuning);
  if (c.level >= et.MAX_LEVEL) return 0;
  return Math.max(0, expForLevel(growthOf(c, data), c.level + 1, opts) - c.exp);
}

/**
 * The growth curve id of an individual: its first form's (`shiftlog[0]`, the form it was born or
 * caught as), falling back to the current form when that row is gone. A Shift never touches level
 * or EXP (rules §2.6), so the curve those numbers sit on must not change with the form either:
 * reading the new form's curve would re-level the creature on its next EXP gain (the Chaos V2
 * re-read the rules reject) or make `deserialize` re-clamp its EXP.
 * @param {Pick<Creature, 'speciesId'|'shiftlog'>} c
 * @param {any} data
 * @returns {string}
 * @throws {RangeError} when neither the first nor the current form is known
 */
export function growthOf(c, data) {
  const look = dataLookup(data);
  const first = Array.isArray(c.shiftlog) && typeof c.shiftlog[0] === 'string' ? look.speciesOrNull(c.shiftlog[0]) : null;
  return (first ?? look.species(c.speciesId)).growth;
}

// ---------------------------------------------------------------------------------------------
// Care
// ---------------------------------------------------------------------------------------------

/**
 * Full restore outside battle: HP, PP, status, Mends.
 * @param {Creature} c
 * @param {TuningOpts} [opts]
 * @returns {Creature}
 */
export function healFull(c, opts = {}) {
  const t = tuningOf(opts.tuning);
  c.hp = c.stats.hp;
  c.status = null;
  c.mends = t.MENDS_PER_BATTLE;
  for (const m of c.moves) m.pp = m.maxPp;
  return c;
}

/**
 * Restores PP to one move or every move.
 * @param {Creature} c
 * @param {number|null} moveIndex   null = every move
 * @param {number} [amount]         default PP_RESTORE_DEFAULT
 * @param {TuningOpts} [opts]
 * @returns {Creature}
 */
export function restorePp(c, moveIndex, amount, opts = {}) {
  const t = tuningOf(opts.tuning);
  const n = isNum(amount) ? Math.max(0, Math.floor(amount)) : t.PP_RESTORE_DEFAULT;
  const list = moveIndex === null ? c.moves : [c.moves[moveIndex]].filter(Boolean);
  for (const m of list) m.pp = Math.min(m.maxPp, m.pp + n);
  return c;
}

/**
 * Adds (or removes, with a negative number) Bond pips, clamped to 0..MAX_BOND.
 * @param {Creature} c
 * @param {number} pips
 * @param {TuningOpts} [opts]
 * @returns {{from: number, to: number}}
 */
export function addBond(c, pips, opts = {}) {
  const t = tuningOf(opts.tuning);
  const from = c.bond;
  c.bond = clampInt(c.bond + (isNum(pips) ? Math.trunc(pips) : 0), 0, t.MAX_BOND);
  return { from, to: c.bond };
}

/**
 * Sets (or clears, with null) the held item. `stillKnot` follows the item row ({@link itemBlocksShift}).
 * On a world creature use `party.setHeldItem`, which also brings `pendingShifts` in line.
 * @param {Creature} c
 * @param {string|null} itemId
 * @param {any} data
 * @returns {{prev: string|null}}
 * @throws {TypeError} for an item id that is not a string or null
 */
export function setHeldItem(c, itemId, data) {
  if (itemId !== null && itemId !== undefined && typeof itemId !== 'string') throw new TypeError('setHeldItem: itemId must be an item id or null');
  const prev = c.heldItem;
  c.heldItem = itemId || null;
  c.stillKnot = blocksShifts(dataLookup(data), c.heldItem);
  return { prev };
}

// ---------------------------------------------------------------------------------------------
// (De)serialization
// ---------------------------------------------------------------------------------------------

const CREATURE_KEYS = Object.freeze(Object.keys(creatureDefaults()));

/**
 * Plain JSON deep copy holding exactly the World `Creature` keys (missing ones take their neutral
 * defaults). Used for the battle engine's side copies and for saves.
 * @param {Creature} c
 * @returns {Creature}
 */
export function serialize(c) {
  const d = /** @type {any} */ (creatureDefaults());
  /** @type {any} */
  const out = {};
  for (const k of CREATURE_KEYS) out[k] = c[k] === undefined ? d[k] : c[k];
  return JSON.parse(JSON.stringify(out));
}

/**
 * Rebuilds a creature from {@link serialize} output (or an older snapshot), self-healing: unknown
 * keys dropped, numbers clamped, a missing level read off the EXP, EXP clamped into the level's
 * band on the creature's own curve ({@link growthOf}), Memory ids that are not moves dropped, statuses outside the schema's kinds cleared, an empty move list given the fallback move,
 * `stillKnot` false without a held item (and following a known item row, {@link itemBlocksShift}), an
 * Unfixed creature's `types` reset to its form's (the loop position is `typeIndex`, wrapped into
 * the loop), and stats recomputed from base + level + trained.
 * @param {Record<string, any>} rec
 * @param {any} data
 * @param {TuningOpts} [opts]
 * @returns {Creature}
 * @throws {TypeError} for a non-object or a missing uid; {RangeError} for unknown content ids
 */
export function deserialize(rec, data, opts = {}) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new TypeError('deserialize: expected a creature record');
  if (typeof rec.uid !== 'string' || rec.uid.length === 0) throw new TypeError('deserialize: record has no string uid');
  const t = tuningOf(opts.tuning);
  const et = expTuningOf(opts.tuning);
  const look = dataLookup(data);
  const sp = look.species(rec.speciesId);
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const shiftlog = strs(rec.shiftlog);
  const growth = growthOf({ speciesId: sp.id, shiftlog }, data);
  // a record without a usable level reads it off its EXP (an older or hand-edited snapshot)
  const level = isNum(rec.level) ? clampInt(rec.level, 1, et.MAX_LEVEL)
    : isNum(rec.exp) ? levelFromExp(growth, Math.max(0, rec.exp), opts) : 1;
  const [lo, hi] = expBand(growth, level, opts);
  const base = { ...sp.base };
  if (rec.base && typeof rec.base === 'object') for (const k of STAT_KEYS) if (isNum(rec.base[k])) base[k] = Math.max(1, Math.floor(rec.base[k]));
  const moves = (Array.isArray(rec.moves) ? rec.moves : [])
    .filter((m) => m && typeof m.id === 'string')
    .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
    .slice(0, t.MOVE_SLOTS)
    .map((m) => {
      const s = slot(look, m.id);
      const maxPp = nonNegInt(m.maxPp) ? m.maxPp : s.maxPp;
      return { id: m.id, pp: clampInt(isNum(m.pp) ? m.pp : maxPp, 0, maxPp), maxPp };
    });
  if (moves.length === 0) {
    const fb = fallbackMove(sp, level, t);
    if (fb) moves.push(slot(look, fb));
  }
  const ability = typeof rec.ability === 'string' && look.abilityOrNull(rec.ability) ? rec.ability : sp.ability;
  const heartmark = typeof rec.heartmark === 'string' && rec.heartmark ? rec.heartmark : null;
  if (heartmark) look.move(heartmark);
  const queue = strs(rec.typeQueue);
  const typeQueue = queue.length ? queue : null;
  const status = rec.status && STATUS_KINDS.includes(rec.status.kind)
    ? { kind: rec.status.kind, turns: clampInt(rec.status.turns, 0, Number.MAX_SAFE_INTEGER) }
    : null;
  const heldItem = typeof rec.heldItem === 'string' && rec.heldItem ? rec.heldItem : null;
  // a Still Knot is a held item: none held, no Knot; a known item row decides; else trust the record
  const itemRow = heldItem ? look.itemOrNull(heldItem) : null;
  const stillKnot = !heldItem ? false : itemRow ? blocksShifts(look, heldItem) : rec.stillKnot === true;
  const windowsUsed = [...new Set((Array.isArray(rec.windowsUsed) ? rec.windowsUsed : []).filter(posInt))].sort((a, b) => a - b);
  const c = {
    uid: rec.uid,
    speciesId: sp.id,
    familyId: typeof rec.familyId === 'string' && rec.familyId ? rec.familyId : sp.familyId,
    nickname: typeof rec.nickname === 'string' && rec.nickname ? rec.nickname : sp.name,
    // an Unfixed creature's in-battle type lives in typeQueue/typeIndex; its record keeps the form's types
    types: !typeQueue && strs(rec.types).length ? strs(rec.types) : sp.types.slice(),
    ability,
    level,
    exp: isNum(rec.exp) ? Math.max(lo, Math.min(hi, Math.floor(rec.exp))) : lo,
    base,
    trained: clampTrained(rec.trained, t),
    stats: zeroStats(),
    hp: 0,
    moves,
    memory: [...new Set(strs(rec.memory))].filter((id) => look.moveOrNull(id) !== null),
    status,
    mends: nonNegInt(rec.mends) ? rec.mends : t.MENDS_PER_BATTLE,
    bond: clampInt(rec.bond ?? 0, 0, t.MAX_BOND),
    heartmark,
    heartmarkStab: rec.heartmarkStab === true,
    mark: rec.mark && Number.isInteger(rec.mark.x) && Number.isInteger(rec.mark.y)
      ? { x: rec.mark.x, y: rec.mark.y, ...(MARK_ANCHORS.includes(rec.mark.anchor) ? { anchor: rec.mark.anchor } : {}) }
      : { x: 0, y: 0 },
    starTouched: rec.starTouched === true,
    shiftlog: shiftlog.length ? shiftlog : [sp.id],
    shiftCount: nonNegInt(rec.shiftCount) ? rec.shiftCount : 0,
    windowsUsed,
    stillKnot,
    heldItem,
    wild: rec.wild === true,
    typeQueue,
    typeIndex: typeQueue ? ((clampInt(rec.typeIndex ?? 0, 0, Number.MAX_SAFE_INTEGER) % typeQueue.length) + typeQueue.length) % typeQueue.length : 0,
    caughtDay: Number.isInteger(rec.caughtDay) ? rec.caughtDay : 0,
    caughtMap: typeof rec.caughtMap === 'string' ? rec.caughtMap : '',
  };
  c.stats = computeStats(c.base, c.level, c.trained, hpMult(sp), opts);
  c.hp = isNum(rec.hp) ? clampInt(rec.hp, 0, c.stats.hp) : c.stats.hp;
  return c;
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
