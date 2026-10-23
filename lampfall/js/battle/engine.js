/**
 * The battle engine: a pure, deterministic singles state machine a UI drives
 * step by step. [BATTLE-RULES] Adopted from proto/battle/engine.js
 * (ARCHITECTURE §5.1) with these changes:
 * - content is injected (`setup.data = {species, moves, abilities, types}` or a
 *   Registry); js/battle imports no table, names no species and no type;
 * - abilities are data rows + `battle/abilityHooks.js` hooks merged at run time;
 * - uids are opaque (strings from `systems/party.nextUid`), never generated here;
 * - per-dial rules come from `setup.rules` over {@link DIAL_RULES};
 * - every designer number is in {@link DEFAULTS} and overridable by `setup.tuning`;
 * - `legal(side)` / `step(action)` are the primary names (`availableActions` /
 *   `submit` remain as aliases).
 *
 * The UI asks {@link Battle#legal} what a side may do, submits one action per
 * side with {@link Battle#step} (or {@link Battle#submit}), and animates the
 * events that come back (contract: `battle/events.js`). Side 0 is always the
 * player. Outcomes: 'win' | 'loss' | 'capture' | 'run' | 'holdout' | 'draw'.
 *
 * Pure: no DOM, no clock; every random decision draws from the injected rng.
 * @module battle/engine
 */

import {
  DEFAULTS as EFFECT_DEFAULTS, mergeTuning, stageMult, critChance, damageFormula, damageRoll, captureOdds, captureBand, catchUpMult,
  isDamaging, isSureHit, isSelfTargeting, isChipMove, moveTypeFor, wardCheck, wardHeldText, wardIndirect, isWard, MAJOR_STATUS,
} from './effects.js';
import { DEFAULTS as ABILITY_DEFAULTS } from './abilityHooks.js';
import { DEFAULTS as CREATURE_DEFAULTS, gainExp as defaultGainExp, isFainted, hpRatio } from './creatureOps.js';
import { DEFAULTS as DATA_DEFAULTS, createBattleData } from './data.js';
import { readCreature } from './read.js';

export { stageMult, critChance, damageFormula, captureOdds, captureBand, catchUpMult } from './effects.js';
export { readCreature, readCard, dossier } from './read.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Engine-only tunables (merged into {@link DEFAULTS}). */
const ENGINE_DEFAULTS = Object.freeze({
  /** Accuracy multipliers by the target's evasion stage (rules 10.1). */
  evasionMult: Object.freeze([1, 0.83, 0.67]),
  /** Evasion stage cap. */
  evasionCap: 2,
  /** Cap for every other stat stage (both directions). */
  stageCap: 6,
  /** Scrap self-cost as a fraction of max HP. */
  scrapCost: 1 / 8,
  /** End-of-turn chip fractions of max HP. */
  chip: Object.freeze({ burn: 1 / 16, poison: 1 / 8, trap: 1 / 8 }),
  /** Trap duration in turns. */
  trapTurns: 4,
  /** Crackdust Ward suppression: full turns after the throw. */
  crackdustTurns: 3,
  /** Plumbline re-boost block in turns after the hit. */
  plumblineBlockTurns: 2,
  /** Plumbline passes every Ward, Mirrorveil included (GDD-00 ruling; false = the prototype, where a status Ward blocked it). */
  plumblineIgnoresWards: true,
  /** Speed multiplier while numbed. */
  numbSpeedMult: 0.5,
  /** Chance a numbed creature loses its turn. */
  numbSkipChance: 0.25,
  /** Chance a chilled creature loses its turn. */
  chillSkipChance: 0.5,
  /** Chill duration range in turns. */
  chillTurnsMin: 1,
  chillTurnsMax: 2,
  /** Bench EXP share (party members that did not battle) and Training Yard share of party EXP. */
  benchShare: 0.6,
  yardShare: 0.25,
  /** Training Yard creatures that receive EXP. */
  yardMax: 3,
  /** Over-curve damping (Rematch-board EXP only): starts past curve + dampStart, multiplies by dampFactor. */
  dampStart: 10,
  dampFactor: 0.5,
  /** Blackout: share of glint lost, and its cap. Summit losses cost nothing. */
  blackoutRate: 0.1,
  blackoutCap: 3000,
  /** Trainer battle EXP multiplier. */
  trainerExpMult: 1.5,
  /** EXP per defeated creature = floor(expYield * level / expYieldDivisor). */
  expYieldDivisor: 7,
  /** Default trainer payout per level of their highest creature. */
  payoutPerLevel: 40,
  /** Flat EXP for a survived hold-out scene (battlers get all of it, the bench `benchShare`); 0 = none (prototype). */
  holdOutExp: 0,
  /** Run odds: floor(mySpe * runSpeedScale / theirSpe) + runAttemptBonus * attempts, out of runAutoThreshold. */
  runSpeedScale: 128,
  runAttemptBonus: 30,
  runAutoThreshold: 256,
  /** Turn cap: the battle ends as a 'draw' (a safety net; never reached in play). */
  maxTurns: 200,
  /** Action priority brackets (moves use their own `priority`). */
  actionPriority: Object.freeze({ run: 7, switch: 6, item: 6, lantern: 6, read: 5, scrap: 0 }),
});

/**
 * Every designer-tunable number the battle rules read, by name: the engine's own
 * plus those of `effects.js`, `creatureOps.js`, `abilityHooks.js` and `data.js`.
 * Override any subset with `createBattle({tuning})`.
 * @type {Readonly<typeof EFFECT_DEFAULTS & typeof CREATURE_DEFAULTS & typeof ABILITY_DEFAULTS & typeof DATA_DEFAULTS & typeof ENGINE_DEFAULTS>}
 */
export const DEFAULTS = Object.freeze({ ...EFFECT_DEFAULTS, ...CREATURE_DEFAULTS, ...ABILITY_DEFAULTS, ...DATA_DEFAULTS, ...ENGINE_DEFAULTS });

/** Every key of {@link DEFAULTS}: the names `createBattle({tuning})` accepts (the GDD tuning table's battle keys). */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));
/** Alias of {@link TUNING_KEYS}. */
export const tuningKeys = TUNING_KEYS;

// Convenience names for the defaults most callers and tests read (each equals its DEFAULTS key).
/** `DEFAULTS.evasionMult`. */
export const EVASION_MULT = DEFAULTS.evasionMult;
/** `DEFAULTS.evasionCap`. */
export const EVASION_CAP = DEFAULTS.evasionCap;
/** `DEFAULTS.stageCap`. */
export const STAGE_CAP = DEFAULTS.stageCap;
/** `DEFAULTS.critRates`. */
export const CRIT_RATES = DEFAULTS.critRates;
/** `DEFAULTS.critMult`. */
export const CRIT_MULT = DEFAULTS.critMult;
/** `DEFAULTS.stab`. */
export const STAB = DEFAULTS.stab;
/** `DEFAULTS.scrapCost`. */
export const SCRAP_COST = DEFAULTS.scrapCost;
/** `DEFAULTS.chip`. */
export const CHIP = DEFAULTS.chip;
/** `DEFAULTS.trapTurns`. */
export const TRAP_TURNS = DEFAULTS.trapTurns;
/** `DEFAULTS.crackdustTurns`. */
export const CRACKDUST_TURNS = DEFAULTS.crackdustTurns;
/** `DEFAULTS.plumblineBlockTurns`. */
export const PLUMBLINE_BLOCK_TURNS = DEFAULTS.plumblineBlockTurns;
/** `DEFAULTS.captureFailBonus`. */
export const CAPTURE_FAIL_BONUS = DEFAULTS.captureFailBonus;
/** `DEFAULTS.captureFailCap`. */
export const CAPTURE_FAIL_CAP = DEFAULTS.captureFailCap;
/** `DEFAULTS.lantern`. */
export const LANTERN = DEFAULTS.lantern;
/** `DEFAULTS.captureBands`. */
export const CAPTURE_BANDS = DEFAULTS.captureBands;
/** `DEFAULTS.benchShare`. */
export const BENCH_SHARE = DEFAULTS.benchShare;
/** `DEFAULTS.yardShare`. */
export const YARD_SHARE = DEFAULTS.yardShare;
/** `DEFAULTS.catchUpStep`. */
export const CATCH_UP_STEP = DEFAULTS.catchUpStep;
/** `DEFAULTS.catchUpCap`. */
export const CATCH_UP_CAP = DEFAULTS.catchUpCap;
/** `DEFAULTS.dampStart`. */
export const DAMP_START = DEFAULTS.dampStart;
/** `DEFAULTS.dampFactor`. */
export const DAMP_FACTOR = DEFAULTS.dampFactor;
/** `DEFAULTS.blackoutRate`. */
export const BLACKOUT_RATE = DEFAULTS.blackoutRate;
/** `DEFAULTS.blackoutCap`. */
export const BLACKOUT_CAP = DEFAULTS.blackoutCap;
/** `DEFAULTS.trainerExpMult`. */
export const TRAINER_EXP_MULT = DEFAULTS.trainerExpMult;
/** `DEFAULTS.maxTurns`. */
export const MAX_TURNS = DEFAULTS.maxTurns;
/** `DEFAULTS.mendsPerBattle`. */
export const MENDS_PER_BATTLE = DEFAULTS.mendsPerBattle;

/** The three Chaos dial positions. */
export const DIALS = Object.freeze(['drift', 'flux', 'freefall']);

/**
 * Per-dial battle rules (rules 17.1). `createBattle({rules})` may override any key
 * (the flow resolves them from `data/dials.js`).
 * - `readCostsTurn`: an in-battle Read spends the turn (Freefall) or is free once per foe
 * - `captureDisplay`: 'exact' percentages or 'bands' (Low / Fair / Good)
 * - `wardBadge`: the "Ward ?" badge shows from 'start' or only 'after-block'
 * - `runAllowed`: Run from wild battles (trainer battles never allow it)
 * - `holdOutTurns`: null, or end the battle as a 'holdout' after this many turns
 * @typedef {{readCostsTurn: boolean, captureDisplay: 'exact'|'bands', wardBadge: 'start'|'after-block', runAllowed: boolean, holdOutTurns: number|null}} DialRules
 * @type {Readonly<Record<string, Readonly<DialRules>>>}
 */
export const DIAL_RULES = Object.freeze({
  drift: Object.freeze({ readCostsTurn: false, captureDisplay: 'exact', wardBadge: 'start', runAllowed: true, holdOutTurns: null }),
  flux: Object.freeze({ readCostsTurn: false, captureDisplay: 'exact', wardBadge: 'start', runAllowed: true, holdOutTurns: null }),
  freefall: Object.freeze({ readCostsTurn: true, captureDisplay: 'bands', wardBadge: 'after-block', runAllowed: true, holdOutTurns: null }),
});

/**
 * Resolves a dial rule row into the engine's canonical {@link DialRules}, accepting the
 * spellings `data/dials.js` rows use: `captureDisplay` 'percent' (= 'exact') or 'band'
 * (= 'bands'); `wardBadge` true (= 'start') or false (= 'after-block'); `holdOutTurns` 0
 * (= null, no hold-out). Keys the engine does not read (e.g. `rerollCostMult`) are dropped.
 * @param {Record<string, any>} rules a full row (defaults merged in by the caller)
 * @returns {DialRules}
 * @throws {RangeError} for a value the engine cannot read (it never guesses)
 */
export function normalizeDialRules(rules) {
  const r = rules || {};
  const display = { exact: 'exact', percent: 'exact', bands: 'bands', band: 'bands' }[r.captureDisplay];
  if (!display) throw new RangeError(`dial rules: captureDisplay must be 'exact' | 'percent' | 'bands' | 'band', got ${String(r.captureDisplay)}`);
  const badge = r.wardBadge === true ? 'start' : r.wardBadge === false ? 'after-block' : r.wardBadge;
  if (badge !== 'start' && badge !== 'after-block') throw new RangeError(`dial rules: wardBadge must be 'start' | 'after-block' | boolean, got ${String(r.wardBadge)}`);
  for (const k of ['readCostsTurn', 'runAllowed']) if (typeof r[k] !== 'boolean') throw new RangeError(`dial rules: ${k} must be a boolean, got ${String(r[k])}`);
  const hold = r.holdOutTurns == null || r.holdOutTurns === 0 ? null : r.holdOutTurns;
  if (hold !== null && !(Number.isInteger(hold) && hold > 0)) throw new RangeError(`dial rules: holdOutTurns must be null, 0 or a positive integer, got ${String(r.holdOutTurns)}`);
  return { readCostsTurn: r.readCostsTurn, captureDisplay: display, wardBadge: badge, runAllowed: r.runAllowed, holdOutTurns: hold };
}

/** Item action id of the Ward-suppressing dust (an engine mechanic, carried in `SideInput.bag.crackdust`). */
export const CRACKDUST = 'crackdust';

const STAT_NAMES = Object.freeze({ atk: 'Attack', def: 'Defence', spa: 'Sp. Attack', spd: 'Sp. Defence', spe: 'Speed', eva: 'evasion', all: 'stats' });
const STATUS_WORD = Object.freeze({ burn: 'burned', poison: 'poisoned', chill: 'chilled', numb: 'numbed' });
const CURE_WORD = Object.freeze({ chill: 'thawed out', burn: 'cooled its burn', poison: 'shook off the poison', numb: 'shook off the numbness' });

/** Error thrown for an illegal action (the menu should never let one through). */
export class BattleError extends Error {
  /** @param {string} code machine-readable reason @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'BattleError';
    /** @type {string} */
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/** @typedef {import('./creatureOps.js').BattleCreature} Creature */
/** @typedef {import('./events.js').BattleEvent} BattleEvent */

/**
 * @typedef {Object} SideInput
 * @property {Creature[]} party                      deep copies; the engine owns and mutates them
 * @property {{id?: string, name: string, title?: string, items?: Array<{id: string, name?: string, heal?: number}>, payout?: number, payoutRate?: number, tacticTag?: string}} [trainer]
 * @property {{crackdust?: number, lanterns?: Record<string, number>|null}} [bag]   lanterns null = unlimited
 * @property {number} [glint]                        wallet at battle start (blackout cost base)
 */

/**
 * @typedef {{type: 'move', move: number} | {type: 'switch', to: number} | {type: 'item', id?: string, item?: string} |
 *   {type: 'lantern', grade: number|string} | {type: 'run'} | {type: 'read'} | {type: 'scrap'}} Action
 */

/**
 * @typedef {Object} BattleSetup
 * @property {[SideInput, SideInput]} sides           side 0 is always the player
 * @property {'wild'|'trainer'} kind                  Spire / Summit / rival are 'trainer' with `source` / `summit`
 * @property {any} data                               `{species, moves, abilities, types}`, a Registry or a BattleData view
 * @property {'drift'|'flux'|'freefall'} [dial='flux']
 * @property {{next: () => number, int: (a: number, b: number) => number, chance: (p: number) => boolean, pick: (a: any[]) => any, weighted?: (e: any[]) => any}} [rng]  may also be createBattle's 2nd argument
 * @property {boolean} [captureStance=false]
 * @property {number|null} [curveLevel=null]          island curve level (catch-up EXP)
 * @property {boolean} [summit=false]                 losses cost nothing
 * @property {'route'|'story'|'spire'|'rematch'|'duel'} [source='route']   EXP source; 'rematch' is damped over the curve
 * @property {((battle: Battle, side: number) => Action)|null} [foeAi]     fills side 1's action when omitted (battle/ai.js)
 * @property {Creature[]} [yard]                      Training Yard creatures (share of party EXP)
 * @property {{seen: Set<string>, read: Set<string>}} [fieldLog]   built by the flow from world.fieldLog; the engine adds to it
 * @property {boolean} [prism=false]                  Scouting Prism owned
 * @property {Partial<DialRules>|Record<string, any>} [rules]   overrides of the dial's {@link DIAL_RULES}; a `data/dials.js` `rules` row works as is (see {@link normalizeDialRules})
 * @property {number|null} [holdOut]                  end as 'holdout' after this many turns (opening scene)
 * @property {string|number} [nextUid]                uid given to a caught creature
 * @property {(attempt: number) => {chance: (p: number) => boolean}} [captureRng]   optional per-attempt stream for the
 *   Lantern roll (GDD-00: `capture:<battleId>:<attempt>`, attempt counts from 0 per battle); default: the battle rng
 * @property {Partial<typeof DEFAULTS>} [tuning]      overrides of {@link DEFAULTS}
 * @property {(c: Creature, amount: number) => import('./creatureOps.js').ExpGain} [gainExp]   level-up implementation (default: creatureOps.gainExp)
 */

/**
 * @typedef {Object} BattleResult
 * @property {boolean} ended  @property {string|null} outcome  @property {0|1|null} winner  @property {number} turns
 * @property {Array<{uid: any, name: string, amount: number, from: number, to: number, levelsGained: number, learned: string[], offers: string[]}>} exp
 * @property {number} payout  @property {number} blackoutCost  @property {boolean} summitNoLoss  @property {Creature|null} caught
 */

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
    trap: 0,
    wardSuppressed: 0,
    critRoll: 1,
    turnsOut: 0,
  };
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

/** One battle. Build it with {@link createBattle}. */
export class Battle {
  /**
   * @param {BattleSetup & {rng: NonNullable<BattleSetup['rng']>}} opts
   * @throws {TypeError|RangeError} for a malformed setup
   */
  constructor(opts) {
    if (!opts || !Array.isArray(opts.sides) || opts.sides.length !== 2) throw new TypeError('createBattle: sides must be [player, foe]');
    if (opts.kind !== 'wild' && opts.kind !== 'trainer') throw new RangeError(`createBattle: kind must be 'wild' or 'trainer', got ${String(opts.kind)}`);
    const dial = opts.dial || 'flux';
    if (!DIALS.includes(dial)) throw new RangeError(`createBattle: unknown dial ${String(dial)}`);
    if (!opts.rng || typeof opts.rng.next !== 'function' || typeof opts.rng.int !== 'function' || typeof opts.rng.chance !== 'function') {
      throw new TypeError('createBattle: rng with next()/int()/chance()/pick() is required');
    }
    if (!opts.data) throw new TypeError('createBattle: data {species, moves, abilities, types} is required');
    /** @type {Readonly<typeof DEFAULTS>} */
    this.tuning = mergeTuning(DEFAULTS, opts.tuning, 'createBattle');
    /** @type {import('./data.js').BattleData} */
    this.data = createBattleData(opts.data, { tuning: opts.tuning });
    this.kind = opts.kind;
    this.dial = dial;
    /** @type {DialRules} */
    this.rules = normalizeDialRules({ ...DIAL_RULES[dial], ...(opts.rules || {}) });
    if (opts.holdOut != null) {
      if (!(Number.isInteger(opts.holdOut) && opts.holdOut > 0)) throw new RangeError(`createBattle: holdOut must be a positive integer, got ${String(opts.holdOut)}`);
      this.rules.holdOutTurns = opts.holdOut;
    }
    this.nextUid = opts.nextUid;
    if (opts.captureRng != null && typeof opts.captureRng !== 'function') throw new TypeError('createBattle: captureRng must be a function (attempt) => Rng');
    /** @type {((attempt: number) => {chance: (p: number) => boolean})|null} */
    this.captureRng = opts.captureRng || null;
    /** Lantern attempts made this battle (the `captureRng` attempt index). */
    this.captureAttempts = 0;
    this.rng = opts.rng;
    this.curveLevel = opts.curveLevel ?? null;
    this.summit = !!opts.summit;
    this.source = opts.source || 'route';
    this.foeAi = opts.foeAi || null;
    this.yard = opts.yard || [];
    this.prism = !!opts.prism;
    this.fieldLog = opts.fieldLog || { seen: new Set(), read: new Set() };
    const tuning = this.tuning;
    const data = this.data;
    /** @type {(c: Creature, amount: number) => import('./creatureOps.js').ExpGain} */
    this._gainExp = typeof opts.gainExp === 'function' ? opts.gainExp : (c, amount) => defaultGainExp(c, amount, data, { tuning });
    this.turn = 0;
    /** @type {'choose'|'replace'|'ended'} */
    this.phase = 'choose';
    /** @type {number[]} */
    this.pendingReplace = [];
    /** @type {string|null} */
    this.outcome = null;
    /** @type {0|1|null} */
    this.winner = null;
    /** @type {Creature|null} */
    this.caught = null;
    this.runAttempts = 0;
    /** @type {Map<any, number>} */
    this.captureFails = new Map();
    /** @type {BattleResult['exp']} */
    this.expReport = [];
    this.payout = 0;
    this.blackoutCost = 0;
    /** Per-side scratch for the AI and ability hooks (plain objects, per battle). */
    this.memo = [{}, {}];
    /** @type {BattleEvent[]} every event of the battle, in order */
    this.log = [];
    /** @type {BattleEvent[]} */
    this._events = [];
    this.sides = opts.sides.map((s, i) => {
      if (!s || !Array.isArray(s.party) || s.party.length === 0) throw new TypeError(`createBattle: side ${i} needs a non-empty party`);
      s.party.forEach((c, j) => {
        checkCreature(c, `createBattle: side ${i} party[${j}]`);
        data.species(c.speciesId);
        data.ability(c.ability);
        for (const m of c.moves) data.move(m.id);
      });
      const first = s.party.findIndex((c) => !isFainted(c));
      if (first < 0) throw new RangeError(`createBattle: side ${i} has no healthy creature`);
      return {
        index: i,
        party: s.party,
        trainer: s.trainer || null,
        bag: { crackdust: 0, lanterns: null, ...(s.bag || {}) },
        glint: Number.isFinite(s.glint) && s.glint > 0 ? s.glint : 0,
        items: s.trainer && s.trainer.items ? s.trainer.items.map((it) => ({ ...it })) : [],
        active: first,
        vol: freshVol(),
        /** @type {Map<any, Record<string, any>>} */
        bflags: new Map(),
        /** @type {Set<any>} */
        participants: new Set(),
        /** @type {Set<any>} */
        readUsed: new Set(),
      };
    });
    if (this.kind === 'wild' && this.sides[1].trainer) throw new RangeError('createBattle: a wild battle has no foe trainer');
    if (this.kind === 'trainer' && !this.sides[1].trainer) this.sides[1].trainer = { name: 'Trainer' };
    this.stance = this.kind === 'wild' ? !!opts.captureStance : false;
    /** uids whose "Ward ?" badge has been revealed (per creature, so it follows switches). */
    this.wardBadgeUids = new Set();
    for (const side of this.sides) {
      for (const c of side.party) {
        c.mends = tuning.mendsPerBattle;
        if (Array.isArray(c.typeQueue) && c.typeQueue.length) {
          c.typeIndex = 0;
          c.types = [c.typeQueue[0]];
        }
      }
    }
    this.sides[1].party.forEach((c) => this.fieldLog.seen.add(c.speciesId));
    this.sides[0].party.forEach((c) => this.fieldLog.seen.add(c.speciesId));
    this._emit({ type: 'message', text: this.kind === 'wild' ? `A wild ${this.active(1).nickname} appeared.` : `${this.sides[1].trainer.name} wants to battle.` });
    for (const side of this.sides) this._sendIn(side.index, side.active, true);
    /** @type {BattleEvent[]} events from the opening send-ins (switch-in abilities fire here) */
    this.intro = this._flush();
  }

  // ---- queries -------------------------------------------------------------

  /** @param {number} side @returns {Creature} the side's active creature */
  active(side) {
    const s = this.sides[side];
    return s.party[s.active];
  }

  /** @param {number} side @returns {Creature} the opposing active creature */
  foeOf(side) {
    return this.active(1 - side);
  }

  /** @param {number} side @returns {boolean} whether this side is the player */
  isPlayer(side) {
    return side === 0;
  }

  /**
   * Per-creature, per-battle scratch flags (first-hit abilities).
   * @param {number} side @param {Creature} [c] @returns {Record<string, any>}
   */
  bflags(side, c = this.active(side)) {
    const s = this.sides[side];
    if (!s.bflags.has(c.uid)) s.bflags.set(c.uid, {});
    return /** @type {Record<string, any>} */ (s.bflags.get(c.uid));
  }

  /** @param {number} side @returns {boolean} whether the "Ward ?" badge shows beside this side's active creature */
  wardBadge(side) {
    return this.wardBadgeUids.has(this.active(side).uid);
  }

  /** @param {number} side @param {Creature} [c] */
  _revealWard(side, c = this.active(side)) {
    if (isWard(this.data.ability(c.ability))) this.wardBadgeUids.add(c.uid);
  }

  /**
   * Effective ability of the active creature (null while Crackdust suppresses a Ward).
   * @param {number} side @returns {import('./abilityHooks.js').AbilityRuntime|null}
   */
  effectiveAbility(side) {
    const ability = this.data.ability(this.active(side).ability);
    if (isWard(ability) && this.sides[side].vol.wardSuppressed > 0) return null;
    return ability;
  }

  /**
   * {@link wardCheck} under this battle's rules (Plumbline may pass every Ward).
   * @param {any} ability @param {import('./effects.js').Move} move @param {readonly string[]} types @param {string|null} moveType
   * @returns {ReturnType<typeof wardCheck>}
   */
  _wardCheck(ability, move, types, moveType) {
    return wardCheck(ability, move, types, moveType, this.data.chart, { plumblineIgnoresWards: this.tuning.plumblineIgnoresWards });
  }

  /**
   * Effective stat with stages and numb.
   * @param {number} side @param {'atk'|'def'|'spa'|'spd'|'spe'} key @returns {number}
   */
  effStat(side, key) {
    const c = this.active(side);
    const v = this.sides[side].vol;
    let value = c.stats[key] * stageMult(v.stages[key]);
    if (key === 'spe' && c.status && c.status.kind === 'numb') value *= this.tuning.numbSpeedMult;
    return Math.max(1, Math.floor(value));
  }

  /**
   * Hit chance of a move from `side` against the foe (what the move panel shows).
   * @param {number} side @param {import('./effects.js').Move} move @returns {number}
   */
  hitChance(side, move) {
    if (isSureHit(move) || move.effect.plumbline) return 1;
    if (isSelfTargeting(move)) return 1;
    const acc = move.accuracy === null ? 100 : move.accuracy;
    const eva = this.sides[1 - side].vol.stages.eva;
    const mult = this.tuning.evasionMult;
    return (acc / 100) * mult[Math.max(0, Math.min(this.tuning.evasionCap, mult.length - 1, eva))];
  }

  /**
   * Damage range of a move slot against the current foe, without rolling or
   * changing anything (no crit, no first-hit flags consumed). For the AI and
   * for UI previews.
   * @param {number} side
   * @param {number|null} index move slot, or null for Scrap
   * @returns {{min: number, max: number, lands: boolean}}
   */
  estimateDamage(side, index) {
    const user = this.active(side);
    const foeSide = 1 - side;
    const target = this.active(foeSide);
    if (index !== null && !(Number.isInteger(index) && user.moves[index])) throw new BattleError('BAD_MOVE', `Side ${side}: no move at slot ${String(index)}.`);
    const move = index === null ? this.data.scrap : this.data.move(user.moves[index].id);
    if (!isDamaging(move) || isFainted(target)) return { min: 0, max: 0, lands: isDamaging(move) };
    const moveType = moveTypeFor(move, user);
    const check = this._wardCheck(this.effectiveAbility(foeSide), move, target.types, moveType);
    if (!check.lands) return { min: 0, max: 0, lands: false };
    const physical = move.category === 'physical';
    const attack = this.effStat(side, physical ? 'atk' : 'spa');
    const defense = this.effStat(foeSide, physical ? 'def' : 'spd');
    const ua = this.data.ability(user.ability);
    const ta = this.data.ability(target.ability);
    let extra = 1;
    if (ua.hooks.onAttackMult) extra *= ua.hooks.onAttackMult({ attacker: user, move, hpRatio: hpRatio(user), moveType });
    if (ta.hooks.onDefendMult) extra *= ta.hooks.onDefendMult({ defender: target, attacker: user, move, eff: check.eff, bflags: { ...this.bflags(foeSide, target) } }).mult;
    const stab = moveType !== null && (user.types.includes(moveType) || (move.id === user.heartmark && user.heartmarkStab));
    const burned = physical && !!user.status && user.status.kind === 'burn';
    const base = { level: user.level, power: move.power, attack, defense, typeMult: check.eff.mult, stab, crit: false, burned, extra };
    const hits = move.effect.multiHit || [1, 1];
    return {
      min: damageFormula({ ...base, rand: this.tuning.damageRollMin }, this.tuning) * hits[0],
      max: damageFormula({ ...base, rand: 1 }, this.tuning) * hits[1],
      lands: true,
    };
  }

  /**
   * Snapshot for the UI (plain data, safe to JSON). `boostBlocked` describes the
   * coming turn (the menu is drawn for it).
   * @returns {Record<string, any>}
   */
  state() {
    return {
      kind: this.kind,
      dial: this.dial,
      rules: { ...this.rules },
      turn: this.turn,
      phase: this.phase,
      pendingReplace: this.pendingReplace.slice(),
      outcome: this.outcome,
      winner: this.winner,
      captureStance: this.stance,
      sides: this.sides.map((s) => ({
        active: s.active,
        trainer: s.trainer ? s.trainer.name : null,
        wardBadge: this.wardBadge(s.index),
        stages: { ...s.vol.stages },
        guarding: s.vol.guarding,
        boostBlocked: this.turn < s.vol.boostBlockUntil,
        boostBlockedTurns: Math.max(0, s.vol.boostBlockUntil - this.turn),
        trapped: s.vol.trap > 0,
        charging: s.vol.charging ? s.party[s.active].moves[s.vol.charging.move].id : null,
        pendingHeal: s.vol.pendingHeal ? Math.max(0, s.vol.pendingHeal.until - this.turn) : null,
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
   * What a side may do now. Every entry carries `selectable` (alias `usable`)
   * and, when it is not selectable, a `reason` for the menu. Move and switch
   * entries carry their slot as `index` (alias `i`). The menu is never empty:
   * with every move at 0 PP, Scrap is offered.
   * @param {number} [side=0]
   * @returns {Record<string, any>} {side, phase, locked, moves, scrap, switches, run, read, lantern, captureStance, items}
   */
  legal(side = 0) {
    const s = this.sides[side];
    const c = this.active(side);
    const v = s.vol;
    const foe = this.foeOf(side);
    const foeAbility = this.effectiveAbility(1 - side);
    const t = this.tuning;
    /** @type {Record<string, any>} */
    const out = { side, phase: this.phase, locked: null, moves: [], scrap: null, switches: [], run: null, read: null, lantern: null, captureStance: null, items: [] };
    if (this.phase === 'ended') return out;
    if (this.phase === 'replace') {
      out.switches = this._switchOptions(side, true);
      return out;
    }
    if (v.charging) {
      out.locked = { type: 'move', move: v.charging.move, reason: `${c.nickname} is braced for ${this.data.move(c.moves[v.charging.move].id).name}.` };
    }
    const allOut = c.moves.every((m) => m.pp <= 0);
    out.moves = c.moves.map((m, i) => {
      const mv = this.data.move(m.id);
      const type = moveTypeFor(mv, c);
      // Damaging moves and foe-aimed status moves are checked against the Ward (a status Ward
      // blocks the latter), so the menu and the AI both see "Blocked by Ward".
      const check = isDamaging(mv) || !isSelfTargeting(mv) ? this._wardCheck(foeAbility, mv, foe.types, type) : { lands: true, reason: null, eff: { mult: 1, word: 'Neutral' } };
      const selectable = m.pp > 0;
      const reason = selectable ? null : 'No PP left.';
      const word = check.reason === 'ward' ? 'Blocked by Ward' : check.reason === 'immune' ? 'No effect' : isDamaging(mv) ? check.eff.word : null;
      return { index: i, i, id: mv.id, name: mv.name, type, category: mv.category, power: mv.power, pp: m.pp, maxPp: m.maxPp, selectable, usable: selectable, reason, word, mult: check.eff.mult, hitChance: this.hitChance(side, mv), heartmark: m.id === c.heartmark };
    });
    out.scrap = { available: allOut, usable: allOut, name: this.data.scrap.name, reason: allOut ? null : 'Scrap is only available when every move is out of PP.', cost: Math.max(1, Math.floor(c.stats.hp * t.scrapCost)) };
    out.switches = this._switchOptions(side, false);
    const isTrainer = this.kind === 'trainer';
    const canRun = !isTrainer && this.rules.runAllowed;
    out.run = side === 0
      ? { available: canRun, usable: canRun, reason: isTrainer ? 'You cannot run from a trainer battle.' : canRun ? null : 'You cannot run from this battle.' }
      : { available: false, usable: false, reason: 'Only the player may run.' };
    const readDone = s.readUsed.has(foe.uid);
    out.read = { available: !readDone, usable: !readDone, free: !this.rules.readCostsTurn, costsTurn: this.rules.readCostsTurn, reason: readDone ? `${foe.nickname} has already been Read.` : null };
    if (side === 0 && this.kind === 'wild') {
      const fails = this.captureFails.get(foe.uid) || 0;
      const exact = this.rules.captureDisplay === 'exact';
      const grades = Object.keys(t.lantern).filter((g) => t.lantern[g].mult !== Infinity).map((key) => {
        const g = /^\d+$/.test(key) ? Number(key) : key;
        const odds = this._captureOddsFor(foe, g, fails);
        const stock = s.bag.lanterns ? s.bag.lanterns[g] || 0 : null;
        const selectable = stock === null || stock > 0;
        const L = t.lantern[g];
        return { grade: g, name: L.name, price: L.price, odds: exact ? odds : null, band: captureBand(odds, t), stock, selectable, usable: selectable, reason: stock === 0 ? `No ${L.name} left.` : null };
      });
      out.lantern = { available: true, fails, grades, exactOdds: exact };
      out.captureStance = { on: this.stance, available: true, text: 'Party damage cannot drop the wild creature below 1 HP.' };
    } else {
      out.lantern = { available: false, reason: side === 0 ? 'You cannot capture a trainer\'s creature.' : 'Only the player captures.' };
      out.captureStance = { on: false, available: false, reason: 'Capture Stance is only for wild battles.' };
    }
    if (s.bag.crackdust > 0) {
      const why = this._crackdustBlocked(side);
      out.items.push({ id: CRACKDUST, name: 'Crackdust', count: s.bag.crackdust, selectable: !why, usable: !why, reason: why });
    }
    for (const it of s.items) {
      if (it.heal) {
        const can = c.hp < c.stats.hp;
        out.items.push({ id: it.id, name: it.name || it.id, count: 1, selectable: can, usable: can, reason: can ? null : 'HP is full.' });
      }
    }
    return out;
  }

  /** Alias of {@link Battle#legal}. @param {number} [side=0] @returns {Record<string, any>} */
  availableActions(side = 0) {
    return this.legal(side);
  }

  /** @param {Creature} target @param {number|string} grade @param {number} fails @returns {number} */
  _captureOddsFor(target, grade, fails) {
    const foeSide = this.sides.findIndex((s) => s.party.includes(target));
    return captureOdds({
      catchRate: this.data.species(target.speciesId).catchRate, hp: target.hp, maxHp: target.stats.hp,
      status: target.status ? target.status.kind : null, trapped: foeSide >= 0 && this.sides[foeSide].vol.trap > 0, grade, fails,
    }, this.tuning);
  }

  /** @param {number} side @returns {string|null} why Crackdust cannot be thrown now (null when it can) */
  _crackdustBlocked(side) {
    const foe = this.foeOf(side);
    if (!isWard(this.data.ability(foe.ability))) return `${foe.nickname} has no Ward.`;
    if (this.sides[1 - side].vol.wardSuppressed > 0) return 'Its Ward is already suppressed.';
    return null;
  }

  /** @param {number} side @param {boolean} forced @returns {Array<Record<string, any>>} */
  _switchOptions(side, forced) {
    const s = this.sides[side];
    const trapped = !forced && s.vol.trap > 0;
    return s.party.map((c, i) => {
      let reason = null;
      if (i === s.active && !forced) reason = `${c.nickname} is already out.`;
      else if (isFainted(c)) reason = `${c.nickname} has fainted.`;
      else if (trapped) reason = `${this.active(side).nickname} is trapped and cannot switch.`;
      else if (i === s.active && forced) reason = `${c.nickname} has fainted.`;
      const selectable = reason === null;
      return { index: i, i, name: c.nickname, speciesId: c.speciesId, level: c.level, hp: c.hp, maxHp: c.stats.hp, selectable, usable: selectable, reason };
    });
  }

  /** @returns {BattleResult} the result (meaningful once `phase === 'ended'`) */
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
   * Toggles Capture Stance (wild battles only, costs nothing).
   * @param {boolean} on
   * @returns {BattleEvent[]}
   * @throws {BattleError} NO_STANCE in a trainer battle, ENDED after the end
   */
  setCaptureStance(on) {
    this._events = [];
    if (this.kind !== 'wild') throw new BattleError('NO_STANCE', 'Capture Stance is only for wild battles.');
    if (this.phase === 'ended') throw new BattleError('ENDED', 'The battle is over.');
    this.stance = !!on;
    this._emit({ type: 'stance', on: this.stance, text: this.stance ? 'Capture Stance. Party damage stops at 1 HP.' : 'Capture Stance off.' });
    return this._flush();
  }

  /**
   * Free in-battle Read (when `rules.readCostsTurn` is false), once per foe.
   * Otherwise submit `{type:'read'}` as the turn's action.
   * @param {number} side
   * @returns {BattleEvent[]}
   * @throws {BattleError} BAD_SIDE, READ_COSTS_TURN, ENDED or REPLACING (a replacement is being chosen)
   */
  read(side) {
    this._events = [];
    if (side !== 0 && side !== 1) throw new BattleError('BAD_SIDE', `No side ${String(side)}.`);
    if (this.rules.readCostsTurn) throw new BattleError('READ_COSTS_TURN', 'On this dial Read costs the turn: submit it as an action.');
    if (this.phase === 'ended') throw new BattleError('ENDED', 'The battle is over.');
    if (this.phase === 'replace') throw new BattleError('REPLACING', 'Read is a battle-menu command: choose the replacement first.');
    this._doRead(side, 'Read');
    return this._flush();
  }

  /** @param {number} side @param {string} source @returns {boolean} */
  _doRead(side, source) {
    const s = this.sides[side];
    const foe = this.foeOf(side);
    if (s.readUsed.has(foe.uid)) {
      this._emit({ type: 'message', side, text: `${foe.nickname} has already been Read.` });
      return false;
    }
    s.readUsed.add(foe.uid);
    this.fieldLog.read.add(foe.speciesId);
    const info = readCreature(foe, this.dial, this.data, { prism: this.prism, costsTurn: this.rules.readCostsTurn });
    if (this.rules.wardBadge === 'start') this._revealWard(1 - side, foe);
    this._emit({ type: 'read', side, target: foe.nickname, source, info, text: `${foe.nickname}: ${info.ability.name}. ${info.ability.text}` });
    return true;
  }

  /**
   * Ability hook API: a free Read of the foe (uses the one Read per foe).
   * @param {number} side @param {string} source ability name
   */
  autoRead(side, source) {
    this._doRead(side, source);
  }

  /**
   * Ability hook API: reveals up to `n` not-yet-revealed foe moves.
   * @param {number} side @param {number} n @param {string} source ability or move name
   */
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
    if (revealed.length) this._emit({ type: 'reveal', side, target: foe.nickname, source, moves: revealed, text: `${source}: ${foe.nickname} knows ${revealed.map((id) => this.data.move(id).name).join(', ')}.` });
  }

  /**
   * Ability hook API: moves the active creature to the next type of its type loop.
   * @param {number} side
   */
  cycleUnfixed(side) {
    const c = this.active(side);
    if (!Array.isArray(c.typeQueue) || !c.typeQueue.length) return;
    const q = c.typeQueue;
    c.typeIndex = ((c.typeIndex || 0) + 1) % q.length;
    c.types = [q[c.typeIndex]];
    const next = [1, 2].map((k) => q[(c.typeIndex + k) % q.length]);
    this._emit({ type: 'type-shift', side, who: c.nickname, current: c.types[0], next, text: `${c.nickname} turns ${c.types[0]}. Next: ${next.join(', ')}.` });
  }

  // ---- the turn --------------------------------------------------------------

  /**
   * Submits one action per side and resolves the turn (or the replacement
   * step). Side 1 may be omitted when `foeAi` is set. A charging creature's
   * braced move fires whatever was submitted for it.
   * @param {Array<Action|undefined>} actions indexed by side
   * @returns {BattleEvent[]}
   * @throws {BattleError} for an illegal action (the battle does not advance)
   */
  submit(actions) {
    this._events = [];
    if (this.phase === 'ended') throw new BattleError('ENDED', 'The battle is over.');
    const acts = Array.isArray(actions) ? actions.slice() : [actions];
    if (this.phase === 'replace') {
      const chosen = [];
      for (const side of this.pendingReplace) {
        let a = acts[side];
        if (!a && side === 1 && this.foeAi) a = this.foeAi(this, side);
        if (!a || a.type !== 'switch') throw new BattleError('NEED_REPLACEMENT', `Side ${side} must switch in a replacement.`);
        this._validateSwitch(side, a.to, true);
        chosen.push([side, a.to]);
      }
      for (const [side, to] of chosen) this._sendIn(side, to, false);
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
      // Crits are rolled at the start of the turn for every creature, so a glint ability can
      // announce the coming crit; the roll is compared with the chosen technique's crit stage.
      s.vol.critRoll = this.rng.next();
      const me = this.active(s.index);
      const ability = this.data.ability(me.ability);
      if (ability.glint) {
        const a = acts[s.index];
        const chosen = a && a.type === 'move' && me.moves[a.move] ? this.data.move(me.moves[a.move].id) : a && a.type === 'scrap' ? this.data.scrap : null;
        if (chosen && isDamaging(chosen) && s.vol.critRoll < critChance(this._critStage(me, chosen), this.tuning)) {
          this._emit({ type: 'glint', side: s.index, who: me.nickname, text: `${me.nickname}'s ears glint. Its next hit will crit.` });
        }
      }
    }
    for (const { side, action } of this._order(acts)) {
      if (this.phase === 'ended') break;
      if (isFainted(this.active(side)) && action.type !== 'switch') continue;
      this._perform(side, action);
    }
    if (this.phase !== 'ended') this._endOfTurn();
    if (this.phase !== 'ended') this._resolveFaints();
    if (this.phase !== 'ended' && this.rules.holdOutTurns != null && this.turn >= this.rules.holdOutTurns) this._finish('holdout', null);
    if (this.phase !== 'ended' && this.turn >= this.tuning.maxTurns) this._finish('draw', null);
    return this._flush();
  }

  /**
   * The primary turn call. Accepts `[playerAction, foeAction?]` or a single
   * player action (the foe's then comes from `foeAi`). When only the foe must
   * send in a replacement, the player's action is ignored and `foeAi` picks.
   * @param {Action|Array<Action|undefined>} action
   * @returns {BattleEvent[]}
   */
  step(action) {
    if (Array.isArray(action)) return this.submit(action);
    if (this.phase === 'replace' && !this.pendingReplace.includes(0)) {
      const foeSwitch = action && action.type === 'switch' && !this.foeAi ? action : undefined;
      return this.submit([undefined, foeSwitch]);
    }
    return this.submit([action]);
  }

  /** @param {number} side @param {any} a */
  _validate(side, a) {
    if (!a || typeof a !== 'object') throw new BattleError('NO_ACTION', `Side ${side} submitted no action.`);
    const s = this.sides[side];
    const c = this.active(side);
    const t = this.tuning;
    switch (a.type) {
      case 'move': {
        const m = Number.isInteger(a.move) ? c.moves[a.move] : undefined;
        if (!m) throw new BattleError('BAD_MOVE', `Side ${side}: no move at slot ${String(a.move)}.`);
        if (!a.charged && m.pp <= 0) throw new BattleError('NO_PP', `${this.data.move(m.id).name} has no PP left.`);
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
        if (!this.rules.runAllowed) throw new BattleError('NO_RUN', 'You cannot run from this battle.');
        return;
      case 'read':
        if (!this.rules.readCostsTurn) throw new BattleError('READ_FREE', 'On this dial Read is free: call battle.read(side) instead.');
        return;
      case 'lantern':
        if (side !== 0 || this.kind !== 'wild') throw new BattleError('NO_LANTERN', 'Lanterns are for wild battles.');
        if (!t.lantern[a.grade]) throw new BattleError('BAD_LANTERN', `Unknown Lantern grade ${String(a.grade)}.`);
        if (s.bag.lanterns && !(s.bag.lanterns[a.grade] > 0)) throw new BattleError('NO_LANTERN', `No ${t.lantern[a.grade].name} left.`);
        return;
      case 'item': {
        const itemId = itemIdOf(a);
        if (itemId === CRACKDUST) {
          if (!(s.bag.crackdust > 0)) throw new BattleError('NO_ITEM', 'No Crackdust.');
          const why = this._crackdustBlocked(side);
          if (why) throw new BattleError('NO_WARD', `Crackdust would be wasted: ${why}`);
          return;
        }
        if (!s.items.some((it) => it.id === itemId)) throw new BattleError('NO_ITEM', `No item ${String(itemId)}.`);
        return;
      }
      default:
        throw new BattleError('BAD_ACTION', `Unknown action type ${String(a.type)}.`);
    }
  }

  /** @param {number} side @param {number} to @param {boolean} forced */
  _validateSwitch(side, to, forced) {
    const s = this.sides[side];
    const target = Number.isInteger(to) ? s.party[to] : undefined;
    if (!target) throw new BattleError('BAD_SWITCH', `No party slot ${String(to)}.`);
    if (isFainted(target)) throw new BattleError('BAD_SWITCH', `${target.nickname} has fainted.`);
    if (!forced && to === s.active) throw new BattleError('BAD_SWITCH', `${target.nickname} is already out.`);
    if (!forced && s.vol.trap > 0) throw new BattleError('TRAPPED', `${this.active(side).nickname} is trapped.`);
  }

  /** @param {number} side @param {any} a @returns {number} */
  _priorityOf(side, a) {
    if (a.type === 'move') return this.data.move(this.active(side).moves[a.move].id).priority;
    return this.tuning.actionPriority[a.type] ?? 0;
  }

  /** @param {any[]} acts @returns {Array<{side: number, action: any}>} */
  _order(acts) {
    const rows = acts.map((action, side) => ({ side, action, priority: this._priorityOf(side, action), speed: this.effStat(side, 'spe'), tie: this.rng.next() }));
    rows.sort((a, b) => b.priority - a.priority || b.speed - a.speed || b.tie - a.tie);
    return rows;
  }

  /** @param {number} side @param {any} a */
  _perform(side, a) {
    switch (a.type) {
      case 'switch': return this._sendIn(side, a.to, false);
      case 'run': return this._tryRun(side);
      case 'read': return void this._doRead(side, 'Read');
      case 'lantern': return this._captureAttempt(side, a.grade);
      case 'item': return this._useItem(side, itemIdOf(a));
      case 'scrap': return this._useMove(side, null);
      case 'move': return this._useMove(side, a.move);
      default: return undefined;
    }
  }

  // ---- switching -------------------------------------------------------------

  /** @param {number} side @param {number} to @param {boolean} initial */
  _sendIn(side, to, initial) {
    const s = this.sides[side];
    const prev = s.party[s.active];
    if (!initial) this._emit({ type: 'switch', side, from: prev.nickname, to: s.party[to].nickname, text: `${prev.nickname} comes back. Go, ${s.party[to].nickname}!` });
    s.active = to;
    s.vol = freshVol();
    const c = s.party[to];
    s.participants.add(c.uid);
    const ability = this.data.ability(c.ability);
    if (this.rules.wardBadge === 'start') this._revealWard(side, c);
    if ((!initial || this.turn === 0) && ability.hooks.onSwitchIn) ability.hooks.onSwitchIn({ battle: this, side, self: c, foe: this.foeOf(side) });
  }

  // ---- items, run, capture -------------------------------------------------------

  /** @param {number} side @param {string} itemId */
  _useItem(side, itemId) {
    const s = this.sides[side];
    const c = this.active(side);
    if (itemId === CRACKDUST) {
      s.bag.crackdust--;
      const turns = this.tuning.crackdustTurns;
      // +1: the counter ticks at the end of the throw turn, so the Ward stays down for `turns` full turns after it.
      this.sides[1 - side].vol.wardSuppressed = turns + 1;
      const foe = this.foeOf(side);
      this._emit({ type: 'item', side, item: CRACKDUST, text: `Crackdust scatters over ${foe.nickname}.` });
      this._emit({ type: 'ward-suppressed', side: 1 - side, target: foe.nickname, turns, text: `${foe.nickname}'s Ward is suppressed for ${turns} turns.` });
      return;
    }
    const idx = s.items.findIndex((it) => it.id === itemId);
    const it = s.items[idx];
    s.items.splice(idx, 1);
    this._emit({ type: 'item', side, item: it.id, text: `${s.trainer ? s.trainer.name : 'The trainer'} uses ${it.name || it.id}.` });
    if (it.heal) this._heal(side, Math.floor(c.stats.hp * it.heal), 'item');
  }

  /** @param {number} side */
  _tryRun(side) {
    const t = this.tuning;
    this.runAttempts++;
    const mine = this.effStat(side, 'spe');
    const theirs = this.effStat(1 - side, 'spe');
    const f = Math.floor((mine * t.runSpeedScale) / Math.max(1, theirs)) + t.runAttemptBonus * this.runAttempts;
    const ok = f >= t.runAutoThreshold || this.rng.int(0, t.runAutoThreshold - 1) < f;
    this._emit({ type: 'run', side, success: ok, text: ok ? 'Got away safely.' : 'Could not get away.' });
    if (ok) this._finish('run', null);
  }

  /** @param {number} side @param {number|string} grade */
  _captureAttempt(side, grade) {
    const s = this.sides[side];
    const t = this.tuning;
    const target = this.foeOf(side);
    const lantern = t.lantern[grade];
    const fails = this.captureFails.get(target.uid) || 0;
    const odds = this._captureOddsFor(target, grade, fails);
    if (s.bag.lanterns) s.bag.lanterns[grade]--;
    const attempt = this.captureAttempts++;
    const roller = this.captureRng ? this.captureRng(attempt) : this.rng;
    const success = lantern.mult === Infinity || roller.chance(odds);
    const segments = success ? 3 : Math.min(2, Math.floor(odds * 3));
    const exact = this.rules.captureDisplay === 'exact';
    this._emit({ type: 'capture-shake', side, target: target.nickname, grade, odds: exact ? odds : null, band: captureBand(odds, t), segments, success, text: `You raise the ${lantern.name}. The light draws ${target.nickname} in.` });
    if (success) {
      target.wild = false;
      if (this.nextUid !== undefined) target.uid = this.nextUid;
      this.caught = target;
      this._emit({ type: 'capture', side, speciesId: target.speciesId, name: target.nickname, text: `${target.nickname} was caught. Its Heartmark lights.` });
      this._finish('capture', 0);
    } else {
      const next = fails + 1;
      this.captureFails.set(target.uid, next);
      const nextOdds = this._captureOddsFor(target, grade, next);
      this._emit({ type: 'capture-fail', side, target: target.nickname, fails: next, nextOdds: exact ? nextOdds : null, nextBand: captureBand(nextOdds, t), text: `${target.nickname} slipped out of the light.` });
    }
  }

  // ---- moves -----------------------------------------------------------------

  /** @param {number} side @returns {boolean} */
  _canAct(side) {
    const c = this.active(side);
    const v = this.sides[side].vol;
    if (v.flinched) {
      this._emit({ type: 'status', side, target: c.nickname, kind: 'flinch', action: 'cant-move', text: `${c.nickname} flinched.` });
      return false;
    }
    if (c.status && c.status.kind === 'chill' && this.rng.chance(this.tuning.chillSkipChance)) {
      this._emit({ type: 'status', side, target: c.nickname, kind: 'chill', action: 'cant-move', text: `${c.nickname} is chilled stiff.` });
      return false;
    }
    if (c.status && c.status.kind === 'numb' && this.rng.chance(this.tuning.numbSkipChance)) {
      this._emit({ type: 'status', side, target: c.nickname, kind: 'numb', action: 'cant-move', text: `${c.nickname} is numb and cannot move.` });
      return false;
    }
    return true;
  }

  /** @param {number} side @param {number|null} index move slot, or null for Scrap */
  _useMove(side, index) {
    const v = this.sides[side].vol;
    const user = this.active(side);
    v.movedThisTurn = true;
    if (!this._canAct(side)) {
      v.charging = null;
      return;
    }
    let move;
    if (v.charging) {
      move = this.data.move(user.moves[v.charging.move].id);
      v.charging = null;
    } else if (index === null) {
      move = this.data.scrap;
    } else {
      const slot = user.moves[index];
      if (slot.pp <= 0) throw new BattleError('NO_PP', `${this.data.move(slot.id).name} has no PP left.`);
      slot.pp--;
      move = this.data.move(slot.id);
      if (move.effect.charge) {
        v.charging = { move: index };
        this._emit({ type: 'charge', side, user: user.nickname, move: move.id, moveName: move.name, text: `${user.nickname} braces for ${move.name}.` });
        return;
      }
    }
    const moveType = moveTypeFor(move, user);
    this._emit({ type: 'move', side, user: user.nickname, move: move.id, moveName: move.name, moveType, category: move.category, pp: index === null || !user.moves[index] ? null : user.moves[index].pp, text: `${user.nickname} used ${move.name}.` });
    try {
      this._resolveMove(side, move, moveType);
    } finally {
      if (move.effect.scrap && !isFainted(user)) {
        const cost = Math.max(1, Math.floor(user.stats.hp * this.tuning.scrapCost));
        this._emit({ type: 'scrap-cost', side, user: user.nickname, amount: cost, text: `${user.nickname} pays for ${move.name}.` });
        this._applyDamage(side, cost, 'self');
      }
    }
  }

  /** @param {number} side @param {import('./effects.js').Move} move @param {string|null} moveType */
  _resolveMove(side, move, moveType) {
    const v = this.sides[side].vol;
    const user = this.active(side);
    const e = move.effect;
    const foeSide = 1 - side;
    const fs = this.sides[foeSide];
    const target = this.active(foeSide);

    // --- self-targeting techniques ---------------------------------------------
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
      if (e.recovery.delay > 0 && v.pendingHeal) {
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'heal-pending', text: `${user.nickname}'s heal is already pending. ${move.name} failed.` });
        return;
      }
      if (user.mends <= 0) {
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'no-mends', text: `${user.nickname} has no Mends left. ${move.name} failed.` });
        return;
      }
      user.mends--;
      this._emit({ type: 'mend-spent', side, user: user.nickname, remaining: user.mends, text: `${user.nickname} spends a Mend (${user.mends} left).` });
      if (e.recovery.delay > 0) {
        // Heals at the end of the turn `delay` turns after this one.
        v.pendingHeal = { until: this.turn + e.recovery.delay, fraction: e.recovery.fraction, cancelledBy: e.recovery.cancelledBy || null, move: move.id };
        this._emit({ type: 'mend-pending', side, user: user.nickname, turns: e.recovery.delay, text: `${user.nickname} gathers light for a delayed heal.` });
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
      const blocked = [0, 1].some((i) => this.data.ability(this.active(i).ability).blocksSelfKo && !isFainted(this.active(i)));
      if (blocked) {
        const holder = [0, 1].map((i) => this.data.ability(this.active(i).ability)).find((a) => a.blocksSelfKo);
        this._emit({ type: 'blocked', side, target: user.nickname, reason: 'sodden', text: `${holder ? holder.name : 'An ability'} damps the burst. ${move.name} failed.` });
        return;
      }
    }

    // --- foe-targeting techniques ------------------------------------------------
    if (isFainted(target)) {
      this._emit({ type: 'message', side, text: 'There is no target.' });
      return;
    }
    if (fs.vol.guarding) {
      this._emit({ type: 'blocked', side, target: target.nickname, reason: 'guard', text: `${target.nickname} guarded.` });
      return;
    }
    const foeAbility = this.effectiveAbility(foeSide);
    const check = this._wardCheck(foeAbility, move, target.types, moveType);
    if (!check.lands) {
      if (check.reason === 'immune') {
        this._emit({ type: 'effectiveness', side, target: target.nickname, word: 'Blocked', mult: 0 });
        this._emit({ type: 'blocked', side, target: target.nickname, reason: 'immune', text: `It has no effect on ${target.nickname}.` });
      } else if (foeAbility) {
        this._revealWard(foeSide, target);
        this._emit({ type: 'effectiveness', side, target: target.nickname, word: 'Blocked', mult: check.eff.mult });
        this._emit({ type: 'blocked', side, target: target.nickname, reason: 'ward', ward: foeAbility.name, text: wardHeldText(foeAbility) });
        this._emit(this._wardReadout(side, foeAbility, target));
      }
      return;
    }

    const hits = e.multiHit ? this.rng.int(e.multiHit[0], e.multiHit[1]) : 1;
    const targetDecoys = this.data.ability(target.ability).decoys;
    let landed = 0;
    let totalDamage = 0;
    for (let h = 0; h < hits; h++) {
      if (isFainted(target) || isFainted(user)) break;
      if (!this._accuracyRoll(side, move, h === 0)) {
        this._missOrDecoy(side, move);
        if (!targetDecoys) break;
        continue;
      }
      landed++;
      if (isDamaging(move)) totalDamage += this._dealHit(side, move, moveType, check.eff, landed === 1);
    }
    if (landed === 0) return;
    if (hits > 1) this._emit({ type: 'message', side, text: `Hit ${landed} time${landed === 1 ? '' : 's'}.` });
    if (isDamaging(move) && e.drain && totalDamage > 0) this._heal(side, Math.max(1, Math.floor(totalDamage * e.drain)), move.id);
    this._applySecondary(side, move, target);
    if (e.selfKo && !isFainted(user)) this._applyDamage(side, user.hp, 'self');
  }

  /** @param {number} side @param {import('./effects.js').Move} move @param {boolean} first @returns {boolean} */
  _accuracyRoll(side, move, first) {
    const user = this.active(side);
    if (isSureHit(move) || move.effect.plumbline) return true;
    const ability = this.data.ability(user.ability);
    if (ability.hooks.sureHitOverride && ability.hooks.sureHitOverride({ attacker: user, move, bflags: this.bflags(side) })) {
      if (first) this._emit({ type: 'ability', side, who: user.nickname, ability: ability.name, text: `${ability.name}: it cannot miss.` });
      return true;
    }
    return this.rng.chance(this.hitChance(side, move));
  }

  /** @param {number} side @param {import('./effects.js').Move} move */
  _missOrDecoy(side, move) {
    const foeSide = 1 - side;
    const target = this.active(foeSide);
    const fv = this.sides[foeSide].vol;
    if (this.data.ability(target.ability).decoys && fv.stages.eva > 0) {
      const pops = move.effect.spread ? fv.stages.eva : 1;
      fv.stages.eva -= pops;
      this._emit({ type: 'decoy-pop', side: foeSide, target: target.nickname, popped: pops, remaining: fv.stages.eva, text: `${this.active(side).nickname} hit a decoy. It pops.` });
      return;
    }
    this._emit({ type: 'miss', side, user: this.active(side).nickname, target: target.nickname, text: `${this.active(side).nickname}'s attack missed.` });
  }

  /**
   * @param {number} side @param {import('./effects.js').Move} move @param {string|null} moveType
   * @param {{mult: number, word: string}} eff @param {boolean} first
   * @returns {number} HP removed
   */
  _dealHit(side, move, moveType, eff, first) {
    const user = this.active(side);
    const foeSide = 1 - side;
    const target = this.active(foeSide);
    const v = this.sides[side].vol;
    const t = this.tuning;
    const physical = move.category === 'physical';
    const attack = this.effStat(side, physical ? 'atk' : 'spa');
    const defense = this.effStat(foeSide, physical ? 'def' : 'spd');
    const userAbility = this.data.ability(user.ability);
    const targetAbility = this.data.ability(target.ability);
    const crit = v.critRoll < critChance(this._critStage(user, move), t);
    const rand = damageRoll(this.rng.next(), t);
    const stab = moveType !== null && (user.types.includes(moveType) || (move.id === user.heartmark && user.heartmarkStab));
    let extra = 1;
    if (userAbility.hooks.onAttackMult) extra *= userAbility.hooks.onAttackMult({ attacker: user, move, hpRatio: hpRatio(user), moveType });
    let defText = null;
    if (targetAbility.hooks.onDefendMult) {
      const r = targetAbility.hooks.onDefendMult({ defender: target, attacker: user, move, eff, bflags: this.bflags(foeSide, target) });
      extra *= r.mult;
      defText = r.text || null;
    }
    const dmg = damageFormula({ level: user.level, power: move.power, attack, defense, typeMult: eff.mult, stab, crit, rand, burned: physical && !!user.status && user.status.kind === 'burn', extra }, t);
    if (first) this._emit({ type: 'effectiveness', side, target: target.nickname, word: eff.word, mult: eff.mult, text: eff.word === 'Strong' ? 'Strong hit!' : eff.word === 'Weak' ? 'Weak hit.' : null });
    if (crit) this._emit({ type: 'crit', side, target: target.nickname, text: 'A critical hit!' });
    if (defText) this._emit({ type: 'ability', side: foeSide, who: target.nickname, ability: targetAbility.name, text: defText });
    const dealt = this._applyDamage(foeSide, dmg, 'party');
    const fvol = this.sides[foeSide].vol;
    const pending = fvol.pendingHeal;
    if (pending && pending.cancelledBy && moveType !== null && (Array.isArray(pending.cancelledBy) ? pending.cancelledBy.includes(moveType) : pending.cancelledBy === moveType)) {
      fvol.pendingHeal = null;
      this._emit({ type: 'mend-cancelled', side: foeSide, target: target.nickname, text: `The ${moveType} hit breaks ${target.nickname}'s pending heal.` });
    }
    if (target.status && this.data.cures(moveType, target.status.kind)) {
      const kind = target.status.kind;
      target.status = null;
      this._emit({ type: 'status', side: foeSide, target: target.nickname, kind, action: 'cure', text: `${target.nickname} ${CURE_WORD[kind] || 'is cured'}.` });
    }
    if (move.effect.popsDecoy && targetAbility.decoys && fvol.stages.eva > 0) {
      const pops = Math.min(fvol.stages.eva, move.effect.popsDecoy === true ? 1 : move.effect.popsDecoy);
      fvol.stages.eva -= pops;
      this._emit({ type: 'decoy-pop', side: foeSide, target: target.nickname, popped: pops, remaining: fvol.stages.eva, text: `${move.name} pops a decoy.` });
    }
    if (isFainted(target) && userAbility.hooks.healOnKo && !isFainted(user)) {
      this._emit({ type: 'ability', side, who: user.nickname, ability: userAbility.name, text: `${userAbility.name} feeds ${user.nickname}.` });
      this._heal(side, Math.max(1, Math.floor(user.stats.hp * userAbility.hooks.healOnKo())), userAbility.id);
    }
    return dealt;
  }

  /** @param {Creature} user @param {import('./effects.js').Move} move @returns {number} crit stage */
  _critStage(user, move) {
    const ability = this.data.ability(user.ability);
    return (move.effect.highCrit || 0) + (ability.hooks.critStages ? ability.hooks.critStages() : 0);
  }

  /** @param {number} side @param {import('./effects.js').Move} move @param {Creature} target */
  _applySecondary(side, move, target) {
    const e = move.effect;
    const foeSide = 1 - side;
    const fvol = this.sides[foeSide].vol;
    if (isFainted(target)) return;
    if (e.status) {
      const chance = e.status.chance ?? 1;
      if (chance >= 1 || this.rng.chance(chance)) this._tryStatus(foeSide, e.status.kind);
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
    if (e.flinch && !fvol.movedThisTurn && this.rng.chance(e.flinch)) fvol.flinched = true;
    if (e.clearRaised) {
      const st = fvol.stages;
      const cleared = Object.keys(st).filter((k) => st[k] > 0);
      for (const k of cleared) st[k] = 0;
      this._emit({ type: 'stat', side: foeSide, target: target.nickname, stat: 'all', stages: 0, result: cleared.length ? 'cleared-raised' : 'none', text: cleared.length ? `${target.nickname}'s boosts were snuffed out.` : 'Nothing to snuff.' });
    }
    if (e.plumbline) {
      const st = fvol.stages;
      for (const k of Object.keys(st)) st[k] = 0;
      const n = this.tuning.plumblineBlockTurns;
      fvol.boostBlockUntil = this.turn + n;
      this._emit({ type: 'stat', side: foeSide, target: target.nickname, stat: 'all', stages: 0, result: 'cleared', text: `${move.name}. ${target.nickname}'s stat stages drop to level and it cannot re-boost for ${n} turns.` });
    }
    if (e.revealMoves) this.revealFoeMove(side, target.moves.length, move.name);
  }

  // ---- damage, healing, status, stages --------------------------------------------

  /**
   * Applies damage to a side's active creature with the Capture Stance floor
   * (every non-self source on the wild creature) and the 0..maxHp clamp.
   * @param {number} side target side
   * @param {number} amount
   * @param {'party'|'self'|'status'} source
   * @returns {number} HP actually removed
   */
  _applyDamage(side, amount, source) {
    const c = this.active(side);
    const want = Math.max(0, Math.floor(amount));
    let dmg = want;
    const floored = this.kind === 'wild' && side === 1 && this.stance && source !== 'self';
    if (floored) dmg = Math.min(dmg, Math.max(0, c.hp - 1));
    dmg = Math.min(dmg, c.hp);
    c.hp -= dmg;
    this._emit({ type: 'damage', side, target: c.nickname, amount: dmg, hp: c.hp, maxHp: c.stats.hp, source, stanceFloor: floored && c.hp === 1 && dmg < want });
    if (isFainted(c)) this._emit({ type: 'faint', side, target: c.nickname, text: `${c.nickname} fainted.` });
    return dmg;
  }

  /** @param {number} side @param {number} amount @param {string} source @returns {number} HP restored */
  _heal(side, amount, source) {
    const c = this.active(side);
    const healed = Math.max(0, Math.min(Math.floor(amount), c.stats.hp - c.hp));
    c.hp += healed;
    this._emit({ type: 'heal', side, target: c.nickname, amount: healed, hp: c.hp, maxHp: c.stats.hp, source, text: `${c.nickname} recovered ${healed} HP.` });
    return healed;
  }

  /** @param {number} side @param {string} kind @returns {boolean} whether it took */
  _tryStatus(side, kind) {
    const c = this.active(side);
    const name = c.nickname;
    if (kind === 'trap') {
      const v = this.sides[side].vol;
      if (v.trap > 0) {
        this._emit({ type: 'status', side, target: name, kind, action: 'already', text: `${name} is already trapped.` });
        return false;
      }
      v.trap = this.tuning.trapTurns;
      this._emit({ type: 'status', side, target: name, kind, action: 'inflict', turns: v.trap, text: `${name} is trapped.` });
      return true;
    }
    if (!MAJOR_STATUS.includes(kind)) throw new RangeError(`unknown status ${String(kind)}`);
    if (c.status) {
      this._emit({ type: 'status', side, target: name, kind, action: 'already', text: `${name} already has a condition.` });
      return false;
    }
    const ability = this.data.ability(c.ability);
    if (this.data.typeBlocksStatus(kind, c.types) || (ability.hooks.statusImmune && ability.hooks.statusImmune(kind))) {
      this._emit({ type: 'status', side, target: name, kind, action: 'immune', text: `${name} cannot be ${STATUS_WORD[kind]}.` });
      return false;
    }
    c.status = { kind, turns: kind === 'chill' ? this.rng.int(this.tuning.chillTurnsMin, this.tuning.chillTurnsMax) : 0 };
    this._emit({ type: 'status', side, target: name, kind, action: 'inflict', text: `${name} is ${STATUS_WORD[kind]}.` });
    return true;
  }

  /**
   * @param {number} side @param {string} stat @param {number} stages @param {{bySelf: boolean}} by
   * @returns {boolean} whether the stage changed
   */
  _changeStage(side, stat, stages, { bySelf }) {
    const c = this.active(side);
    const v = this.sides[side].vol;
    const t = this.tuning;
    const name = c.nickname;
    if (stages > 0 && this.turn <= v.boostBlockUntil) {
      this._emit({ type: 'stat', side, target: name, stat, stages: 0, result: 'blocked', reason: 'plumbline', text: `${name} is held level. It cannot boost.` });
      return false;
    }
    if (stages < 0 && !bySelf) {
      const ability = this.data.ability(c.ability);
      if (ability.hooks.blocksForeignStatDrops && ability.hooks.blocksForeignStatDrops()) {
        this._emit({ type: 'stat', side, target: name, stat, stages: 0, result: 'blocked', reason: ability.id, text: `${ability.name} keeps ${name}'s ${STAT_NAMES[stat]} steady.` });
        return false;
      }
    }
    const cap = stat === 'eva' ? t.evasionCap : t.stageCap;
    const cur = v.stages[stat];
    const next = Math.max(-t.stageCap, Math.min(cap, cur + stages));
    if (next === cur) {
      this._emit({ type: 'stat', side, target: name, stat, stages: 0, result: 'capped', text: stat === 'eva' ? `${name}'s evasion cannot go higher (cap +${t.evasionCap}).` : `${name}'s ${STAT_NAMES[stat]} will not go ${stages > 0 ? 'higher' : 'lower'}.` });
      return false;
    }
    v.stages[stat] = next;
    const delta = next - cur;
    const word = Math.abs(delta) >= 2 ? 'sharply ' : '';
    this._emit({ type: 'stat', side, target: name, stat, stages: delta, stage: next, result: delta > 0 ? 'raised' : 'lowered', text: `${name}'s ${STAT_NAMES[stat]} ${word}${delta > 0 ? 'rose' : 'fell'}.` });
    if (stat === 'eva' && delta > 0 && this.data.ability(c.ability).decoys) {
      this._emit({ type: 'decoy', side, who: name, count: next, text: `A decoy ${name} shimmers into place (${next}).` });
    }
    return true;
  }

  // ---- end of turn -----------------------------------------------------------------

  _endOfTurn() {
    const t = this.tuning;
    for (const s of this.sides) {
      if (this.phase === 'ended') return;
      const c = this.active(s.index);
      const v = s.vol;
      if (isFainted(c)) continue;
      if (c.status) {
        const k = c.status.kind;
        if (k === 'burn' || k === 'poison') {
          this._emit({ type: 'status', side: s.index, target: c.nickname, kind: k, action: 'tick', text: `${c.nickname} is hurt by ${k === 'burn' ? 'its burn' : 'poison'}.` });
          this._applyDamage(s.index, Math.max(1, Math.floor(c.stats.hp * t.chip[k])), 'status');
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
        this._applyDamage(s.index, Math.max(1, Math.floor(c.stats.hp * t.chip.trap)), 'status');
        v.trap--;
        if (v.trap === 0 && !isFainted(c)) this._emit({ type: 'status', side: s.index, target: c.nickname, kind: 'trap', action: 'cure', text: `${c.nickname} is free of the trap.` });
      }
      if (!isFainted(c) && v.pendingHeal && this.turn >= v.pendingHeal.until) {
        const p = v.pendingHeal;
        v.pendingHeal = null;
        this._heal(s.index, Math.floor(c.stats.hp * p.fraction), p.move);
      }
      if (v.wardSuppressed > 0) {
        v.wardSuppressed--;
        if (v.wardSuppressed === 0) this._emit({ type: 'message', side: s.index, text: `${c.nickname}'s Ward returns.` });
      }
      v.guardedLast = v.guarding;
      v.guarding = false;
      v.turnsOut++;
      const ability = this.data.ability(c.ability);
      if (!isFainted(c) && ability.hooks.onTurnEnd) ability.hooks.onTurnEnd({ battle: this, side: s.index, self: c });
    }
  }

  _resolveFaints() {
    const need = [];
    for (const s of this.sides) {
      if (!isFainted(this.active(s.index))) continue;
      if (!s.party.some((c) => !isFainted(c))) {
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
    return undefined;
  }

  /** @param {string} outcome @param {0|1|null} winner */
  _finish(outcome, winner) {
    const t = this.tuning;
    this.phase = 'ended';
    this.outcome = outcome;
    this.winner = winner;
    this.pendingReplace = [];
    this._emit({ type: 'end', outcome, winner, text: outcomeText(outcome, this) });
    if (outcome === 'holdout' && t.holdOutExp > 0) this._holdOutExp();
    if (outcome === 'win' || outcome === 'capture') {
      this._distributeExp();
      if (this.kind === 'trainer') {
        const tr = this.sides[1].trainer;
        const maxLevel = Math.max(...this.sides[1].party.map((c) => c.level));
        this.payout = tr.payout ?? (tr.payoutRate ?? t.payoutPerLevel) * maxLevel;
        this._emit({ type: 'payout', amount: this.payout, text: `You won ${this.payout} glint.` });
      }
    } else if (outcome === 'loss') {
      this.blackoutCost = this.summit ? 0 : Math.max(0, Math.min(t.blackoutCap, Math.floor(this.sides[0].glint * t.blackoutRate)));
      this._emit({ type: 'blackout', cost: this.blackoutCost, summit: this.summit, text: this.summit ? 'The Summit takes nothing.' : `You black out and lose ${this.blackoutCost} glint.` });
    }
  }

  // ---- EXP -----------------------------------------------------------------------

  _distributeExp() {
    const t = this.tuning;
    const player = this.sides[0];
    const defeated = this.sides[1].party.filter((c) => isFainted(c) || c === this.caught);
    if (!defeated.length) return;
    /** @type {Map<any, number>} */
    const gains = new Map();
    const add = (c, amount, share) => {
      if (!(amount > 0)) return;
      gains.set(c.uid, (gains.get(c.uid) || 0) + amount);
      this._emit({ type: 'exp', creature: c.nickname, uid: c.uid, amount, share, text: `${c.nickname} gained ${amount} EXP${share === 'bench' ? ' (bench)' : share === 'sibling' ? ' (shared)' : share === 'yard' ? ' (Training Yard)' : ''}.` });
    };
    const recipients = player.party.filter((c) => !isFainted(c));
    for (const d of defeated) {
      const base = Math.floor((this.data.species(d.speciesId).expYield * d.level) / t.expYieldDivisor) * (this.kind === 'trainer' ? t.trainerExpMult : 1);
      for (const c of recipients) {
        const share = player.participants.has(c.uid) ? 1 : t.benchShare;
        let amount = Math.floor(base * share * catchUpMult(c.level, this.curveLevel, t));
        if (this.source === 'rematch' && this.curveLevel != null && c.level > this.curveLevel + t.dampStart) amount = Math.floor(amount * t.dampFactor);
        add(c, amount, share === 1 ? 'battler' : 'bench');
      }
    }
    for (const c of recipients) {
      const ability = this.data.ability(c.ability);
      if (ability.expShare && player.participants.has(c.uid)) {
        const others = player.party.filter((o) => o !== c && !isFainted(o));
        if (!others.length) continue;
        const lowest = others.reduce((a, b) => (b.level < a.level ? b : a));
        add(lowest, Math.floor((gains.get(c.uid) || 0) * ability.expShare.toLowest), 'sibling');
      }
    }
    const partyTotal = [...gains.values()].reduce((a, b) => a + b, 0);
    const yard = this.yard.slice(0, t.yardMax);
    for (const y of yard) add(y, Math.floor(partyTotal * t.yardShare), 'yard');
    this._applyGains(gains, [...player.party, ...yard]);
  }

  /** The flat hold-out EXP ({@link DEFAULTS}.holdOutExp): battlers all of it, the bench `benchShare`. */
  _holdOutExp() {
    const t = this.tuning;
    const player = this.sides[0];
    /** @type {Map<any, number>} */
    const gains = new Map();
    for (const c of player.party) {
      if (isFainted(c)) continue;
      const battler = player.participants.has(c.uid);
      const amount = Math.floor(t.holdOutExp * (battler ? 1 : t.benchShare));
      if (!(amount > 0)) continue;
      gains.set(c.uid, amount);
      this._emit({ type: 'exp', creature: c.nickname, uid: c.uid, amount, share: battler ? 'battler' : 'bench', text: `${c.nickname} gained ${amount} EXP${battler ? '' : ' (bench)'}.` });
    }
    this._applyGains(gains, player.party);
  }

  /**
   * Applies summed EXP through the level-up implementation and reports it.
   * @param {Map<any, number>} gains by uid @param {Creature[]} creatures candidates, in report order
   */
  _applyGains(gains, creatures) {
    for (const c of creatures) {
      const amount = gains.get(c.uid);
      if (!amount) continue;
      const r = this._gainExp(c, amount);
      this.expReport.push({ uid: c.uid, name: c.nickname, amount, from: r.from, to: r.to, levelsGained: r.to - r.from, learned: r.learned, offers: r.offers });
      if (r.to > r.from) {
        this._emit({ type: 'levelup', creature: c.nickname, uid: c.uid, from: r.from, to: r.to, stats: r.statsAfter, text: `${c.nickname} grew to Lv${r.to}.` });
        for (const mv of r.learned) this._emit({ type: 'learn', creature: c.nickname, uid: c.uid, move: mv, text: `${c.nickname} learned ${this.data.move(mv).name}.` });
        for (const mv of r.offers) this._emit({ type: 'learn-offer', creature: c.nickname, uid: c.uid, move: mv, text: `${c.nickname} wants to learn ${this.data.move(mv).name}, but its slots are full.` });
      }
    }
  }

  // ---- Ward readout ---------------------------------------------------------------

  /**
   * The readout after a blocked hit (rules 8.3): which party techniques land,
   * which are out of PP, which types get through, which indirect damage works,
   * the party's chip techniques and Crackdust.
   * @param {number} side the side whose hit was blocked
   * @param {import('./abilityHooks.js').AbilityRuntime} ability the Ward
   * @param {Creature} target
   * @returns {import('./events.js').WardReadoutEvent}
   */
  _wardReadout(side, ability, target) {
    const s = this.sides[side];
    const chart = this.data.chart;
    const canLand = [];
    const outOfPp = [];
    const chip = [];
    for (const c of s.party) {
      if (isFainted(c)) continue;
      for (const m of c.moves) {
        const mv = this.data.move(m.id);
        const type = moveTypeFor(mv, c);
        const lands = this._wardCheck(ability, mv, target.types, type).lands;
        if (isDamaging(mv) && !mv.effect.scrap && lands) {
          const entry = { creature: c.nickname, uid: c.uid, move: mv.id, moveName: mv.name, type, pp: m.pp };
          if (m.pp > 0) canLand.push(entry);
          else outOfPp.push(entry);
        }
        // Chip techniques (poison / burn / trap) that still work: a status move the Ward lets
        // through, or a damaging move that lands and may inflict chip. A status already on the
        // target drops a major-status move; traps stay.
        if (isChipMove(mv) && m.pp > 0 && lands && !(target.status && mv.effect.status.kind !== 'trap' && MAJOR_STATUS.includes(mv.effect.status.kind))) {
          chip.push({ creature: c.nickname, uid: c.uid, move: mv.id, moveName: mv.name, kind: mv.effect.status.kind, pp: m.pp });
        }
      }
    }
    const types = chart.ordinary.filter((ty) => this._wardCheck(ability, { id: '-', name: '-', category: 'special', power: 100, accuracy: 100, pp: 1, priority: 0, type: ty, effect: {} }, target.types, ty).lands);
    const indirect = wardIndirect(ability);
    const lines = [wardHeldText(ability)];
    lines.push(canLand.length ? `Can land: ${canLand.map((e) => `${e.creature}'s ${e.moveName}`).join(', ')}.` : 'Nothing in your party lands right now.');
    if (outOfPp.length) lines.push(`Out of PP: ${outOfPp.map((e) => `${e.creature}'s ${e.moveName}`).join(', ')}.`);
    lines.push(types.length ? `Types that get through: ${types.join(', ')}.` : 'No type gets through directly.');
    lines.push(`Indirect damage that works: ${indirect.join(', ')}.`);
    if (chip.length) lines.push(`Your chip techniques: ${chip.map((e) => `${e.creature}'s ${e.moveName} (${e.kind})`).join(', ')}.`);
    if (s.bag.crackdust > 0) lines.push(`You carry Crackdust (${s.bag.crackdust}).`);
    return {
      type: 'ward-readout', side, target: target.nickname, targetTypes: target.types.slice(), ward: ability.name, wardId: ability.id,
      wardKind: /** @type {any} */ (ability.ward).kind, canLand, outOfPp, types, indirect, chip, crackdust: s.bag.crackdust > 0, text: lines.join(' '),
    };
  }

  // ---- events ------------------------------------------------------------------------

  /** @param {any} ev */
  _emit(ev) {
    this._events.push(ev);
    this.log.push(ev);
  }

  /** @returns {BattleEvent[]} */
  _flush() {
    const out = this._events;
    this._events = [];
    return out;
  }
}

/**
 * Throws a readable TypeError when a party entry is not a usable battle creature
 * (a malformed save or fixture must fail at setup, not as a NaN mid-battle).
 * @param {any} c @param {string} where
 */
function checkCreature(c, where) {
  if (!c || typeof c !== 'object') throw new TypeError(`${where}: not a creature object`);
  if (c.uid === undefined || c.uid === null) throw new TypeError(`${where}: uid is required`);
  if (typeof c.speciesId !== 'string') throw new TypeError(`${where}: speciesId must be a string`);
  if (typeof c.ability !== 'string') throw new TypeError(`${where}: ability must be a string`);
  if (!Number.isInteger(c.level) || c.level < 1) throw new TypeError(`${where}: level must be a positive integer, got ${String(c.level)}`);
  if (!c.stats || typeof c.stats !== 'object') throw new TypeError(`${where}: stats are required`);
  for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    if (!(Number.isFinite(c.stats[k]) && c.stats[k] > 0)) throw new TypeError(`${where}: stats.${k} must be a positive number, got ${String(c.stats[k])}`);
  }
  if (!Number.isFinite(c.hp) || c.hp < 0 || c.hp > c.stats.hp) throw new TypeError(`${where}: hp must be 0..stats.hp, got ${String(c.hp)}`);
  if (!Array.isArray(c.types) || c.types.length === 0) throw new TypeError(`${where}: types must be a non-empty array`);
  if (!Array.isArray(c.moves)) throw new TypeError(`${where}: moves must be an array`);
  for (const m of c.moves) {
    if (!m || typeof m.id !== 'string' || !Number.isFinite(m.pp) || !Number.isFinite(m.maxPp) || m.pp < 0) throw new TypeError(`${where}: bad move slot ${JSON.stringify(m)}`);
  }
}

/** @param {any} a @returns {string} item id of an item action (`id`, or the prototype's `item`) */
function itemIdOf(a) {
  return a.item !== undefined ? a.item : a.id;
}

/** @param {string} outcome @param {Battle} b @returns {string} */
function outcomeText(outcome, b) {
  switch (outcome) {
    case 'win': return b.kind === 'trainer' ? `You beat ${b.sides[1].trainer.name}.` : `The wild ${b.sides[1].party[0].nickname} fainted.`;
    case 'loss': return 'You have no creatures left.';
    case 'capture': return `${b.caught ? b.caught.nickname : 'It'} joins you.`;
    case 'run': return 'You got away.';
    case 'holdout': return `You held out for ${b.turn} turns.`;
    default: return 'The battle ends in a draw.';
  }
}

/**
 * Creates a battle. The rng may be passed inside `setup` (`setup.rng`) or as
 * the second argument (`createBattle(setup, rng)`, the flow passes
 * `rngs.battle(world)`).
 * @param {BattleSetup} setup
 * @param {BattleSetup['rng']} [rng]
 * @returns {Battle}
 */
export function createBattle(setup, rng) {
  return new Battle(/** @type {any} */ (rng ? { ...setup, rng } : setup));
}
