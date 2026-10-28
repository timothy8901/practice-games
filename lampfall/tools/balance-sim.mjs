#!/usr/bin/env node
/**
 * Balance simulator for the creature (GDD-03) and battle (GDD-04) chapters.
 *
 * Plays the real content through the real engine (`js/battle/engine.js`) with the real tables
 * (`js/data/species`, `moves`, `abilities`, `types`, `trainers`, `spires`): every Spire leader, the
 * Summit gauntlet and every route trainer against a typical on-curve player party, many times each,
 * with a competent player brain on side 0 and the trainer's own AI profile on side 1.
 *
 * The engine runs arena weather and held items itself: the Weather Spire's posted cycle
 * (`theme.rule`) is passed as `weatherCycle`, trainer party entries carry their `held` item (as
 * `heldItem`) and `onEntry` weather (Cass's and Idris's squall), and the item and weather tables
 * (`data/items.ITEMS`, `data/spires.WEATHER_KINDS`) are injected with the rest of the content.
 * Posted boss Shifts (`party[i].bossShift`) run in the engine too (GDD-04 §1.4, the same code the game
 * runs): the strip posts at `postAt`, the Shift lands at `shiftAt`, cards at the Flux base odds (or 100%)
 * on `bossShift:<trainerId>:<slot>`.
 * The Relay Spire follows the rounds the game's battle flow runs (`theme.rule.rounds`; battleFlow `relayRule`,
 * `relayNextSetup`): three rounds of two player creatures each, no repeats, no heal between, both bags
 * (the player's and the twins' two Tonics) carried over; the harness plans the split against the posted rounds.
 * What the engine does not run, the harness supplies, and says so:
 *  - the Summit is played as one run: three fights in a row, no Waystone between, +5 PP per move;
 *    the player's bag is used between fights (Revives on the fainted, Full Salves on the lowest).
 *
 * Player parties are the GDD-04 §Balance "on-curve parties": the starter line (three variants:
 * Sloshkin, Scrapling, Reedkit lines) plus forms commonly caught by that point, at the posted
 * curve (starter at curve +1, everyone else at the curve), with sensible movesets picked
 * from their learnsets and the discs a player can own by then.
 *
 * Level progression (`simulateProgression`): the on-curve parties above are fixed; this part plays a whole
 * run's EXP instead, through the real award split (`systems/exp.computeAward`) and the shipped curve
 * (`data/tuning.GROWTH_CURVES`), against the real rosters (trainers, the isles' wild tables, Porch Duels
 * scaled as `battleFlow` scales them), for three players (minimal, typical, thorough), and reports each
 * party's levels at every Spire door against the posted curve and ace, plus where each Shift window opens.
 * `tools/economy-sim.mjs` (`levelPace`) feeds it the economy sim's day-by-day battles for real-minute pace.
 *
 * Usage: node tools/balance-sim.mjs [--n 200] [--json] [--only progression]
 * Library: import { runAll, simulateSpire, simulateSummit, simulateRoute, statOutliers, simulateProgression } from it.
 * @module tools/balance-sim
 */

import { createBattle } from '../js/battle/engine.js';
import { createBattleData } from '../js/battle/data.js';
import { chooseAction, chooseReplacement } from '../js/battle/ai.js';
import { isDamaging, moveTypeFor, wardCheck, damageFormula, CHIP_KINDS, MAJOR_STATUS } from '../js/battle/effects.js';
import { makeCreature } from '../js/systems/creature.js';
import { makeRng } from '../js/core/rng.js';
import { TYPES, TYPE_TABLE } from '../js/data/types.js';
import { ABILITIES } from '../js/data/abilities.js';
import { SPECIES, FAMILIES } from '../js/data/species/index.js';
import { MOVES } from '../js/data/moves/index.js';
import { TRAINERS, TRAINER_BY_ID } from '../js/data/trainers.js';
import { SPIRES, SUMMIT, BOSS_SHIFT_ODDS, WEATHER_KINDS } from '../js/data/spires.js';
import { ITEMS } from '../js/data/items.js';
import { TUNING } from '../js/data/tuning.js';
import { REGIONS } from '../js/data/regions.js';
import { ENCOUNTERS } from '../js/data/encounters/index.js';
import { PORCH_DUELS } from '../js/data/town.js';
import * as expSys from '../js/systems/exp.js';

// --- data views -----------------------------------------------------------------------------------

/** Tables for systems/creature (types as rows, for the Unfixed loop). */
export const CREATURE_DATA = Object.freeze({ species: SPECIES, families: FAMILIES, moves: MOVES, abilities: ABILITIES, types: TYPES, items: [] });
/** Tables for the battle engine (types as the chart table; items drive held items; arena weather kinds). */
export const BATTLE_DATA = Object.freeze({ species: SPECIES, moves: MOVES, abilities: ABILITIES, types: TYPE_TABLE, items: ITEMS, weatherKinds: WEATHER_KINDS });
const VIEW = createBattleData(BATTLE_DATA);
const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const MV = Object.fromEntries(MOVES.map((m) => [m.id, m]));

/**
 * GDD-00 numbers the engine DEFAULTS do not carry yet (GDD-04 engine follow-up 3); none of them
 * changes a win rate, they are passed so the sim reads the shipped rules.
 */
export const SIM_TUNING = Object.freeze({ payoutPerLevel: 50, expYieldDivisor: 5, blackoutCap: 1500 });

// --- targets (the verifier's acceptance bands) ----------------------------------------------------

export const TARGETS = Object.freeze({
  spire: Object.freeze([0.55, 0.85]),
  summit: Object.freeze([0.35, 0.65]),
  routeMin: 0.85,
  maxAvgTurns: 60,
});

// --- creatures ------------------------------------------------------------------------------------

let uidSeq = 0;

/**
 * A creature from the real tables.
 * @param {string} speciesId @param {number} level @param {string[]|null} moves
 * @param {{rng?: any, nick?: string}} [opts]
 */
export function mon(speciesId, level, moves, opts = {}) {
  return makeCreature({
    uid: `sim${++uidSeq}`, speciesId, level, moves: moves || undefined, heartmark: null,
    nickname: opts.nick || SP[speciesId].name, rng: opts.rng || null,
  }, CREATURE_DATA);
}

/** Learnable at a level (learnset) plus the discs owned that the form can be taught. */
export function moveOptions(speciesId, level, discs = []) {
  const s = SP[speciesId];
  const out = [];
  for (const [lv, id] of s.learnset) if (lv <= level && !out.includes(id)) out.push(id);
  for (const id of s.flags.teachable || []) if (discs.includes(id) && !out.includes(id)) out.push(id);
  return out;
}

/**
 * A sensible four: the strongest same-type hit per own type, the strongest coverage hit of a new
 * type, one utility move (recovery, then a chip status, then a stat boost), then the next best hit.
 * Hits are scored by power x accuracy x STAB x the form's matching attack stat.
 * @param {string} speciesId @param {number} level @param {string[]} [discs]
 * @returns {string[]}
 */
export function pickMoves(speciesId, level, discs = []) {
  const s = SP[speciesId];
  const opts = moveOptions(speciesId, level, discs).map((id) => MV[id]);
  const hitScore = (m) => {
    const stat = m.category === 'physical' ? s.base.atk : s.base.spa;
    const acc = m.accuracy == null ? 1 : m.accuracy / 100;
    const charge = m.effect.charge ? 0.55 : 1;
    const selfKo = m.effect.selfKo ? 0.2 : 1;
    const hits = m.effect.multiHit ? (m.effect.multiHit[0] + m.effect.multiHit[1]) / 2 : 1;
    return m.power * hits * acc * charge * selfKo * (s.types.includes(m.type) ? 1.5 : 1) * stat;
  };
  const hits = opts.filter((m) => m.category !== 'status' && m.power > 0).sort((a, b) => hitScore(b) - hitScore(a));
  const picked = [];
  const covered = new Set();
  for (const t of s.types) {
    const m = hits.find((h) => h.type === t && !picked.includes(h.id));
    if (m) { picked.push(m.id); covered.add(t); }
  }
  const cov = hits.find((h) => !covered.has(h.type) && !picked.includes(h.id) && hitScore(h) > 0);
  if (cov) { picked.push(cov.id); covered.add(cov.type); }
  const util = opts.find((m) => m.effect.recovery)
    || opts.find((m) => m.category === 'status' && m.effect.status && CHIP_KINDS.includes(m.effect.status.kind))
    || opts.find((m) => m.category === 'status' && m.effect.stat && m.effect.stat.some((x) => x.target === 'self' && x.stages > 0 && ['atk', 'spa'].includes(x.stat)));
  if (util && picked.length < 4) picked.push(util.id);
  while (picked.length < 4) {
    const rest = hits.filter((h) => !picked.includes(h.id));
    if (!rest.length) break;
    const next = rest.sort((a, b) => hitScore(b) * (covered.has(b.type) ? 1 : 1.25) - hitScore(a) * (covered.has(a.type) ? 1 : 1.25))[0];
    picked.push(next.id);
    covered.add(next.type);
  }
  return picked.slice(0, 4);
}

/**
 * A trainer's party as battle creatures (moves as written; held items and entry weather as the
 * engine reads them; boss Shifts kept for the harness).
 */
export function trainerParty(tr, scale = null) {
  return tr.party.map((c, i) => {
    const level = scale !== null && c.levelOffset !== undefined ? Math.max(2, scale + c.levelOffset) : c.level;
    const m = mon(c.species, level, c.moves ? [...c.moves] : null, { nick: c.nick });
    m._slot = i;
    if (c.bossShift) m.bossShift = c.bossShift;
    m.heldItem = c.held ?? null;
    if (c.onEntry) m.onEntry = { ...c.onEntry };
    return m;
  });
}

// --- damage estimates for any pair (bench decisions) ----------------------------------------------

/**
 * Expected damage of one move from `att` to `def` at full stages (0 when it cannot land), under
 * the battle's weather when one is given.
 */
export function expectedDamage(att, def, moveId, wardDown = false, battle = null) {
  const mv = VIEW.move(moveId);
  if (!isDamaging(mv)) return 0;
  const type = moveTypeFor(mv, att);
  const ab0 = VIEW.ability(def.ability);
  const ab = wardDown && ab0.ward ? { ...ab0, ward: null } : ab0;
  const check = wardCheck(ab, mv, def.types, type, VIEW.chart);
  if (!check.lands) return 0;
  const physical = mv.category === 'physical';
  const ua = VIEW.ability(att.ability);
  let extra = battle ? battle.weatherPowerMult(type) : 1;
  if (ua.hooks.onAttackMult) extra *= ua.hooks.onAttackMult({ attacker: att, move: mv, hpRatio: att.hp / att.stats.hp, moveType: type });
  const dmg = damageFormula({
    level: att.level, power: mv.power, attack: physical ? att.stats.atk : att.stats.spa, defense: physical ? def.stats.def : def.stats.spd,
    typeMult: check.eff.mult, stab: type !== null && att.types.includes(type), crit: false, rand: 0.925, burned: false, extra,
  });
  const hits = mv.effect.multiHit ? (mv.effect.multiHit[0] + mv.effect.multiHit[1]) / 2 : 1;
  const acc = mv.accuracy == null ? 1 : mv.accuracy / 100;
  return dmg * hits * acc * (mv.effect.charge ? 0.5 : 1);
}

/** Best expected damage of a creature's usable moves into a target (under the battle's weather when given). */
export function bestDamage(att, def, wardDown = false, battle = null) {
  let best = 0;
  for (const m of att.moves) if (m.pp > 0) best = Math.max(best, expectedDamage(att, def, m.id, wardDown, battle));
  return best;
}

/** Matchup score of `c` against `foe`: share of foe HP it takes per turn minus share it loses (weather counted). */
function matchup(c, foe, wardDown = false, battle = null) {
  const give = bestDamage(c, foe, wardDown, battle) / Math.max(1, foe.hp);
  const take = bestDamage(foe, c, false, battle) / Math.max(1, c.hp);
  const speed = c.stats.spe >= foe.stats.spe ? 0.1 : 0;
  return Math.min(1.2, give) - 0.8 * Math.min(1.2, take) + speed;
}

// --- the competent player -------------------------------------------------------------------------

/**
 * Player brain (side 0): finishes when it can, heals when a heal buys a turn, switches out of a
 * wall or a losing matchup when the bench has a clear answer (never twice in a row), throws
 * Crackdust at a Ward nothing lands on, clears boosts with Plumbline, chips what it cannot hurt,
 * otherwise picks the hit with the best expected damage. It sees the foe's moves (a Scouting Prism
 * Read and the posted dossier).
 * @param {import('../js/battle/engine.js').Battle} battle
 * @param {Record<string, any>} memo
 */
export function playerBrain(battle, memo) {
  const side = 0;
  if (battle.phase === 'replace') {
    const acts = battle.legal(side);
    const foe = battle.foeOf(side);
    const opts = acts.switches.filter((s) => s.selectable);
    let best = opts[0];
    let score = -Infinity;
    const down = battle.sides[1].vol.wardSuppressed > 1;
    for (const o of opts) {
      const sc = matchup(battle.sides[side].party[o.index], foe, down, battle);
      if (sc > score) { score = sc; best = o; }
    }
    return { type: 'switch', to: best.index };
  }
  const acts = battle.legal(side);
  if (acts.locked) return { type: 'move', move: acts.locked.move };
  const me = battle.active(side);
  const foe = battle.foeOf(side);
  const mine = battle.sides[side];
  const theirs = battle.sides[1];
  const sel = acts.moves.filter((m) => m.selectable);
  if (!sel.length) return { type: 'scrap' };
  const scored = sel.map((m) => {
    const mv = VIEW.move(m.id);
    if (!isDamaging(mv)) return { m, mv, exp: 0, min: 0 };
    const est = battle.estimateDamage(side, m.index);
    const charge = mv.effect.charge ? 0.5 : 1;
    const selfKo = mv.effect.selfKo ? 0.3 : 1;
    return { m, mv, exp: ((est.min + est.max) / 2) * m.hitChance * charge * selfKo, min: est.min };
  }).sort((a, b) => b.exp - a.exp);
  const best = scored[0];
  const threat = bestDamage(foe, me, false, battle);
  const iAmFaster = battle.effStat(side, 'spe') >= battle.effStat(1, 'spe');

  // 1. A sure knock-out (most accurate first).
  if (!theirs.vol.guarding) {
    const ko = scored.filter((x) => x.min >= foe.hp && !x.mv.effect.charge).sort((a, b) => b.m.hitChance - a.m.hitChance)[0];
    if (ko && (iAmFaster || threat < me.hp)) return { type: 'move', move: ko.m.index };
  }

  const canSwitch = !mine.vol.trap && memo.lastSwitch !== battle.turn - 1;
  const benchPick = (minScore) => {
    let pick = null;
    let score = minScore;
    for (const o of acts.switches.filter((s) => s.selectable)) {
      const c = mine.party[o.index];
      const sc = matchup(c, foe, false, battle);
      if (sc > score) { score = sc; pick = o; }
    }
    return pick;
  };

  // 2. A Ward up and little getting through: a bench creature that lands now and survives a hit,
  //    else Crackdust, else (below) chip.
  const foeAb = VIEW.ability(foe.ability);
  const wardUp = !!foeAb.ward && !(theirs.vol.wardSuppressed > 0);
  if (wardUp && best.exp < foe.hp * 0.5) {
    if (canSwitch) {
      let pick = null;
      let sc = best.exp;
      for (const o of acts.switches.filter((x) => x.selectable)) {
        const c = mine.party[o.index];
        const d = bestDamage(c, foe, false, battle);
        const hitsTaken = c.stats.spe > foe.stats.spe ? 1 : 2;
        if (d > sc && d >= foe.hp * 0.5 && bestDamage(foe, c, false, battle) * hitsTaken < c.hp * 0.9) { sc = d; pick = o; }
      }
      if (pick) { memo.lastSwitch = battle.turn; return { type: 'switch', to: pick.index }; }
    }
    const cd = acts.items.find((it) => it.id === 'crackdust' && it.selectable);
    if (cd) return { type: 'item', item: 'crackdust' };
  }

  // 2b. Nothing lands (an immunity, or a Ward with no dust left): switch to an answer, else Crackdust.
  if (best.exp <= 0) {
    if (canSwitch) {
      const pick = benchPick(0);
      if (pick) { memo.lastSwitch = battle.turn; return { type: 'switch', to: pick.index }; }
    }
    const cd = acts.items.find((it) => it.id === 'crackdust' && it.selectable);
    if (cd) return { type: 'item', item: 'crackdust' };
  }

  // 3. Heal when low and the heal outlasts the next hit.
  const hpr = me.hp / me.stats.hp;
  if (hpr < 0.4 && threat < me.stats.hp * 0.55 && best.exp < foe.hp) {
    const rec = scored.find((x) => x.mv.effect.recovery);
    if (rec && me.mends > 0 && !mine.vol.pendingHeal) return { type: 'move', move: rec.m.index };
    const item = acts.items.find((it) => it.selectable && it.id !== 'crackdust');
    if (item && me.mends > 0) return { type: 'item', item: item.id };
  }

  // 4. A losing matchup with a clear answer on the bench.
  const now = matchup(me, foe, false, battle);
  if (canSwitch && now < -0.25) {
    const pick = benchPick(now + 0.6);
    if (pick && bestDamage(foe, mine.party[pick.index], false, battle) < mine.party[pick.index].hp * 0.75) {
      memo.lastSwitch = battle.turn;
      return { type: 'switch', to: pick.index };
    }
  }

  // 5. Plumbline against a boosted foe (evasion first).
  if (Object.values(theirs.vol.stages).some((v) => v > 0)) {
    const pl = scored.find((x) => x.mv.effect.plumbline || (x.mv.effect.clearRaised && x.exp > 0));
    if (pl && (theirs.vol.stages.eva > 0 || best.exp < foe.hp * 0.3)) return { type: 'move', move: pl.m.index };
  }

  // 6. Chip what it can barely hurt.
  if (best.exp < foe.hp * 0.12 && !foe.status && !theirs.vol.trap) {
    const chip = scored.find((x) => x.mv.category === 'status' && x.mv.effect.status && CHIP_KINDS.includes(x.mv.effect.status.kind)
      && x.m.word !== 'Blocked by Ward' && statusTakes(battle, x.mv));
    if (chip) return { type: 'move', move: chip.m.index };
    const cd = acts.items.find((it) => it.id === 'crackdust' && it.selectable);
    if (cd) return { type: 'item', item: 'crackdust' };
  }

  // 7. The best hit.
  if (best.exp > 0) return { type: 'move', move: best.m.index };
  return { type: 'move', move: sel[0].index };
}

/** Whether a status move's condition can take on the foe now. */
function statusTakes(battle, mv) {
  const st = mv.effect.status;
  const foe = battle.foeOf(0);
  if (st.kind === 'trap') return !(battle.sides[1].vol.trap > 0);
  if (!MAJOR_STATUS.includes(st.kind)) return true;
  if (foe.status) return false;
  if (battle.data.typeBlocksStatus(st.kind, foe.types)) return false;
  const ab = battle.data.ability(foe.ability);
  return !(ab.hooks.statusImmune && ab.hooks.statusImmune(st.kind));
}

// --- boss Shifts -----------------------------------------------------------------------------------

/** Re-forms a battle creature in place: types, ability, base, stats (HP fraction kept), moves kept. */
export function reform(c, formId) {
  const s = SP[formId];
  const ratio = c.hp / c.stats.hp;
  const fresh = mon(formId, c.level, c.moves.map((m) => m.id));
  c.speciesId = s.id;
  c.types = s.types.slice();
  c.ability = s.ability;
  c.base = { ...s.base };
  c.stats = fresh.stats;
  c.hp = c.hp <= 0 ? 0 : Math.max(1, Math.round(c.stats.hp * ratio));
}

// --- one battle -----------------------------------------------------------------------------------

/**
 * Plays one trainer battle to the end and returns {outcome, turns, party (player side state), items}.
 * @param {any[]} playerParty creatures (mutated copies are returned)
 * @param {any[]} foeParty
 * @param {{rng: any, trainer?: any, source?: string, summit?: boolean, items?: any[], foeItems?: any[], crackdust?: number, maxTurns?: number, weatherCycle?: any, log?: string[]}} o   `foeItems`: the foe's heals left (a Relay round)
 */
export function playBattle(playerParty, foeParty, o) {
  const rng = o.rng;
  const trainerId = o.trainer ? o.trainer.id : 'trainer';
  const battle = createBattle({
    sides: [
      { party: playerParty, bag: { crackdust: o.crackdust || 0 }, trainer: { name: 'Sorrel', items: (o.items || []).map((x) => ({ ...x })) } },
      { party: foeParty, trainer: { name: o.trainer ? o.trainer.name : 'Trainer', items: (o.foeItems || (o.trainer && o.trainer.items) || []).map((x) => ({ ...x })) } },
    ],
    kind: 'trainer', data: BATTLE_DATA, dial: 'flux', rng: rng.fork('battle'), source: o.source || 'route', summit: !!o.summit, tuning: SIM_TUNING,
    weatherCycle: o.weatherCycle || null,
    // posted boss Shifts: the engine's own (the game's code path), at the Flux base odds
    bossShiftOdds: BOSS_SHIFT_ODDS.base.flux,
    bossShiftRng: (i) => rng.fork(`bossShift:${trainerId}:${foeParty[i] && foeParty[i]._slot !== undefined ? foeParty[i]._slot : i}`),
  });
  if (o.log) for (const ev of battle.intro) if (ev.text) o.log.push(`[t0] ${ev.text}`);
  const profile = o.trainer && o.trainer.ai ? o.trainer.ai : undefined;
  const memo = {};
  let steps = 0;
  const maxSteps = (o.maxTurns || 300) * 3;
  while (battle.phase !== 'ended' && steps++ < maxSteps) {
    const actions = [];
    const who = battle.phase === 'replace' ? battle.pendingReplace : [0, 1];
    for (const s of who) actions[s] = s === 0 ? playerBrain(battle, memo) : (battle.phase === 'replace' ? chooseReplacement(battle, 1) : chooseAction(battle, 1, profile ? { profile } : {}));
    const evs = battle.step(actions);
    if (o.log) for (const ev of evs) if (ev.text) o.log.push(`[t${battle.turn}] ${ev.text}`);
  }
  return {
    outcome: battle.outcome, turns: battle.turn, party: battle.sides[0].party, items: battle.sides[0].items, crackdust: battle.sides[0].bag.crackdust,
    foeItems: battle.sides[1].items,
    consumedItems: battle.result().consumedItems, events: battle.log,
  };
}

// --- on-curve parties -----------------------------------------------------------------------------

/** Starter lines by stage reached (GDD-04 §Balance: steering with Reroll / Anchor favours Up). */
export const STARTER_LINES = Object.freeze({
  sloshkin: Object.freeze(['sloshkin', 'siltback', 'bogmonarch']),
  scrapling: Object.freeze(['scrapling', 'knuckleback', 'cragmitt']),
  reedkit: Object.freeze(['reedkit', 'sedgehare', 'strandrunner']),
});

/**
 * The on-curve party for each fight: `starterStage` indexes STARTER_LINES, `members` are the
 * commonly caught forms by then (this isle's band plus earlier ones), `discs` the discs a player
 * owns by then, `items` the heal items carried (amount = HP healed, as on the item rows),
 * `crackdust` how many Crackdust, `alt` the forms that fill a slot when the starter's line already holds a member.
 */
export const PARTIES = Object.freeze({
  turn: { curve: 7, starterStage: 0, members: ['tossup', 'wirewhisk', 'mudfist'], discs: [], items: [['salve', 25], ['salve', 25]], crackdust: 0, alt: ['puddlepip'] },
  ward: { curve: 13, starterStage: 1, members: ['tossup', 'wirewhisk', 'mudfist', 'chillnub'], discs: ['spore-drift'], items: [['salve', 25], ['salve', 25]], crackdust: 2, alt: ['mothling'] },
  weather: { curve: 19, starterStage: 1, members: ['wirewhisk', 'mudfist', 'chillnub', 'sootling', 'sedgehare'], discs: ['spore-drift'], items: [['tonic', 70], ['salve', 25]], crackdust: 0, alt: ['rayling'] },
  hollow: { curve: 26, starterStage: 2, members: ['coilcrest', 'rimeplate', 'sootling', 'rushling', 'bilgebob'], discs: ['spore-drift', 'flashover'], items: [['tonic', 70], ['tonic', 70]], crackdust: 0, alt: ['creelwight'] },
  relay: { curve: 33, starterStage: 2, members: ['coilcrest', 'rimeplate', 'emberjaw', 'rushling', 'duskowl'], discs: ['spore-drift', 'flashover', 'gale-cut'], items: [['tonic', 70], ['tonic', 70]], crackdust: 0, alt: ['gillwick'] },
  mirror: { curve: 40, starterStage: 2, members: ['coilcrest', 'floeback', 'emberjaw', 'gillwick', 'duskowl'], discs: ['spore-drift', 'flashover', 'gale-cut', 'hoarfrost'], items: [['tonic', 70], ['tonic', 70]], crackdust: 0, alt: ['strandrunner', 'lumenveil'] },
  summit: { curve: 47, starterStage: 2, members: ['coilcrest', 'floeback', 'caldermaw', 'strandrunner', 'duskowl'], discs: ['spore-drift', 'flashover', 'gale-cut', 'hoarfrost', 'drowned-bell', 'plumbline'], items: [['tonic', 70], ['tonic', 70], ['tonic', 70], ['tonic', 70]], crackdust: 0, alt: ['gillwick', 'lumenveil'],
    between: { revive: 3, fullSalve: 2 } },
});

/** Party for a fight, starter variant, optionally at another curve (route trainers). */
export function buildParty(key, starter, curveOverride = null) {
  const p = PARTIES[key];
  const curve = curveOverride ?? p.curve;
  const line = STARTER_LINES[starter];
  const starterForm = line[Math.min(p.starterStage, line.length - 1)];
  const forms = [starterForm, ...p.members.filter((m) => !line.includes(m))];
  // keep the party size constant when the starter's line overlaps a member: the isle's alternate
  for (const a of p.alt) if (forms.length < p.members.length + 1 && !forms.includes(a)) forms.push(a);
  return forms.map((f, i) => {
    const level = Math.max(2, i === 0 ? curve + 1 : curve);
    return mon(f, level, pickMoves(f, level, p.discs));
  });
}

/** Heal items as engine rows (fraction of the party's average max HP). */
export function itemRows(key, party) {
  const avg = party.reduce((a, c) => a + c.stats.hp, 0) / party.length;
  return PARTIES[key].items.map(([id, amount]) => ({ id, name: id, heal: Math.min(1, amount / avg) }));
}

const STARTERS = Object.keys(STARTER_LINES);

// --- runs -----------------------------------------------------------------------------------------

/** Win rate and turns against one Spire leader (all three starter lines, n battles each). */
export function simulateSpire(spireId, n = 200, seed = 'balance') {
  const sp = SPIRES.find((s) => s.id === spireId);
  const tr = TRAINER_BY_ID[sp.trainer];
  const res = { id: spireId, trainer: tr.id, n: 0, wins: 0, turns: 0, byStarter: {} };
  for (const st of STARTERS) {
    let w = 0;
    const plan = sp.theme.kind === 'relay' ? relayPlan(buildParty(spireId, st), tr, sp) : null;
    for (let i = 0; i < n; i++) {
      const rng = makeRng(`${seed}:${spireId}:${st}:${i}`);
      const party = buildParty(spireId, st);
      const items = itemRows(spireId, party);
      let win;
      let turns;
      if (sp.theme.kind === 'relay') ({ win, turns } = playRelay(party, tr, sp, rng, items, null, plan));
      else {
        const weatherCycle = sp.theme.kind === 'weather' ? sp.theme.rule : null;
        const r = playBattle(party, trainerParty(tr), { rng, trainer: tr, source: 'spire', items, crackdust: PARTIES[spireId].crackdust, weatherCycle });
        win = r.outcome === 'win';
        turns = r.turns;
      }
      if (win) w++;
      res.turns += turns;
      res.n++;
    }
    res.byStarter[st] = w / n;
    res.wins += w;
  }
  res.rate = res.wins / res.n;
  res.avgTurns = res.turns / res.n;
  return res;
}

/**
 * The Relay Spire: three rounds (slots from the theme rule), two fresh player creatures each. The
 * player reads the posted rounds and splits the party so the weakest round is as strong as it can be.
 */
export function playRelay(party, tr, sp, rng, items, stats = null, plan = null) {
  const foes = trainerParty(tr);
  const rounds = sp.theme.rule.rounds;
  plan ||= relayPlan(party, tr, sp);
  let turns = 0;
  let bag = items;
  // the twins' heals last across the three rounds, as battleFlow carries them (relayNextSetup foeItems)
  let foeBag = tr.items || [];
  for (let k = 0; k < rounds.length; k++) {
    const round = rounds[k];
    const r = playBattle(plan[k].map((i) => party[i]), round.slots.map((i) => foes[i]), { rng: rng.fork(`round${round.n}`), trainer: tr, source: 'spire', items: bag, foeItems: foeBag });
    turns += r.turns;
    bag = r.items;
    foeBag = r.foeItems;
    if (stats) {
      const key = `r${round.n}:${plan[k].map((i) => party[i].speciesId).join('+')}`;
      stats[key] ||= [0, 0];
      stats[key][1]++;
      if (r.outcome === 'win') stats[key][0]++;
    }
    if (r.outcome !== 'win') return { win: false, turns };
  }
  return { win: true, turns };
}

/**
 * The player's Relay plan: try every pair of the party against every posted round a few times
 * (the player knows their own creatures), then deal the party so the product of the three round
 * odds is highest.
 */
export function relayPlan(party, tr, sp, tries = 12) {
  const rounds = sp.theme.rule.rounds;
  const per = sp.theme.rule.playerPerRound;
  const odds = new Map();
  const est = (pair, k) => {
    const key = `${pair.join(',')}|${k}`;
    if (!odds.has(key)) {
      let w = 0;
      for (let t = 0; t < tries; t++) {
        const foes = trainerParty(tr);
        const mine = pair.map((i) => mon(party[i].speciesId, party[i].level, party[i].moves.map((m) => m.id)));
        const r = playBattle(mine, rounds[k].slots.map((i) => foes[i]), { rng: makeRng(`plan:${key}:${t}`), trainer: tr, source: 'spire' });
        if (r.outcome === 'win') w++;
      }
      odds.set(key, (w + 0.5) / (tries + 1));
    }
    return odds.get(key);
  };
  return bestSplit(party.map((c, i) => i), rounds.length, per, (pair, k) => est(pair, k));
}

/** Every way to deal `ids` into `nRounds` groups of `per`; keeps the split with the best product of odds. */
function bestSplit(ids, nRounds, per, odds) {
  let best = null;
  let bestP = -1;
  const rec = (k, left, acc, p) => {
    if (p <= bestP) return;
    if (k === nRounds) { bestP = p; best = acc.slice(); return; }
    const combos = [];
    const pick = (start, cur) => {
      if (cur.length === per) { combos.push(cur.slice()); return; }
      for (let i = start; i < left.length; i++) { cur.push(left[i]); pick(i + 1, cur); cur.pop(); }
    };
    pick(0, []);
    for (const c of combos) rec(k + 1, left.filter((x) => !c.includes(x)), [...acc, c], p * odds(c, k));
  };
  rec(0, ids, [], 1);
  return best;
}

/** The Summit run: Bastien, Cass, Idris in a row; no heal between, +5 PP per move. */
export function simulateSummit(n = 200, seed = 'balance') {
  const res = { id: 'summit', n: 0, wins: 0, turns: 0, fights: 0, byStarter: {}, reached: { 'bastien-keeper': 0, 'cass-keeper': 0, 'idris-champion': 0 } };
  const ppTop = SUMMIT.between.ppTopUp;
  for (const st of STARTERS) {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const rng = makeRng(`${seed}:summit:${st}:${i}`);
      let party = buildParty('summit', st);
      let items = itemRows('summit', party);
      const kit = { ...PARTIES.summit.between };
      let won = true;
      for (const step of SUMMIT.order) {
        res.reached[step.trainer]++;
        const tr = TRAINER_BY_ID[step.trainer];
        const r = playBattle(party, trainerParty(tr), { rng: rng.fork(step.trainer), trainer: tr, source: 'spire', summit: true, items });
        res.turns += r.turns;
        res.fights++;
        if (r.outcome !== 'win') { won = false; break; }
        party = r.party.map((c) => ({ ...c, status: null, moves: c.moves.map((m) => ({ ...m, pp: Math.min(m.maxPp, m.pp + ppTop) })) }));
        // the bag between fights: Revives on the fainted (half HP), then Full Salves on the lowest
        for (const c of party) if (c.hp <= 0 && kit.revive > 0) { kit.revive--; c.hp = Math.floor(c.stats.hp / 2); }
        for (const c of party.filter((x) => x.hp > 0 && x.hp < x.stats.hp * 0.5).sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)) {
          if (kit.fullSalve <= 0) break;
          kit.fullSalve--;
          c.hp = c.stats.hp;
        }
        items = r.items;
      }
      if (won) w++;
      res.n++;
    }
    res.byStarter[st] = w / n;
    res.wins += w;
  }
  res.rate = res.wins / res.n;
  res.avgTurns = res.turns / res.fights;
  return res;
}

/** Spire key whose party a route trainer on a map meets (the isle's party, at the trainer's level). */
const ISLE_PARTY = Object.freeze({ lowmoor: 'turn', cairnhold: 'ward', emberstep: 'weather', drownwood: 'hollow', thistlewind: 'relay', rimeholt: 'mirror' });

/**
 * Every route trainer against that isle's on-curve party, the party levelled to the isle's curve
 * or the trainer's top level, whichever is lower (the player meets route trainers on the way in).
 */
export function simulateRoute(n = 200, seed = 'balance') {
  const out = [];
  for (const tr of TRAINERS.filter((t) => t.class === 'route')) {
    const key = ISLE_PARTY[tr.map];
    const top = Math.max(...tr.party.map((c) => c.level));
    const curve = Math.min(PARTIES[key].curve, top);
    let w = 0;
    let turns = 0;
    for (let i = 0; i < n; i++) {
      const st = STARTERS[i % STARTERS.length];
      const rng = makeRng(`${seed}:route:${tr.id}:${i}`);
      const party = buildParty(key, st, curve);
      const r = playBattle(party, trainerParty(tr), { rng, trainer: tr, source: 'route', items: itemRows(key, party).slice(0, 1), crackdust: PARTIES[key].crackdust });
      if (r.outcome === 'win') w++;
      turns += r.turns;
    }
    out.push({ id: tr.id, rate: w / n, avgTurns: turns / n, top, declinable: !!tr.declinable });
  }
  return out;
}

// --- stat-total outliers --------------------------------------------------------------------------

/**
 * Base-stat totals per stage, with each form's z-score; flags forms outside 1.5 standard deviations
 * of their stage and forms that are strictly dominated (every stat <= another same-stage form's,
 * with the same types) or strictly dominant.
 */
export function statOutliers() {
  const total = (b) => b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
  const byStage = {};
  for (const s of SPECIES) (byStage[s.stage] ||= []).push(s);
  const report = { stages: {}, outliers: [], dominated: [] };
  for (const [stage, forms] of Object.entries(byStage)) {
    const t = forms.map((s) => total(s.base));
    const mean = t.reduce((a, b) => a + b, 0) / t.length;
    const sd = Math.sqrt(t.reduce((a, b) => a + (b - mean) ** 2, 0) / t.length) || 1;
    report.stages[stage] = { n: forms.length, min: Math.min(...t), max: Math.max(...t), mean: Math.round(mean) };
    for (const s of forms) {
      const z = (total(s.base) - mean) / sd;
      if (Math.abs(z) > 1.5 && forms.length > 2) report.outliers.push({ id: s.id, stage: Number(stage), total: total(s.base), z: Math.round(z * 100) / 100 });
    }
    for (const a of forms) for (const b of forms) {
      if (a === b) continue;
      const keys = Object.keys(a.base);
      const le = keys.every((k) => a.base[k] <= b.base[k]);
      const lt = keys.some((k) => a.base[k] < b.base[k]);
      if (le && lt && a.types.join('/') === b.types.join('/')) report.dominated.push({ form: a.id, by: b.id, stage: Number(stage) });
    }
  }
  return report;
}

// --- level progression (GDD-04 §7 posted curve; GDD-00 §8 EXP and Shift windows) ------------------

/** The isles in story order, each with its Spire. */
export const PROGRESSION_STOPS = Object.freeze([
  Object.freeze({ isle: 'lowmoor', spire: 'turn' }), Object.freeze({ isle: 'cairnhold', spire: 'ward' }),
  Object.freeze({ isle: 'emberstep', spire: 'weather' }), Object.freeze({ isle: 'drownwood', spire: 'hollow' }),
  Object.freeze({ isle: 'thistlewind', spire: 'relay' }), Object.freeze({ isle: 'rimeholt', spire: 'mirror' }),
]);

/**
 * Who the party is (GDD-04 §7.1's on-curve party for the Sloshkin line): when each member is caught and
 * when it leaves. Shifts change forms, never the curve, so members keep their first species here.
 */
export const PROGRESSION_PLAN = Object.freeze({
  starter: 'sloshkin',
  pellwick: Object.freeze({ join: Object.freeze(['tossup']) }),
  lowmoor: Object.freeze({ join: Object.freeze(['wirewhisk', 'mudfist']) }),
  cairnhold: Object.freeze({ join: Object.freeze(['chillnub']) }),
  emberstep: Object.freeze({ join: Object.freeze(['sootling', 'sedgehare']), drop: Object.freeze(['tossup']) }),
  drownwood: Object.freeze({ join: Object.freeze(['rushling', 'bilgebob']), drop: Object.freeze(['mudfist', 'sedgehare']) }),
  thistlewind: Object.freeze({ join: Object.freeze(['duskowl']), drop: Object.freeze(['bilgebob']) }),
  rimeholt: Object.freeze({ join: Object.freeze(['gillwick']), drop: Object.freeze(['rushling']) }),
});

/**
 * Player behaviour per isle (never what the battles pay): wild KOs that are not catches, the share of
 * the declinable night trainers fought, Porch Duels fought while on that isle. Story battles, the
 * mandatory route trainers and the Spire are always fought.
 */
export const PROGRESSION_PLAYERS = Object.freeze({
  minimal: Object.freeze({ id: 'minimal', label: 'Minimal (mandatory trainers, 2 wilds an isle, no duels)', wilds: 2, optional: 0, duels: 0 }),
  typical: Object.freeze({ id: 'typical', label: 'Typical (6 wilds an isle, half the night trainers, 3 duels an isle)', wilds: 6, optional: 0.5, duels: 3 }),
  thorough: Object.freeze({ id: 'thorough', label: 'Thorough (12 wilds an isle, every trainer, 6 duels an isle)', wilds: 12, optional: 1, duels: 6 }),
});

/**
 * Acceptance bands for the party median at each Spire door, relative to the posted curve (GDD-04 §7:
 * the ace sits at curve + 3), and where the starter's Shift windows (GDD-00 §8: Lv8 / 20 / 34) open.
 */
export const PROGRESSION_TARGETS = Object.freeze({
  // Lowmoor sits highest (+4/+5): its night trainers and Linnet's Caldermaw 11 stand above its posted 7.
  typical: Object.freeze([-1, 5]),
  minimal: Object.freeze([-4, 4]),
  thorough: Object.freeze([0, 8]),
  /** window level -> the stops (isle ids, 'pellwick', 'the-bar') it may open in for the starter, by player */
  starterWindows: Object.freeze({
    8: Object.freeze(['pellwick', 'lowmoor']),
    20: Object.freeze(['cairnhold', 'emberstep', 'drownwood']),
    34: Object.freeze(['drownwood', 'thistlewind', 'rimeholt']),
  }),
});

const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
const SPIRE_BY_ID = Object.fromEntries(SPIRES.map((s) => [s.id, s]));

/**
 * The average wild foe of an isle: the weighted mean yield and level of its land and water tables
 * (`data/encounters`), as one foe of the award split.
 * @param {string} isle
 * @returns {{expYield: number, level: number}}
 */
export function wildFoe(isle) {
  const rows = [...(ENCOUNTERS[`${isle}-land`] || []), ...(ENCOUNTERS[`${isle}-water`] || [])].filter((r) => SP[r.species]);
  if (!rows.length) {
    const band = REGION[isle]?.wild ?? [5, 5];
    return { expYield: 60, level: Math.round((band[0] + band[1]) / 2) };
  }
  const W = rows.reduce((a, r) => a + (r.w ?? 1), 0);
  const expYield = rows.reduce((a, r) => a + (r.w ?? 1) * SP[r.species].expYield, 0) / W;
  const level = rows.reduce((a, r) => a + (r.w ?? 1) * ((r.levels[0] + r.levels[1]) / 2), 0) / W;
  return { expYield: Math.round(expYield), level: Math.round(level) };
}

/**
 * A run's battles in order, as progression events (see {@link simulateProgression}).
 * @param {{wilds: number, optional: number, duels: number}} player
 * @returns {any[]}
 */
export function progressionSchedule(player) {
  const ev = [];
  const trainerFight = (id, extra = {}) => {
    const tr = TRAINER_BY_ID[id];
    if (!tr) return;
    ev.push({ type: 'fight', kind: 'trainer', source: tr.expSource ?? (tr.story ? 'story' : 'route'), foes: tr.party.map((e) => ({ species: e.species, level: e.level })), label: id, holdOut: tr.holdOut ?? null, ...extra });
  };
  const catchOne = (species, level, stop) => {
    ev.push({ type: 'fight', kind: 'wild', source: 'route', foes: [{ species, level }], label: `catch ${species}`, stop });
    ev.push({ type: 'join', species, level, stop });
  };
  // night one (GDD-00 §8 check): Pip, Linnet's dock hold-out, the Tossup catch
  ev.push({ type: 'stop', stop: 'pellwick', curve: REGION.pellwick.curveLevel });
  trainerFight('pip');
  ev.push({ type: 'flat', amount: TUNING.holdOutExp, label: 'linnet-dock hold-out' });
  for (const sp of PROGRESSION_PLAN.pellwick.join) catchOne(sp, 4, 'pellwick');
  let optAcc = 0;
  PROGRESSION_STOPS.forEach(({ isle, spire }, i) => {
    const curve = REGION[isle].curveLevel;
    ev.push({ type: 'stop', stop: isle, curve });
    const plan = PROGRESSION_PLAN[isle] || {};
    for (const sp of plan.drop || []) ev.push({ type: 'drop', species: sp });
    const wild = wildFoe(isle);
    for (const sp of plan.join || []) catchOne(sp, wild.level, isle);
    for (let k = 0; k < player.wilds; k++) ev.push({ type: 'fight', kind: 'wild', source: 'route', foes: [{ ...wild }], label: 'wild' });
    for (let k = 0; k < player.duels; k++) ev.push({ type: 'duel', badges: i, trainer: PORCH_DUELS.neighbours[k % PORCH_DUELS.neighbours.length].trainer });
    for (const tr of TRAINERS.filter((t) => t.region === isle && t.class === 'route')) {
      if (tr.declinable || tr.band === 'night') {
        optAcc += player.optional;
        if (optAcc < 1 - 1e-9) continue;
        optAcc -= 1;
      }
      trainerFight(tr.id);
    }
    for (const tr of TRAINERS.filter((t) => t.region === isle && (t.story || t.class === 'mentor'))) trainerFight(tr.id);
    const sp = SPIRE_BY_ID[spire];
    ev.push({ type: 'door', id: spire, curve, ace: sp.ace.level });
    trainerFight(sp.trainer);
  });
  // the Bar and the Summit
  ev.push({ type: 'stop', stop: 'the-bar', curve: REGION['the-bar']?.curveLevel ?? 41 });
  for (const tr of TRAINERS.filter((t) => t.region === 'the-bar')) trainerFight(tr.id);
  ev.push({ type: 'door', id: 'summit', curve: SUMMIT.curveLevel ?? 47, ace: 50 });
  for (const id of ['bastien-keeper', 'cass-keeper', 'idris-champion']) trainerFight(id);
  return ev;
}

/**
 * Plays progression events through the real EXP rules: `systems/exp.computeAward` (battlers 100%, bench
 * 60%, catch-up under the posted curve, Porch Duel damping) and the curve in `tuning` (default: the
 * shipped `data/tuning.TUNING`). Each foe's KO is credited to the next party member in rotation; every
 * member used in a battle is a battler for all of its KOs, as in the engine. Events:
 *  - `{type: 'stop', stop, curve}` the isle the party is on (curve for catch-up; window bookkeeping);
 *  - `{type: 'fight', kind, source, foes: [{species|expYield, level}], label}`;
 *  - `{type: 'duel', badges, trainer}` a Porch Duel: the trainer's party at the party median + offsets,
 *    `PORCH_DUELS.partySizeByBadges` creatures (the last ones), source 'rematch';
 *  - `{type: 'flat', amount}` the hold-out: battlers all of it, the bench 60%;
 *  - `{type: 'join', species, level}` / `{type: 'drop', species}`;
 *  - `{type: 'door', id, curve, ace}` snapshot before a Spire (or the Summit);
 *  - any event may carry `t` (real minutes), copied onto the windows it opens.
 * @param {any[]} events
 * @param {{tuning?: object}} [opts]
 */
export function simulateProgression(events, opts = {}) {
  const tuning = opts.tuning ?? TUNING;
  const xo = { tuning };
  const growth = 'medium-fast';
  /** @type {Array<{uid: string, species: string, familyId: string, level: number, exp: number, windowsUsed: number[]}>} */
  const party = [];
  const windows = [];
  const doors = [];
  let uidSeq = 0;
  let rot = 0;
  let stop = 'pellwick';
  let curve = 4;
  let t = null;
  const add = (species, level) => {
    const c = { uid: `p${uidSeq++}`, species, familyId: SP[species].familyId, level, exp: expSys.expForLevel(growth, level, xo), windowsUsed: [] };
    expSys.skipPassedWindows(c, CREATURE_DATA, xo);
    party.push(c);
  };
  const credit = (uid, amount) => {
    const c = party.find((x) => x.uid === uid);
    if (!c || !(amount > 0)) return;
    const from = c.level;
    c.exp += amount;
    c.level = expSys.levelFromExp(growth, c.exp, xo);
    for (const L of expSys.windowLevels(c, CREATURE_DATA, xo)) {
      if (L > from && L <= c.level && !c.windowsUsed.includes(L)) {
        c.windowsUsed.push(L);
        windows.push({ uid: c.uid, species: c.species, starter: c.uid === 'p0', level: L, stop, t });
      }
    }
  };
  const median = () => {
    const lv = party.map((c) => c.level).sort((a, b) => a - b);
    return lv[Math.floor((lv.length - 1) / 2)];
  };
  const fight = (foes, kind, source) => {
    const used = new Set();
    for (let i = 0; i < foes.length; i++) used.add(party[(rot++) % party.length].uid);
    const award = expSys.computeAward({
      kind, source, curveLevel: curve,
      defeated: foes.map((f) => ({ level: f.level, expYield: f.expYield ?? SP[f.species].expYield })),
      party: party.map((c) => ({ uid: c.uid, level: c.level, participated: used.has(c.uid) })),
    }, null, xo);
    for (const a of award.totals) credit(a.uid, a.amount);
  };
  add(PROGRESSION_PLAN.starter, 5);
  for (const e of events) {
    if (Number.isFinite(e.t)) t = e.t;
    if (e.type === 'stop') { stop = e.stop; curve = e.curve; } else if (e.type === 'fight') fight(e.foes, e.kind, e.source);
    else if (e.type === 'duel') {
      const tr = TRAINER_BY_ID[e.trainer];
      const size = PORCH_DUELS.partySizeByBadges[Math.min(e.badges, PORCH_DUELS.partySizeByBadges.length - 1)];
      const m = median();
      const scale = tr.scale ?? {};
      const foes = tr.party.slice(-size).map((p) => ({ species: p.species, level: Math.max(scale.min ?? 1, Math.min(scale.max ?? 100, m)) + (p.levelOffset ?? 0) }));
      fight(foes, 'trainer', tr.expSource ?? 'rematch');
    } else if (e.type === 'flat') {
      const lead = party[0];
      for (const c of party) credit(c.uid, Math.floor(e.amount * (c === lead ? 1 : tuning.BENCH_SHARE)));
    } else if (e.type === 'join') { if (party.length < 6) add(e.species, e.level); } else if (e.type === 'drop') {
      const i = party.findIndex((c) => c.species === e.species && c.uid !== 'p0');
      if (i >= 0) party.splice(i, 1);
    } else if (e.type === 'door') {
      const levels = party.map((c) => c.level);
      doors.push({ id: e.id, curve: e.curve, ace: e.ace, levels, starter: party[0].level, median: median(), max: Math.max(...levels), t });
    }
  }
  return { doors, windows, party: party.map((c) => ({ species: c.species, level: c.level })), forecasts: windows.length };
}

/**
 * The progression of every player in {@link PROGRESSION_PLAYERS}, with each door's offset from the
 * posted curve and whether it sits in its band.
 * @param {{tuning?: object}} [opts]
 */
export function progressionReport(opts = {}) {
  const out = {};
  for (const [id, player] of Object.entries(PROGRESSION_PLAYERS)) {
    const r = simulateProgression(progressionSchedule(player), opts);
    const band = PROGRESSION_TARGETS[id];
    const doors = r.doors.map((d) => ({ ...d, offset: d.median - d.curve, ok: d.median - d.curve >= band[0] && d.median - d.curve <= band[1] }));
    const starterWindows = r.windows.filter((w) => w.starter).map((w) => ({ level: w.level, stop: w.stop }));
    out[id] = { ...r, doors, band, starterWindows };
  }
  return out;
}

// --- all of it ------------------------------------------------------------------------------------

/** Every run, one report. */
export function runAll(n = 200, seed = 'balance') {
  const spires = SPIRES.map((s) => simulateSpire(s.id, n, seed));
  const summit = simulateSummit(n, seed);
  const route = simulateRoute(n, seed);
  return { n, spires, summit, route, stats: statOutliers() };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

/** Prints a {@link progressionReport}. @param {Record<string, any>} rep */
export function printProgression(rep) {
  console.log('Level progression (party median at each Spire door vs the posted curve; ace = curve + 3)');
  for (const [id, r] of Object.entries(rep)) {
    console.log(`  ${id.padEnd(9)} band ${r.band[0]}..+${r.band[1]}  forecasts ${r.forecasts}  starter windows ${r.starterWindows.map((w) => `Lv${w.level}@${w.stop}`).join(' ')}`);
    for (const d of r.doors) console.log(`    ${d.id.padEnd(8)} curve ${String(d.curve).padStart(2)} ace ${String(d.ace).padStart(2)}  median ${String(d.median).padStart(2)} (${d.offset >= 0 ? '+' : ''}${d.offset})${d.ok ? '' : ' OUT'}  party ${d.levels.join(',')}`);
  }
}

/** CLI. */
async function main(argv) {
  const ni = argv.indexOf('--n');
  const n = ni >= 0 ? Number(argv[ni + 1]) : 200;
  const only = argv.indexOf('--only') >= 0 ? argv[argv.indexOf('--only') + 1] : null;
  if (only === 'progression') { printProgression(progressionReport()); return; }
  if (only === 'route') { for (const r of simulateRoute(n)) console.log(r.id.padEnd(24), pct(r.rate), r.avgTurns.toFixed(1)); return; }
  if (only === 'summit') { const s = simulateSummit(n); console.log(pct(s.rate), JSON.stringify(s.byStarter), s.avgTurns.toFixed(1), JSON.stringify(s.reached)); return; }
  if (only) { const s = simulateSpire(only, n); console.log(s.id, pct(s.rate), JSON.stringify(s.byStarter), s.avgTurns.toFixed(1)); return; }
  const r = runAll(n);
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return; }
  console.log(`Balance sim, ${n} battles per starter line per fight (3 lines)`);
  for (const s of r.spires) console.log(`  ${s.id.padEnd(8)} ${pct(s.rate).padStart(6)}  turns ${s.avgTurns.toFixed(1).padStart(5)}  ${Object.entries(s.byStarter).map(([k, v]) => `${k} ${pct(v)}`).join('  ')}`);
  console.log(`  summit   ${pct(r.summit.rate).padStart(6)}  turns ${r.summit.avgTurns.toFixed(1).padStart(5)}  ${Object.entries(r.summit.byStarter).map(([k, v]) => `${k} ${pct(v)}`).join('  ')}`);
  const low = r.route.filter((x) => x.rate < TARGETS.routeMin);
  console.log(`  route    min ${pct(Math.min(...r.route.map((x) => x.rate)))}  mean ${pct(r.route.reduce((a, x) => a + x.rate, 0) / r.route.length)}  below target: ${low.map((x) => `${x.id} ${pct(x.rate)}`).join(', ') || 'none'}`);
  console.log(`  stats    ${JSON.stringify(r.stats.stages)}`);
  console.log(`  outliers ${JSON.stringify(r.stats.outliers)}  dominated ${JSON.stringify(r.stats.dominated)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
