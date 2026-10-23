// js/battle/engine.js beyond the prototype: injected data, the DEFAULTS / tuning contract, the
// gainExp seam, estimateDamage, determinism across seeds and malformed setups.
// Run: node --test test/battle.tuning.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, Battle, DEFAULTS, DIAL_RULES, DIALS, BENCH_SHARE, MAX_TURNS, MENDS_PER_BATTLE, CRACKDUST } from '../js/battle/engine.js';
import { DEFAULTS as EFFECT_DEFAULTS } from '../js/battle/effects.js';
import { DEFAULTS as ABILITY_DEFAULTS } from '../js/battle/abilityHooks.js';
import { DEFAULTS as CREATURE_DEFAULTS } from '../js/battle/creatureOps.js';
import { DEFAULTS as DATA_DEFAULTS } from '../js/battle/data.js';
import { chooseAction } from '../js/battle/ai.js';
import { makeRng, constRng, mk, duel, ofType, DATA } from './fixtures/battle/helpers.mjs';
import { randomParty } from './fixtures/battle/sim.mjs';
import { MOVES, SPECIES, ABILITIES, TYPE_DATA } from './fixtures/battle/data.mjs';

const fixedFoe = (move = 0) => () => ({ type: 'move', move });

describe('DEFAULTS', () => {
  it('is one frozen table holding every sub-module default plus the engine\'s own, with prototype values', () => {
    assert.ok(Object.isFrozen(DEFAULTS));
    for (const sub of [EFFECT_DEFAULTS, ABILITY_DEFAULTS, CREATURE_DEFAULTS, DATA_DEFAULTS]) for (const k of Object.keys(sub)) assert.equal(DEFAULTS[k], sub[k], k);
    assert.equal(DEFAULTS.benchShare, 0.6);
    assert.equal(BENCH_SHARE, DEFAULTS.benchShare);
    assert.equal(MAX_TURNS, 200);
    assert.equal(MENDS_PER_BATTLE, 3);
    assert.deepEqual(DIALS, ['drift', 'flux', 'freefall']);
    for (const d of DIALS) assert.ok(Object.isFrozen(DIAL_RULES[d]));
    for (const [k, v] of Object.entries(DEFAULTS)) assert.ok(typeof v === 'number' || typeof v === 'object', k);
  });

  it('battle.tuning is the merged table; an unknown key fails loudly', () => {
    const bt = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap']), { tuning: { benchShare: 0.9 } });
    assert.equal(bt.tuning.benchShare, 0.9);
    assert.equal(bt.tuning.stab, 1.5);
    assert.equal(duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap'])).tuning, DEFAULTS);
    assert.throws(() => duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap']), { tuning: { benchShar: 0.9 } }), /unknown tuning key "benchShar"/);
  });
});

describe('tuning reaches the rules', () => {
  it('benchShare, trainerExpMult and expYieldDivisor shape EXP', () => {
    const run = (tuning) => {
      const bt = duel([mk('caldermaw', 50, ['kiln-maw'], { nickname: 'ACE' }), mk('sloshkin', 50, ['tap'], { nickname: 'BENCH' })], mk('tossup', 5, ['settle']), { tuning, foeAi: fixedFoe() });
      bt.submit([{ type: 'move', move: 0 }]);
      return Object.fromEntries(ofType(bt.log, 'exp').map((e) => [e.creature, e.amount]));
    };
    const base = run();
    const tuned = run({ benchShare: 1, trainerExpMult: 1, expYieldDivisor: 1 });
    assert.equal(tuned.ACE, Math.floor((40 * 5) / 1));
    assert.equal(tuned.BENCH, tuned.ACE);
    assert.ok(base.BENCH < base.ACE);
  });

  it('mendsPerBattle, scrapCost, chip and trapTurns', () => {
    const me = mk('sloshkin', 40, ['tap']);
    duel(me, mk('tossup', 5, ['tap']), { tuning: { mendsPerBattle: 1 } });
    assert.equal(me.mends, 1);
    const a = mk('tossup', 30, ['tap']);
    a.moves[0].pp = 0;
    const bt = duel(a, mk('tossup', 30, ['settle']), { tuning: { scrapCost: 0.5 }, foeAi: fixedFoe() });
    const cost = ofType(bt.submit([{ type: 'scrap' }]), 'scrap-cost')[0];
    assert.equal(cost.amount, Math.floor(a.stats.hp * 0.5));
    const b = mk('tossup', 40, ['settle']);
    const bt2 = duel(mk('rimeplate', 40, ['sandtrap']), b, { tuning: { trapTurns: 2, chip: { burn: 0.1, poison: 0.1, trap: 0.25 } }, foeAi: fixedFoe() });
    const evs = bt2.submit([{ type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'status').find((e) => e.kind === 'trap').turns, 2);
    assert.equal(ofType(evs, 'damage').find((e) => e.source === 'status').amount, Math.floor(b.stats.hp * 0.25));
    const evs2 = bt2.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs2, 'status').some((e) => e.kind === 'trap' && e.action === 'cure'), 'freed after the tuned 2 turns');
  });

  it('blackoutRate / blackoutCap, payoutPerLevel and maxTurns', () => {
    const lose = duel(mk('tossup', 1, ['tap']), mk('caldermaw', 60, ['kiln-maw']), { glint: 10000, tuning: { blackoutRate: 0.5, blackoutCap: 4000 }, foeAi: fixedFoe() });
    lose.submit([{ type: 'move', move: 0 }]);
    assert.equal(lose.result().blackoutCost, 4000);
    const win = duel(mk('caldermaw', 50, ['kiln-maw']), mk('tossup', 5, ['settle']), { tuning: { payoutPerLevel: 7 }, foeAi: fixedFoe() });
    win.submit([{ type: 'move', move: 0 }]);
    assert.equal(win.result().payout, 35);
    const stall = duel(mk('sloshkin', 40, ['settle']), mk('tossup', 40, ['settle']), { tuning: { maxTurns: 3 }, foeAi: fixedFoe() });
    for (let i = 0; i < 3; i++) stall.submit([{ type: 'move', move: 0 }]);
    assert.equal(stall.outcome, 'draw');
  });

  it('evasionMult / evasionCap and the Lantern table (menu grades follow the table)', () => {
    const v = mk('vesperay', 40, ['mirror-step', 'tap']);
    const bt = duel(mk('stillox', 40, ['tap']), v, { rng: constRng(0.1), tuning: { evasionCap: 1, evasionMult: [1, 0.5] }, foeAi: fixedFoe() }); // hits land, so no decoy pops
    bt.submit([{ type: 'move', move: 0 }]);
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'stat').some((e) => e.result === 'capped'));
    assert.equal(bt.hitChance(0, MOVES.find((m) => m.id === 'tap')), 0.5);
    const lantern = { 1: { mult: 1, price: 10, name: 'Wick' }, 2: { mult: 3, price: 30, name: 'Torch' }, sure: { mult: Infinity, price: null, name: 'Heart' } };
    const wild = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 10, ['settle']), { kind: 'wild', tuning: { lantern }, foeAi: fixedFoe() });
    const menu = wild.legal(0).lantern;
    assert.deepEqual(menu.grades.map((g) => [g.grade, g.name, g.price]), [[1, 'Wick', 10], [2, 'Torch', 30]]);
    assert.throws(() => wild.submit([{ type: 'lantern', grade: 3 }]), (e) => e.code === 'BAD_LANTERN');
    wild.rng = constRng(0.9999);
    const sure = wild.submit([{ type: 'lantern', grade: 'sure' }]);
    assert.ok(ofType(sure, 'capture').length === 1);
  });

  it('actionPriority and the run formula', () => {
    const bt = duel([mk('stillox', 30, ['tap']), mk('tossup', 30, ['tap'])], mk('wirewhisk', 30, ['arc-ping']), { tuning: { actionPriority: { run: 7, switch: 0, item: 6, lantern: 6, read: 5, scrap: 0 } }, foeAi: fixedFoe() });
    const evs = bt.submit([{ type: 'switch', to: 1 }]);
    assert.ok(evs.findIndex((e) => e.type === 'move') < evs.findIndex((e) => e.type === 'switch'), 'Arc Ping (priority 1) now beats a priority-0 switch');
    const wild = duel(mk('stillox', 30, ['tap']), mk('wirewhisk', 30, ['tap']), { kind: 'wild', rng: constRng(0.99), tuning: { runAutoThreshold: 1 }, foeAi: fixedFoe() });
    assert.equal(ofType(wild.submit([{ type: 'run' }]), 'run')[0].success, true, 'a threshold of 1 always escapes');
  });
});

describe('injected data and setup validation', () => {
  it('requires data and refuses parties that reference unknown content', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const b = mk('tossup', 20, ['tap']);
    assert.throws(() => createBattle({ sides: [{ party: [a] }, { party: [b] }], kind: 'wild', rng: constRng() }), /data/);
    const ghost = mk('tossup', 20, ['tap']);
    ghost.speciesId = 'ghostling';
    assert.throws(() => duel(a, ghost), /unknown species "ghostling"/);
    const badMove = mk('tossup', 20, ['tap']);
    badMove.moves[0].id = 'tapp';
    assert.throws(() => duel(a, badMove), /did you mean "tap"/);
    const noHp = mk('tossup', 20, ['tap']);
    noHp.hp = 0;
    assert.throws(() => duel(a, noHp), RangeError);
  });

  it('runs on a minimal toy content set that names nothing from the game', () => {
    const data = {
      types: { chart: { Sun: { Sun: 1, Moon: 2 }, Moon: { Sun: 2, Moon: 1 } } },
      moves: [{ id: 'ray', name: 'Ray', type: 'Sun', category: 'special', power: 60, accuracy: 100, pp: 10, priority: 0, effect: {} }],
      abilities: [{ id: 'none', name: 'None', text: '', ward: null, hook: null }],
      species: [{ id: 'dot', name: 'Dot', types: ['Moon'], familyId: 'dot', stage: 1, base: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 }, ability: 'none', learnset: [[1, 'ray']], heartmark: null, catchRate: 100, expYield: 50, growth: 'fast', flags: {} }],
    };
    const make = (uid) => ({ uid, speciesId: 'dot', nickname: `Dot-${uid}`, types: ['Moon'], ability: 'none', level: 10, exp: 800, base: data.species[0].base, trained: {}, stats: { hp: 40, atk: 25, def: 25, spa: 25, spd: 25, spe: 25 }, hp: 40, moves: [{ id: 'ray', pp: 10, maxPp: 10 }], status: null, mends: 3, heartmark: null, heartmarkStab: false, heldItem: null, wild: true });
    const bt = createBattle({ sides: [{ party: [make('a')] }, { party: [make('b')] }], kind: 'wild', data, rng: makeRng('toy'), foeAi: chooseAction });
    for (let i = 0; i < 30 && bt.phase !== 'ended'; i++) bt.step({ type: 'move', move: 0 });
    assert.equal(bt.phase, 'ended');
    assert.ok(['win', 'loss'].includes(bt.outcome));
    assert.equal(bt.data.scrap.type, null, 'Scrap synthesized for content without one');
  });

  it('createBattle(setup, rng) and setup.rng are equivalent', () => {
    const go = (viaArg) => {
      const sides = [{ party: [mk('sloshkin', 20, ['tap', 'undertow'], { uid: 'p1' })] }, { party: [mk('tossup', 20, ['tap'], { uid: 'f1' })], trainer: { name: 'R' } }];
      const setup = { sides, kind: 'trainer', data: DATA, foeAi: chooseAction };
      const bt = viaArg ? createBattle(setup, makeRng('same')) : createBattle({ ...setup, rng: makeRng('same') });
      const log = [...bt.intro];
      for (let i = 0; i < 8 && bt.phase !== 'ended'; i++) log.push(...bt.step(bt.phase === 'replace' ? chooseAction(bt, 0) : { type: 'move', move: i % 2 }));
      return JSON.stringify(log);
    };
    assert.equal(go(true), go(false));
    assert.ok(createBattle({ sides: [{ party: [mk('sloshkin', 20, ['tap'])] }, { party: [mk('tossup', 20, ['tap'])] }], kind: 'wild', data: DATA }, constRng()) instanceof Battle);
  });

  it('the gainExp seam replaces level-up handling (systems/creature can plug in)', () => {
    const calls = [];
    const bt = duel(mk('caldermaw', 50, ['kiln-maw']), mk('tossup', 5, ['settle']), {
      foeAi: fixedFoe(),
      gainExp: (c, amount) => { calls.push([c.uid, amount]); return { from: c.level, to: c.level + 1, learned: [], offers: [], statsBefore: c.stats, statsAfter: c.stats }; },
    });
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(calls.length, 1);
    assert.equal(bt.result().exp[0].levelsGained, 1);
    assert.ok(ofType(bt.log, 'levelup').length === 1);
  });

  it('item action ids: CRACKDUST is the engine mechanic id', () => {
    assert.equal(CRACKDUST, 'crackdust');
  });
});

describe('estimateDamage', () => {
  it('brackets the real damage, consumes no rng and touches no first-hit flag', () => {
    let draws = 0;
    const rng = makeRng('est');
    const counting = { next: () => { draws++; return rng.next(); }, int: (a, b) => { draws++; return rng.int(a, b); }, chance: (p) => { draws++; return rng.chance(p); }, pick: (x) => rng.pick(x), weighted: (e) => rng.weighted(e) };
    const a = mk('scrapling', 40, ['knuckle', 'pummel', 'settle']);
    const d = mk('skeinwing', 60, ['tidal-mend']);
    const bt = duel(a, d, { rng: counting, foeAi: fixedFoe() });
    const before = draws;
    const est = bt.estimateDamage(0, 0);
    assert.equal(draws, before, 'no draws');
    assert.deepEqual(bt.bflags(1), {}, 'Featherbed not consumed');
    assert.ok(est.lands && est.min > 0 && est.max >= est.min);
    assert.deepEqual(bt.estimateDamage(0, 2), { min: 0, max: 0, lands: false }, 'a status move');
    const multi = bt.estimateDamage(0, 1);
    assert.ok(multi.max >= multi.min * 2, 'multi-hit range covers 2..5 hits');
    const hit = ofType(bt.submit([{ type: 'move', move: 0 }]), 'damage').find((e) => e.side === 1);
    assert.ok(hit.amount <= est.max, `${hit.amount} <= ${est.max}`);
    const walled = duel(mk('tossup', 30, ['tap']), mk('prismoth', 30, ['settle']));
    assert.deepEqual(walled.estimateDamage(0, 0), { min: 0, max: 0, lands: false });
    const dry = mk('tossup', 30, ['tap']);
    assert.ok(duel(dry, mk('tossup', 30, ['tap'])).estimateDamage(0, null).min > 0, 'Scrap estimate');
  });
});

describe('determinism', () => {
  it('same seed and actions give identical logs across many seeds; different seeds diverge', () => {
    const play = (seed) => {
      const rng = makeRng(seed);
      const bt = createBattle({ sides: [{ party: randomParty(rng.fork('p'), { size: 3 }) }, { party: randomParty(rng.fork('f'), { size: 3 }), trainer: { name: 'T' } }], kind: 'trainer', data: DATA, rng: rng.fork('b'), foeAi: chooseAction });
      const log = [...bt.intro];
      for (let i = 0; i < 60 && bt.phase !== 'ended'; i++) log.push(...bt.step(chooseAction(bt, 0)));
      return JSON.stringify(log);
    };
    const logs = new Set();
    for (let i = 0; i < 25; i++) {
      const l = play(`det-${i}`);
      assert.equal(play(`det-${i}`), l, `seed ${i}`);
      logs.add(l);
    }
    assert.equal(logs.size, 25);
  });

  it('a refused action leaves the battle exactly as it was', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const bt = duel(a, mk('tossup', 20, ['tap']), { foeAi: fixedFoe() });
    const before = JSON.stringify(bt.state());
    for (const bad of [{ type: 'move', move: 4 }, { type: 'move', move: '0' }, { type: 'switch', to: 0 }, { type: 'switch', to: 1.5 }, { type: 'run' }, { type: 'read' }, { type: 'lantern', grade: 1 }, { type: 'item', id: 'tonic' }, { type: 'item', item: CRACKDUST }]) {
      assert.throws(() => bt.submit([bad]), (e) => e.name === 'BattleError', JSON.stringify(bad));
    }
    assert.equal(JSON.stringify(bt.state()), before);
    assert.equal(bt.turn, 0);
  });

  it('a replacement step validates every pending side before sending anyone in', () => {
    const bt = duel([mk('tossup', 1, ['tap']), mk('tossup', 30, ['tap'])], [mk('caldermaw', 80, ['kiln-maw'])], { foeAi: fixedFoe() });
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'replace');
    assert.throws(() => bt.submit([{ type: 'switch', to: 0 }]), (e) => e.code === 'BAD_SWITCH');
    assert.equal(bt.phase, 'replace');
    bt.submit([{ type: 'switch', to: 1 }]);
    assert.equal(bt.phase, 'choose');
  });

  it('fixture tables stay untouched by battles (the engine only mutates the creatures it was handed)', () => {
    const snap = JSON.stringify([MOVES, SPECIES, ABILITIES, TYPE_DATA]);
    for (let i = 0; i < 20; i++) {
      const rng = makeRng(`untouched-${i}`);
      const bt = createBattle({ sides: [{ party: randomParty(rng.fork('p')) }, { party: randomParty(rng.fork('f'), { size: 1 }) }], kind: 'wild', data: DATA, rng: rng.fork('b'), foeAi: chooseAction });
      for (let t = 0; t < 30 && bt.phase !== 'ended'; t++) bt.step(chooseAction(bt, 0));
    }
    assert.equal(JSON.stringify([MOVES, SPECIES, ABILITIES, TYPE_DATA]), snap);
  });
});
