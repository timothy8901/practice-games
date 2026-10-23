/**
 * Battle AI: one wild brain and one tactical brain run by named profiles
 * ('wild' | 'trainer' | 'spire' | 'summit'). [BATTLE-RULES] Ported from
 * proto/battle/ai.js; the 'trainer' profile is the prototype trainer AI.
 *
 * Every brain only returns actions {@link Battle#legal} marks selectable: it
 * never picks a 0-PP move, never Runs in a trainer battle, and falls back to
 * Scrap when every move is out of PP.
 *
 * Tactical brain, in order (each step gated by a profile knob):
 * 0. finisher: take a sure knock-out when a move's minimum damage covers the foe's HP
 * 1. heal under `healThreshold` (a recovery move spending a Mend, or a heal item)
 * 2. switch out of a Blocked matchup when the bench has an answer (else throw Crackdust)
 * 3. guard against a braced charge move or to protect a pending heal (never twice in a row)
 * 4. evasion at most `maxEvasionUses` per battle, never past the cap, above `evasionMinHp`
 * 5. chip a Ward holder or a foe it only hits Weak
 * 6. clear a boosted foe (Plumbline / Snuff)
 * 7. the best expected-damage hit; 8. any other legal status move, then the first legal move
 *
 * Profile memory lives in `battle.memo[side]` (per battle, plain data). The
 * wild brain draws from the battle rng, so everything stays deterministic.
 * Pure: no DOM.
 * @module battle/ai
 */

import { isDamaging, moveTypeFor, wardCheck, CHIP_KINDS } from './effects.js';

/**
 * @typedef {Object} AiProfile
 * @property {'wild'|'tactical'} brain
 * @property {boolean} finisher          take a guaranteed knock-out first
 * @property {number} healThreshold      heal below this HP fraction (0 disables)
 * @property {boolean} healItems         use trainer heal items when low
 * @property {boolean} switchOnBlocked   switch out of a Blocked matchup
 * @property {boolean} crackdust         throw Crackdust when walled and nothing on the bench answers
 * @property {boolean} guard             guard against a charge or to protect a pending heal
 * @property {number} maxEvasionUses     evasion moves per battle (rules 10.1: at most 2)
 * @property {number} evasionMinHp       only use evasion above this HP fraction
 * @property {boolean} chip              chip Ward holders / foes it only hits Weak
 * @property {boolean} clearBoosts       answer a boosted foe with Plumbline / Snuff
 */

/**
 * The designer-tunable AI table: one profile per name. A `tuning` override may
 * replace any profile field: `{profiles: {summit: {healThreshold: 0.5}}}`
 * (fields merge per profile; unknown profiles or fields throw).
 * @type {Readonly<{profiles: Readonly<Record<'wild'|'trainer'|'spire'|'summit', Readonly<AiProfile>>>}>}
 */
export const DEFAULTS = Object.freeze({
  profiles: Object.freeze({
    wild: Object.freeze({ brain: 'wild', finisher: false, healThreshold: 0, healItems: false, switchOnBlocked: false, crackdust: false, guard: false, maxEvasionUses: 0, evasionMinHp: 1, chip: false, clearBoosts: false }),
    trainer: Object.freeze({ brain: 'tactical', finisher: false, healThreshold: 0.35, healItems: true, switchOnBlocked: true, crackdust: true, guard: true, maxEvasionUses: 2, evasionMinHp: 0.5, chip: true, clearBoosts: true }),
    spire: Object.freeze({ brain: 'tactical', finisher: true, healThreshold: 0.35, healItems: true, switchOnBlocked: true, crackdust: true, guard: true, maxEvasionUses: 2, evasionMinHp: 0.5, chip: true, clearBoosts: true }),
    summit: Object.freeze({ brain: 'tactical', finisher: true, healThreshold: 0.4, healItems: true, switchOnBlocked: true, crackdust: true, guard: true, maxEvasionUses: 2, evasionMinHp: 0.5, chip: true, clearBoosts: true }),
  }),
});

/** Profile names. */
export const AI_PROFILES = Object.freeze(Object.keys(DEFAULTS.profiles));

/** Prototype names kept for callers and tests. */
export const HEAL_THRESHOLD = DEFAULTS.profiles.trainer.healThreshold;
export const MAX_EVASION_USES = DEFAULTS.profiles.trainer.maxEvasionUses;

/**
 * Resolves a profile (with any tuning override).
 * @param {string} name
 * @param {{profiles?: Record<string, Partial<AiProfile>>}} [tuning]
 * @returns {Readonly<AiProfile>}
 * @throws {RangeError} for an unknown profile or field
 */
export function resolveProfile(name, tuning) {
  const base = DEFAULTS.profiles[/** @type {keyof typeof DEFAULTS.profiles} */ (name)];
  if (!base) throw new RangeError(`ai: unknown profile ${String(name)} (known: ${AI_PROFILES.join(', ')})`);
  if (tuning) {
    for (const k of Object.keys(tuning)) if (k !== 'profiles') throw new RangeError(`ai: unknown tuning key "${k}"`);
    for (const p of Object.keys(tuning.profiles || {})) if (!DEFAULTS.profiles[/** @type {any} */ (p)]) throw new RangeError(`ai: unknown profile "${p}" in tuning`);
  }
  const over = tuning && tuning.profiles && tuning.profiles[name];
  if (!over) return base;
  for (const k of Object.keys(over)) if (!(k in base)) throw new RangeError(`ai: unknown profile field "${k}"`);
  return Object.freeze({ ...base, ...over });
}

/**
 * Expected-damage score of one menu entry.
 * @param {any} entry legal() move entry
 * @param {any} me the acting creature
 * @param {number} stab same-type multiplier
 * @returns {number}
 */
function scoreMove(entry, me, stab) {
  if (!entry.selectable || entry.category === 'status' || entry.power <= 0) return 0;
  if (entry.word === 'Blocked' || entry.word === 'No effect' || entry.word === 'Blocked by Ward' || entry.mult === 0) return 0;
  const s = entry.type !== null && (me.types.includes(entry.type) || (entry.heartmark && me.heartmarkStab)) ? stab : 1;
  return entry.power * entry.mult * s * entry.hitChance;
}

/**
 * Best raw matchup score of a creature's damaging techniques against the foe
 * (0 when nothing lands).
 * @param {import('./engine.js').Battle} battle @param {any} c @param {any} foe @param {any} foeAbility
 * @returns {number}
 */
function benchScore(battle, c, foe, foeAbility) {
  let best = 0;
  for (const m of c.moves) {
    if (m.pp <= 0) continue;
    const mv = battle.data.move(m.id);
    if (!isDamaging(mv)) continue;
    const type = moveTypeFor(mv, c);
    const check = wardCheck(foeAbility, mv, foe.types, type, battle.data.chart);
    if (!check.lands) continue;
    const stab = type !== null && c.types.includes(type) ? battle.tuning.stab : 1;
    best = Math.max(best, mv.power * check.eff.mult * stab);
  }
  return best;
}

/**
 * Picks the replacement after a faint: the bench creature with the best
 * matchup, ties to the higher level.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @returns {{type: 'switch', to: number}}
 * @throws {Error} when nothing can be sent in
 */
export function chooseReplacement(battle, side) {
  const acts = battle.legal(side);
  const foe = battle.foeOf(side);
  const foeAbility = battle.effectiveAbility(1 - side);
  const options = acts.switches.filter((s) => s.selectable);
  if (!options.length) throw new Error('chooseReplacement: nothing to send in');
  let best = options[0];
  let bestScore = -1;
  for (const o of options) {
    const c = battle.sides[side].party[o.index];
    const score = benchScore(battle, c, foe, foeAbility) + c.level / 1000;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return { type: 'switch', to: best.index };
}

/**
 * The tactical brain under a profile (default 'trainer').
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @param {{profile?: string, tuning?: {profiles?: Record<string, Partial<AiProfile>>}}} [opts]
 * @returns {import('./engine.js').Action}
 */
export function chooseTrainerAction(battle, side, opts = {}) {
  if (battle.phase === 'replace') return chooseReplacement(battle, side);
  const p = resolveProfile(opts.profile || 'trainer', opts.tuning);
  const acts = battle.legal(side);
  if (acts.locked) return { type: 'move', move: acts.locked.move };
  const me = battle.active(side);
  const foe = battle.foeOf(side);
  const foeAbility = battle.effectiveAbility(1 - side);
  const memo = battle.memo[side];
  memo.evasionUses = memo.evasionUses || 0;
  const mine = battle.sides[side];
  const theirs = battle.sides[1 - side];
  const selectable = acts.moves.filter((m) => m.selectable);
  if (!selectable.length) return { type: 'scrap' };

  const hpr = me.hp / me.stats.hp;
  const find = (pred) => selectable.find((m) => pred(battle.data.move(m.id), m));
  const scored = selectable.map((m) => ({ m, score: scoreMove(m, me, battle.tuning.stab) })).sort((a, b) => b.score - a.score);
  const best = scored[0].score > 0 ? scored[0].m : null;

  // 0. Finisher: a move whose minimum damage knocks the foe out (most accurate, then fastest).
  if (p.finisher && !theirs.vol.guarding) {
    const kos = selectable
      .filter((m) => m.category !== 'status' && battle.estimateDamage(side, m.index).min >= foe.hp)
      .sort((a, b) => b.hitChance - a.hitChance || battle.data.move(b.id).priority - battle.data.move(a.id).priority || a.index - b.index);
    if (kos.length) return { type: 'move', move: kos[0].index };
  }

  // 1. Heal when low.
  if (hpr < p.healThreshold) {
    const rec = find((mv) => mv.effect.recovery);
    if (rec && me.mends > 0 && !mine.vol.pendingHeal) return { type: 'move', move: rec.index };
    const item = p.healItems && acts.items.find((it) => it.selectable && it.id !== 'crackdust');
    if (item) return { type: 'item', item: item.id };
  }

  // 2. Switch out of a Blocked matchup when the bench has an answer.
  if (!best && !mine.vol.trap) {
    if (p.switchOnBlocked) {
      let pick = null;
      let pickScore = 0;
      for (const o of acts.switches.filter((s) => s.selectable)) {
        const score = benchScore(battle, mine.party[o.index], foe, foeAbility);
        if (score > pickScore) {
          pickScore = score;
          pick = o;
        }
      }
      if (pick) return { type: 'switch', to: pick.index };
    }
    const cd = p.crackdust && acts.items.find((it) => it.id === 'crackdust' && it.selectable);
    if (cd) return { type: 'item', item: 'crackdust' };
  }

  // 3. Guard sensibly.
  const guard = p.guard && find((mv) => mv.effect.guard);
  if (guard && !mine.vol.guardedLast && (theirs.vol.charging || mine.vol.pendingHeal)) return { type: 'move', move: guard.index };

  // 4. Evasion, at most maxEvasionUses per battle and never past the cap or into a Plumbline lock.
  const eva = find((mv) => mv.effect.evasion);
  if (eva && memo.evasionUses < p.maxEvasionUses && mine.vol.stages.eva < battle.tuning.evasionCap && hpr > p.evasionMinHp && battle.turn >= mine.vol.boostBlockUntil) {
    memo.evasionUses++;
    return { type: 'move', move: eva.index };
  }

  // 5. Chip the foe when direct damage is poor or it has a Ward.
  const foeHasWard = !!(foeAbility && foeAbility.ward);
  const weakHit = !best || scored[0].m.mult < 1;
  if (p.chip && (foeHasWard || weakHit) && !foe.status && !theirs.vol.trap) {
    const chip = find((mv, entry) => mv.effect.status && mv.category === 'status' && CHIP_KINDS.includes(mv.effect.status.kind) && entry.word !== 'Blocked by Ward');
    if (chip) return { type: 'move', move: chip.index };
  }

  // 6. Plumbline / Snuff against a boosted foe.
  if (p.clearBoosts && Object.values(theirs.vol.stages).some((v) => v > 0)) {
    const clear = find((mv, entry) => (mv.effect.plumbline || mv.effect.clearRaised) && entry.word !== 'Blocked by Ward' && entry.word !== 'No effect');
    if (clear) return { type: 'move', move: clear.index };
  }

  // 7. Strongest hit.
  if (best) return { type: 'move', move: best.index };

  // 8. Anything else that is legal (a status move, then the first selectable).
  const status = find((mv, entry) => mv.category === 'status' && !mv.effect.recovery && !mv.effect.evasion && !mv.effect.guard && entry.word !== 'Blocked by Ward');
  if (status) return { type: 'move', move: status.index };
  return { type: 'move', move: selectable[0].index };
}

/**
 * The wild brain: a damaging move weighted by expected damage, else any legal
 * move, else Scrap. Draws from the battle rng.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @returns {import('./engine.js').Action}
 */
export function chooseWildAction(battle, side) {
  if (battle.phase === 'replace') return chooseReplacement(battle, side);
  const acts = battle.legal(side);
  if (acts.locked) return { type: 'move', move: acts.locked.move };
  const me = battle.active(side);
  const selectable = acts.moves.filter((m) => m.selectable);
  if (!selectable.length) return { type: 'scrap' };
  const weighted = selectable.map((m) => ({ w: scoreMove(m, me, battle.tuning.stab), v: m.index })).filter((e) => e.w > 0);
  if (weighted.length) return { type: 'move', move: /** @type {(e: any[]) => number} */ (battle.rng.weighted)(weighted) };
  return { type: 'move', move: battle.rng.pick(selectable).index };
}

/**
 * The profile a battle side gets by default: the wild brain for a wild foe,
 * 'summit' for Summit fights, 'spire' for Spire fights, else 'trainer'.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @returns {'wild'|'trainer'|'spire'|'summit'}
 */
export function profileFor(battle, side) {
  if (side === 1 && battle.kind === 'wild') return 'wild';
  if (battle.summit) return 'summit';
  if (battle.source === 'spire') return 'spire';
  return 'trainer';
}

/**
 * Picks an action for a side under a profile (default: {@link profileFor}).
 * Usable directly as `createBattle({foeAi: chooseAction})`.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @param {{profile?: string, tuning?: {profiles?: Record<string, Partial<AiProfile>>}}} [opts]
 * @returns {import('./engine.js').Action}
 */
export function chooseAction(battle, side, opts = {}) {
  const name = opts.profile || profileFor(battle, side);
  const p = resolveProfile(name, opts.tuning);
  if (p.brain === 'wild') return chooseWildAction(battle, side);
  return chooseTrainerAction(battle, side, { profile: name, tuning: opts.tuning });
}

/**
 * The manifest's `foeAi(battle, side)`: {@link chooseAction} with the default profile.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @returns {import('./engine.js').Action}
 */
export function foeAi(battle, side) {
  return chooseAction(battle, side);
}

/**
 * Builds a `foeAi` bound to one profile (and optional tuning), for
 * `createBattle({foeAi: makeFoeAi('spire')})`.
 * @param {string} profile
 * @param {{tuning?: {profiles?: Record<string, Partial<AiProfile>>}}} [opts]
 * @returns {(battle: import('./engine.js').Battle, side: number) => import('./engine.js').Action}
 * @throws {RangeError} for an unknown profile (checked at build time)
 */
export function makeFoeAi(profile, opts = {}) {
  resolveProfile(profile, opts.tuning);
  return (battle, side) => chooseAction(battle, side, { profile, tuning: opts.tuning });
}

/**
 * Legality check: whether `action` is one {@link Battle#legal} marks selectable
 * for `side` right now (used by tests and the simulator).
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @param {any} action
 * @returns {boolean}
 */
export function isLegal(battle, side, action) {
  if (!action || typeof action !== 'object') return false;
  const acts = battle.legal(side);
  if (battle.phase === 'ended') return false;
  if (battle.phase === 'replace') return action.type === 'switch' && acts.switches.some((s) => s.selectable && s.index === action.to);
  if (acts.locked) return action.type === 'move' && action.move === acts.locked.move;
  switch (action.type) {
    case 'move': return acts.moves.some((m) => m.selectable && m.index === action.move);
    case 'scrap': return acts.scrap.available;
    case 'switch': return acts.switches.some((s) => s.selectable && s.index === action.to);
    case 'run': return acts.run.available;
    case 'read': return acts.read.available && acts.read.costsTurn;
    case 'lantern': return !!(acts.lantern && acts.lantern.available && acts.lantern.grades.some((g) => g.grade === action.grade && g.selectable));
    case 'item': return acts.items.some((it) => it.selectable && it.id === (action.item !== undefined ? action.item : action.id));
    default: return false;
  }
}
