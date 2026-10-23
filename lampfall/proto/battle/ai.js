/**
 * Battle AI: a trainer brain and a wild brain. Both only ever return actions
 * that {@link Battle#availableActions} marks selectable, so they never pick a
 * 0-PP move, never Run in a trainer battle and fall back to Scrap when every
 * move is out of PP.
 *
 * Trainer AI (rules 10.1 and dossier tactics):
 * - prefers Strong hits (expected damage = power x type mult x STAB x hit chance)
 * - switches out of Blocked matchups (Ward or immunity) when a bench creature has an answer
 * - uses an evasion move at most twice per battle, and never past the +2 cap
 * - heals with a recovery move (spending a Mend) under 35% HP, or a heal item
 * - guards sensibly: against a braced charge move, or to protect a pending heal; never on consecutive turns
 * Memory lives in `battle.memo[side]` so it is per battle and serialisable.
 *
 * @module proto/battle/ai
 */

import { getMove, isDamaging } from './moves.js';
import { wardCheck } from './abilities.js';
import { STAB } from './engine.js';

/** Trainer AI heals below this HP fraction. */
export const HEAL_THRESHOLD = 0.35;
/** Max evasion-move uses per battle (estimate, rules 10.1). */
export const MAX_EVASION_USES = 2;

/**
 * Expected-damage score of one menu entry.
 * @param {any} entry availableActions move entry
 * @param {import('./creature.js').Creature} me
 */
function scoreMove(entry, me) {
  if (!entry.selectable || entry.category === 'status' || entry.power <= 0) return 0;
  if (entry.word === 'Blocked' || entry.word === 'No effect' || entry.word === 'Blocked by Ward' || entry.mult === 0) return 0;
  const stab = entry.type !== null && (me.types.includes(entry.type) || (entry.heartmark && me.heartmarkStab)) ? STAB : 1;
  return entry.power * entry.mult * stab * entry.hitChance;
}

/**
 * Whether `c` has a damaging technique that lands on the foe (through its Ward, if any).
 */
function hasAnswer(c, foe, foeAbility) {
  return c.moves.some((m) => {
    if (m.pp <= 0) return false;
    const mv = getMove(m.id);
    if (!isDamaging(mv)) return false;
    const type = mv.effect.queuedType && c.typeQueue ? c.typeQueue[(c.typeIndex + 1) % c.typeQueue.length] : mv.type;
    return wardCheck(foeAbility, mv, foe.types, type).lands;
  });
}

/** Best raw matchup score of a bench creature against the foe. */
function benchScore(c, foe, foeAbility) {
  let best = 0;
  for (const m of c.moves) {
    if (m.pp <= 0) continue;
    const mv = getMove(m.id);
    if (!isDamaging(mv)) continue;
    const type = mv.effect.queuedType && c.typeQueue ? c.typeQueue[(c.typeIndex + 1) % c.typeQueue.length] : mv.type;
    const check = wardCheck(foeAbility, mv, foe.types, type);
    if (!check.lands) continue;
    const stab = c.types.includes(type) ? STAB : 1;
    best = Math.max(best, mv.power * check.eff.mult * stab);
  }
  return best;
}

/**
 * Picks the replacement after a faint: the bench creature with the best
 * matchup, ties to the higher level.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @returns {{type:'switch', to:number}}
 */
export function chooseReplacement(battle, side) {
  const acts = battle.availableActions(side);
  const foe = battle.foeOf(side);
  const foeAbility = battle.effectiveAbility(1 - side);
  const options = acts.switches.filter((s) => s.selectable);
  if (!options.length) throw new Error('chooseReplacement: nothing to send in');
  let best = null;
  let bestScore = -1;
  for (const o of options) {
    const c = battle.sides[side].party[o.index];
    const score = benchScore(c, foe, foeAbility) + c.level / 1000;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return { type: 'switch', to: best.index };
}

/**
 * Trainer AI.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @returns {any} an action for {@link Battle#submit}
 */
export function chooseTrainerAction(battle, side) {
  if (battle.phase === 'replace') return chooseReplacement(battle, side);
  const acts = battle.availableActions(side);
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
  const find = (pred) => selectable.find((m) => pred(getMove(m.id), m));
  const scored = selectable.map((m) => ({ m, score: scoreMove(m, me) })).sort((a, b) => b.score - a.score);
  const best = scored[0].score > 0 ? scored[0].m : null;

  // 1. Heal when low.
  if (hpr < HEAL_THRESHOLD) {
    const rec = find((mv) => mv.effect.recovery);
    if (rec && me.mends > 0 && !mine.vol.pendingHeal) return { type: 'move', move: rec.index };
    const item = acts.items.find((it) => it.selectable && it.id !== 'crackdust');
    if (item) return { type: 'item', item: item.id };
  }

  // 2. Switch out of a Blocked matchup when the bench has an answer.
  if (!best && !mine.vol.trap) {
    const bench = acts.switches.filter((s) => s.selectable);
    let pick = null;
    let pickScore = 0;
    for (const o of bench) {
      const c = mine.party[o.index];
      const score = benchScore(c, foe, foeAbility);
      if (score > pickScore) {
        pickScore = score;
        pick = o;
      }
    }
    if (pick) return { type: 'switch', to: pick.index };
    const cd = acts.items.find((it) => it.id === 'crackdust' && it.selectable);
    if (cd) return { type: 'item', item: 'crackdust' };
  }

  // 3. Guard sensibly.
  const guard = find((mv) => mv.effect.guard);
  if (guard && !mine.vol.guardedLast) {
    if (theirs.vol.charging) return { type: 'move', move: guard.index };
    if (mine.vol.pendingHeal) return { type: 'move', move: guard.index };
  }

  // 4. Evasion, at most twice per battle and never past the cap.
  const eva = find((mv) => mv.effect.evasion);
  if (eva && memo.evasionUses < MAX_EVASION_USES && mine.vol.stages.eva < 2 && hpr > 0.5 && battle.turn >= mine.vol.boostBlockUntil) {
    memo.evasionUses++;
    return { type: 'move', move: eva.index };
  }

  // 5. Chip the foe when direct damage is poor or it has a Ward.
  const foeHasWard = !!(foeAbility && foeAbility.ward);
  const bestEntry = scored[0];
  const weakHit = !best || bestEntry.m.mult < 1;
  if ((foeHasWard || weakHit) && !foe.status && !theirs.vol.trap) {
    const chip = find((mv, entry) => mv.effect.status && mv.category === 'status' && ['poison', 'burn', 'trap'].includes(mv.effect.status.kind) && entry.word !== 'Blocked by Ward');
    if (chip) return { type: 'move', move: chip.index };
  }

  // 6. Plumbline / Snuff against a boosted foe.
  const foeBoosted = Object.values(theirs.vol.stages).some((v) => v > 0);
  if (foeBoosted) {
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
 * Wild AI: a damaging move weighted by expected damage, else any legal move,
 * else Scrap. Uses the battle rng so it stays deterministic.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 */
export function chooseWildAction(battle, side) {
  if (battle.phase === 'replace') return chooseReplacement(battle, side);
  const acts = battle.availableActions(side);
  if (acts.locked) return { type: 'move', move: acts.locked.move };
  const me = battle.active(side);
  const selectable = acts.moves.filter((m) => m.selectable);
  if (!selectable.length) return { type: 'scrap' };
  const weighted = selectable.map((m) => ({ w: scoreMove(m, me), v: m.index })).filter((e) => e.w > 0);
  if (weighted.length) return { type: 'move', move: battle.rng.weighted(weighted) };
  return { type: 'move', move: battle.rng.pick(selectable).index };
}

/**
 * Picks the brain for a side: trainer brain for trainers, wild brain for wild
 * creatures. Handy as `foeAi` in createBattle.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 */
export function chooseAction(battle, side) {
  if (side === 1 && battle.kind === 'wild') return chooseWildAction(battle, side);
  return chooseTrainerAction(battle, side);
}

/**
 * Legality check used by tests and the simulator: an action the AI returned
 * must be one availableActions marks selectable.
 * @param {import('./engine.js').Battle} battle
 * @param {number} side
 * @param {any} action
 * @returns {boolean}
 */
export function isLegal(battle, side, action) {
  const acts = battle.availableActions(side);
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
