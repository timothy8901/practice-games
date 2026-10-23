// Adversarial tests for lane BATTLE-RULES (js/battle/*), written by the lane verifier:
// determinism across processes, every dial, boundaries, malformed data, huge inputs, state round
// trips through systems/creature serialize/deserialize, refusals that leave the battle unchanged,
// and regressions for the bugs the verification found.
// Run: node --test test/battle.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createBattle, BattleError, DEFAULTS, TUNING_KEYS, tuningKeys, DIALS, DIAL_RULES, normalizeDialRules,
} from '../js/battle/engine.js';
import * as effects from '../js/battle/effects.js';
import * as hooks from '../js/battle/abilityHooks.js';
import * as ops from '../js/battle/creatureOps.js';
import * as dataMod from '../js/battle/data.js';
import * as ai from '../js/battle/ai.js';
import { checkEvent } from '../js/battle/events.js';
import { readCard } from '../js/battle/read.js';
import * as SC from '../js/systems/creature.js';
import { createRegistry } from '../js/data/registry.js';
import { makeRng, constRng, mk, duel, ofType, DATA } from './fixtures/battle/helpers.mjs';
import { simulateBattle, randomParty } from './fixtures/battle/sim.mjs';
import { MOVES, SPECIES, ABILITIES, TYPE_DATA } from './fixtures/battle/data.mjs';

const fixedFoe = (move = 0) => () => ({ type: 'move', move });
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Drives a battle to the end with the AI on both sides; returns the full event log. */
function playOut(bt, rng, maxSteps = 1000) {
  const log = bt.intro.slice();
  let steps = 0;
  while (bt.phase !== 'ended' && steps++ < maxSteps) {
    const acts = [];
    const sides = bt.phase === 'replace' ? bt.pendingReplace : [0, 1];
    for (const s of sides) acts[s] = bt.phase === 'replace' ? ai.chooseReplacement(bt, s) : ai.chooseAction(bt, s, { profile: s === 0 ? 'trainer' : undefined });
    log.push(...bt.step(acts));
  }
  return log;
}

// ---------------------------------------------------------------------------
describe('determinism', () => {
  it('the same seeds give byte-identical battles in two separate Node processes and in this one', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => `xproc:${i}`);
    const code = `
      import { simulateBattle } from ${JSON.stringify(new URL('./fixtures/battle/sim.mjs', import.meta.url).href)};
      import { createHash } from 'node:crypto';
      const out = ${JSON.stringify(seeds)}.map((seed) => {
        const r = simulateBattle({ seed });
        return createHash('sha256').update(JSON.stringify({ e: r.events, r: r.result })).digest('hex');
      });
      process.stdout.write(JSON.stringify(out));`;
    const run = () => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }));
    const a = run();
    const b = run();
    const here = seeds.map((seed) => {
      const r = simulateBattle({ seed });
      return digest({ e: r.events, r: r.result });
    });
    assert.deepEqual(a, b);
    assert.deepEqual(a, here);
    assert.ok(new Set(here).size > 1, 'different seeds diverge');
  });

  it('never calls Math.random or Date.now while battling (rule 5)', () => {
    const origRandom = Math.random;
    const origNow = Date.now;
    Math.random = () => { throw new Error('Math.random called'); };
    Date.now = () => { throw new Error('Date.now called'); };
    try {
      for (let i = 0; i < 25; i++) assert.deepEqual(simulateBattle({ seed: `norand:${i}` }).violations, []);
    } finally {
      Math.random = origRandom;
      Date.now = origNow;
    }
  });

  it('a refused action leaves state, log and rng position untouched (the rest replays identically)', () => {
    const build = () => duel(mk('sloshkin', 30, ['tap', 'salt-spray']), mk('tossup', 30, ['tap', 'settle']), { rng: makeRng('refuse'), foeAi: (b, s) => ai.chooseAction(b, s) });
    const a = build();
    const b = build();
    const before = JSON.stringify(b.state());
    for (const bad of [{ type: 'move', move: 9 }, { type: 'switch', to: 0 }, { type: 'run' }, { type: 'lantern', grade: 1 }, { type: 'scrap' }, { type: 'read' }, { type: 'item', id: 'nope' }, { type: 'dance' }, null]) {
      assert.throws(() => b.step(bad), BattleError);
    }
    assert.equal(JSON.stringify(b.state()), before);
    assert.equal(b.log.length, a.log.length);
    for (let t = 0; t < 4 && a.phase === 'choose'; t++) assert.deepEqual(b.step({ type: 'move', move: 0 }), a.step({ type: 'move', move: 0 }));
  });
});

// ---------------------------------------------------------------------------
describe('every dial', () => {
  for (const dial of DIALS) {
    it(`${dial}: 40 seeded battles hold every invariant`, () => {
      for (let i = 0; i < 40; i++) {
        const r = simulateBattle({ seed: `dial:${dial}:${i}`, dial });
        assert.deepEqual(r.violations, [], `seed ${i}`);
        assert.equal(r.dial, dial);
      }
    });
  }

  it('Read cost, capture display and the Ward badge follow DIAL_RULES on each dial', () => {
    for (const dial of DIALS) {
      const rules = DIAL_RULES[dial];
      const bt = duel(mk('scrapling', 20, ['tap']), mk('prismoth', 20, ['tap']), { kind: 'wild', dial, foeAi: fixedFoe() }); // no auto-Read ability on the lead
      const L = bt.legal(0);
      assert.equal(L.read.costsTurn, rules.readCostsTurn, dial);
      assert.equal(L.lantern.exactOdds, rules.captureDisplay === 'exact', dial);
      for (const g of L.lantern.grades) assert.equal(g.odds === null, rules.captureDisplay === 'bands', `${dial} grade ${g.grade}`);
      assert.equal(bt.state().sides[1].wardBadge, rules.wardBadge === 'start', dial);
      if (rules.readCostsTurn) {
        assert.throws(() => bt.read(0), (e) => e.code === 'READ_COSTS_TURN');
        const evs = bt.step({ type: 'read' });
        assert.equal(ofType(evs, 'turn').length, 1, 'a costly Read uses the turn');
        assert.equal(ofType(evs, 'read').length, 1);
      } else {
        const evs = bt.read(0);
        assert.equal(ofType(evs, 'turn').length, 0, 'a free Read is not a turn');
        assert.equal(bt.turn, 0);
        assert.throws(() => bt.step({ type: 'read' }), (e) => e.code === 'READ_FREE');
      }
    }
  });

  it('an unknown dial or a rules override of the wrong shape is refused at setup', () => {
    assert.throws(() => duel(mk('sloshkin', 5, ['tap']), mk('tossup', 5, ['tap']), { dial: 'chaos' }), RangeError);
    assert.throws(() => duel(mk('sloshkin', 5, ['tap']), mk('tossup', 5, ['tap']), { holdOut: 0 }), RangeError);
    assert.throws(() => duel(mk('sloshkin', 5, ['tap']), mk('tossup', 5, ['tap']), { holdOut: 2.5 }), RangeError);
    for (const rules of [{ captureDisplay: 'fuzzy' }, { wardBadge: 'sometimes' }, { readCostsTurn: 'no' }, { runAllowed: 1 }, { holdOutTurns: -2 }, { holdOutTurns: 1.5 }]) {
      assert.throws(() => duel(mk('sloshkin', 5, ['tap']), mk('tossup', 5, ['tap']), { rules }), RangeError, JSON.stringify(rules));
    }
  });

  it('a data/dials.js-style rules row (percent / band, boolean wardBadge, holdOutTurns 0, extra keys) is read correctly', () => {
    const rows = {
      drift: { readCostsTurn: false, captureDisplay: 'percent', wardBadge: true, runAllowed: true, holdOutTurns: 0, rerollCostMult: 1, anchorsAllowed: true },
      freefall: { readCostsTurn: true, captureDisplay: 'band', wardBadge: false, runAllowed: true, holdOutTurns: 0, rerollCostMult: 2, anchorsAllowed: false },
    };
    assert.deepEqual(normalizeDialRules(rows.drift), DIAL_RULES.drift);
    assert.deepEqual(normalizeDialRules(rows.freefall), DIAL_RULES.freefall);
    for (const [dial, rules] of Object.entries(rows)) {
      const bt = duel(mk('scrapling', 20, ['tap']), mk('prismoth', 20, ['tap']), { kind: 'wild', dial, rules, foeAi: fixedFoe() });
      assert.deepEqual(bt.state().rules, DIAL_RULES[dial]);
      const grade = bt.legal(0).lantern.grades[0];
      assert.equal(grade.odds === null, dial === 'freefall', dial);
      assert.equal(bt.state().sides[1].wardBadge, dial === 'drift');
      bt.step({ type: 'move', move: 0 });
      assert.equal(bt.phase === 'ended' ? bt.outcome !== 'holdout' : true, true, 'holdOutTurns 0 means no hold-out');
    }
  });
});

// ---------------------------------------------------------------------------
describe('boundaries', () => {
  it('Lv1 against Lv100 (both ways) ends cleanly with finite numbers', () => {
    for (const [la, lb] of [[1, 100], [100, 1], [1, 1], [100, 100]]) {
      const bt = duel(mk('scrapling', la, ['tap', 'knuckle']), mk('caldermaw', lb, ['kiln-maw', 'tap']), { rng: makeRng(`lv:${la}:${lb}`), foeAi: (b, s) => ai.chooseAction(b, s) });
      const log = playOut(bt, null);
      assert.equal(bt.phase, 'ended');
      for (const ev of log) assert.deepEqual(checkEvent(ev), [], JSON.stringify(ev));
    }
  });

  it('holdOut 1 ends after exactly one turn; maxTurns 1 ends a stall as a draw', () => {
    const h = duel(mk('sloshkin', 10, ['settle']), mk('tossup', 10, ['settle']), { holdOut: 1, foeAi: fixedFoe() });
    h.step({ type: 'move', move: 0 });
    assert.equal(h.result().outcome, 'holdout');
    assert.equal(h.result().turns, 1);
    const d = duel(mk('sloshkin', 10, ['settle']), mk('tossup', 10, ['settle']), { tuning: { maxTurns: 1 }, foeAi: fixedFoe() });
    d.step({ type: 'move', move: 0 });
    assert.equal(d.result().outcome, 'draw');
  });

  it('mendsPerBattle 0: every recovery fails with no-mends; a 1-HP creature still acts', () => {
    const me = mk('vesperay', 40, ['tidal-mend']);
    const bt = duel(me, mk('tossup', 40, ['settle']), { tuning: { mendsPerBattle: 0 }, foeAi: fixedFoe() });
    me.hp = 1;
    const evs = bt.step({ type: 'move', move: 0 });
    assert.ok(ofType(evs, 'blocked').some((e) => e.reason === 'no-mends'));
    assert.equal(me.hp, 1);
  });

  it('blackout cost: 0 glint, a negative or NaN wallet cost nothing; a huge wallet stops at the cap', () => {
    const lose = (glint) => {
      const bt = duel(mk('tossup', 1, ['tap']), mk('caldermaw', 60, ['kiln-maw']), { glint, foeAi: fixedFoe() });
      while (bt.phase !== 'ended') bt.step({ type: 'move', move: 0 });
      return bt.result().blackoutCost;
    };
    assert.equal(lose(0), 0);
    assert.equal(lose(-5000), 0);
    assert.equal(lose(NaN), 0);
    assert.equal(lose(9), 0);
    assert.equal(lose(1e12), DEFAULTS.blackoutCap);
  });

  it('captureOdds clamps at both ends and is 1 for the sure Lantern; bands cover 0..1', () => {
    const lo = effects.captureOdds({ catchRate: 1, hp: 100, maxHp: 100, status: null, grade: 1 });
    const hi = effects.captureOdds({ catchRate: 255, hp: 1, maxHp: 100, status: 'chill', trapped: true, grade: 3, fails: 99 });
    assert.equal(lo, DEFAULTS.captureOddsMin);
    assert.equal(hi, DEFAULTS.captureOddsMax);
    assert.equal(effects.captureOdds({ catchRate: 3, hp: 100, maxHp: 100, status: null, grade: 'sure' }), 1);
    assert.equal(effects.captureOdds({ catchRate: 100, hp: 0, maxHp: 0, status: null, grade: 1 }) > 0, true, 'a 0-max-HP target does not divide by zero');
    for (const p of [0, 0.2499, 0.25, 0.5999, 0.6, 1]) assert.ok(['Low', 'Fair', 'Good'].includes(effects.captureBand(p)));
    assert.throws(() => effects.captureOdds({ catchRate: 3, hp: 1, maxHp: 1, status: null, grade: 'gold' }), RangeError);
  });

  it('catch-up multiplier: exact steps at 4/5/9/10 under and the x3 cap far below', () => {
    assert.equal(effects.catchUpMult(30, 34), 1);
    assert.equal(effects.catchUpMult(30, 35), 1.5);
    assert.equal(effects.catchUpMult(30, 39), 1.5);
    assert.equal(effects.catchUpMult(30, 40), 2);
    assert.equal(effects.catchUpMult(1, 100), 3);
    assert.equal(effects.catchUpMult(80, 10), 1, 'over the curve is never damped here');
    assert.equal(effects.catchUpMult(5, null), 1);
  });

  it('critChance and stageMult survive out-of-range and non-integer input', () => {
    assert.equal(effects.critChance(-3), DEFAULTS.critRates[0]);
    assert.equal(effects.critChance(99), DEFAULTS.critRates.at(-1));
    assert.equal(effects.critChance(NaN), DEFAULTS.critRates[0]);
    assert.equal(effects.stageMult(0), 1);
    assert.equal(effects.stageMult(6), 4);
    assert.equal(effects.stageMult(-6), 0.25);
  });

  it('PP bottoms out at 0 and Scrap takes over; the Scrap cost is at least 1 HP even for a 1-max-HP creature', () => {
    const me = mk('scrapling', 5, ['tap']);
    me.moves[0].pp = 0;
    const bt = duel(me, mk('tossup', 40, ['settle']), { foeAi: fixedFoe() });
    const L = bt.legal(0);
    assert.equal(L.moves[0].selectable, false);
    assert.equal(L.scrap.available, true);
    assert.throws(() => bt.step({ type: 'move', move: 0 }), (e) => e.code === 'NO_PP');
    const evs = bt.step({ type: 'scrap' });
    assert.ok(ofType(evs, 'scrap-cost')[0].amount >= 1);
  });
});

// ---------------------------------------------------------------------------
describe('malformed data and setups', () => {
  const ok = () => mk('sloshkin', 10, ['tap']);
  const foe = () => mk('tossup', 10, ['tap']);

  it('malformed party creatures fail at setup with a readable TypeError, never as a NaN mid-battle', () => {
    const cases = [
      ['NaN hp', (c) => { c.hp = NaN; }],
      ['hp over max', (c) => { c.hp = c.stats.hp + 1; }],
      ['negative hp', (c) => { c.hp = -1; }],
      ['missing stats', (c) => { delete c.stats; }],
      ['zero speed', (c) => { c.stats.spe = 0; }],
      ['string attack', (c) => { c.stats.atk = '50'; }],
      ['empty types', (c) => { c.types = []; }],
      ['moves not an array', (c) => { c.moves = 'tap'; }],
      ['negative PP', (c) => { c.moves[0].pp = -1; }],
      ['level 0', (c) => { c.level = 0; }],
      ['no uid', (c) => { delete c.uid; }],
    ];
    for (const [name, mutate] of cases) {
      const c = ok();
      mutate(c);
      assert.throws(() => duel([c, ok()], foe()), TypeError, name);
    }
    assert.throws(() => duel([null], foe()), TypeError);
  });

  it('unknown species, ability and move ids throw a RangeError with a did-you-mean', () => {
    const c = ok();
    c.moves[0].id = 'tapp';
    assert.throws(() => duel(c, foe()), /unknown move "tapp" \(did you mean "tap"\?\)/);
    const d = ok();
    d.ability = 'shoresens';
    assert.throws(() => duel(d, foe()), /unknown ability "shoresens"/);
    const e = ok();
    e.speciesId = 'sloshkn';
    assert.throws(() => duel(e, foe()), /unknown species "sloshkn" \(did you mean "sloshkin"\?\)/);
  });

  it('setup errors: wrong side count, bad kind, a wild battle with a trainer, no rng, no data, an all-fainted party', () => {
    const rng = makeRng('s');
    assert.throws(() => createBattle({ sides: [{ party: [ok()] }], kind: 'wild', data: DATA }, rng), TypeError);
    assert.throws(() => createBattle({ sides: [{ party: [ok()] }, { party: [foe()] }], kind: 'duel', data: DATA }, rng), RangeError);
    assert.throws(() => createBattle({ sides: [{ party: [ok()] }, { party: [foe()], trainer: { name: 'X' } }], kind: 'wild', data: DATA }, rng), RangeError);
    assert.throws(() => createBattle({ sides: [{ party: [ok()] }, { party: [foe()] }], kind: 'wild', data: DATA }), TypeError);
    assert.throws(() => createBattle({ sides: [{ party: [ok()] }, { party: [foe()] }], kind: 'wild' }, rng), TypeError);
    const dead = ok();
    dead.hp = 0;
    assert.throws(() => createBattle({ sides: [{ party: [dead] }, { party: [foe()] }], kind: 'wild', data: DATA }, rng), RangeError);
    assert.throws(() => createBattle({ sides: [{ party: [] }, { party: [foe()] }], kind: 'wild', data: DATA }, rng), TypeError);
  });

  it('tuning: unknown keys, undefined, NaN and wrong-shaped values all throw before the battle exists', () => {
    for (const tuning of [{ benchShar: 1 }, { benchShare: undefined }, { benchShare: NaN }, { benchShare: '0.6' }, { lantern: [] }, { evasionMult: { 0: 1 } }, { plumblineIgnoresWards: 'yes' }, { chip: null }]) {
      assert.throws(() => duel(ok(), foe(), { tuning }), (e) => e instanceof RangeError || e instanceof TypeError, JSON.stringify(tuning));
    }
    assert.throws(() => duel(ok(), foe(), { tuning: [] }), TypeError);
    assert.doesNotThrow(() => duel(ok(), foe(), { tuning: { maxTurns: Infinity, holdOutExp: 0 } }));
  });

  it('AI profile tuning: unknown profile, unknown field, wrong-typed value and bad brain all throw', () => {
    assert.throws(() => ai.makeFoeAi('boss'), RangeError);
    assert.throws(() => ai.makeFoeAi('spire', { tuning: { profiles: { spire: { healThresh: 0.5 } } } }), RangeError);
    assert.throws(() => ai.makeFoeAi('spire', { tuning: { profiles: { spire: { healThreshold: '0.5' } } } }), TypeError);
    assert.throws(() => ai.makeFoeAi('spire', { tuning: { profiles: { spire: { healThreshold: NaN } } } }), TypeError);
    assert.throws(() => ai.makeFoeAi('spire', { tuning: { profiles: { spire: { brain: 'genius' } } } }), RangeError);
    assert.throws(() => ai.makeFoeAi('spire', { tuning: { profilez: {} } }), RangeError);
    assert.doesNotThrow(() => ai.makeFoeAi('summit', { tuning: { profiles: { summit: { healThreshold: 0.5 } } } }));
  });

  it('data view: a missing table or chart, a non-square chart, a row without id and an unknown hook are refused', () => {
    assert.throws(() => dataMod.createBattleData({ species: SPECIES, moves: MOVES, abilities: ABILITIES }), /type chart is required/);
    assert.throws(() => dataMod.createBattleData({ moves: MOVES, abilities: ABILITIES, types: TYPE_DATA }), /missing table "species"/);
    assert.throws(() => dataMod.createBattleData({ species: SPECIES, moves: MOVES, abilities: ABILITIES, types: { chart: { A: { A: 1, B: 1 }, B: { A: 1 } } } }), TypeError);
    assert.throws(() => dataMod.createBattleData({ species: [{ name: 'x' }], moves: MOVES, abilities: ABILITIES, types: TYPE_DATA }), /no string id/);
    const bad = dataMod.createBattleData({ species: SPECIES, moves: MOVES, abilities: [{ id: 'x', name: 'X', hook: 'teleport' }], types: TYPE_DATA });
    assert.throws(() => bad.ability('x'), /unknown hook "teleport"/);
    assert.throws(() => dataMod.createBattleData(null), TypeError);
  });

  it('data.problems() flags bad move rows, NaN catch rates, unknown types and dangling learnsets', () => {
    const moves = [...MOVES, { id: 'zap', name: 'Zap', type: 'Plasma', category: 'special', power: NaN, accuracy: 150, pp: 0, priority: 0.5, effect: { teleport: true, multiHit: [3, 1] } }];
    const species = [...SPECIES, { ...SPECIES[0], id: 'odd', types: ['Plasma'], catchRate: NaN, expYield: 0, growth: 'glacial', learnset: [[1, 'nothing']] }];
    const p = dataMod.createBattleData({ species, moves, abilities: ABILITIES, types: TYPE_DATA }).problems();
    for (const want of [/unknown effect key "teleport"/, /power must be/, /accuracy must be/, /pp must be/, /priority must be/, /multiHit/, /move zap: unknown type Plasma/, /species odd: unknown type Plasma/, /catchRate/, /expYield/, /unknown growth/, /learnset move nothing/]) {
      assert.ok(p.some((x) => want.test(x)), `${want} in ${JSON.stringify(p)}`);
    }
    assert.deepEqual(dataMod.createBattleData(DATA).problems(), []);
  });

  it('gainExp refuses a non-finite amount (a NaN would corrupt the saved EXP) and treats a negative as 0', () => {
    const view = dataMod.createBattleData(DATA);
    const c = mk('sloshkin', 10, ['tap']);
    const exp = c.exp;
    for (const bad of [NaN, Infinity, -Infinity, '5', undefined]) assert.throws(() => ops.gainExp(c, bad, view), TypeError);
    assert.equal(c.exp, exp);
    assert.equal(ops.gainExp(c, -500, view).to, 10);
    assert.equal(c.exp, exp);
  });

  it('a battle whose foe species has a NaN EXP yield still ends cleanly (no NaN EXP is handed out)', () => {
    const species = SPECIES.map((s) => (s.id === 'tossup' ? { ...s, expYield: NaN } : s));
    const data = { ...DATA, species };
    const me = mk('caldermaw', 60, ['kiln-maw']);
    const bt = duel(me, mk('tossup', 5, ['settle']), { data, foeAi: fixedFoe() });
    const exp = me.exp;
    while (bt.phase !== 'ended') bt.step({ type: 'move', move: 0 });
    assert.equal(bt.result().outcome, 'win');
    assert.equal(me.exp, exp);
    assert.deepEqual(bt.result().exp, []);
  });

  it('ability rows: an expShare object without a share and a min-power Ward without a threshold are reported', () => {
    assert.ok(hooks.abilityProblems({ id: 'w', name: 'W', ward: { kind: 'min-power' } }).some((p) => /minPower/.test(p)));
    assert.ok(hooks.abilityProblems({ id: 'w', name: 'W', ward: { kind: 'force-field' } }).some((p) => /unknown ward kind/.test(p)));
    assert.ok(hooks.abilityProblems({ id: 'w', name: 'W', hookParams: [1] }).some((p) => /hookParams/.test(p)));
    assert.ok(hooks.abilityProblems({ id: 'w', name: '' }).some((p) => /name/.test(p)));
    assert.ok(hooks.abilityProblems({ id: 'w', name: 'W', expShare: {} }).some((p) => /expShare/.test(p)));
    assert.ok(hooks.abilityProblems({ id: 'w', name: 'W', expShare: 3 }).some((p) => /expShare/.test(p)));
    assert.deepEqual(hooks.abilityProblems({ id: 'w', name: 'W', expShare: true }), []);
    assert.deepEqual(hooks.abilityProblems({ id: 'w', name: 'W', expShare: { toLowest: 0.3 } }), []);
  });
});

// ---------------------------------------------------------------------------
describe('huge inputs', () => {
  it('six Lv100 creatures a side, AI on both, end in a valid result', () => {
    const rng = makeRng('huge-6');
    const a = randomParty(rng.fork('a'), { size: 6, minLevel: 100, maxLevel: 100 });
    const b = randomParty(rng.fork('b'), { size: 6, minLevel: 100, maxLevel: 100 });
    const bt = createBattle({ sides: [{ party: a, glint: 1e12 }, { party: b, trainer: { name: 'T' } }], kind: 'trainer', data: DATA, foeAi: (x, s) => ai.chooseAction(x, s) }, rng.fork('battle'));
    const log = playOut(bt);
    assert.equal(bt.phase, 'ended');
    for (const ev of log) assert.deepEqual(checkEvent(ev), []);
    assert.ok(bt.result().blackoutCost <= DEFAULTS.blackoutCap);
  });

  it('a 40-creature party is handled (no hidden party cap in the engine)', () => {
    const rng = makeRng('huge-40');
    const a = randomParty(rng.fork('a'), { size: 40, minLevel: 5, maxLevel: 10 });
    const b = randomParty(rng.fork('b'), { size: 3, minLevel: 50, maxLevel: 60 });
    const bt = createBattle({ sides: [{ party: a }, { party: b, trainer: { name: 'T' } }], kind: 'trainer', data: DATA, foeAi: (x, s) => ai.chooseAction(x, s) }, rng.fork('battle'));
    assert.equal(bt.legal(0).switches.length, 40);
    playOut(bt, null, 5000);
    assert.equal(bt.phase, 'ended');
  });

  it('a 1e15 EXP gain reaches the level cap exactly once and EXP stops at the cap threshold', () => {
    const view = dataMod.createBattleData(DATA);
    const c = mk('sloshkin', 5, ['tap']);
    const r = ops.gainExp(c, 1e15, view);
    assert.equal(r.to, DEFAULTS.maxLevel);
    assert.equal(c.exp, view.expForLevel(view.species('sloshkin').growth, DEFAULTS.maxLevel));
    assert.equal(new Set(r.offers).size, r.offers.length, 'each move offered at most once');
    const again = ops.gainExp(c, 1e15, view);
    assert.equal(again.from, again.to);
  });

  it('a 2,000-turn stall runs to the draw cap without drift (HP/PP stay in bounds)', () => {
    const a = mk('stillox', 50, ['settle']);
    const b = mk('stillox', 50, ['settle']);
    a.moves[0].pp = a.moves[0].maxPp = 5000;
    b.moves[0].pp = b.moves[0].maxPp = 5000;
    const bt = duel(a, b, { tuning: { maxTurns: 2000 }, foeAi: fixedFoe() });
    while (bt.phase !== 'ended') bt.step({ type: 'move', move: 0 });
    assert.equal(bt.result().outcome, 'draw');
    assert.equal(bt.turn, 2000);
    assert.equal(a.hp, a.stats.hp);
  });
});

// ---------------------------------------------------------------------------
describe('round trips', () => {
  const build = (uid, speciesId, level) => SC.makeCreature({ uid, speciesId, level, rng: makeRng(uid) }, DATA);

  it('creatures from systems/creature go in through serialize/deserialize, come out battle-mutated, and survive the trip back', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = makeRng(`rt:${seed}`);
      const mine = [build(`c${seed}a`, 'sloshkin', 20), build(`c${seed}b`, 'scrapling', 18)].map((c) => SC.deserialize(SC.serialize(c), DATA));
      const theirs = [build(`t${seed}a`, rng.pick(['tossup', 'mudfist', 'chillnub']), 19)];
      const bt = createBattle({ sides: [{ party: mine }, { party: theirs, trainer: { name: 'T' } }], kind: 'trainer', data: DATA, foeAi: (x, s) => ai.chooseAction(x, s), gainExp: (c, n) => SC.gainExp(c, n, DATA) }, rng.fork('battle'));
      playOut(bt);
      for (const c of mine) {
        const back = SC.deserialize(SC.serialize(c), DATA);
        assert.equal(back.hp, c.hp, 'HP');
        assert.deepEqual(back.moves.map((m) => m.pp), c.moves.map((m) => m.pp), 'PP');
        assert.deepEqual(back.status, c.status, 'status');
        assert.equal(back.level, c.level, 'level');
        assert.equal(back.exp, c.exp, 'EXP');
      }
    }
  });

  it('state(), result(), the intro and every logged event are JSON-safe (deep-equal after a JSON trip)', () => {
    for (let i = 0; i < 20; i++) {
      const r = simulateBattle({ seed: `json:${i}` });
      assert.deepEqual(JSON.parse(JSON.stringify(r.events)), r.events);
      assert.deepEqual(JSON.parse(JSON.stringify(r.result)), r.result);
    }
    const bt = duel(mk('sloshkin', 20, ['tap', 'tidal-mend']), mk('vesperay', 20, ['tidal-mend', 'tap']), { foeAi: fixedFoe(1) });
    bt.step({ type: 'move', move: 0 });
    const st = bt.state();
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
  });

  it('a caught creature takes the allocated uid, keeps its HP and round-trips as a World creature', () => {
    const wild = build('w1', 'tossup', 6);
    const me = build('c1', 'caldermaw', 40);
    const bt = createBattle({ sides: [{ party: [me] }, { party: [wild] }], kind: 'wild', data: DATA, nextUid: 'c2', foeAi: fixedFoe(), tuning: { lantern: { 1: { mult: Infinity, price: 0, name: 'Test Lantern' } } } }, makeRng('catch'));
    bt.step({ type: 'lantern', grade: 1 });
    const caught = bt.result().caught;
    assert.equal(caught.uid, 'c2');
    assert.equal(caught.wild, false);
    const back = SC.deserialize(SC.serialize(caught), DATA);
    assert.equal(back.uid, 'c2');
    assert.equal(back.hp, caught.hp);
  });

  it('the data view over a data/registry Registry (+ typeChart) battles exactly like the plain tables', () => {
    const reg = createRegistry({ species: SPECIES, moves: MOVES, abilities: ABILITIES });
    const viaReg = { ...reg, typeChart: TYPE_DATA };
    const run = (data) => {
      const bt = duel(mk('sloshkin', 25, ['tap', 'salt-spray']), mk('scrapling', 25, ['tap', 'knuckle']), { data, rng: makeRng('reg'), foeAi: (x, s) => ai.chooseAction(x, s) });
      return digest(playOut(bt));
    };
    assert.equal(run(viaReg), run(DATA));
  });
});

// ---------------------------------------------------------------------------
describe('regressions found by verification', () => {
  it('the trainer AI no longer spends its turns on a status move a status Ward blocks', () => {
    const foe = mk('sloshkin', 30, ['spore-drift', 'tap']);
    const me = mk('lumenveil', 30, ['settle']);
    const bt = duel(me, foe, { rng: makeRng('veil') });
    assert.equal(bt.legal(1).moves[0].word, 'Blocked by Ward', 'the menu marks it');
    for (let i = 0; i < 4; i++) {
      const a = ai.chooseTrainerAction(bt, 1);
      assert.notEqual(bt.active(1).moves[a.move].id, 'spore-drift', `turn ${i}`);
      bt.submit([{ type: 'move', move: 0 }, a]);
    }
  });

  it('the trainer AI does not chip with a status its target is immune to by type or by ability', () => {
    // Scorch (burn) into a Kiln foe: immune by type (types.statusImmunity).
    // Its only hit is Weak against Kiln, which is exactly when the chip step looks for a status move.
    const kiln = duel(mk('sootling', 30, ['settle']), mk('scrapling', 30, ['scorch', 'reed-whip']), { rng: makeRng('kiln') });
    assert.equal(kiln.legal(1).moves[1].word, 'Weak');
    assert.equal(kiln.active(1).moves[ai.chooseTrainerAction(kiln, 1).move].id, 'reed-whip');
    // Immune by ability (a status-immunity hook covering burn).
    const abilities = ABILITIES.map((ab) => (ab.id === 'shoresense' ? { ...ab, hook: 'status-immunity', hookParams: { kinds: ['burn'] } } : ab));
    const viaHook = duel(mk('sloshkin', 30, ['settle']), mk('scrapling', 30, ['scorch', 'reed-whip']), { data: { ...DATA, abilities }, rng: makeRng('hook') });
    assert.equal(viaHook.legal(1).moves[1].word, 'Weak');
    assert.equal(viaHook.active(1).moves[ai.chooseTrainerAction(viaHook, 1).move].id, 'reed-whip');
    // Without the immunity it does chip (the step still works).
    const plain = duel(mk('sloshkin', 30, ['settle']), mk('scrapling', 30, ['scorch', 'reed-whip']), { rng: makeRng('plain') });
    assert.equal(plain.active(1).moves[ai.chooseTrainerAction(plain, 1).move].id, 'scorch');
  });

  it('Big Sibling hands its share to the lowest-level creature still standing, never to a fainted one', () => {
    const sib = mk('caldermaw', 50, ['kiln-maw']);
    const low = mk('tossup', 3, ['tap'], { nickname: 'LOW' });
    const mid = mk('scrapling', 20, ['tap'], { nickname: 'MID' });
    low.hp = 0;
    const abilities = ABILITIES.map((ab) => (ab.id === sib.ability ? { ...ab, hook: 'exp-share-lowest', hookParams: { toLowest: 0.3 } } : ab));
    const bt = duel([sib, low, mid], mk('tossup', 5, ['settle']), { data: { ...DATA, abilities }, foeAi: fixedFoe() });
    const lowExp = low.exp;
    while (bt.phase !== 'ended') bt.step({ type: 'move', move: 0 });
    const sibEv = ofType(bt.log, 'exp').filter((e) => e.share === 'sibling');
    assert.ok(sibEv.length > 0);
    assert.ok(sibEv.every((e) => e.creature === 'MID'));
    assert.equal(low.exp, lowExp);
  });

  it('holdOutExp (GDD: the dock hold-out grants a flat 100) pays battlers fully and the bench its share; 0 by default', () => {
    const play = (tuning) => {
      const lead = mk('sloshkin', 5, ['settle'], { nickname: 'LEAD' });
      const bench = mk('tossup', 5, ['tap'], { nickname: 'BENCH' });
      const bt = duel([lead, bench], mk('caldermaw', 5, ['settle']), { holdOut: 3, tuning, foeAi: fixedFoe() });
      while (bt.phase !== 'ended') bt.step({ type: 'move', move: 0 });
      return bt.result();
    };
    assert.deepEqual(play(undefined).exp, []);
    const r = play({ holdOutExp: 100 });
    assert.equal(r.outcome, 'holdout');
    assert.deepEqual(r.exp.map((e) => [e.name, e.amount]), [['LEAD', 100], ['BENCH', 60]]);
  });

  it('Read is refused with a bad side or while a replacement is being chosen; Stance is refused after the end', () => {
    const bt = duel([mk('tossup', 2, ['tap']), mk('sloshkin', 30, ['tap'])], mk('caldermaw', 60, ['kiln-maw']), { foeAi: fixedFoe() });
    assert.throws(() => bt.read(2), (e) => e.code === 'BAD_SIDE');
    while (bt.phase === 'choose') bt.step({ type: 'move', move: 0 });
    assert.equal(bt.phase, 'replace');
    assert.throws(() => bt.read(0), (e) => e.code === 'REPLACING');
    const w = duel(mk('caldermaw', 60, ['kiln-maw']), mk('tossup', 2, ['settle']), { kind: 'wild', foeAi: fixedFoe() });
    w.step({ type: 'move', move: 0 });
    assert.equal(w.phase, 'ended');
    assert.throws(() => w.setCaptureStance(true), (e) => e.code === 'ENDED');
  });

  it('captureRng: each Lantern attempt rolls on its own stream (odds shown = odds rolled, independent of earlier draws)', () => {
    const calls = [];
    const captureRng = (attempt) => { calls.push(attempt); return { chance: () => attempt === 2 }; };
    const bt = duel(mk('scrapling', 30, ['settle']), mk('tossup', 30, ['settle']), { kind: 'wild', captureRng, rng: makeRng('cap'), foeAi: fixedFoe() });
    for (let i = 0; i < 3 && bt.phase !== 'ended'; i++) bt.step({ type: 'lantern', grade: 1 });
    assert.deepEqual(calls, [0, 1, 2]);
    assert.equal(bt.result().outcome, 'capture');
    assert.throws(() => duel(mk('scrapling', 30, ['settle']), mk('tossup', 30, ['settle']), { kind: 'wild', captureRng: 5 }), TypeError);
  });

  it('the data view cache is keyed by tuning values, not object identity', () => {
    const t = { softenMult: 0.5 };
    const a = dataMod.createBattleData(DATA, { tuning: t });
    t.softenMult = 0.1;
    const b = dataMod.createBattleData(DATA, { tuning: t });
    assert.notEqual(a, b);
    assert.equal(dataMod.createBattleData(DATA, { tuning: { softenMult: 0.1 } }), b);
    assert.equal(dataMod.createBattleData(DATA, { tuning: { benchShare: 0.9 } }), dataMod.createBattleData(DATA), 'keys the view does not read share the plain view');
  });

  it('estimateDamage refuses a slot that does not exist', () => {
    const bt = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap']));
    assert.throws(() => bt.estimateDamage(0, 3), (e) => e.code === 'BAD_MOVE');
    assert.throws(() => bt.estimateDamage(0, 'x'), (e) => e.code === 'BAD_MOVE');
    assert.ok(bt.estimateDamage(0, null).max > 0, 'null estimates Scrap');
  });

  it('TUNING_KEYS lists every DEFAULTS key in each module; the engine table is their union', () => {
    assert.equal(tuningKeys, TUNING_KEYS);
    assert.deepEqual([...TUNING_KEYS].sort(), Object.keys(DEFAULTS).sort());
    for (const m of [effects, hooks, ops, dataMod]) {
      assert.deepEqual(m.TUNING_KEYS, Object.keys(m.DEFAULTS));
      for (const k of m.TUNING_KEYS) assert.ok(TUNING_KEYS.includes(k), k);
    }
    assert.deepEqual(ai.TUNING_KEYS, ['profiles']);
    assert.ok(TUNING_KEYS.includes('plumblineIgnoresWards') && TUNING_KEYS.includes('holdOutExp'));
  });

  it('readCard on Freefall keeps the prototype choice (lead only, no pips) and every dial reveals no Ward shimmer when told not to', () => {
    const foe = { party: [mk('prismoth', 20, ['tap']), mk('tossup', 20, ['tap'])] };
    assert.equal(readCard(foe, 'freefall', DATA).roster.length, 1);
    for (const dial of DIALS) {
      const card = readCard(foe, dial, DATA, undefined, { rules: { wardShimmer: false, pips: true } });
      assert.ok(card.pips.every((p) => p.wardShimmer === false));
    }
  });

  it('a constant rng cannot wedge the engine: a stub rng stuck at 0.999 or 0 still ends every battle', () => {
    for (const v of [0, 0.999]) {
      const bt = duel(mk('sloshkin', 30, ['tap', 'salt-spray']), mk('scrapling', 30, ['tap']), { rng: constRng(v), foeAi: (x, s) => ai.chooseAction(x, s) });
      playOut(bt, null, 3000);
      assert.equal(bt.phase, 'ended', `rng ${v}`);
    }
  });
});
