/**
 * The creature pieces the battle engine needs at run time, ported from
 * proto/battle/creature.js: faint and HP-ratio checks, the stat formula used
 * when a level-up recomputes stats, move-slot learning and EXP gain with
 * level-ups. [BATTLE-RULES]
 *
 * Building, Shifting and (de)serializing creatures belongs to
 * `systems/creature.js` (RULES-CREATURE); the engine only levels up the deep
 * copies it was handed, and a caller may swap in another implementation
 * through `createBattle({gainExp})`.
 *
 * Content-agnostic: species rows, move rows and growth curves come from the
 * battle data view (`battle/data.js`). Pure: no DOM, no randomness.
 * @module battle/creatureOps
 */

import { mergeTuning } from './effects.js';

/** Stat keys in display order. */
export const STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);

/**
 * Designer-tunable creature numbers the engine uses.
 * @type {Readonly<{mendsPerBattle: number, maxLevel: number, moveSlots: number}>}
 */
export const DEFAULTS = Object.freeze({
  /** Recovery uses per creature per battle (reset at battle start). */
  mendsPerBattle: 3,
  /** Level cap. */
  maxLevel: 100,
  /** Move slots per creature. */
  moveSlots: 4,
});

/** Every key of {@link DEFAULTS}. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * The battle-facing slice of a Creature record (ARCHITECTURE §3.1). Extra
 * fields are carried through untouched.
 * @typedef {Object} BattleCreature
 * @property {string|number} uid  @property {string} speciesId  @property {string} nickname
 * @property {string[]} types  @property {string} ability  @property {number} level  @property {number} exp
 * @property {{hp:number, atk:number, def:number, spa:number, spd:number, spe:number}} base
 * @property {{hp:number, atk:number, def:number, spa:number, spd:number, spe:number}} trained
 * @property {{hp:number, atk:number, def:number, spa:number, spd:number, spe:number}} stats
 * @property {number} hp
 * @property {Array<{id: string, pp: number, maxPp: number}>} moves
 * @property {{kind: string, turns: number}|null} status
 * @property {number} mends  @property {string|null} heartmark  @property {boolean} heartmarkStab
 * @property {string|null} heldItem  @property {boolean} wild
 * @property {string[]|null} [typeQueue]  @property {number} [typeIndex]
 */

/** @param {BattleCreature} c @returns {boolean} */
export function isFainted(c) {
  return c.hp <= 0;
}

/** @param {BattleCreature} c @returns {number} 0..1 */
export function hpRatio(c) {
  return c.stats.hp > 0 ? Math.max(0, c.hp) / c.stats.hp : 0;
}

/**
 * The stat formula (no IVs; trained points add up to +63 at Lv100).
 * @param {BattleCreature['base']} base
 * @param {number} level
 * @param {Partial<BattleCreature['trained']>} [trained]
 * @param {number} [hpMultiplier=1] species flag (a quartered-HP form)
 * @returns {BattleCreature['stats']}
 */
export function computeStats(base, level, trained = {}, hpMultiplier = 1) {
  /** @type {any} */
  const out = {};
  for (const k of STAT_KEYS) {
    const core = Math.floor(((2 * base[k] + Math.floor((trained[k] || 0) / 4)) * level) / 100);
    out[k] = k === 'hp' ? core + level + 10 : core + 5;
  }
  out.hp = Math.max(1, Math.floor(out.hp * hpMultiplier));
  return out;
}

/**
 * Default growth curves: total EXP needed to be at `level`.
 * @type {Readonly<Record<string, (n: number) => number>>}
 */
export const GROWTH_CURVES = Object.freeze({
  fast: (n) => Math.floor((4 * n ** 3) / 5),
  'medium-fast': (n) => n ** 3,
  'medium-slow': (n) => Math.max(0, Math.floor(1.2 * n ** 3 - 15 * n ** 2 + 100 * n - 140)),
  slow: (n) => Math.floor((5 * n ** 3) / 4),
});

/**
 * Total EXP needed to be at `level` on a growth curve (default curves).
 * @param {string} growth
 * @param {number} level
 * @param {number} [maxLevel=DEFAULTS.maxLevel]
 * @returns {number}
 * @throws {RangeError} for an unknown curve
 */
export function expForLevel(growth, level, maxLevel = DEFAULTS.maxLevel) {
  const curve = GROWTH_CURVES[growth];
  if (!curve) throw new RangeError(`expForLevel: unknown growth ${String(growth)}`);
  const n = Math.max(1, Math.min(maxLevel, Math.floor(level)));
  return n === 1 ? 0 : curve(n);
}

/**
 * Level reached with `exp` total EXP on a growth curve (default curves).
 * @param {string} growth
 * @param {number} exp
 * @param {number} [maxLevel=DEFAULTS.maxLevel]
 * @returns {number} 1..maxLevel
 */
export function levelFromExp(growth, exp, maxLevel = DEFAULTS.maxLevel) {
  let lv = 1;
  while (lv < maxLevel && expForLevel(growth, lv + 1, maxLevel) <= exp) lv++;
  return lv;
}

/**
 * The data a creature op needs: species/move lookups and growth curves (the
 * battle data view satisfies it).
 * @typedef {Object} CreatureData
 * @property {(id: string) => {growth: string, learnset: ReadonlyArray<{level: number, move: string}>, flags: Record<string, any>}} species
 * @property {(id: string) => {pp: number|null}} move
 * @property {(growth: string, level: number) => number} [expForLevel]
 * @property {(growth: string, exp: number) => number} [levelFromExp]
 */

/**
 * Recomputes stats after a level change, keeping the HP ratio (a creature at
 * half HP stays at half HP; a fainted one stays fainted).
 * @param {BattleCreature} c
 * @param {CreatureData} data
 * @returns {BattleCreature}
 */
export function recomputeStats(c, data) {
  const species = data.species(c.speciesId);
  const ratio = hpRatio(c);
  const fainted = c.hp <= 0;
  c.stats = computeStats(c.base, c.level, c.trained || {}, (species.flags && species.flags.hpMultiplier) || 1);
  c.hp = fainted ? 0 : Math.max(1, Math.round(c.stats.hp * ratio));
  return c;
}

/**
 * A fresh move slot with full PP.
 * @param {CreatureData} data
 * @param {string} id
 * @returns {{id: string, pp: number, maxPp: number}}
 */
export function moveSlot(data, id) {
  const mv = data.move(id);
  const pp = mv.pp === null ? 0 : mv.pp;
  return { id, pp, maxPp: pp };
}

/**
 * Puts a move into a slot. Returns false when the creature already knows it,
 * when every slot is full and no replacement index was given, or when the
 * replacement slot holds the Heartmark technique.
 * @param {BattleCreature} c
 * @param {string} moveId
 * @param {CreatureData} data
 * @param {number} [replaceIndex]
 * @param {{tuning?: Partial<typeof DEFAULTS>}} [opts]
 * @returns {boolean}
 */
export function learnMove(c, moveId, data, replaceIndex, opts = {}) {
  const t = mergeTuning(DEFAULTS, pickKnown(opts.tuning), 'creatureOps');
  data.move(moveId);
  if (c.moves.some((m) => m.id === moveId)) return false;
  if (c.moves.length < t.moveSlots) {
    c.moves.push(moveSlot(data, moveId));
    return true;
  }
  if (replaceIndex === undefined || replaceIndex < 0 || replaceIndex >= c.moves.length) return false;
  if (c.moves[replaceIndex].id === c.heartmark) return false;
  c.moves[replaceIndex] = moveSlot(data, moveId);
  return true;
}

/**
 * @typedef {{from: number, to: number, learned: string[], offers: string[], statsBefore: BattleCreature['stats'], statsAfter: BattleCreature['stats']}} ExpGain
 */

/**
 * Adds EXP, levels up and surfaces new learnset moves. Moves learned at a new
 * level go into a free slot; when the slots are full they come back in
 * `offers` for the UI to resolve (each move at most once). Total EXP stops at
 * the max-level threshold.
 * @param {BattleCreature} c
 * @param {number} amount negative counts as 0
 * @param {CreatureData} data
 * @param {{tuning?: Partial<typeof DEFAULTS>}} [opts]
 * @returns {ExpGain}
 * @throws {TypeError} for a non-finite amount (a NaN would corrupt the saved EXP)
 */
export function gainExp(c, amount, data, opts = {}) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new TypeError(`gainExp: amount must be a finite number, got ${String(amount)}`);
  const t = mergeTuning(DEFAULTS, pickKnown(opts.tuning), 'creatureOps');
  const species = data.species(c.speciesId);
  const levelOf = data.levelFromExp || ((g, e) => levelFromExp(g, e, t.maxLevel));
  const expAt = data.expForLevel || ((g, l) => expForLevel(g, l, t.maxLevel));
  const from = c.level;
  const statsBefore = { ...c.stats };
  const cap = expAt(species.growth, t.maxLevel);
  const before = Number.isFinite(c.exp) ? c.exp : 0;
  c.exp = Math.max(before, Math.min(cap, before + Math.max(0, Math.floor(amount))));
  const target = Math.min(t.maxLevel, levelOf(species.growth, c.exp));
  const learned = [];
  const offers = [];
  while (c.level < target) {
    c.level++;
    for (const e of species.learnset) {
      if (e.level !== c.level || c.moves.some((m) => m.id === e.move) || offers.includes(e.move)) continue;
      if (learnMove(c, e.move, data, undefined, opts)) learned.push(e.move);
      else offers.push(e.move);
    }
  }
  if (c.level !== from) recomputeStats(c, data);
  return { from, to: c.level, learned, offers, statsBefore, statsAfter: { ...c.stats } };
}

/**
 * @param {Record<string, any>|undefined} tuning
 * @returns {Record<string, any>|undefined}
 */
function pickKnown(tuning) {
  if (!tuning) return undefined;
  const out = {};
  for (const k of Object.keys(tuning)) if (k in DEFAULTS) out[k] = tuning[k];
  return out;
}
