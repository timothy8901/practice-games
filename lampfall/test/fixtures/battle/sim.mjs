// Headless battle simulator (ported from proto/battle/sim.js onto js/battle). Plays N random
// battles between random parties with both sides driven by the AI and checks engine invariants
// after every step:
// - every event matches the contract in js/battle/events.js
// - no NaN anywhere in HP, stats or PP; HP and PP stay in bounds
// - battles terminate under the turn cap; no 0-PP move is ever used
// - Scrap is offered whenever every move is at 0 PP
// - a Ward readout lists an answer exactly when one exists, and only chip moves that work
// - the AI only returns legal actions
// Pure: everything flows from the seed.
// CLI: node test/fixtures/battle/sim.mjs [n] [seed]
import { makeRng } from '../../../js/core/rng.js';
import { createBattle, MAX_TURNS } from '../../../js/battle/engine.js';
import { createBattleData } from '../../../js/battle/data.js';
import { chooseAction, chooseReplacement, isLegal } from '../../../js/battle/ai.js';
import { checkEvent } from '../../../js/battle/events.js';
import { isDamaging, isChipMove, moveTypeFor, wardCheck } from '../../../js/battle/effects.js';
import { isFainted } from '../../../js/battle/creatureOps.js';
import { DATA, SPECIES } from './data.mjs';
import { makeCreature } from './helpers.mjs';

const DIALS = ['drift', 'flux', 'freefall'];
const VIEW = createBattleData(DATA);

/**
 * Builds a random party.
 * @param {import('../../../js/core/rng.js').Rng} rng
 * @param {{size?: number, minLevel?: number, maxLevel?: number, pool?: string[]}} [opts]
 */
export function randomParty(rng, opts = {}) {
  const size = opts.size ?? rng.int(1, 4);
  const pool = opts.pool || SPECIES.map((s) => s.id);
  const party = [];
  for (let i = 0; i < size; i++) {
    const speciesId = rng.pick(pool);
    const level = rng.int(opts.minLevel ?? 5, opts.maxLevel ?? 60);
    party.push(makeCreature({ speciesId, level, rng, nickname: `${speciesId}-${i}`, uid: `c${rng.int(1, 2 ** 30)}` }));
  }
  return party;
}

function allFinite(c) {
  if (!Number.isFinite(c.hp)) return false;
  for (const k of Object.keys(c.stats)) if (!Number.isFinite(c.stats[k])) return false;
  return c.moves.every((m) => Number.isFinite(m.pp) && Number.isFinite(m.maxPp));
}

/** Independent re-computation of "does anything in this party land on the Ward holder". */
function partyHasWardAnswer(battle, side, target, ability) {
  return battle.sides[side].party.some((c) => !isFainted(c) && c.moves.some((m) => {
    if (m.pp <= 0) return false;
    const mv = VIEW.move(m.id);
    if (!isDamaging(mv) || mv.effect.scrap) return false;
    return wardCheck(ability, mv, target.types, moveTypeFor(mv, c), VIEW.chart).lands;
  }));
}

/** Player-side brain: the trainer AI plus Lanterns and Run in wild battles so capture code runs. */
function playerBrain(battle, rng) {
  if (battle.phase === 'replace') return chooseReplacement(battle, 0);
  const acts = battle.legal(0);
  if (battle.kind === 'wild' && acts.lantern && acts.lantern.available && !acts.locked) {
    const foe = battle.foeOf(0);
    const low = foe.hp / foe.stats.hp < 0.5;
    if ((low && rng.chance(0.3)) || battle.turn > 60) return { type: 'lantern', grade: rng.pick([1, 2, 3]) };
    if (battle.turn > 120 && acts.run.available) return { type: 'run' };
  }
  return chooseAction(battle, 0, { profile: 'trainer' });
}

/**
 * Plays one battle to the end.
 * @param {{seed: string|number, maxTurns?: number, kind?: 'wild'|'trainer', dial?: string, profile?: string}} opts
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
  const source = kind === 'trainer' ? rng.pick(['route', 'spire', 'story']) : 'route';
  const battle = createBattle({ sides, kind, data: DATA, dial, rng: rng.fork('battle'), captureStance: kind === 'wild' && rng.chance(0.5), curveLevel: rng.chance(0.5) ? rng.int(10, 50) : null, summit: rng.chance(0.1), source });
  const foeProfile = opts.profile;
  // Check every Ward readout at the moment it is built, independently of the engine.
  const origReadout = battle._wardReadout.bind(battle);
  battle._wardReadout = (side, ability, target) => {
    const ev = origReadout(side, ability, target);
    const expect = partyHasWardAnswer(battle, side, target, ability);
    if (expect !== ev.canLand.length > 0) note(`ward readout mismatch: expected answer=${expect}, listed ${ev.canLand.length} (turn ${battle.turn})`);
    for (const e of ev.canLand) {
      const mv = VIEW.move(e.move);
      if (!wardCheck(ability, mv, target.types, e.type, VIEW.chart).lands || e.pp <= 0) note(`ward readout lists a move that cannot land: ${e.creature}'s ${e.move}`);
    }
    if (ev.types.length === 0 && ability.ward.kind !== 'no-status' && expect) note('ward readout lists no type although a technique lands');
    for (const e of ev.chip) {
      const mv = VIEW.move(e.move);
      if (!isChipMove(mv) || e.pp <= 0 || !wardCheck(ability, mv, target.types, mv.type, VIEW.chart).lands) note(`ward readout lists a chip technique that cannot work: ${e.creature}'s ${e.move}`);
    }
    const expectChip = battle.sides[side].party.some((c) => !isFainted(c) && c.moves.some((m) => {
      const mv = VIEW.move(m.id);
      return m.pp > 0 && isChipMove(mv) && wardCheck(ability, mv, target.types, mv.type, VIEW.chart).lands && (!target.status || mv.effect.status.kind === 'trap');
    }));
    if (expectChip && ev.chip.length === 0) note(`ward readout omits a usable chip technique (turn ${battle.turn})`);
    return ev;
  };
  const brainRng = rng.fork('brain');
  const events = battle.intro.slice();
  for (const ev of events) for (const p of checkEvent(ev)) note(`intro event: ${p}`);
  let steps = 0;
  while (battle.phase !== 'ended' && steps < maxTurns * 3) {
    steps++;
    const actions = [];
    const sidesToAct = battle.phase === 'replace' ? battle.pendingReplace : [0, 1];
    for (const side of sidesToAct) {
      const a = side === 0 ? playerBrain(battle, brainRng) : chooseAction(battle, side, foeProfile ? { profile: foeProfile } : {});
      if (!isLegal(battle, side, a)) note(`illegal AI action on side ${side} turn ${battle.turn}: ${JSON.stringify(a)}`);
      if (battle.phase === 'choose') {
        const c = battle.active(side);
        const acts = battle.legal(side);
        if (c.moves.every((m) => m.pp <= 0) && !acts.scrap.available) note(`Scrap unavailable with every move at 0 PP (side ${side}, turn ${battle.turn})`);
        if (a.type === 'move' && !acts.locked && c.moves[a.move].pp <= 0) note(`AI picked a 0-PP move on side ${side}`);
      }
      actions[side] = a;
    }
    let evs;
    try {
      evs = battle.step(actions);
    } catch (err) {
      note(`engine threw: ${err && err.message}`);
      break;
    }
    for (const ev of evs) {
      events.push(ev);
      for (const p of checkEvent(ev)) note(`event contract: ${p}`);
      if (ev.type === 'move' && ev.pp !== null && ev.pp < 0) note(`move event with negative PP: ${ev.move}`);
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
 * @param {{n?: number, seed?: string|number, maxTurns?: number, profile?: string}} [opts]
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
    const r = simulateBattle({ seed: `${seed}:${i}`, maxTurns: opts.maxTurns, profile: opts.profile });
    outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
    turns += r.turns;
    longest = Math.max(longest, r.turns);
    for (const ev of r.events) eventTypes.add(ev.type);
    violations.push(...r.violations);
  }
  return {
    n, seed, outcomes, avgTurns: n ? turns / n : 0, longest, eventTypes: [...eventTypes].sort(), violations,
    summary: `${n} battles, outcomes ${JSON.stringify(outcomes)}, avg ${n ? (turns / n).toFixed(1) : 0} turns, longest ${longest}, ${violations.length} violations`,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const n = Number(process.argv[2] || 500);
  const report = simulate({ n, seed: process.argv[3] || 'wildshift-cli' });
  console.log(report.summary);
  for (const v of report.violations.slice(0, 20)) console.log(v);
  process.exitCode = report.violations.length ? 1 : 0;
}
