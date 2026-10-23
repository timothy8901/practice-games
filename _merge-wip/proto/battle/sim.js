/**
 * Headless battle simulator. Plays N random battles between random parties
 * with both sides driven by the AI and checks engine invariants after every
 * step:
 * - no NaN anywhere in HP or stats
 * - HP stays within [0, maxHp]
 * - battles terminate under MAX_TURNS turns
 * - no 0-PP move is ever used
 * - Scrap is available whenever every move is at 0 PP
 * - a Ward readout lists at least one answer whenever one exists
 * - the AI only returns legal actions
 *
 * Pure: everything flows from the seed. Usage from Node:
 *   node -e "import('./sim.js').then(m => console.log(m.simulate({ n: 50, seed: 'tide' }).summary))"
 *
 * @module proto/battle/sim
 */

import { makeRng } from '../../js/core/rng.js';
import { SPECIES_LIST } from './species.js';
import { makeCreature, isFainted } from './creature.js';
import { getMove, isDamaging } from './moves.js';
import { getAbility, wardCheck } from './abilities.js';
import { createBattle, MAX_TURNS } from './engine.js';
import { chooseAction, chooseReplacement, isLegal } from './ai.js';

const DIALS = ['drift', 'flux', 'freefall'];

/**
 * Builds a random party.
 * @param {import('../../js/core/rng.js').Rng} rng
 * @param {{size?:number, minLevel?:number, maxLevel?:number, pool?:string[]}} [opts]
 */
export function randomParty(rng, opts = {}) {
  const size = opts.size ?? rng.int(1, 4);
  const pool = opts.pool || SPECIES_LIST.map((s) => s.id);
  const party = [];
  for (let i = 0; i < size; i++) {
    const speciesId = rng.pick(pool);
    const level = rng.int(opts.minLevel ?? 5, opts.maxLevel ?? 60);
    party.push(makeCreature({ speciesId, level, rng, nickname: `${speciesId}-${i}` }));
  }
  return party;
}

function allFinite(c) {
  if (!Number.isFinite(c.hp)) return false;
  for (const k of Object.keys(c.stats)) if (!Number.isFinite(c.stats[k])) return false;
  return c.moves.every((m) => Number.isFinite(m.pp) && Number.isFinite(m.maxPp));
}

/**
 * Independent re-computation of "does anything in this party land on the Ward holder".
 */
function partyHasWardAnswer(battle, side, target) {
  const ability = getAbility(target.ability);
  return battle.sides[side].party.some((c) => !isFainted(c) && c.moves.some((m) => {
    const mv = getMove(m.id);
    if (!isDamaging(mv) || mv.effect.scrap) return false;
    const type = mv.effect.queuedType && c.typeQueue ? c.typeQueue[(c.typeIndex + 1) % c.typeQueue.length] : mv.type;
    return wardCheck(ability, mv, target.types, type).lands;
  }));
}

/**
 * Player-side brain for the simulator: the trainer AI, plus Lanterns and
 * Capture Stance toggles in wild battles so capture code gets exercised.
 */
function playerBrain(battle, rng) {
  if (battle.phase === 'replace') return chooseReplacement(battle, 0);
  const acts = battle.availableActions(0);
  if (battle.kind === 'wild' && acts.lantern && acts.lantern.available && !acts.locked) {
    const foe = battle.foeOf(0);
    const low = foe.hp / foe.stats.hp < 0.5;
    if ((low && rng.chance(0.3)) || battle.turn > 60) {
      const grade = rng.pick([1, 2, 3]);
      return { type: 'lantern', grade };
    }
    if (battle.turn > 120 && acts.run.available) return { type: 'run' };
  }
  return chooseAction(battle, 0);
}

/**
 * Plays one battle to the end and returns what happened.
 * @param {{seed: string|number, maxTurns?: number, kind?: 'wild'|'trainer', dial?: string}} opts
 */
export function simulateBattle(opts) {
  const rng = makeRng(opts.seed);
  const kind = opts.kind || rng.pick(['wild', 'trainer', 'trainer']);
  const dial = opts.dial || rng.pick(DIALS);
  const maxTurns = opts.maxTurns ?? MAX_TURNS;
  const violations = [];
  const note = (what) => violations.push(`[${opts.seed}] ${what}`);
  const player = randomParty(rng.fork('player'), { size: rng.int(1, 4) });
  const foeParty = kind === 'wild' ? randomParty(rng.fork('foe'), { size: 1 }) : randomParty(rng.fork('foe'), { size: rng.int(1, 4) });
  const sides = [
    { party: player, bag: { crackdust: rng.int(0, 1) }, glint: rng.int(0, 50000) },
    kind === 'wild' ? { party: foeParty } : { party: foeParty, trainer: { name: 'Sim Trainer', items: rng.chance(0.5) ? [{ id: 'tonic', name: 'Tonic', heal: 0.5 }] : [] } },
  ];
  const battle = createBattle({ sides, kind, dial, rng: rng.fork('battle'), captureStance: kind === 'wild' && rng.chance(0.5), curveLevel: rng.chance(0.5) ? rng.int(10, 50) : null, summit: rng.chance(0.1) });
  const brainRng = rng.fork('brain');
  const events = battle.intro.slice();
  let steps = 0;
  while (battle.phase !== 'ended' && steps < maxTurns * 3) {
    steps++;
    const actions = [];
    const sidesToAct = battle.phase === 'replace' ? battle.pendingReplace : [0, 1];
    for (const side of sidesToAct) {
      const a = side === 0 ? playerBrain(battle, brainRng) : chooseAction(battle, side);
      if (!isLegal(battle, side, a)) note(`illegal AI action on side ${side} turn ${battle.turn}: ${JSON.stringify(a)}`);
      if (battle.phase === 'choose') {
        const c = battle.active(side);
        const all0 = c.moves.every((m) => m.pp <= 0);
        const acts = battle.availableActions(side);
        if (all0 && !acts.scrap.available) note(`Scrap unavailable with every move at 0 PP (side ${side}, turn ${battle.turn})`);
        if (a.type === 'move' && !acts.locked && c.moves[a.move].pp <= 0) note(`AI picked a 0-PP move on side ${side}`);
      }
      actions[side] = a;
    }
    let evs;
    try {
      evs = battle.submit(actions);
    } catch (err) {
      note(`engine threw: ${err && err.message}`);
      break;
    }
    for (const ev of evs) {
      events.push(ev);
      if (ev.type === 'move' && ev.pp !== null && ev.pp < 0) note(`move event with negative PP: ${ev.move}`);
      if (ev.type === 'ward-readout') {
        const target = battle.active(ev.side === 0 ? 1 : 0);
        const expect = partyHasWardAnswer(battle, ev.side, target);
        if (expect !== ev.canLand.length > 0) note(`ward readout mismatch: expected answer=${expect}, listed ${ev.canLand.length} (turn ${battle.turn})`);
      }
    }
    for (const s of battle.sides) {
      for (const c of s.party) {
        if (!allFinite(c)) note(`NaN in ${c.nickname}`);
        if (c.hp < 0 || c.hp > c.stats.hp) note(`HP out of bounds for ${c.nickname}: ${c.hp}/${c.stats.hp}`);
        for (const m of c.moves) if (m.pp < 0 || m.pp > m.maxPp) note(`PP out of bounds for ${c.nickname} ${m.id}: ${m.pp}`);
      }
    }
  }
  if (battle.phase !== 'ended') note(`battle did not end after ${steps} steps`);
  if (battle.turn >= maxTurns) note(`battle ran ${battle.turn} turns`);
  return { seed: opts.seed, kind, dial, turns: battle.turn, outcome: battle.outcome, events, violations, result: battle.result() };
}

/**
 * Plays `n` battles seeded from `seed` and aggregates.
 * @param {{n?: number, seed?: string|number, maxTurns?: number}} [opts]
 */
export function simulate(opts = {}) {
  const n = opts.n ?? 100;
  const seed = opts.seed ?? 'wildshift';
  const outcomes = {};
  const violations = [];
  let turns = 0;
  let longest = 0;
  const eventTypes = new Set();
  for (let i = 0; i < n; i++) {
    const r = simulateBattle({ seed: `${seed}:${i}`, maxTurns: opts.maxTurns });
    outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
    turns += r.turns;
    longest = Math.max(longest, r.turns);
    for (const ev of r.events) eventTypes.add(ev.type);
    violations.push(...r.violations);
  }
  return {
    n,
    seed,
    outcomes,
    avgTurns: n ? turns / n : 0,
    longest,
    eventTypes: [...eventTypes].sort(),
    violations,
    summary: `${n} battles, outcomes ${JSON.stringify(outcomes)}, avg ${n ? (turns / n).toFixed(1) : 0} turns, longest ${longest}, ${violations.length} violations`,
  };
}
