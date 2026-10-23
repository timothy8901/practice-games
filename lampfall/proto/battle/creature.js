/**
 * Creature instances: stats from base stats + level (+ trained points), move
 * slots with PP, status, Mends, Bond, Heartmark technique, Shiftlog, held item,
 * Shift recompute with the per-stat floor, EXP gain and (de)serialization.
 *
 * Pure: the only randomness is the injected `rng` (used for a uid and the
 * Unfixed type loop). No DOM.
 *
 * @module proto/battle/creature
 */

import { getSpecies, learnableAt, canLearn, expForLevel, levelFromExp } from './species.js';
import { getMove } from './moves.js';
import { getAbility } from './abilities.js';
import { ORDINARY_TYPES } from './types.js';

/** Fallback uid counter for creatures built without an rng or an explicit uid. */
let nextFallbackUid = 1;

/** Stat keys in display order. */
export const STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);

/** Mends per creature per battle (rules 10.1, lead decision). */
export const MENDS_PER_BATTLE = 3;

/** Max Bond pips. */
export const MAX_BOND = 5;

/** Move slots per creature. */
export const MOVE_SLOTS = 4;

/** Per-stat floor per Shift by dial (rules 2.7): max drop of any single base stat. */
export const STAT_FLOOR = Object.freeze({ drift: 0.1, flux: 0.2, freefall: null });

/** Max level. */
export const MAX_LEVEL = 100;

/**
 * @typedef {Object} Creature
 * @property {number} uid
 * @property {string} speciesId
 * @property {string} nickname
 * @property {string[]} types
 * @property {string} ability ability id (follows the form)
 * @property {number} level
 * @property {number} exp
 * @property {{hp:number,atk:number,def:number,spa:number,spd:number,spe:number}} base effective base stats (floor-adjusted after Shifts)
 * @property {{hp:number,atk:number,def:number,spa:number,spd:number,spe:number}} trained trained points (0..252 each)
 * @property {{hp:number,atk:number,def:number,spa:number,spd:number,spe:number}} stats
 * @property {number} hp current HP
 * @property {Array<{id:string, pp:number, maxPp:number}>} moves
 * @property {string[]} memory move ids parked by a Shift
 * @property {{kind:string, turns:number}|null} status burn | poison | chill | numb
 * @property {number} mends battle budget (reset to 3 at battle start)
 * @property {number} bond 0..5 pips
 * @property {string|null} heartmark pinned Heartmark technique id
 * @property {boolean} heartmarkStab whether the Heartmark technique keeps same-type bonus
 * @property {string[]} shiftlog every form held, in order
 * @property {string|null} heldItem
 * @property {boolean} wild true until bonded (Heartmark unlit)
 * @property {string[]|null} typeQueue Unfixed loop (Vagary only)
 * @property {number} typeIndex index into typeQueue
 * @property {number} shiftCount
 */

/**
 * Stat formula (no IVs; trained points add up to +63 at Lv100).
 * @param {number} base
 * @param {number} level
 * @param {number} trained
 * @param {boolean} isHp
 */
function statFrom(base, level, trained, isHp) {
  const core = Math.floor(((2 * base + Math.floor(trained / 4)) * level) / 100);
  return isHp ? core + level + 10 : core + 5;
}

/**
 * Computes the six stats.
 * @param {Creature['base']} base
 * @param {number} level
 * @param {Creature['trained']} trained
 * @param {number} [hpMultiplier=1]
 * @returns {Creature['stats']}
 */
export function computeStats(base, level, trained, hpMultiplier = 1) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = statFrom(base[k], level, trained[k] || 0, k === 'hp');
  out.hp = Math.max(1, Math.floor(out.hp * hpMultiplier));
  return out;
}

function zeroStats() {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/**
 * Picks default move slots: the last four learnset moves at this level, with
 * the Heartmark technique pinned into a slot when the creature has one.
 * @param {import('./species.js').Species} species
 * @param {number} level
 * @param {string|null} heartmark
 * @returns {string[]}
 */
export function defaultMoves(species, level, heartmark) {
  let ids = learnableAt(species, level).slice(-MOVE_SLOTS);
  if (heartmark && !ids.includes(heartmark)) {
    if (ids.length >= MOVE_SLOTS) ids = ids.slice(1);
    ids.unshift(heartmark);
  }
  if (ids.length === 0) ids = ['tap'];
  return ids;
}

function slot(id) {
  const mv = getMove(id);
  return { id, pp: mv.pp === null ? 0 : mv.pp, maxPp: mv.pp === null ? 0 : mv.pp };
}

/**
 * Builds a creature instance.
 *
 * @param {Object} opts
 * @param {string} opts.speciesId
 * @param {number} [opts.level=5]
 * @param {string} [opts.nickname] defaults to the species name
 * @param {{int:(a:number,b:number)=>number, pick:(a:any[])=>any, shuffle?:Function}} [opts.rng] for uid and Unfixed loop; optional
 * @param {Partial<Creature['trained']>} [opts.trained]
 * @param {string|null} [opts.heldItem]
 * @param {number} [opts.bond=0]
 * @param {string[]} [opts.moves] explicit move ids (max 4)
 * @param {string|null} [opts.heartmark] explicit Heartmark technique (defaults to the species' fixed one)
 * @param {boolean} [opts.wild=false]
 * @param {number|string} [opts.uid] explicit uid (the game allocates these); otherwise drawn from `rng`, else a counter
 * @param {number} [opts.exp] explicit total EXP (defaults to the level's threshold)
 * @returns {Creature}
 */
export function makeCreature(opts) {
  const species = getSpecies(opts.speciesId);
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(opts.level ?? 5)));
  const rng = opts.rng || null;
  const trained = { ...zeroStats(), ...(opts.trained || {}) };
  const heartmark = opts.heartmark === undefined ? species.heartmark : opts.heartmark;
  if (heartmark) getMove(heartmark);
  const base = { ...species.base };
  const stats = computeStats(base, level, trained, species.flags.hpMultiplier || 1);
  let moveIds = opts.moves ? opts.moves.slice(0, MOVE_SLOTS) : defaultMoves(species, level, heartmark);
  if (heartmark && !moveIds.includes(heartmark)) {
    if (moveIds.length >= MOVE_SLOTS) moveIds = moveIds.slice(1);
    moveIds.unshift(heartmark);
  }
  let typeQueue = null;
  if (getAbility(species.ability).unfixed) {
    const pool = ORDINARY_TYPES.slice();
    const picks = [];
    for (let i = 0; i < 3; i++) {
      const idx = rng ? rng.int(0, pool.length - 1) : (i * 5) % pool.length;
      picks.push(pool.splice(idx, 1)[0]);
    }
    typeQueue = ['Star', ...picks];
  }
  return {
    uid: opts.uid !== undefined ? opts.uid : rng ? rng.int(1, 2 ** 31 - 1) : nextFallbackUid++,
    speciesId: species.id,
    nickname: opts.nickname || species.name,
    types: species.types.slice(),
    ability: species.ability,
    level,
    exp: opts.exp ?? expForLevel(species.growth, level),
    base,
    trained,
    stats,
    hp: stats.hp,
    moves: moveIds.map(slot),
    memory: [],
    status: null,
    mends: MENDS_PER_BATTLE,
    bond: Math.max(0, Math.min(MAX_BOND, opts.bond || 0)),
    heartmark,
    heartmarkStab: !!heartmark && species.types.includes(getMove(heartmark).type),
    shiftlog: [species.id],
    heldItem: opts.heldItem ?? null,
    wild: !!opts.wild,
    typeQueue,
    typeIndex: 0,
    shiftCount: 0,
  };
}

/** @param {Creature} c @returns {import('./species.js').Species} */
export function speciesOf(c) {
  return getSpecies(c.speciesId);
}

/** @param {Creature} c @returns {boolean} */
export function isFainted(c) {
  return c.hp <= 0;
}

/** @param {Creature} c @returns {number} 0..1 */
export function hpRatio(c) {
  return c.stats.hp > 0 ? c.hp / c.stats.hp : 0;
}

/**
 * Recomputes stats after a level or base change, keeping the HP ratio
 * (a Lv40 creature at half HP stays at half HP).
 * @param {Creature} c
 * @returns {Creature}
 */
export function recomputeStats(c) {
  const species = speciesOf(c);
  const ratio = hpRatio(c);
  const fainted = c.hp <= 0;
  c.stats = computeStats(c.base, c.level, c.trained, species.flags.hpMultiplier || 1);
  c.hp = fainted ? 0 : Math.max(1, Math.round(c.stats.hp * ratio));
  return c;
}

/**
 * Applies a Shift to a new form. Level, EXP, held item, nickname, Bond,
 * trained points and the Heartmark technique are untouched (rules 2.6).
 * Per-stat floor (rules 2.7): on Drift no base stat drops more than 10%, on
 * Flux 20%, on Freefall there is no floor. Moves the new form can learn stay;
 * others go to Memory; the Heartmark technique always stays. The ability
 * follows the form.
 *
 * @param {Creature} c
 * @param {string} newSpeciesId
 * @param {'drift'|'flux'|'freefall'} dial
 * @param {{heartmark?: string}} [opts] pin a Heartmark technique at this (first) Shift
 * @returns {{kept: string[], toMemory: string[], statDelta: number, floored: string[]}}
 */
export function shiftTo(c, newSpeciesId, dial, opts = {}) {
  const from = speciesOf(c);
  const to = getSpecies(newSpeciesId);
  if (from.flags.neverShifts) throw new Error(`shiftTo: ${from.name} never Shifts`);
  if (!(dial in STAT_FLOOR)) throw new RangeError(`shiftTo: unknown dial ${String(dial)}`);
  if (opts.heartmark !== undefined && c.heartmark === null) {
    getMove(opts.heartmark);
    if (!c.moves.some((m) => m.id === opts.heartmark)) throw new Error('shiftTo: the Heartmark technique must be one of the creature\'s current moves');
    c.heartmark = opts.heartmark;
    c.heartmarkStab = c.types.includes(getMove(opts.heartmark).type);
  }
  const before = STAT_KEYS.reduce((a, k) => a + c.base[k], 0);
  const floor = STAT_FLOOR[dial];
  const floored = [];
  const newBase = {};
  for (const k of STAT_KEYS) {
    let v = to.base[k];
    if (floor !== null) {
      const min = Math.ceil(c.base[k] * (1 - floor));
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
  if (moves.length === 0) moves.push(slot('tap'));
  c.moves = moves;
  c.memory = c.memory.concat(toMemory);
  c.base = newBase;
  c.speciesId = to.id;
  c.types = to.types.slice();
  c.ability = to.ability;
  c.shiftlog.push(to.id);
  c.shiftCount++;
  recomputeStats(c);
  const after = STAT_KEYS.reduce((a, k) => a + c.base[k], 0);
  return { kept, toMemory, statDelta: after - before, floored };
}

/**
 * Relearns a Memory move (free at any Shelter once a later form can use it).
 * @param {Creature} c
 * @param {string} moveId
 * @param {number} [replaceIndex] slot to replace when all four are full
 * @returns {boolean}
 */
export function relearnFromMemory(c, moveId, replaceIndex) {
  const i = c.memory.indexOf(moveId);
  if (i < 0 || !canLearn(speciesOf(c), moveId)) return false;
  if (!learnMove(c, moveId, replaceIndex)) return false;
  c.memory.splice(i, 1);
  return true;
}

/**
 * Puts a move into a slot. Returns false when all slots are full and no
 * replacement index was given, or when the replacement slot holds the
 * Heartmark technique.
 * @param {Creature} c
 * @param {string} moveId
 * @param {number} [replaceIndex]
 * @returns {boolean}
 */
export function learnMove(c, moveId, replaceIndex) {
  getMove(moveId);
  if (c.moves.some((m) => m.id === moveId)) return false;
  if (c.moves.length < MOVE_SLOTS) {
    c.moves.push(slot(moveId));
    return true;
  }
  if (replaceIndex === undefined || replaceIndex < 0 || replaceIndex >= c.moves.length) return false;
  if (c.moves[replaceIndex].id === c.heartmark) return false;
  c.moves[replaceIndex] = slot(moveId);
  return true;
}

/**
 * Adds EXP, levels up and surfaces new learnset moves. Moves learned at a new
 * level go into a free slot; when the slots are full they come back in
 * `offers` for the UI to resolve with {@link learnMove}.
 *
 * @param {Creature} c
 * @param {number} amount
 * @returns {{from: number, to: number, learned: string[], offers: string[], statsBefore: Creature['stats'], statsAfter: Creature['stats']}}
 */
export function gainExp(c, amount) {
  const species = speciesOf(c);
  const from = c.level;
  const statsBefore = { ...c.stats };
  c.exp += Math.max(0, Math.floor(amount));
  const target = Math.min(MAX_LEVEL, levelFromExp(species.growth, c.exp));
  const learned = [];
  const offers = [];
  while (c.level < target) {
    c.level++;
    for (const e of species.learnset) {
      if (e.level !== c.level || c.moves.some((m) => m.id === e.move)) continue;
      if (learnMove(c, e.move)) learned.push(e.move);
      else offers.push(e.move);
    }
  }
  if (c.level !== from) recomputeStats(c);
  return { from, to: c.level, learned, offers, statsBefore, statsAfter: { ...c.stats } };
}

/** EXP still needed for the next level (0 at the cap). */
export function expToNext(c) {
  if (c.level >= MAX_LEVEL) return 0;
  return expForLevel(speciesOf(c).growth, c.level + 1) - c.exp;
}

/**
 * Full restore outside battle: HP, PP, status, Mends.
 * @param {Creature} c
 */
export function healFull(c) {
  c.hp = c.stats.hp;
  c.status = null;
  c.mends = MENDS_PER_BATTLE;
  for (const m of c.moves) m.pp = m.maxPp;
  return c;
}

/**
 * Restores PP to one move (Ether: 10) or all moves (Full Ether).
 * @param {Creature} c
 * @param {number|null} moveIndex null = every move
 * @param {number} [amount=10]
 */
export function restorePp(c, moveIndex, amount = 10) {
  const list = moveIndex === null ? c.moves : [c.moves[moveIndex]].filter(Boolean);
  for (const m of list) m.pp = Math.min(m.maxPp, m.pp + amount);
  return c;
}

/** Current type list (Unfixed creatures cycle). */
export function currentTypes(c) {
  if (c.typeQueue) return [c.typeQueue[c.typeIndex]];
  return c.types;
}

/**
 * Plain JSON snapshot.
 * @param {Creature} c
 * @returns {Record<string, any>}
 */
export function serialize(c) {
  return JSON.parse(JSON.stringify({ v: 1, ...c }));
}

/**
 * Rebuilds a creature from {@link serialize} output. Stats are recomputed
 * from base + level + trained so stale saves self-heal.
 * @param {Record<string, any>} data
 * @returns {Creature}
 */
export function deserialize(data) {
  if (!data || typeof data !== 'object' || data.v !== 1) throw new TypeError('deserialize: not a v1 creature snapshot');
  const species = getSpecies(data.speciesId);
  const c = {
    uid: typeof data.uid === 'string' ? data.uid : data.uid | 0,
    speciesId: species.id,
    nickname: String(data.nickname || species.name),
    types: Array.isArray(data.types) ? data.types.slice() : species.types.slice(),
    ability: data.ability || species.ability,
    level: Math.max(1, Math.min(MAX_LEVEL, data.level | 0)),
    exp: Math.max(0, data.exp | 0),
    base: { ...species.base, ...(data.base || {}) },
    trained: { ...zeroStats(), ...(data.trained || {}) },
    stats: zeroStats(),
    hp: 0,
    moves: (data.moves || []).map((m) => {
      const mv = getMove(m.id);
      const maxPp = Number.isFinite(m.maxPp) ? m.maxPp : (mv.pp || 0);
      return { id: m.id, pp: Math.max(0, Math.min(maxPp, m.pp | 0)), maxPp };
    }),
    memory: (data.memory || []).slice(),
    status: data.status ? { kind: data.status.kind, turns: data.status.turns | 0 } : null,
    mends: Number.isFinite(data.mends) ? data.mends : MENDS_PER_BATTLE,
    bond: Math.max(0, Math.min(MAX_BOND, data.bond | 0)),
    heartmark: data.heartmark || null,
    heartmarkStab: !!data.heartmarkStab,
    shiftlog: Array.isArray(data.shiftlog) && data.shiftlog.length ? data.shiftlog.slice() : [species.id],
    heldItem: data.heldItem ?? null,
    wild: !!data.wild,
    typeQueue: Array.isArray(data.typeQueue) ? data.typeQueue.slice() : null,
    typeIndex: data.typeIndex | 0,
    shiftCount: data.shiftCount | 0,
  };
  getAbility(c.ability);
  c.stats = computeStats(c.base, c.level, c.trained, species.flags.hpMultiplier || 1);
  c.hp = Math.max(0, Math.min(c.stats.hp, Number.isFinite(data.hp) ? data.hp : c.stats.hp));
  return c;
}
