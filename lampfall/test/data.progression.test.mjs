// Level progression (MID-06): EXP pacing against GDD-04 §7's posted curve and GDD-00 §8's Shift windows.
// 1. systems/exp: stepped growth curves (8 × L² through Lv8, the cubic above) are exact and validated.
// 2. tools/balance-sim.mjs simulateProgression: a whole run through the real award split, for a minimal,
//    a typical and a thorough player, keeps each party's median in its band at every Spire door, and the
//    starter's windows open on the isles that post those levels. The old 8 × L² curve fails the same gate.
// 3. tools/economy-sim.mjs levelPace: the economy sim's own day-by-day battles give the same picture, and
//    Forecasts arrive no faster than one per 20 real minutes on average.
// 4. A scripted early game through systems/flow/battleFlow and the real engine: night one takes the
//    starter to Lv7, two Lowmoor wilds to Lv8 (window open), and the Turn Spire door finds the party near
//    the curve, not ~10 levels over it.
// Run: node --test test/data.progression.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/systems/exp.js';
import { TUNING } from '../js/data/tuning.js';
import { progressionReport, progressionSchedule, simulateProgression, PROGRESSION_PLAYERS, PROGRESSION_TARGETS } from '../tools/balance-sim.mjs';
import { simulate, levelPace } from '../tools/economy-sim.mjs';
import * as F from '../js/systems/flow/battleFlow.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';

const OLD = { num: [0, 8, 0, 0], den: 1 };
const OLD_TUNING = { ...TUNING, GROWTH_CURVES: { fast: OLD, 'medium-fast': OLD, 'medium-slow': OLD, slow: OLD } };
const opts = { tuning: TUNING };

describe('stepped growth curves (systems/exp)', () => {
  it('8 × L² through Lv8, (3·L³ − 512) / 2 from Lv9, round-tripping through levelFromExp', () => {
    for (let L = 2; L <= 8; L++) assert.equal(E.expForLevel('medium-fast', L, opts), 8 * L * L);
    assert.equal(E.expForLevel('medium-fast', 9, opts), 837);
    assert.equal(E.expForLevel('medium-fast', 20, opts), 11744);
    for (let L = 1; L <= 100; L++) {
      const e = E.expForLevel('medium-fast', L, opts);
      assert.equal(E.levelFromExp('medium-fast', e, opts), L);
      if (L > 1) assert.equal(E.levelFromExp('medium-fast', e - 1, opts), L - 1);
    }
  });

  it('validates steps (integers, from ≥ 2, ascending) and ignores them when absent', () => {
    assert.throws(() => E.tuningOf({ GROWTH_CURVES: { x: { num: [0, 8, 0, 0], den: 1, steps: [{ from: 1, num: [1, 0, 0, 0], den: 1 }] } } }), TypeError);
    assert.throws(() => E.tuningOf({ GROWTH_CURVES: { x: { num: [0, 8, 0, 0], den: 1, steps: [{ from: 9, num: [1.5, 0, 0, 0], den: 1 }] } } }), TypeError);
    assert.throws(() => E.tuningOf({ GROWTH_CURVES: { x: { num: [0, 8, 0, 0], den: 1, steps: [{ from: 9, num: [1, 0, 0, 0], den: 1 }, { from: 9, num: [2, 0, 0, 0], den: 1 }] } } }), TypeError);
    assert.equal(E.expForLevel('medium-fast', 30, { tuning: OLD_TUNING }), 7200);
  });
});

describe('level progression (tools/balance-sim.mjs)', () => {
  const rep = progressionReport();

  for (const id of Object.keys(PROGRESSION_PLAYERS)) {
    it(`${id}: the party median sits in ${PROGRESSION_TARGETS[id].join('..')} of the posted curve at every Spire door and the Summit`, () => {
      const r = rep[id];
      assert.equal(r.doors.length, 7);
      for (const d of r.doors) assert.ok(d.ok, `${id} ${d.id}: median ${d.median} vs curve ${d.curve} (party ${d.levels.join(',')})`);
    });
  }

  it('the starter\'s Shift windows open on the isles that post those levels (Lv8 Lowmoor, Lv20 around Emberstep, Lv34 around Thistlewind)', () => {
    for (const [id, r] of Object.entries(rep)) {
      assert.deepEqual(r.starterWindows.map((w) => w.level), [8, 20, 34], id);
      for (const w of r.starterWindows) assert.ok(PROGRESSION_TARGETS.starterWindows[w.level].includes(w.stop), `${id}: Lv${w.level} opened at ${w.stop}`);
    }
    assert.equal(rep.typical.starterWindows.find((w) => w.level === 20).stop, 'emberstep');
    assert.equal(rep.typical.starterWindows.find((w) => w.level === 34).stop, 'thistlewind');
  });

  it('a run opens about 18 Forecasts (GDD-00 §8), never every window at once', () => {
    for (const [id, r] of Object.entries(rep)) assert.ok(r.forecasts >= 12 && r.forecasts <= 22, `${id}: ${r.forecasts}`);
  });

  it('regression: the old 8 × L² curve runs parties far past every posted curve (the MID-06 reproduction)', () => {
    const old = simulateProgression(progressionSchedule(PROGRESSION_PLAYERS.minimal), { tuning: OLD_TUNING });
    const mirror = old.doors.find((d) => d.id === 'mirror');
    assert.ok(mirror.median - mirror.curve > 30, `minimal player at the Mirror door: ${mirror.median}`);
    const now = rep.minimal.doors.find((d) => d.id === 'mirror');
    assert.ok(Math.abs(now.median - now.curve) <= 4, `now ${now.median}`);
  });
});

describe('level pace (tools/economy-sim.mjs levelPace)', () => {
  for (const id of ['casual', 'typical']) {
    it(`${id}: on the curve at every door, starter windows in step, at most one Forecast per 20 real minutes`, () => {
      const p = levelPace(simulate(id));
      assert.equal(p.doors.length, 6);
      for (const d of p.doors) assert.ok(d.offset >= -2 && d.offset <= 6, `${id} ${d.id}: ${d.median} vs ${d.curve}`);
      assert.ok(p.minutesPerForecast >= 20, `${p.minutesPerForecast} real minutes per Forecast`);
      assert.ok(p.forecasts >= 12 && p.forecasts <= 22, String(p.forecasts));
      const starter = p.windows.filter((w) => w.starter).map((w) => `${w.level}@${w.stop}`);
      assert.deepEqual(starter, ['8@lowmoor', '20@emberstep', '34@thistlewind']);
    });
  }

  it('the old curve would show the starter\'s last window by Emberstep', () => {
    const p = levelPace(simulate('typical'), { tuning: OLD_TUNING });
    const last = p.windows.find((w) => w.starter && w.level === 34);
    assert.ok(last && ['lowmoor', 'cairnhold', 'emberstep', 'pellwick'].includes(last.stop), last && last.stop);
  });
});

// --- a scripted early game through the real flow and engine -------------------------------------

const data = realBattleData();
const tuning = F.tuningFor(data);

function makeG(seedCode = 'FLUX-K7Q2-MD7F') {
  const store = createStore(createNewWorld({ seedCode }));
  store.tx('dial', (w) => { w.run.dial = 'flux'; w.player.mapId = 'lowmoor'; });
  const bus = { emit: (e, p) => store.bus.emit(e, p), on: (...a) => store.bus.on(...a) };
  return { store, get world() { return store.world; }, bus, rngs: createRngs(store), push: () => {} };
}

function give(G, speciesId, level) {
  return G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, speciesId, level }, data);
    return party.addCreature(w, c, data, { tuning, caught: true });
  });
}

/** Plays to the end with the strongest selectable move, healing the party first (a Waystone between fights). */
function fight(G, setup) {
  G.store.tx('heal', (w) => party.heal(w, { tuning }));
  const s = F.buildBattle(G, setup, data);
  const b = s.battle;
  for (let i = 0; i < 400 && b.phase !== 'ended'; i++) {
    const lg = b.legal(0);
    if (b.phase === 'replace') {
      if (b.pendingReplace.includes(0)) b.step({ type: 'switch', to: lg.switches.find((x) => x.selectable).index });
      else b.step(null);
      continue;
    }
    let best = -1;
    let score = -Infinity;
    lg.moves.forEach((m, k) => { const v = m.selectable ? (m.power || 1) * (m.mult ?? 1) : -Infinity; if (v > score) { score = v; best = k; } });
    b.step(F.prepareAction(s, best >= 0 && score > -Infinity ? { type: 'move', move: best } : { type: 'scrap' }));
  }
  return F.applyBattleResult(G, s, { bus: null });
}

describe('a scripted early game (battleFlow + the real engine)', () => {
  it('night one Lv7, day two Lv8 with the window open, and the Turn Spire door near the curve', () => {
    const G = makeG();
    give(G, 'sloshkin', 5);
    const starter = G.world.party[0].uid;
    assert.equal(G.world.party[0].exp, 200);
    // night one in the game's order: the dock hold-out, the reeds Tossup, then Pip on the quay
    G.store.tx('holdout', (w) => party.giveExp(w, starter, TUNING.holdOutExp, data, { tuning }));
    fight(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } });
    fight(G, { kind: 'trainer', trainerId: 'pip' });
    const s = () => G.world.party.find((c) => c.uid === starter);
    assert.equal(s().level, 7, 'night one: Linnet + the Tossup + Pip\'s Wirewhisk take the starter to Lv7');
    assert.ok(E.windowSoon(s(), data, { tuning }), 'the pip shows on night one');
    give(G, 'tossup', 4);
    fight(G, { kind: 'wild', wild: { speciesId: 'bilgebob', level: 6 } });
    fight(G, { kind: 'wild', wild: { speciesId: 'rushling', level: 6 } });
    assert.equal(s().level, 8, 'two Lowmoor wilds on day two');
    assert.ok(G.world.pendingShifts.includes(starter), 'the Lv8 window is open');
    give(G, 'wirewhisk', 6);
    give(G, 'mudfist', 6);
    for (const id of ['lowmoor-osier', 'lowmoor-dunlin', 'lowmoor-perrin', 'lowmoor-tibby', 'corin-exhibition-1']) fight(G, { kind: 'trainer', trainerId: id });
    for (let i = 0; i < 4; i++) fight(G, { kind: 'wild', wild: { speciesId: 'bilgebob', level: 6 } });
    const lv = G.world.party.map((c) => c.level).sort((a, b) => a - b);
    const median = lv[Math.floor((lv.length - 1) / 2)];
    assert.ok(median >= 7 && median <= 12, `Turn Spire door (curve 6, ace 9): party ${lv.join(',')}`);
    assert.ok(s().level <= 13, `starter Lv${s().level}`);
  });
});
