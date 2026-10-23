/**
 * WILDSHIFT battle engine: a pure, deterministic state machine a UI drives
 * step by step. The UI asks {@link Battle#availableActions} what each side may
 * do, submits one action per side with {@link Battle#submit}, and animates the
 * list of events that comes back.
 *
 * Singles only for the prototype. Side 0 is always the player.
 *
 * Event types emitted (all have `type`; most have `side` and a creature name):
 * 'turn', 'switch', 'move', 'charge', 'miss', 'decoy-pop', 'blocked',
 * 'ward-readout', 'effectiveness', 'damage', 'crit', 'faint', 'status', 'stat',
 * 'heal', 'mend-spent', 'mend-pending', 'mend-cancelled', 'ability', 'glint',
 * 'scrap-cost', 'read', 'reveal', 'capture-shake', 'capture', 'capture-fail',
 * 'run', 'stance', 'item', 'ward-suppressed', 'type-shift', 'exp', 'levelup',
 * 'learn', 'learn-offer', 'payout', 'blackout', 'replace-needed', 'end', 'message'.
 *
 * @module proto/battle/engine
 */

import { effectiveness, ORDINARY_TYPES } from './types.js';
import { getMove, SCRAP, isDamaging, isSureHit, isSelfTargeting } from './moves.js';
import { getAbility, wardCheck, wardHeldText, isWard } from './abilities.js';
import { getSpecies } from './species.js';
import { gainExp, hpRatio, isFainted, speciesOf, MENDS_PER_BATTLE } from './creature.js';

// ---------------------------------------------------------------------------
// Tunables (every one is an estimate from the rules doc unless noted)
// ---------------------------------------------------------------------------

/** Accuracy multipliers by the target's evasion stage (rules 10.1). */
export const EVASION_MULT = Object.freeze([1, 0.83, 0.67]);
/** Evasion stage cap (lead decision). */
export const EVASION_CAP = 2;
/** Cap for every other stat stage. */
export const STAGE_CAP = 6;
/** Crit chance by crit stage. */
export const CRIT_RATES = Object.freeze([1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2]);
/** Crit damage multiplier. */
export const CRIT_MULT = 1.5;
/** Same-type bonus. */
export const STAB = 1.5;
/** Scrap self-cost as a fraction of max HP. */
export const SCRAP_COST = 1 / 8;
/** Chip fractions per end of turn. */
export const CHIP = Object.freeze({ burn: 1 / 16, poison: 1 / 8, trap: 1 / 8 });
/** Trap duration in turns. */
export const TRAP_TURNS = 4;
/** Crackdust Ward suppression in turns. */
export const CRACKDUST_TURNS = 3;
/** Plumbline re-boost block in turns after the hit. */
export const PLUMBLINE_BLOCK_TURNS = 2;
/** Capture: bonus per failed attempt on the same creature, and its cap. */
export const CAPTURE_FAIL_BONUS = 0.03;
export const CAPTURE_FAIL_CAP = 0.15;
/** Lantern grades: odds multiplier and price. */
export const LANTERN = Object.freeze({
  1: Object.freeze({ mult: 1, price: 250, name: 'Lantern' }),
  2: Object.freeze({ mult: 1.5, price: 700, name: 'Bright Lantern' }),
  3: Object.freeze({ mult: 2, price: 1400, name: 'Beacon Lantern' }),
  sure: Object.freeze({ mult: Infinity, price: null, name: 'Keepsake Lantern' }),
});
/** Capture odds bands for Freefall. */
export const CAPTURE_BANDS = Object.freeze([[0.25, 'Low'], [0.6, 'Fair'], [Infinity, 'Good']]);
/** Bench EXP share (lead decision) and Training Yard share. */
export const BENCH_SHARE = 0.6;
export const YARD_SHARE = 0.25;
/** Catch-up: +50% per 5 levels under the curve, capped x3. */
export const CATCH_UP_STEP = 0.5;
export const CATCH_UP_CAP = 3;
/** Over-curve damping (Rematch-board EXP only). */
export const DAMP_START = 10;
export const DAMP_FACTOR = 0.5;
/** Blackout: 10% of glint, capped at 3,000. Summit losses cost nothing. */
export const BLACKOUT_RATE = 0.1;
export const BLACKOUT_CAP = 3000;
/** Trainer battle EXP bonus. */
export const TRAINER_EXP_MULT = 1.5;
/** Max turns before the simulator calls a battle stuck. */
export const MAX_TURNS = 200;

const DIALS = Object.freeze(['drift', 'flux', 'freefall']);
const STAT_NAMES = Object.freeze({ atk: 'Attack', def: 'Defence', spa: 'Sp. Attack', spd: 'Sp. Defence', spe: 'Speed', eva: 'evasion' });
const MAJOR_STATUS = Object.freeze(['burn', 'poison', 'chill', 'numb']);
const STATUS_TYPE_IMMUNITY = Object.freeze({ burn: 'Kiln', chill: 'Rime', poison: 'Rust', numb: 'Bolt' });

/** Error thrown for an illegal action (the menu should never let one through). */
export class BattleError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'BattleError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests and the UI)
// ---------------------------------------------------------------------------

/** Stat-stage multiplier. */
export function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Crit chance for a crit stage (clamped to the table). */
export function critChance(stage) {
  return CRIT_RATES[Math.max(0, Math.min(CRIT_RATES.length - 1, stage))];
}

/**
 * Catch-up multiplier for a creature `level` against the island curve.
 * @param {number} level
 * @param {number|null} curveLevel
 */
export function catchUpMult(level, curveLevel) {
  if (curveLevel == null) return 1;
  const under = Math.max(0, curveLevel - level);
  return Math.min(CATCH_UP_CAP, 1 + CATCH_UP_STEP * Math.floor(under / 5));
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
 * @param {number} p.rand 0.85..1
 * @param {boolean} [p.burned] attacker burned and move physical
 * @param {number} [p.extra=1] ability multipliers
 * @returns {number} integer damage (>= 1 unless typeMult is 0)
 */
export function damageFormula({ level, power, attack, defense, typeMult, stab, crit, rand, burned = false, extra = 1 }) {
  if (typeMult === 0 || power <= 0) return 0;
  const base = Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / Math.max(1, defense) / 50) + 2;
  let mods = typeMult * rand * extra;
  if (stab) mods *= STAB;
  if (crit) mods *= CRIT_MULT;
  if (burned) mods *= 0.5;
  return Math.max(1, Math.floor(base * mods));
}

/**
 * Capture odds (lead decision: shown before a Lantern is spent).
 * @param {Object} p
 * @param {number} p.catchRate 3..255
 * @param {number} p.hp
 * @param {number} p.maxHp
 * @param {string|null} p.status major status kind
 * @param {boolean} [p.trapped]
 * @param {1|2|3|'sure'} p.grade Lantern grade
 * @param {number} [p.fails=0] failed attempts on this creature
 * @returns {number} 0.01..1
 */
export function captureOdds({ catchRate, hp, maxHp, status, trapped = false, grade, fails = 0 }) {
  if (grade === 'sure') return 1;
  const lantern = LANTERN[grade];
  if (!lantern) throw new RangeError(`captureOdds: unknown Lantern grade ${String(grade)}`);
  const hpFactor = (3 * maxHp - 2 * Math.max(1, hp)) / (3 * maxHp);
  const statusMult = status === 'chill' || status === 'numb' || trapped ? 1.5 : status === 'burn' || status === 'poison' ? 1.25 : 1;
  const raw = (catchRate / 255) * hpFactor * lantern.mult * statusMult;
  const bonus = Math.min(CAPTURE_FAIL_CAP, Math.max(0, fails) * CAPTURE_FAIL_BONUS);
  return Math.max(0.01, Math.min(0.99, raw + bonus));
}

/** Freefall capture band for an odds value. */
export function captureBand(odds) {
  for (const [limit, word] of CAPTURE_BANDS) if (odds < limit) return word;
  return 'Good';
}

/**
 * What Read reveals about a creature. In battle Read always reveals the
 * ability with a one-line effect; the dial only sets what it costs (free on
 * Drift/Flux, the turn on Freefall) and what the pre-battle card shows.
 * @param {import('./creature.js').Creature} target
 * @param {'drift'|'flux'|'freefall'} dial
 * @param {{prism?: boolean}} [opts] Scouting Prism adds moves and held item
 */
export function readCreature(target, dial, opts = {}) {
  const ability = getAbility(target.ability);
  const species = speciesOf(target);
  const out = {
    speciesId: species.id,
    name: target.nickname,
    species: species.name,
    level: target.level,
    types: target.types.slice(),
    ability: { id: ability.id, name: ability.name, text: ability.text, ward: isWard(ability) },
    costsTurn: dial === 'freefall',
  };
  if (opts.prism) {
    out.moves = target.moves.map((m) => m.id);
    out.heldItem = target.heldItem;
    out.mends = target.mends;
  }
  return out;
}

/**
 * The dossier posted at a Spire door or the Summit gate.
 * @param {{name:string, party:any[], items?:any[], tacticTag?:string, title?:string}} trainer
 */
export function dossier(trainer) {
  const roster = trainer.party.map((c) => {
    const ability = getAbility(c.ability);
    return { speciesId: c.speciesId, species: speciesOf(c).name, name: c.nickname, level: c.level, types: c.types.slice(), ability: { id: ability.id, name: ability.name, ward: isWard(ability) } };
  });
  return {
    name: trainer.name,
    title: trainer.title || null,
    roster,
    healPips: (trainer.items || []).filter((i) => i.heal).length,
    tacticTag: trainer.tacticTag || inferTacticTag(trainer.party),
  };
}

function inferTacticTag(party) {
  const tags = [];
  const hasEva = party.some((c) => c.moves.some((m) => getMove(m.id).effect.evasion));
  const hasRec = party.some((c) => c.moves.some((m) => getMove(m.id).effect.recovery));
  if (hasEva && hasRec) tags.push('evasion + recovery');
  else if (hasEva) tags.push('evasion');
  else if (hasRec) tags.push('recovery');
  if (party.some((c) => isWard(getAbility(c.ability)))) tags.push('Ward wall');
  if (party.some((c) => c.moves.some((m) => getMove(m.id).effect.status && ['poison', 'burn', 'trap'].includes(getMove(m.id).effect.status.kind)))) tags.push('chip');
  if (party.some((c) => c.moves.some((m) => getMove(m.id).effect.highCrit) || getAbility(c.ability).glint)) tags.push('crits');
  return tags.length ? tags.join(', ') : 'straight fight';
}

/**
 * The pre-battle Read card (rules 6.2).
 * @param {{party:any[], name?:string, items?:any[]}} foe trainer side (or wild)
 * @param {'drift'|'flux'|'freefall'} dial
 * @param {{read: Set<string>}} [fieldLog]
 * @param {{prism?: boolean}} [opts]
 */
export function readCard(foe, dial, fieldLog = { read: new Set() }, opts = {}) {
  const roster = dial === 'freefall' ? foe.party.slice(0, 1) : foe.party;
  const entries = roster.map((c) => {
    const ability = getAbility(c.ability);
    const showAbility = dial === 'drift' || (dial === 'flux' && fieldLog.read.has(c.speciesId));
    const e = { speciesId: c.speciesId, species: speciesOf(c).name, types: c.types.slice(), level: c.level, ability: showAbility ? { id: ability.id, name: ability.name, ward: isWard(ability) } : null, wardShimmer: dial !== 'freefall' && isWard(ability) };
    if (opts.prism) {
      e.moves = c.moves.map((m) => m.id);
      e.heldItem = c.heldItem;
    }
    return e;
  });
  const pips = dial === 'freefall' ? null : foe.party.map((c) => ({ wardShimmer: isWard(getAbility(c.ability)) }));
  const allRead = foe.party.every((c) => fieldLog.read.has(c.speciesId));
  return { dial, roster: entries, pips, healPips: opts.prism ? (foe.items || []).filter((i) => i.heal).length : null, autoSkip: allRead };
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

function freshVol() {
  return {
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, eva: 0 },
    guarding: false,
    guardedLast: false,
    boostBlockUntil: -1,
    pendingHeal: null,
    charging: null,
    flinched: false,
    movedThisTurn: false,
    hollowHitThisTurn: false,
    trap: 0,
    wardSuppressed: 0,
    critRoll: 1,
    turnsOut: 0,
  };
}

/**
 * @typedef {Object} SideInput
 * @property {import('./creature.js').Creature[]} party
 * @property {{name:string, items?:Array<{id:string, heal?:number}>, payout?:number, payoutRate?:number, tacticTag?:string, title?:string}} [trainer]
 * @property {{crackdust?:number, lanterns?:Record<string, number>}} [bag]
 * @property {number} [glint]
 */

export class Battle {
  /**
   * @param {Object} opts
   * @param {[SideInput, SideInput]} opts.sides
   * @param {'wild'|'trainer'} opts.kind
   * @param {'drift'|'flux'|'freefall'} [opts.dial='flux']
   * @param {{next:()=>number,int:(a:number,b:number)=>number,chance:(p:number)=>boolean,pick:(a:any[])=>any}} opts.rng
   * @param {boolean} [opts.captureStance=false]
   * @param {number|null} [opts.curveLevel=null] island curve level for catch-up
   * @param {boolean} [opts.summit=false] Summit fights cost no glint on a loss
   * @param {'route'|'story'|'spire'|'rematch'} [opts.source='route'] EXP source (rematch is damped over the curve)
   * @param {((battle: Battle, side: number) => any)|null} [opts.foeAi] fills in side 1's action when the UI omits it
   * @param {import('./creature.js').Creature[]} [opts.yard] Training Yard creatures (25% of party EXP)
   * @param {{seen:Set<string>, read:Set<string>}} [opts.fieldLog]
   * @param {boolean} [opts.prism=false] Scouting Prism owned
   */
  constructor(opts) {
    if (!opts || !Array.isArray(opts.sides) || opts.sides.length !== 2) throw new TypeError('createBattle: sides must be [player, foe]');
    if (opts.kind !== 'wild' && opts.kind !== 'trainer') throw new RangeError(`createBattle: kind must be 'wild' or 'trainer', got ${String(opts.kind)}`);
    const dial = opts.dial || 'flux';
    if (!DIALS.includes(dial)) throw new RangeError(`createBattle: unknown dial ${String(dial)}`);
    if (!opts.rng || typeof opts.rng.next !== 'function' || typeof opts.rng.int !== 'function' || typeof opts.rng.chance !== 'function') {
      throw new TypeError('createBattle: rng with next()/int()/chance()/pick() is required');
    }
    this.kind = opts.kind;
    this.dial = dial;
    this.rng = opts.rng;
    this.curveLevel = opts.curveLevel ?? null;
    this.summit = !!opts.summit;
    this.source = opts.source || 'route';
    this.foeAi = opts.foeAi || null;
    this.yard = opts.yard || [];
    this.prism = !!opts.prism;
    this.fieldLog = opts.fieldLog || { seen: new Set(), read: new Set() };
    this.turn = 0;
    this.phase = 'choose';
    this.pendingReplace = [];
    this.outcome = null;
    this.winner = null;
    this.caught = null;
    this.runAttempts = 0;
    this.captureFails = new Map();
    this.expReport = [];
    this.payout = 0;
    this.blackoutCost = 0;
    this.memo = [{}, {}];
    this.log = [];
    /** @type {any[]} */
    this._events = [];
    this.sides = opts.sides.map((s, i) => {
      if (!Array.isArray(s.party) || s.party.length === 0) throw new TypeError(`createBattle: side ${i} needs a non-empty party`);
      const first = s.party.findIndex((c) => !isFainted(c));
      if (first < 0) throw new RangeError(`createBattle: side ${i} has no healthy creature`);
      return {
        index: i,
        party: s.party,
        trainer: s.trainer || null,
        bag: { crackdust: 0, lanterns: null, ...(s.bag || {}) },
        glint: s.glint ?? 0,
        items: s.trainer && s.trainer.items ? s.trainer.items.map((it) => ({ ...it })) : [],
        active: first,
        vol: freshVol(),
        bflags: new Map(),
        participants: new Set(),
        readUsed: new Set(),
      };
    });
    if (this.kind === 'wild' && this.sides[1].trainer) throw new RangeError('createBattle: a wild battle has no foe trainer');
    this.stance = this.kind === 'wild' ? !!opts.captureStance : false;
    this.wardBadge = [false, false];
    for (const side of this.sides) {
      for (const c of side.party) {
        c.mends = MENDS_PER_BATTLE;
        if (c.typeQueue) {
          c.typeIndex = 0;
          c.types = [c.typeQueue[0]];
        }
      }
    }
    this.sides[1].party.forEach((c) => this.fieldLog.seen.add(c.speciesId));
    this.sides[0].party.forEach((c) => this.fieldLog.seen.add(c.speciesId));
    this._emit({ type: 'message', text: this.kind === 'wild' ? `A wild ${this.active(1).nickname} appeared.` : `${this.sides[1].trainer.name} wants to battle.` });
    for (const side of this.sides) this._sendIn(side.index, side.active, true);
    /** Events from the opening send-ins (abilities such as Shoresense fire here). */
    this.intro = this._flush();
  }

  // ---- queries -------------------------------------------------------------

  /** @param {number} side @returns {import('./creature.js').Creature} */
  active(side) {
    const s = this.sides[side];
    return s.party[s.active];
  }

  /** @param {number} side @returns {import('./creature.js').Creature} */
  foeOf(side) {
    return this.active(1 - side);
  }

  /** Whether this side is the player. */
  isPlayer(side) {
    return side === 0;
  }

  /** Per-creature, per-battle flags (first-hit abilities). */
  bflags(side, c = this.active(side)) {
    const s = this.sides[side];
    if (!s.bflags.has(c.uid)) s.bflags.set(c.uid, {});
    return s.bflags.get(c.uid);
  }

  /** Effective ability of the active creature (null while Crackdust suppresses a Ward). */
  effectiveAbility(side) {
    const ability = getAbility(this.active(side).ability);
    if (isWard(ability) && this.sides[side].vol.wardSuppressed > 0) return null;
    return ability;
  }

  /** Effective stat with stages, numb and burn. */
  effStat(side, key) {
    const c = this.active(side);
    const v = this.sides[side].vol;
    let value = c.stats[key] * stageMult(v.stages[key]);
    if (key === 'spe' && c.status && c.status.kind === 'numb') value *= 0.5;
    return Math.max(1, Math.floor(value));
  }

  /** Hit chance of a move from `side` against the foe (what the move panel shows). */
  hitChance(side, move) {
    if (isSureHit(move) || move.effect.plumbline) return 1;
    if (isSelfTargeting(move)) return 1;
    const acc = move.accuracy === null ? 100 : move.accuracy;
    const eva = this.sides[1 - side].vol.stages.eva;
    return (acc / 100) * EVASION_MULT[Math.max(0, Math.min(EVASION_CAP, eva))];
  }

  /**
   * Snapshot for the UI (plain data, safe to JSON).
   */
  state() {
    return {
      kind: this.kind,
      dial: this.dial,
      turn: this.turn,
      phase: this.phase,
      pendingReplace: this.pendingReplace.slice(),
      outcome: this.outcome,
      winner: this.winner,
      captureStance: this.stance,
      sides: this.sides.map((s) => ({
        active: s.active,
        trainer: s.trainer ? s.trainer.name : null,
        wardBadge: this.wardBadge[s.index],
        stages: { ...s.vol.stages },
        guarding: s.vol.guarding,
        boostBlocked: this.turn <= s.vol.boostBlockUntil,
        trapped: s.vol.trap > 0,
        charging: s.vol.charging ? s.vol.charging.move : null,
        pendingHeal: s.vol.pendingHeal ? s.vol.pendingHeal.turns : null,
        wardSuppressed: s.vol.wardSuppressed,
        party: s.party.map((c) => ({
          uid: c.uid, name: c.nickname, speciesId: c.speciesId, level: c.level, hp: c.hp, maxHp: c.stats.hp,
          status: c.status ? c.status.kind : null, mends: c.mends, types: c.types.slice(), fainted: isFainted(c),
          moves: c.moves.map((m) => ({ id: m.id, pp: m.pp, maxPp: m.maxPp })),
        })),
      })),
    };
  }

  /**
   * What a side may do now. Every entry carries `selectable` and, when it is
   * not selectable, a `reason` string for the menu to show.
   * @param {number} side
   */
  availableActions(side) {
    const s = this.sides[side];
    const c = this.active(side);
    const v = s.vol;
    const foe = this.foeOf(side);
    const foeAbility = this.effectiveAbility(1 - side);
    const out = { side, phase: this.phase, locked: null, moves: [], scrap: null, switches: [], run: null, read: null, lantern: null, captureStance: null, items: [] };
    if (this.phase === 'ended') return out;
    if (this.phase === 'replace') {
      out.switches = this._switchOptions(side, true);
      return out;
    }
    if (v.charging) {
      out.locked = { type: 'move', move: v.charging.move, reason: `${c.nickname} is braced for ${getMove(c.moves[v.charging.move].id).name}.` };
    }
    const allOut = c.moves.every((m) => m.pp <= 0);
    out.moves = c.moves.map((m, i) => {
      const mv = getMove(m.id);
      const type = mv.effect.queuedType && c.typeQueue ? c.typeQueue[(c.typeIndex + 1) % c.typeQueue.length] : mv.type;
      const check = isDamaging(mv) ? wardCheck(foeAbility, mv, foe.types, type) : { lands: true, reason: null, eff: { mult: 1, word: 'Neutral' } };
      let selectable = true;
      let reason = null;
      if (m.pp <= 0) {
        selectable = false;
        reason = 'No PP left.';
      }
      const panelWord = check.reason === 'ward' ? 'Blocked by Ward' : check.reason === 'immune' ? 'No effect' : isDamaging(mv) ? check.eff.word : null;
      return { index: i, id: mv.id, name: mv.name, type, category: mv.category, power: mv.power, pp: m.pp, maxPp: m.maxPp, selectable, reason, word: panelWord, mult: check.eff.mult, hitChance: this.hitChance(side, mv), heartmark: m.id === c.heartmark };
    });
    out.scrap = { available: allOut, name: SCRAP.name, reason: allOut ? null : 'Scrap is only available when every move is out of PP.', cost: Math.max(1, Math.floor(c.stats.hp * SCRAP_COST)) };
    out.switches = this._switchOptions(side, false);
    const isTrainer = this.kind === 'trainer';
    out.run = side === 0
      ? { available: !isTrainer, reason: isTrainer ? 'You cannot run from a trainer battle.' : null }
      : { available: false, reason: 'Only the player may run.' };
    const foeKey = foe.uid;
    const readDone = s.readUsed.has(foeKey);
    out.read = {
      available: !readDone,
      free: this.dial !== 'freefall',
      costsTurn: this.dial === 'freefall',
      reason: readDone ? `${foe.nickname} has already been Read.` : null,
    };
    if (side === 0 && this.kind === 'wild') {
      const fails = this.captureFails.get(foe.uid) || 0;
      const grades = [1, 2, 3].map((g) => {
        const odds = captureOdds({ catchRate: speciesOf(foe).catchRate, hp: foe.hp, maxHp: foe.stats.hp, status: foe.status ? foe.status.kind : null, trapped: this.sides[1].vol.trap > 0, grade: g, fails });
        const stock = s.bag.lanterns ? s.bag.lanterns[g] || 0 : null;
        return { grade: g, name: LANTERN[g].name, price: LANTERN[g].price, odds: this.dial === 'freefall' ? null : odds, band: captureBand(odds), stock, selectable: stock === null || stock > 0, reason: stock === 0 ? `No ${LANTERN[g].name} left.` : null };
      });
      out.lantern = { available: true, fails, grades, exactOdds: this.dial !== 'freefall' };
      out.captureStance = { on: this.stance, available: true, text: 'Party damage cannot drop the wild creature below 1 HP.' };
    } else {
      out.lantern = { available: false, reason: side === 0 ? 'You cannot capture a trainer\'s creature.' : 'Only the player captures.' };
      out.captureStance = { on: false, available: false, reason: 'Capture Stance is only for wild battles.' };
    }
    if (s.bag.crackdust > 0) {
      const foeIsWard = isWard(getAbility(foe.ability));
      out.items.push({ id: 'crackdust', name: 'Crackdust', count: s.bag.crackdust, selectable: foeIsWard && this.sides[1 - side].vol.wardSuppressed === 0, reason: !foeIsWard ? `${foe.nickname} has no Ward.` : this.sides[1 - side].vol.wardSuppressed > 0 ? 'Its Ward is already suppressed.' : null });
    }
    for (const it of s.items) {
      if (it.heal) out.items.push({ id: it.id, name: it.name || it.id, count: 1, selectable: c.hp < c.stats.hp, reason: c.hp < c.stats.hp ? null : 'HP is full.' });
    }
    return out;
  }

  _switchOptions(side, forced) {
    const s = this.sides[side];
    const trapped = !forced && s.vol.trap > 0;
    return s.party.map((c, i) => {
      let selectable = true;
      let reason = null;
      if (i === s.active && !forced) {
        selectable = false;
        reason = `${c.nickname} is already out.`;
      } else if (isFainted(c)) {
        selectable = false;
        reason = `${c.nickname} has fainted.`;
      } else if (trapped) {
        selectable = false;
        reason = `${this.active(side).nickname} is trapped and cannot switch.`;
      } else if (i === s.active && forced) {
        selectable = false;
        reason = `${c.nickname} has fainted.`;
      }
      return { index: i, name: c.nickname, speciesId: c.speciesId, level: c.level, hp: c.hp, maxHp: c.stats.hp, selectable, reason };
    });
  }

  /** Battle result once `phase === 'ended'`. */
  result() {
    return {
      ended: this.phase === 'ended',
      outcome: this.outcome,
      winner: this.winner,
      turns: this.turn,
      exp: this.expReport.slice(),
      payout: this.payout,
      blackoutCost: this.blackoutCost,
      summitNoLoss: this.summit,
      caught: this.caught,
    };
  }

  // ---- free actions (do not use the turn) -----------------------------------

  /**
   * Toggle Capture Stance (wild battles only, costs nothing).
   * @param {boolean} on
   * @returns {any[]} events
   */
  setCaptureStance(on) {
    this._events = [];
    if (this.kind !== 'wild') throw new BattleError('NO_STANCE', 'Capture Stance is only for wild battles.');
    this.stance = !!on;
    this._emit({ type: 'stance', on: this.stance, text: this.stance ? 'Capture Stance. Party damage stops at 1 HP.' : 'Capture Stance off.' });
    return this._flush();
  }

  /**
   * In-battle Read on Drift and Flux: free, once per foe. On Freefall submit
   * `{type:'read'}` as the turn's action instead.
   * @param {number} side
   * @returns {any[]} events
   */
  read(side) {
    this._events = [];
    if (this.dial === 'freefall') throw new BattleError('READ_COSTS_TURN', 'On Freefall, Read costs the turn: submit it as an action.');
    this._doRead(side, 'Read');
    return this._flush();
  }

  _doRead(side, source) {
    const s = this.sides[side];
    const foe = this.foeOf(side);
    if (s.readUsed.has(foe.uid)) {
      this._emit({ type: 'message', side, text: `${foe.nickname} has already been Read.` });
      return false;
    }
    s.readUsed.add(foe.uid);
    this.fieldLog.read.add(foe.speciesId);
    const info = readCreature(foe, this.dial, { prism: this.prism });
    if (info.ability.ward && this.dial !== 'freefall') this.wardBadge[1 - side] = true;
    this._emit({ type: 'read', side, target: foe.nickname, source, info, text: `${foe.nickname}: ${info.ability.name}. ${info.ability.text}` });
    return true;
  }

  /** Ability hook: Shoresense. */
  autoRead(side, source) {
    this._doRead(side, source);
    return [];
  }

  /** Ability hook: Tailhum. Reveals `n` unrevealed foe moves. */
  revealFoeMove(side, n, source) {
    const foe = this.foeOf(side);
    const memo = this.memo[side];
    memo.revealed = memo.revealed || new Map();
    const set = memo.revealed.get(foe.uid) || new Set();
    const revealed = [];
    for (const m of foe.moves) {
      if (revealed.length >= n) break;
      if (!set.has(m.id)) {
        set.add(m.id);
        revealed.push(m.id);
      }
    }
    memo.revealed.set(foe.uid, set);
    if (revealed.length) this._emit({ type: 'reveal', side, target: foe.nickname, source, moves: revealed, text: `${source}: ${foe.nickname} knows ${revealed.map((id) => getMove(id).name).join(', ')}.` });
    return [];
  }

  /** Ability hook: Unfixed. */
  cycleUnfixed(side) {
    const c = this.active(side);
    if (!c.typeQueue) return [];
    c.typeIndex = (c.typeIndex + 1) % c.typeQueue.length;
    c.types = [c.typeQueue[c.typeIndex]];
    const next = [1, 2].map((k) => c.typeQueue[(c.typeIndex + k) % c.typeQueue.length]);
    this._emit({ type: 'type-shift', side, who: c.nickname, current: c.types[0], next, text: `${c.nickname} turns ${c.types[0]}. Next: ${next.join(', ')}.` });
    return [];
  }

  // ---- the turn --------------------------------------------------------------

  /**
   * Submits one action per side and resolves the turn (or the replacement
   * step). Returns the events to animate.
   *
   * Actions: `{type:'move', move:index}`, `{type:'scrap'}`, `{type:'switch', to:index}`,
   * `{type:'run'}`, `{type:'read'}` (Freefall), `{type:'lantern', grade:1|2|3|'sure'}`,
   * `{type:'item', item:'crackdust'|<trainer item id>}`.
   *
   * @param {any[]} actions indexed by side; side 1 may be omitted when `foeAi` is set
   * @returns {any[]} events
   */
  submit(actions) {
    this._events = [];
    if (this.phase === 'ended') throw new BattleError('ENDED', 'The battle is over.');
    const acts = Array.isArray(actions) ? actions.slice() : [actions[0], actions[1]];
    if (this.phase === 'replace') {
      for (const side of this.pendingReplace) {
        let a = acts[side];
        if (!a && side === 1 && this.foeAi) a = this.foeAi(this, side);
        if (!a || a.type !== 'switch') throw new BattleError('NEED_REPLACEMENT', `Side ${side} must switch in a replacement.`);
        this._validateSwitch(side, a.to, true);
        this._sendIn(side, a.to, false);
      }
      this.pendingReplace = [];
      this.phase = 'choose';
      return this._flush();
    }
    for (let side = 0; side < 2; side++) {
      if (!acts[side] && side === 1 && this.foeAi) acts[side] = this.foeAi(this, side);
      if (this.sides[side].vol.charging) acts[side] = { type: 'move', move: this.sides[side].vol.charging.move, charged: true };
      this._validate(side, acts[side]);
    }
    this.turn++;
    this._emit({ type: 'turn', n: this.turn });
    for (const s of this.sides) {
      s.vol.movedThisTurn = false;
      s.vol.flinched = false;
      s.vol.hollowHitThisTurn = false;
      s.vol.critRoll = this.rng.next();
      const ability = getAbility(this.active(s.index).ability);
      if (ability.glint && s.vol.critRoll < critChance(ability.hooks.critStages())) {
        this._emit({ type: 'glint', side: s.index, who: this.active(s.index).nickname, text: `${this.active(s.index).nickname}'s ears glint. Its next hit will crit.` });
      }
    }
    const order = this._order(acts);
    for (const { side, action } of order) {
      if (this.phase === 'ended') break;
      const me = this.active(side);
      if (isFainted(me) && action.type !== 'switch') continue;
      this._perform(side, action);
    }
    if (this.phase !== 'ended') this._endOfTurn();
    if (this.phase !== 'ended') this._resolveFaints();
    if (this.phase !== 'ended' && this.turn >= MAX_TURNS) this._finish('draw', null);
    return this._flush();
  }

  _validate(side, a) {
    if (!a || typeof a !== 'object') throw new BattleError('NO_ACTION', `Side ${side} submitted no action.`);
    const s = this.sides[side];
    const c = this.active(side);
    switch (a.type) {
      case 'move': {
        const m = c.moves[a.move];
        if (!m) throw new BattleError('BAD_MOVE', `Side ${side}: no move at slot ${String(a.move)}.`);
        if (!a.charged && m.pp <= 0) throw new BattleError('NO_PP', `${getMove(m.id).name} has no PP left.`);
        return;
      }
      case 'scrap':
        if (!c.moves.every((m) => m.pp <= 0)) throw new BattleError('SCRAP_UNAVAILABLE', 'Scrap is only available when every move is out of PP.');
        return;
      case 'switch':
        this._validateSwitch(side, a.to, false);
        return;
      case 'run':
        if (side !== 0) throw new BattleError('NO_RUN', 'Only the player may run.');
        if (this.kind === 'trainer') throw new BattleError('NO_RUN', 'You cannot run from a trainer battle.');
        return;
      case 'read':
        if (this.dial !== 'freefall') throw new BattleError('READ_FREE', 'On this dial Read is free: call battle.read(side) instead.');
        return;
      case 'lantern':
        if (side !== 0 || this.kind !== 'wild') throw new BattleError('NO_LANTERN', 'Lanterns are for wild battles.');
        if (!LANTERN[a.grade]) throw new BattleError('BAD_LANTERN', `Unknown Lantern grade ${String(a.grade)}.`);
        if (s.bag.lanterns && !(s.bag.lanterns[a.grade] > 0)) throw new BattleError('NO_LANTERN', `No ${LANTERN[a.grade].name} left.`);
        return;
      case 'item':
        if (a.item === 'crackdust') {
          if (!(s.bag.crackdust > 0)) throw new BattleError('NO_ITEM', 'No Crackdust.');
          return;
        }
        if (!s.items.some((it) => it.id === a.item)) throw new BattleError('NO_ITEM', `No item ${String(a.item)}.`);
        return;
      default:
        throw new BattleError('BAD_ACTION', `Unknown action type ${String(a.type)}.`);
    }
  }

  _validateSwitch(side, to, forced) {
    const s = this.sides[side];
    const target = s.party[to];
    if (!target) throw new BattleError('BAD_SWITCH', `No party slot ${String(to)}.`);
    if (isFainted(target)) throw new BattleError('BAD_SWITCH', `${target.nickname} has fainted.`);
    if (!forced && to === s.active) throw new BattleError('BAD_SWITCH', `${target.nickname} is already out.`);
    if (!forced && s.vol.trap > 0) throw new BattleError('TRAPPED', `${this.active(side).nickname} is trapped.`);
  }

  _priorityOf(side, a) {
    switch (a.type) {
      case 'run': return 7;
      case 'switch': case 'item': case 'lantern': return 6;
      case 'read': return 5;
      case 'scrap': return 0;
      case 'move': return getMove(this.active(side).moves[a.move].id).priority;
      default: return 0;
    }
  }

  _order(acts) {
    const rows = acts.map((action, side) => ({ side, action, priority: this._priorityOf(side, action), speed: this.effStat(side, 'spe'), tie: this.rng.next() }));
    rows.sort((a, b) => b.priority - a.priority || b.speed - a.speed || b.tie - a.tie);
    return rows;
  }

  _perform(side, a) {
    const s = this.sides[side];
    switch (a.type) {
      case 'switch':
        this._sendIn(side, a.to, false);
        return;
      case 'run':
        this._tryRun(side);
        return;
      case 'read':
        this._doRead(side, 'Read');
        return;
      case 'lantern':
        this._captureAttempt(side, a.grade);
        return;
      case 'item':
        this._useItem(side, a.item);
        return;
      case 'scrap':
        this._useMove(side, null);
        return;
      case 'move':
        this._useMove(side, a.move);
        return;
      default:
        return;
    }
  }

  // ---- switching -------------------------------------------------------------

  _sendIn(side, to, initial) {
    const s = this.sides[side];
    const prev = s.party[s.active];
    if (!initial) {
      this._emit({ type: 'switch', side, from: prev.nickname, to: s.party[to].nickname, text: `${prev.nickname} comes back. Go, ${s.party[to].nickname}!` });
    }
    s.active = to;
    s.vol = freshVol();
    const c = s.party[to];
    s.participants.add(c.uid);
    const ability = getAbility(c.ability);
    if (isWard(ability) && this.dial !== 'freefall') this.wardBadge[side] = true;
    if (!initial || this.turn === 0) {
      if (ability.hooks.onSwitchIn) ability.hooks.onSwitchIn({ battle: this, side, self: c, foe: this.foeOf(side) });
    }
  }

  // ---- items, run, capture -------------------------------------------------------

  _useItem(side, itemId) {
    const s = this.sides[side];
    const c = this.active(side);
    if (itemId === 'crackdust') {
      s.bag.crackdust--;
      const foeSide = this.sides[1 - side];
      foeSide.vol.wardSuppressed = CRACKDUST_TURNS;
      this._emit({ type: 'item', side, item: 'crackdust', text: `Crackdust scatters over ${this.foeOf(side).nickname}.` });
      this._emit({ type: 'ward-suppressed', side: 1 - side, target: this.foeOf(side).nickname, turns: CRACKDUST_TURNS, text: `${this.foeOf(side).nickname}'s Ward is suppressed for ${CRACKDUST_TURNS} turns.` });
      return;
    }
    const idx = s.items.findIndex((it) => it.id === itemId);
    const it = s.items[idx];
    s.items.splice(idx, 1);
    this._emit({ type: 'item', side, item: it.id, text: `${s.trainer ? s.trainer.name : 'The trainer'} uses ${it.name || it.id}.` });
    if (it.heal) this._heal(side, Math.floor(c.stats.hp * it.heal), 'item');
  }

  _tryRun(side) {
    this.runAttempts++;
    const mine = this.effStat(side, 'spe');
    const theirs = this.effStat(1 - side, 'spe');
    const f = Math.floor((mine * 128) / Math.max(1, theirs)) + 30 * this.runAttempts;
    const ok = f >= 256 || this.rng.int(0, 255) < f;
    this._emit({ type: 'run', side, success: ok, text: ok ? 'Got away safely.' : 'Could not get away.' });
    if (ok) this._finish('run', null);
  }

  _captureAttempt(side, grade) {
    const s = this.sides[side];
    const target = this.foeOf(side);
    const fails = this.captureFails.get(target.uid) || 0;
    const odds = captureOdds({ catchRate: speciesOf(target).catchRate, hp: target.hp, maxHp: target.stats.hp, status: target.status ? target.status.kind : null, trapped: this.sides[1 - side].vol.trap > 0, grade, fails });
    if (s.bag.lanterns) s.bag.lanterns[grade]--;
    const success = grade === 'sure' || this.rng.chance(odds);
    const segments = success ? 3 : Math.min(2, Math.floor(odds * 3));
    this._emit({ type: 'capture-shake', side, target: target.nickname, grade, odds, band: captureBand(odds), segments, success, text: `You raise the ${LANTERN[grade].name}. The light draws ${target.nickname} in.` });
    if (success) {
      target.wild = false;
      this.caught = target;
      this._emit({ type: 'capture', side, speciesId: target.speciesId, name: target.nickname, text: `${target.nickname} was caught. Its Heartmark lights.` });
      this._finish('capture', 0);
    } else {
      const next = fails + 1;
      this.captureFails.set(target.uid, next);
      const nextOdds = captureOdds({ catchRate: speciesOf(target).catchRate, hp: target.hp, maxHp: target.stats.hp, status: target.status ? target.status.kind : null, trapped: this.sides[1 - side].vol.trap > 0, grade, fails: next });
      this._emit({ type: 'capture-fail', side, target: target.nickname, fails: next, nextOdds, text: `${target.nickname} slipped out of the light.` });
    }
  }

  // ---- moves -----------------------------------------------------------------

  _canAct(side) {
    const c = this.active(side);
    const v = this.sides[side].vol;
    if (v.flinched) {
      this._emit({ type: 'status', side, target: c.nickname, kind: 'flinch', action: 'cant-move', text: `${c.nickname} flinched.` });
      return false;
    }
    if (c.status && c.status.kind === 'chill' && this.rng.chance(0.5)) {
      this._emit({ type: 'status', side, target: c.nickname, kind: 'chill', action: 'cant-move', text: `${c.nickname} is chilled stiff.` });
      return false;
    }
    if (c.status && c.status.kind === 'numb' && this.rng.chance(0.25)) {
      this._emit({ type: 'status', side, target: c.nickname, kind: 'numb', action: 'cant-move', text: `${c.nickname} is numb and cannot move.` });
      return false;
    }
    return true;
  }

  /** @param {number} side @param {number|null} index move slot, or null for Scrap */
  _useMove(side, index) {
    const s = this.sides[side];
    const v = s.vol;
    const user = this.active(side);
    v.movedThisTurn = true;
    if (!this._canAct(side)) {
      v.charging = null;
      return;
    }
    let move;
    if (v.charging) {
      move = getMove(user.moves[v.charging.move].id);
      v.charging = null;
    } else if (index === null) {
      move = SCRAP;
    } else {
      const slot = user.moves[index];
      if (slot.pp <= 0) throw new BattleError('NO_PP', `${getMove(slot.id).name} has no PP left.`);
      slot.pp--;
      move = getMove(slot.id);
      if (move.effect.charge) {
        v.charging = { move: index };
        this._emit({ type: 'charge', side, user: user.nickname, move: move.id, moveName: move.name, text: `${user.nickname} braces for ${move.name}.` });
        return;
      }
    }
    const moveType = move.effect.queuedType && user.typeQueue ? user.typeQueue[(user.typeIndex + 1) % user.typeQueue.length] : move.type;
    this._emit({ type: 'move', side, user: user.nickname, move: move.id, moveName: move.name, moveType, category: move.category, pp: index === null || !user.moves[index] ? null : user.moves[index].pp, text: `${user.nickname} used ${move.name}.` });
    try {
      this._resolveMove(side, move, moveType);
    } finally {
      if (move.effect.scrap && !isFainted(user)) {
        const cost = Math.max(1, Math.floor(user.stats.hp * SCRAP_COST));
        this._emit({ type: 'scrap-cost', side, user: user.nickname, amount: cost, text: `${user.nickname} pays for Scrap.` });
        this._applyDamage(side, cost, 'self');
      }
    }
  }

  _resolveMove(side, move, moveType) {
    const s = this.sides[side];
    const v = s.vol;
    const user = this.active(side);
    const e = move.effect;
    const foeSide = 1 - side;
    const fs = this.sides[foeSide];
    const target = this.active(foeSide);

    // --- self-targeting status techniques ---------------------------------------
    if (e.guard) {
      if (v.guardedLast) {
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'consecutive-guard', text: `${move.name} failed. Guards fail on consecutive turns.` });
        v.guardedLast = false;
        return;
      }
      v.guarding = true;
      this._emit({ type: 'guard', side, who: user.nickname, text: `${user.nickname} guards.` });
      return;
    }
    if (e.recovery) {
      if (user.hp >= user.stats.hp) {
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'hp-full', text: `${user.nickname}'s HP is already full.` });
        return;
      }
      if (user.mends <= 0) {
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'no-mends', text: `${user.nickname} has no Mends left. ${move.name} failed.` });
        return;
      }
      user.mends--;
      this._emit({ type: 'mend-spent', side, user: user.nickname, remaining: user.mends, text: `${user.nickname} spends a Mend (${user.mends} left).` });
      if (e.recovery.delay > 0) {
        v.pendingHeal = { turns: e.recovery.delay, fraction: e.recovery.fraction, cancelledBy: e.recovery.cancelledBy || null, move: move.id };
        this._emit({ type: 'mend-pending', side, user: user.nickname, turns: e.recovery.delay, text: `${user.nickname}'s eye panel brightens.` });
      } else {
        this._heal(side, Math.floor(user.stats.hp * e.recovery.fraction), move.id);
      }
      return;
    }
    if (e.evasion) {
      this._changeStage(side, 'eva', e.evasion, { bySelf: true });
      return;
    }
    if (isSelfTargeting(move)) {
      for (const st of e.stat) this._changeStage(side, st.stat, st.stages, { bySelf: true });
      return;
    }
    if (e.selfKo) {
      const soddenOnField = [0, 1].some((i) => getAbility(this.active(i).ability).blocksSelfKo && !isFainted(this.active(i)));
      if (soddenOnField) {
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'sodden', text: `Sodden damps the burst. ${move.name} failed.` });
        return;
      }
    }

    // --- foe-targeting techniques --------------------------------------------------
    if (isFainted(target)) {
      this._emit({ type: 'message', side, text: 'There is no target.' });
      return;
    }
    if (fs.vol.guarding) {
      this._emit({ type: 'blocked', side, target: target.nickname, reason: 'guard', text: `${target.nickname} guarded.` });
      return;
    }
    const foeAbility = this.effectiveAbility(foeSide);
    const check = wardCheck(foeAbility, move, target.types, moveType);
    if (!check.lands) {
      if (check.reason === 'immune') {
        this._emit({ type: 'effectiveness', side, target: target.nickname, word: 'Blocked', mult: 0 });
        this._emit({ type: 'blocked', side, target: target.nickname, reason: 'immune', text: `It has no effect on ${target.nickname}.` });
      } else {
        this.wardBadge[foeSide] = true;
        this._emit({ type: 'effectiveness', side, target: target.nickname, word: 'Blocked', mult: check.eff.mult });
        this._emit({ type: 'blocked', side, target: target.nickname, reason: 'ward', ward: foeAbility.name, text: wardHeldText(foeAbility) });
        this._emit(this._wardReadout(side, foeAbility, target));
      }
      return;
    }

    const hits = e.multiHit ? this.rng.int(e.multiHit[0], e.multiHit[1]) : 1;
    let landed = 0;
    let totalDamage = 0;
    for (let h = 0; h < hits; h++) {
      if (isFainted(target) || isFainted(user)) break;
      if (!this._accuracyRoll(side, move, h === 0)) {
        this._missOrDecoy(side, move);
        if (!getAbility(target.ability).decoys) break;
        continue;
      }
      landed++;
      if (isDamaging(move)) {
        totalDamage += this._dealHit(side, move, moveType, check.eff, landed === 1);
      }
    }
    if (landed === 0) return;
    if (hits > 1) this._emit({ type: 'message', side, text: `Hit ${landed} time${landed === 1 ? '' : 's'}.` });
    if (isDamaging(move) && e.drain && totalDamage > 0) this._heal(side, Math.max(1, Math.floor(totalDamage * e.drain)), move.id);
    this._applySecondary(side, move, moveType, target);
    if (e.selfKo && !isFainted(user)) {
      this._applyDamage(side, user.hp, 'self');
    }
  }

  _accuracyRoll(side, move, first) {
    const user = this.active(side);
    if (isSureHit(move) || move.effect.plumbline) return true;
    const ability = getAbility(user.ability);
    if (ability.hooks.sureHitOverride && ability.hooks.sureHitOverride({ attacker: user, move, bflags: this.bflags(side) })) {
      if (first) this._emit({ type: 'ability', side, who: user.nickname, ability: ability.name, text: `${ability.name}: it cannot miss.` });
      return true;
    }
    return this.rng.chance(this.hitChance(side, move));
  }

  _missOrDecoy(side, move) {
    const foeSide = 1 - side;
    const target = this.active(foeSide);
    const fv = this.sides[foeSide].vol;
    if (getAbility(target.ability).decoys && fv.stages.eva > 0) {
      const pops = move.effect.spread ? fv.stages.eva : 1;
      fv.stages.eva -= pops;
      this._emit({ type: 'decoy-pop', side: foeSide, target: target.nickname, popped: pops, remaining: fv.stages.eva, text: `${this.active(side).nickname} hit a decoy. It pops.` });
      return;
    }
    this._emit({ type: 'miss', side, user: this.active(side).nickname, target: target.nickname, text: `${this.active(side).nickname}'s attack missed.` });
  }

  _dealHit(side, move, moveType, eff, first) {
    const user = this.active(side);
    const foeSide = 1 - side;
    const target = this.active(foeSide);
    const v = this.sides[side].vol;
    const physical = move.category === 'physical';
    const attack = this.effStat(side, physical ? 'atk' : 'spa');
    const defense = this.effStat(foeSide, physical ? 'def' : 'spd');
    const userAbility = getAbility(user.ability);
    const targetAbility = getAbility(target.ability);
    let critStage = (move.effect.highCrit || 0) + (userAbility.hooks.critStages ? userAbility.hooks.critStages() : 0);
    const crit = v.critRoll < critChance(critStage);
    const rand = 0.85 + this.rng.next() * 0.15;
    const stab = moveType !== null && (user.types.includes(moveType) || (move.id === user.heartmark && user.heartmarkStab));
    let extra = 1;
    if (userAbility.hooks.onAttackMult) extra *= userAbility.hooks.onAttackMult({ attacker: user, move, hpRatio: hpRatio(user), moveType });
    let effMult = eff.mult;
    let defText = null;
    if (targetAbility.hooks.onDefendMult) {
      const r = targetAbility.hooks.onDefendMult({ defender: target, attacker: user, move, eff, bflags: this.bflags(foeSide, target) });
      extra *= r.mult;
      defText = r.text || null;
    }
    let dmg = damageFormula({ level: user.level, power: move.power, attack, defense, typeMult: effMult, stab, crit, rand, burned: physical && user.status && user.status.kind === 'burn', extra });
    if (first) this._emit({ type: 'effectiveness', side, target: target.nickname, word: eff.word, mult: eff.mult, text: eff.word === 'Strong' ? 'Strong hit!' : eff.word === 'Weak' ? 'Weak hit.' : null });
    if (crit) this._emit({ type: 'crit', side, target: target.nickname, text: 'A critical hit!' });
    if (defText) this._emit({ type: 'ability', side: foeSide, who: target.nickname, ability: targetAbility.name, text: defText });
    const dealt = this._applyDamage(foeSide, dmg, 'party', { fromSide: side, moveType, move });
    if (moveType === 'Hollow' && this.sides[foeSide].vol.pendingHeal) {
      this.sides[foeSide].vol.pendingHeal = null;
      this._emit({ type: 'mend-cancelled', side: foeSide, target: target.nickname, text: `The Hollow hit dims ${target.nickname}'s eye panel. The heal is cancelled.` });
    }
    if (moveType === 'Kiln' && target.status && target.status.kind === 'chill') {
      target.status = null;
      this._emit({ type: 'status', side: foeSide, target: target.nickname, kind: 'chill', action: 'cure', text: `${target.nickname} thawed out.` });
    }
    if (move.effect.popsDecoy && getAbility(target.ability).decoys && this.sides[foeSide].vol.stages.eva > 0) {
      this.sides[foeSide].vol.stages.eva -= 1;
      this._emit({ type: 'decoy-pop', side: foeSide, target: target.nickname, popped: 1, remaining: this.sides[foeSide].vol.stages.eva, text: `${move.name} pops a decoy.` });
    }
    if (isFainted(target)) {
      if (userAbility.hooks.healOnKo && !isFainted(user)) {
        this._emit({ type: 'ability', side, who: user.nickname, ability: userAbility.name, text: `${userAbility.name} feeds ${user.nickname}.` });
        this._heal(side, Math.max(1, Math.floor(user.stats.hp * userAbility.hooks.healOnKo())), userAbility.id);
      }
    }
    return dealt;
  }

  _applySecondary(side, move, moveType, target) {
    const e = move.effect;
    const foeSide = 1 - side;
    const user = this.active(side);
    if (isFainted(target)) return;
    if (e.status) {
      const chance = e.status.chance ?? 1;
      if (chance >= 1 || this.rng.chance(chance)) this._tryStatus(foeSide, e.status.kind, side);
    }
    if (e.stat) {
      const chance = e.chance ?? 1;
      if (chance >= 1 || this.rng.chance(chance)) {
        for (const st of e.stat) {
          if (st.target === 'self') this._changeStage(side, st.stat, st.stages, { bySelf: true });
          else this._changeStage(foeSide, st.stat, st.stages, { bySelf: false });
        }
      }
    }
    if (e.flinch && !this.sides[foeSide].vol.movedThisTurn && this.rng.chance(e.flinch)) {
      this.sides[foeSide].vol.flinched = true;
    }
    if (e.clearRaised) {
      const st = this.sides[foeSide].vol.stages;
      const cleared = Object.keys(st).filter((k) => st[k] > 0);
      for (const k of cleared) st[k] = 0;
      this._emit({ type: 'stat', side: foeSide, target: target.nickname, stat: 'all', stages: 0, result: cleared.length ? 'cleared-raised' : 'none', text: cleared.length ? `${target.nickname}'s boosts were snuffed out.` : 'Nothing to snuff.' });
    }
    if (e.plumbline) {
      const st = this.sides[foeSide].vol.stages;
      for (const k of Object.keys(st)) st[k] = 0;
      this.sides[foeSide].vol.boostBlockUntil = this.turn + PLUMBLINE_BLOCK_TURNS;
      this._emit({ type: 'stat', side: foeSide, target: target.nickname, stat: 'all', stages: 0, result: 'cleared', text: `Plumbline. ${target.nickname}'s stat stages drop to level and it cannot re-boost for ${PLUMBLINE_BLOCK_TURNS} turns.` });
    }
    if (e.revealMoves) this.revealFoeMove(side, 4, move.name);
  }

  // ---- damage, healing, status, stages --------------------------------------------

  /**
   * Applies damage to a side's active creature with Capture Stance and the
   * 0..maxHp clamp. Returns the HP actually removed.
   * @param {number} side target side
   * @param {number} amount
   * @param {'party'|'self'|'status'} source
   */
  _applyDamage(side, amount, source, extra = {}) {
    const c = this.active(side);
    let dmg = Math.max(0, Math.floor(amount));
    if (this.kind === 'wild' && side === 1 && this.stance && source !== 'self') {
      dmg = Math.min(dmg, Math.max(0, c.hp - 1));
    }
    dmg = Math.min(dmg, c.hp);
    c.hp -= dmg;
    if (source === 'party' && extra.moveType === 'Hollow') this.sides[side].vol.hollowHitThisTurn = true;
    this._emit({ type: 'damage', side, target: c.nickname, amount: dmg, hp: c.hp, maxHp: c.stats.hp, source, stanceFloor: this.kind === 'wild' && side === 1 && this.stance && c.hp === 1 && dmg < Math.floor(amount) });
    if (isFainted(c)) this._emit({ type: 'faint', side, target: c.nickname, text: `${c.nickname} fainted.` });
    return dmg;
  }

  _heal(side, amount, source) {
    const c = this.active(side);
    const healed = Math.max(0, Math.min(Math.floor(amount), c.stats.hp - c.hp));
    c.hp += healed;
    this._emit({ type: 'heal', side, target: c.nickname, amount: healed, hp: c.hp, maxHp: c.stats.hp, source, text: `${c.nickname} recovered ${healed} HP.` });
    return healed;
  }

  _tryStatus(side, kind, fromSide) {
    const c = this.active(side);
    const name = c.nickname;
    if (kind === 'trap') {
      const v = this.sides[side].vol;
      if (v.trap > 0) {
        this._emit({ type: 'status', side, target: name, kind, action: 'already', text: `${name} is already trapped.` });
        return false;
      }
      v.trap = TRAP_TURNS;
      this._emit({ type: 'status', side, target: name, kind, action: 'inflict', turns: TRAP_TURNS, text: `${name} is trapped.` });
      return true;
    }
    if (!MAJOR_STATUS.includes(kind)) throw new RangeError(`unknown status ${String(kind)}`);
    if (c.status) {
      this._emit({ type: 'status', side, target: name, kind, action: 'already', text: `${name} already has a condition.` });
      return false;
    }
    const ability = getAbility(c.ability);
    if (c.types.includes(STATUS_TYPE_IMMUNITY[kind]) || (ability.hooks.statusImmune && ability.hooks.statusImmune(kind))) {
      this._emit({ type: 'status', side, target: name, kind, action: 'immune', text: `${name} cannot be ${describeStatus(kind)}.` });
      return false;
    }
    c.status = { kind, turns: kind === 'chill' ? this.rng.int(1, 2) : 0 };
    this._emit({ type: 'status', side, target: name, kind, action: 'inflict', text: `${name} is ${describeStatus(kind)}.` });
    return true;
  }

  _changeStage(side, stat, stages, { bySelf }) {
    const c = this.active(side);
    const v = this.sides[side].vol;
    const name = c.nickname;
    if (stages > 0 && this.turn <= v.boostBlockUntil) {
      this._emit({ type: 'stat', side, target: name, stat, stages: 0, result: 'blocked', reason: 'plumbline', text: `Plumbline holds ${name}. It cannot boost.` });
      return false;
    }
    if (stages < 0 && !bySelf) {
      const ability = getAbility(c.ability);
      if (ability.hooks.blocksForeignStatDrops && ability.hooks.blocksForeignStatDrops()) {
        this._emit({ type: 'stat', side, target: name, stat, stages: 0, result: 'blocked', reason: ability.id, text: `${ability.name} keeps ${name}'s ${STAT_NAMES[stat]} steady.` });
        return false;
      }
    }
    const cap = stat === 'eva' ? EVASION_CAP : STAGE_CAP;
    const cur = v.stages[stat];
    const next = Math.max(-STAGE_CAP, Math.min(cap, cur + stages));
    if (next === cur) {
      this._emit({ type: 'stat', side, target: name, stat, stages: 0, result: 'capped', text: stat === 'eva' ? `${name}'s evasion cannot go higher (cap +${EVASION_CAP}).` : `${name}'s ${STAT_NAMES[stat]} will not go ${stages > 0 ? 'higher' : 'lower'}.` });
      return false;
    }
    v.stages[stat] = next;
    const delta = next - cur;
    const word = Math.abs(delta) >= 2 ? 'sharply ' : '';
    this._emit({ type: 'stat', side, target: name, stat, stages: delta, stage: next, result: delta > 0 ? 'raised' : 'lowered', text: `${name}'s ${STAT_NAMES[stat]} ${word}${delta > 0 ? 'rose' : 'fell'}.` });
    if (stat === 'eva' && delta > 0 && getAbility(c.ability).decoys) {
      this._emit({ type: 'decoy', side, who: name, count: next, text: `A decoy ${name} shimmers into place (${next}).` });
    }
    return true;
  }

  // ---- end of turn -----------------------------------------------------------------

  _endOfTurn() {
    for (const s of this.sides) {
      if (this.phase === 'ended') return;
      const c = this.active(s.index);
      const v = s.vol;
      if (isFainted(c)) continue;
      if (c.status) {
        const k = c.status.kind;
        if (k === 'burn' || k === 'poison') {
          this._emit({ type: 'status', side: s.index, target: c.nickname, kind: k, action: 'tick', text: `${c.nickname} is hurt by ${k === 'burn' ? 'its burn' : 'poison'}.` });
          this._applyDamage(s.index, Math.max(1, Math.floor(c.stats.hp * CHIP[k])), 'status');
        } else if (k === 'chill') {
          c.status.turns--;
          if (c.status.turns <= 0) {
            c.status = null;
            this._emit({ type: 'status', side: s.index, target: c.nickname, kind: 'chill', action: 'cure', text: `${c.nickname} shook off the chill.` });
          }
        }
      }
      if (!isFainted(c) && v.trap > 0) {
        this._emit({ type: 'status', side: s.index, target: c.nickname, kind: 'trap', action: 'tick', text: `${c.nickname} is hurt by the trap.` });
        this._applyDamage(s.index, Math.max(1, Math.floor(c.stats.hp * CHIP.trap)), 'status');
        v.trap--;
        if (v.trap === 0 && !isFainted(c)) this._emit({ type: 'status', side: s.index, target: c.nickname, kind: 'trap', action: 'cure', text: `${c.nickname} is free of the trap.` });
      }
      if (!isFainted(c) && v.pendingHeal) {
        v.pendingHeal.turns--;
        if (v.pendingHeal.turns <= 0) {
          const p = v.pendingHeal;
          v.pendingHeal = null;
          this._heal(s.index, Math.floor(c.stats.hp * p.fraction), p.move);
        }
      }
      if (v.wardSuppressed > 0) {
        v.wardSuppressed--;
        if (v.wardSuppressed === 0) this._emit({ type: 'message', side: s.index, text: `${c.nickname}'s Ward returns.` });
      }
      v.guardedLast = v.guarding;
      v.guarding = false;
      v.turnsOut++;
      const ability = getAbility(c.ability);
      if (!isFainted(c) && ability.hooks.onTurnEnd) ability.hooks.onTurnEnd({ battle: this, side: s.index, self: c });
    }
  }

  _resolveFaints() {
    const need = [];
    for (const s of this.sides) {
      if (!isFainted(this.active(s.index))) continue;
      const alive = s.party.some((c) => !isFainted(c));
      if (!alive) {
        if (s.index === 0) return this._finish('loss', 1);
        return this._finish('win', 0);
      }
      need.push(s.index);
    }
    if (need.length) {
      this.phase = 'replace';
      this.pendingReplace = need;
      for (const side of need) this._emit({ type: 'replace-needed', side, text: side === 0 ? 'Choose your next creature.' : `${this.sides[1].trainer ? this.sides[1].trainer.name : 'The foe'} is about to send in another creature.` });
    }
  }

  _finish(outcome, winner) {
    this.phase = 'ended';
    this.outcome = outcome;
    this.winner = winner;
    this.pendingReplace = [];
    this._emit({ type: 'end', outcome, winner, text: outcomeText(outcome, this) });
    if (outcome === 'win' || outcome === 'capture') {
      this._distributeExp();
      if (this.kind === 'trainer') {
        const t = this.sides[1].trainer;
        const maxLevel = Math.max(...this.sides[1].party.map((c) => c.level));
        this.payout = t.payout ?? (t.payoutRate ?? 40) * maxLevel;
        this._emit({ type: 'payout', amount: this.payout, text: `You won ${this.payout} glint.` });
      }
    } else if (outcome === 'loss') {
      this.blackoutCost = this.summit ? 0 : Math.min(BLACKOUT_CAP, Math.floor(this.sides[0].glint * BLACKOUT_RATE));
      this._emit({ type: 'blackout', cost: this.blackoutCost, summit: this.summit, text: this.summit ? 'The Summit takes nothing.' : `You black out and lose ${this.blackoutCost} glint.` });
    }
  }

  // ---- EXP -----------------------------------------------------------------------

  _distributeExp() {
    const player = this.sides[0];
    const defeated = this.sides[1].party.filter((c) => isFainted(c) || c === this.caught);
    if (!defeated.length) return;
    const gains = new Map();
    const add = (c, amount, share) => {
      if (amount <= 0) return;
      gains.set(c.uid, (gains.get(c.uid) || 0) + amount);
      this._emit({ type: 'exp', creature: c.nickname, uid: c.uid, amount, share, text: `${c.nickname} gained ${amount} EXP${share === 'bench' ? ' (bench)' : share === 'sibling' ? ' (Big Sibling)' : share === 'yard' ? ' (Training Yard)' : ''}.` });
    };
    const recipients = player.party.filter((c) => !isFainted(c));
    for (const d of defeated) {
      const base = Math.floor((speciesOf(d).expYield * d.level) / 7) * (this.kind === 'trainer' ? TRAINER_EXP_MULT : 1);
      for (const c of recipients) {
        const share = player.participants.has(c.uid) ? 1 : BENCH_SHARE;
        let amount = Math.floor(base * share * catchUpMult(c.level, this.curveLevel));
        if (this.source === 'rematch' && this.curveLevel != null && c.level > this.curveLevel + DAMP_START) amount = Math.floor(amount * DAMP_FACTOR);
        add(c, amount, share === 1 ? 'battler' : 'bench');
      }
    }
    for (const c of recipients) {
      const ability = getAbility(c.ability);
      if (ability.expShare && player.participants.has(c.uid)) {
        const others = player.party.filter((o) => o !== c);
        if (!others.length) continue;
        const lowest = others.reduce((a, b) => (b.level < a.level ? b : a));
        add(lowest, Math.floor((gains.get(c.uid) || 0) * ability.expShare.toLowest), 'sibling');
      }
    }
    const partyTotal = [...gains.values()].reduce((a, b) => a + b, 0);
    for (const y of this.yard.slice(0, 3)) add(y, Math.floor(partyTotal * YARD_SHARE), 'yard');
    const all = [...player.party, ...this.yard.slice(0, 3)];
    for (const c of all) {
      const amount = gains.get(c.uid);
      if (!amount) continue;
      const r = gainExp(c, amount);
      this.expReport.push({ uid: c.uid, name: c.nickname, amount, from: r.from, to: r.to, learned: r.learned, offers: r.offers });
      if (r.to > r.from) {
        this._emit({ type: 'levelup', creature: c.nickname, uid: c.uid, from: r.from, to: r.to, stats: r.statsAfter, text: `${c.nickname} grew to Lv${r.to}.` });
        for (const mv of r.learned) this._emit({ type: 'learn', creature: c.nickname, uid: c.uid, move: mv, text: `${c.nickname} learned ${getMove(mv).name}.` });
        for (const mv of r.offers) this._emit({ type: 'learn-offer', creature: c.nickname, uid: c.uid, move: mv, text: `${c.nickname} wants to learn ${getMove(mv).name}, but its slots are full.` });
      }
    }
  }

  // ---- Ward readout ---------------------------------------------------------------

  /**
   * The readout after a blocked hit (rules 8.3): which party techniques can
   * land, which types can hit it, which indirect damage works, Crackdust.
   */
  _wardReadout(side, ability, target) {
    const s = this.sides[side];
    const canLand = [];
    const outOfPp = [];
    for (const c of s.party) {
      if (isFainted(c)) continue;
      for (const m of c.moves) {
        const mv = getMove(m.id);
        if (!isDamaging(mv) || mv.effect.scrap) continue;
        const type = mv.effect.queuedType && c.typeQueue ? c.typeQueue[(c.typeIndex + 1) % c.typeQueue.length] : mv.type;
        if (!wardCheck(ability, mv, target.types, type).lands) continue;
        const entry = { creature: c.nickname, uid: c.uid, move: mv.id, moveName: mv.name, type, pp: m.pp };
        if (m.pp > 0) canLand.push(entry);
        else outOfPp.push(entry);
      }
    }
    const types = ORDINARY_TYPES.filter((t) => wardCheck(ability, { category: 'special', power: 100, type: t, effect: {} }, target.types, t).lands);
    const indirect = ability.ward.kind === 'no-status' ? ['poison (from a damaging hit)', 'burn (from a damaging hit)'] : ['poison', 'burn', 'trap'];
    const lines = [wardHeldText(ability)];
    lines.push(canLand.length ? `Can land: ${canLand.map((e) => `${e.creature}'s ${e.moveName}`).join(', ')}.` : 'Nothing in your party lands right now.');
    if (outOfPp.length) lines.push(`Out of PP: ${outOfPp.map((e) => `${e.creature}'s ${e.moveName}`).join(', ')}.`);
    lines.push(types.length ? `Types that get through: ${types.join(', ')}.` : 'No type gets through directly.');
    lines.push(`Indirect damage that works: ${indirect.join(', ')}.`);
    if (s.bag.crackdust > 0) lines.push(`You carry Crackdust (${s.bag.crackdust}).`);
    return { type: 'ward-readout', side, target: target.nickname, ward: ability.name, wardKind: ability.ward.kind, canLand, outOfPp, types, indirect, crackdust: s.bag.crackdust > 0, text: lines.join(' ') };
  }

  // ---- events ------------------------------------------------------------------------

  _emit(ev) {
    this._events.push(ev);
    this.log.push(ev);
  }

  _flush() {
    const out = this._events;
    this._events = [];
    return out;
  }
}

function describeStatus(kind) {
  return { burn: 'burned', poison: 'poisoned', chill: 'chilled', numb: 'numbed' }[kind] || kind;
}

function outcomeText(outcome, b) {
  switch (outcome) {
    case 'win': return b.kind === 'trainer' ? `You beat ${b.sides[1].trainer.name}.` : `The wild ${b.sides[1].party[0].nickname} fainted.`;
    case 'loss': return 'You have no creatures left.';
    case 'capture': return `${b.caught.nickname} joins you.`;
    case 'run': return 'You got away.';
    default: return 'The battle ends in a draw.';
  }
}

/**
 * Creates a battle. See {@link Battle} for the options.
 * @param {ConstructorParameters<typeof Battle>[0]} opts
 * @returns {Battle}
 */
export function createBattle(opts) {
  return new Battle(opts);
}
