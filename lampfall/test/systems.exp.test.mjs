// Unit tests for js/systems/exp.js. Run: node --test test/systems.exp.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/systems/exp.js';
import * as C from '../js/systems/creature.js';
import { validateWorld } from '../js/state/schema.js';
import { expForLevel as protoExpForLevel, levelFromExp as protoLevelFromExp } from '../proto/battle/species.js';
import { makeCreature as protoMake } from '../proto/battle/creature.js';
import { BENCH_SHARE, YARD_SHARE, CATCH_UP_CAP, DAMP_START, DAMP_FACTOR, TRAINER_EXP_MULT, catchUpMult as protoCatchUp } from '../proto/battle/engine.js';
import { duel, constRng } from '../proto/battle/test/helpers.mjs';
import { chooseAction } from '../proto/battle/ai.js';
import { DATA, REG, mk, world, spyBus } from './fixtures/rules-creature.fixture.mjs';

const CURVES = ['fast', 'medium-fast', 'medium-slow', 'slow'];

describe('DEFAULTS and tuning', () => {
  it('match the rules doc and the prototype constants', () => {
    assert.equal(E.DEFAULTS.BENCH_SHARE, 0.6);
    assert.equal(E.DEFAULTS.BENCH_SHARE, BENCH_SHARE);
    assert.equal(E.DEFAULTS.YARD_SHARE, YARD_SHARE);
    assert.equal(E.DEFAULTS.YARD_CAP, 3);
    assert.equal(E.DEFAULTS.CATCH_UP_CAP, CATCH_UP_CAP);
    assert.equal(E.DEFAULTS.DAMP_START, DAMP_START);
    assert.equal(E.DEFAULTS.DAMP_FACTOR, DAMP_FACTOR);
    assert.equal(E.DEFAULTS.TRAINER_EXP_MULT, TRAINER_EXP_MULT);
    assert.deepEqual(E.DEFAULTS.WINDOW_LEVELS, [9, 20, 34]);
    assert.deepEqual(E.DEFAULTS.DAMP_SOURCES, ['rematch']);
    assert.ok(Object.isFrozen(E.DEFAULTS) && Object.isFrozen(E.DEFAULTS.GROWTH_CURVES.slow.num));
    assert.deepEqual([...E.TUNING_KEYS].sort(), Object.keys(E.DEFAULTS).sort());
  });

  it('tuningOf validates known keys and ignores foreign ones', () => {
    assert.equal(E.tuningOf(undefined), E.DEFAULTS);
    assert.equal(E.tuningOf({ PARTY_MAX: 3 }).BENCH_SHARE, 0.6);
    assert.equal(E.tuningOf({ BENCH_SHARE: 0.5 }).BENCH_SHARE, 0.5);
    assert.throws(() => E.tuningOf({ MAX_LEVEL: 101 }), TypeError);
    assert.throws(() => E.tuningOf({ BENCH_SHARE: -1 }), TypeError);
    assert.throws(() => E.tuningOf({ WINDOW_LEVELS: [9, 0] }), TypeError);
    assert.throws(() => E.tuningOf({ STILL_KNOT_MODE: 'melt' }), TypeError);
    assert.throws(() => E.tuningOf({ GROWTH_CURVES: { x: { num: [1, 2], den: 1 } } }), TypeError);
    assert.throws(() => E.tuningOf('x'), TypeError);
  });
});

describe('growth curves and level thresholds', () => {
  it('expForLevel is exact and equals the prototype for every curve and level', () => {
    for (const g of CURVES) for (let n = 0; n <= 101; n++) assert.equal(E.expForLevel(g, n), protoExpForLevel(g, n), `${g} ${n}`);
  });

  it('levelFromExp equals the prototype at, below and between thresholds', () => {
    for (const g of CURVES) {
      for (let n = 1; n <= 100; n++) {
        const t = E.expForLevel(g, n);
        for (const x of [t - 1, t, t + 1]) assert.equal(E.levelFromExp(g, x), protoLevelFromExp(g, x), `${g} exp ${x}`);
      }
      assert.equal(E.levelFromExp(g, 10 ** 12), 100);
    }
  });

  it('thresholds are strictly increasing from level 1 = 0', () => {
    for (const g of CURVES) {
      assert.equal(E.expForLevel(g, 1), 0);
      for (let n = 2; n <= 100; n++) assert.ok(E.expForLevel(g, n) > E.expForLevel(g, n - 1), `${g} ${n}`);
    }
  });

  it('expBand gives the level\'s EXP range; curves and the cap are tunable; unknown curves throw', () => {
    assert.deepEqual(E.expBand('medium-fast', 10), [1000, 1330]);
    assert.deepEqual(E.expBand('medium-fast', 100), [10 ** 6, 10 ** 6]);
    const tuning = { MAX_LEVEL: 20, GROWTH_CURVES: { flat: { num: [0, 0, 10, -10], den: 1 } } };
    assert.equal(E.expForLevel('flat', 5, { tuning }), 40);
    assert.equal(E.expForLevel('flat', 50, { tuning }), 190);
    assert.equal(E.levelFromExp('flat', 10 ** 9, { tuning }), 20);
    assert.throws(() => E.expForLevel('medium-fast', 5, { tuning }), RangeError);
    assert.throws(() => E.expForLevel('weird', 5), RangeError);
  });
});

describe('multipliers', () => {
  it('catch-up follows the rules table (+50% per 5 levels under, cap x3) and the prototype', () => {
    const table = [[0, 1], [4, 1], [5, 1.5], [9, 1.5], [10, 2], [14, 2], [15, 2.5], [19, 2.5], [20, 3], [45, 3]];
    for (const [under, mult] of table) assert.equal(E.catchUpMult(30 - under, 30), mult, `under ${under}`);
    for (let lv = 1; lv <= 60; lv++) assert.equal(E.catchUpMult(lv, 40), protoCatchUp(lv, 40));
    assert.equal(E.catchUpMult(50, 30), 1, 'over the curve');
    assert.equal(E.catchUpMult(5, null), 1);
    assert.equal(E.catchUpMult(5, 40, { tuning: { CATCH_UP_STEP_LEVELS: 10, CATCH_UP_STEP: 1, CATCH_UP_CAP: 2 } }), 2);
  });

  it('damping applies only to listed sources, only above curve + DAMP_START', () => {
    assert.equal(E.dampMult(41, 30, 'rematch'), 0.5);
    assert.equal(E.dampMult(40, 30, 'rematch'), 1, 'exactly +10 is not damped');
    for (const s of ['route', 'story', 'spire', 'duel']) assert.equal(E.dampMult(80, 30, s), 1, s);
    assert.equal(E.dampMult(80, null, 'rematch'), 1);
    assert.equal(E.dampMult(80, 30, undefined), 1);
    assert.equal(E.dampMult(35, 30, 'duel', { tuning: { DAMP_SOURCES: ['duel'], DAMP_START: 2, DAMP_FACTOR: 0.25 } }), 0.25);
  });

  it('baseYield = floor(yield x level / EXP_DIVISOR), x TRAINER_EXP_MULT in trainer battles', () => {
    assert.equal(E.baseYield(64, 10, 'wild'), 91);
    assert.equal(E.baseYield(64, 10, 'trainer'), 136.5);
    assert.equal(E.baseYield(64, 10, 'wild', { tuning: { EXP_DIVISOR: 1 } }), 640);
    assert.equal(E.baseYield(-3, 10, 'wild'), 0);
  });
});

describe('computeAward', () => {
  const foe = { expYield: 70, level: 14 }; // base 140
  const party = [
    { uid: 'a', level: 20, participated: true },
    { uid: 'b', level: 20 },
    { uid: 'c', level: 20, fainted: true, participated: true },
  ];

  it('participants 100%, bench 60%, fainted 0% (tunable)', () => {
    const r = E.computeAward({ kind: 'wild', defeated: [foe], party });
    assert.deepEqual(r.totals, [{ uid: 'a', amount: 140 }, { uid: 'b', amount: 84 }]);
    assert.deepEqual(r.lines.map((l) => l.share), ['battler', 'bench']);
    const t = E.computeAward({ kind: 'wild', defeated: [foe], party }, null, { tuning: { BENCH_SHARE: 0.5, FAINTED_EXP_SHARE: 0.1 } });
    assert.deepEqual(t.totals, [{ uid: 'a', amount: 140 }, { uid: 'b', amount: 70 }, { uid: 'c', amount: 14 }]);
  });

  it('participants may come as a uid list; several foes add up; trainer battles pay x1.5', () => {
    const r = E.computeAward({ kind: 'trainer', defeated: [foe, foe], party: [{ uid: 'a', level: 20 }, { uid: 'b', level: 20 }], participants: ['b'] });
    assert.deepEqual(r.totals, [{ uid: 'a', amount: 2 * Math.floor(210 * 0.6) }, { uid: 'b', amount: 420 }]);
  });

  it('catch-up and rematch damping apply per recipient', () => {
    const r = E.computeAward({ kind: 'wild', source: 'rematch', curveLevel: 30, defeated: [foe], party: [{ uid: 'low', level: 10, participated: true }, { uid: 'high', level: 45, participated: true }, { uid: 'mid', level: 30, participated: true }] });
    assert.deepEqual(r.totals, [{ uid: 'low', amount: 140 * 3 }, { uid: 'high', amount: 70 }, { uid: 'mid', amount: 140 }]);
    const story = E.computeAward({ kind: 'wild', source: 'story', curveLevel: 30, defeated: [foe], party: [{ uid: 'high', level: 45, participated: true }] });
    assert.deepEqual(story.totals, [{ uid: 'high', amount: 140 }]);
  });

  it('Training Yard: YARD_SHARE of the party total each, first YARD_CAP, never party members or duplicates', () => {
    const r = E.computeAward({ kind: 'wild', defeated: [foe], party: party.slice(0, 2), yard: [{ uid: 'y1', level: 5 }, { uid: 'a', level: 20 }, { uid: 'y1', level: 5 }, { uid: 'y2', level: 5 }, { uid: 'y3', level: 5 }, { uid: 'y4', level: 5 }] });
    const total = 140 + 84;
    assert.deepEqual(r.totals, [{ uid: 'a', amount: 140 }, { uid: 'b', amount: 84 }, { uid: 'y1', amount: Math.floor(total * 0.25) }, { uid: 'y2', amount: 56 }, { uid: 'y3', amount: 56 }]);
    const none = E.computeAward({ kind: 'wild', defeated: [foe], party: party.slice(0, 2), yard: [{ uid: 'y1', level: 5 }] }, null, { tuning: { YARD_CAP: 0 } });
    assert.equal(none.totals.length, 2);
  });

  it('an ability with expShare gives the lowest-level other member a share of its gain, lost if it faints', () => {
    const p = [
      { uid: 'sib', level: 30, participated: true, ability: 'big-sibling' },
      { uid: 'x', level: 25 },
      { uid: 'y', level: 12 },
    ];
    const r = E.computeAward({ kind: 'wild', defeated: [foe], party: p }, DATA);
    const sib = r.lines.find((l) => l.share === 'sibling');
    assert.deepEqual(sib, { uid: 'y', amount: Math.floor(140 * 0.3), share: 'sibling' });
    const fainted = E.computeAward({ kind: 'wild', defeated: [foe], party: [{ ...p[0], fainted: true }, p[1], p[2]] }, DATA);
    assert.ok(!fainted.lines.some((l) => l.share === 'sibling'));
    const benched = E.computeAward({ kind: 'wild', defeated: [foe], party: [{ ...p[0], participated: false }, p[1], p[2]] }, DATA);
    assert.ok(!benched.lines.some((l) => l.share === 'sibling'), 'only when it took part');
    const flag = { ...DATA, abilities: { ...DATA.abilities, 'fx-share': { id: 'fx-share', expShare: true } } };
    const def = E.computeAward({ kind: 'wild', defeated: [foe], party: [{ ...p[0], ability: 'fx-share' }, p[1], p[2]] }, flag, { tuning: { SIBLING_SHARE: 0.5 } });
    assert.equal(def.lines.find((l) => l.share === 'sibling').amount, 70);
  });

  it('resolves expYield from data when a foe gives only speciesId; errors otherwise', () => {
    const r = E.computeAward({ kind: 'wild', defeated: [{ speciesId: 'tossup', level: 7 }], party: [{ uid: 'a', level: 5, participated: true }] }, REG);
    assert.deepEqual(r.totals, [{ uid: 'a', amount: Math.floor((40 * 7) / 7) }]);
    assert.throws(() => E.computeAward({ kind: 'wild', defeated: [{ speciesId: 'tossup', level: 7 }], party: [] }), TypeError);
    assert.throws(() => E.computeAward(null), TypeError);
    assert.throws(() => E.computeAward({ defeated: [3], party: [] }), TypeError);
    assert.throws(() => E.computeAward({ defeated: [foe], party: [{ level: 3 }] }), TypeError);
    assert.deepEqual(E.computeAward({ kind: 'wild', party }), { lines: [], totals: [] });
  });

  it('matches the prototype engine\'s own split for a real battle (participants, bench, catch-up, trainer)', () => {
    const lead = protoMake({ uid: 1, speciesId: 'caldermaw', level: 40, rng: constRng() });
    const bench = protoMake({ uid: 2, speciesId: 'tossup', level: 12, rng: constRng() });
    const sib = protoMake({ uid: 3, speciesId: 'scrapling', level: 18, rng: constRng() });
    const f1 = protoMake({ uid: 10, speciesId: 'mudfist', level: 9, rng: constRng() });
    const f2 = protoMake({ uid: 11, speciesId: 'wirewhisk', level: 11, rng: constRng() });
    const b = duel([lead, bench, sib], [f1, f2], { curveLevel: 25, trainer: { name: 'T' }, foeAi: chooseAction });
    for (let i = 0; i < 40 && !b.result().ended; i++) b.submit([{ type: 'move', move: 1 }]);
    const res = b.result();
    assert.equal(res.outcome, 'win');
    const ours = E.computeAward({
      kind: 'trainer', curveLevel: 25,
      defeated: [{ speciesId: 'mudfist', level: 9 }, { speciesId: 'wirewhisk', level: 11 }],
      party: [{ uid: '1', level: 40, participated: true, ability: lead.ability }, { uid: '2', level: 12, ability: bench.ability }, { uid: '3', level: 18, ability: sib.ability }],
    }, DATA);
    const theirs = Object.fromEntries(res.exp.map((e) => [String(e.uid), e.amount]));
    assert.deepEqual(Object.fromEntries(ours.totals.map((t) => [t.uid, t.amount])), theirs);
  });
});

describe('Shift windows', () => {
  it('windowLevels: opts.levels > family row > WINDOW_LEVELS; sorted and unique', () => {
    const s = mk('c1', 'sloshkin', 5);
    const w = mk('c2', 'wirewhisk', 5);
    const p = mk('c3', 'prismoth', 5);
    assert.deepEqual(E.windowLevels(s, DATA), [9, 20, 34]);
    assert.deepEqual(E.windowLevels(w, DATA), [4, 8]);
    assert.deepEqual(E.windowLevels(p, DATA), [9, 20, 34], 'family without windows falls back');
    assert.deepEqual(E.windowLevels(w), [9, 20, 34], 'no data');
    assert.deepEqual(E.windowLevels(w, DATA, { tuning: { USE_FAMILY_WINDOWS: false, WINDOW_LEVELS: [30, 10, 10] } }), [10, 30]);
    assert.deepEqual(E.windowLevels(w, DATA, { levels: [7] }), [7]);
    assert.throws(() => E.windowLevels(w, DATA, { levels: [0] }), TypeError);
  });

  it('openWindows / nextWindowLevel / windowSoon follow level, windowsUsed, Still Knot and neverShifts', () => {
    const c = mk('c1', 'sloshkin', 19);
    assert.deepEqual(E.openWindows(c, DATA), [9]);
    assert.equal(E.nextWindowLevel(c, DATA), 20);
    assert.equal(E.windowSoon(c, DATA), true, 'one level before');
    c.level = 17;
    assert.equal(E.windowSoon(c, DATA), false);
    assert.equal(E.windowSoon(c, DATA, { tuning: { PIP_LEAD_LEVELS: 3 } }), true);
    c.level = 34;
    c.windowsUsed = [20];
    assert.deepEqual(E.openWindows(c, DATA), [9, 34]);
    c.stillKnot = true;
    assert.deepEqual(E.openWindows(c, DATA), []);
    assert.equal(E.windowSoon(c, DATA), false);
    const titan = mk('c2', 'stillox', 50);
    assert.deepEqual(E.openWindows(titan, DATA), []);
    assert.equal(E.nextWindowLevel(titan, DATA), null);
    assert.equal(E.nextWindowLevel(mk('c3', 'sloshkin', 60), DATA), null);
    assert.equal(E.canEverShift(titan), true, 'unknown without data');
  });

  it('skipPassedWindows marks points at/below the catch level as used (inclusive tunable)', () => {
    const c = mk('c1', 'sloshkin', 20);
    assert.deepEqual(E.skipPassedWindows(c, DATA), [9, 20]);
    assert.deepEqual(c.windowsUsed, [9, 20]);
    assert.deepEqual(E.skipPassedWindows(c, DATA), []);
    const d = mk('c2', 'sloshkin', 20);
    assert.deepEqual(E.skipPassedWindows(d, DATA, { tuning: { SKIP_WINDOW_AT_CATCH_LEVEL: false } }), [9]);
    const e = mk('c3', 'sloshkin', 3);
    assert.deepEqual(E.skipPassedWindows(e, DATA), []);
  });

  it('detectWindows opens each newly reached point once, pushes the uid once and emits shift:window', () => {
    const w = world();
    const c = mk('c1', 'sloshkin', 8);
    w.party.push(c);
    const { bus, events } = spyBus();
    C.gainExp(c, E.expForLevel('medium-slow', 21) - c.exp, DATA);
    assert.equal(c.level, 21);
    const r = E.detectWindows(w, 'c1', 8, DATA, { bus });
    assert.deepEqual(r, { opened: [9, 20], consumed: [], pending: true });
    assert.deepEqual(w.pendingShifts, ['c1']);
    assert.deepEqual(events, [['shift:window', { uid: 'c1', level: 9, held: false }], ['shift:window', { uid: 'c1', level: 20, held: false }]]);
    const again = E.detectWindows(w, 'c1', 21, DATA, { bus });
    assert.deepEqual(again.opened, []);
    assert.deepEqual(w.pendingShifts, ['c1'], 'never pushed twice');
    assert.equal(events.length, 2);
    assert.deepEqual(validateWorld(w), []);
  });

  it('resolveWindow resolves the lowest open window and keeps the uid pending while another is open', () => {
    const w = world();
    const c = mk('c1', 'sloshkin', 21);
    w.party.push(c);
    E.detectWindows(w, 'c1', 1, DATA);
    assert.equal(E.resolveWindow(w, 'c1', DATA), 9);
    assert.deepEqual(w.pendingShifts, ['c1']);
    assert.equal(E.resolveWindow(w, 'c1', DATA), 20);
    assert.deepEqual(w.pendingShifts, []);
    assert.deepEqual(c.windowsUsed, [9, 20]);
    assert.equal(E.resolveWindow(w, 'c1', DATA), null);
    w.pendingShifts.push('ghost');
    assert.equal(E.resolveWindow(w, 'ghost', DATA), null);
    assert.deepEqual(w.pendingShifts, [], 'an unknown uid is cleaned out');
  });

  it('Still Knot: "consume" uses windows up; "hold" keeps them for when the Knot comes off', () => {
    const w = world();
    const a = mk('c1', 'sloshkin', 22, { heldItem: 'fx-knot' });
    const b = mk('c2', 'sloshkin', 22, { heldItem: 'fx-knot' });
    w.party.push(a, b);
    assert.deepEqual(E.detectWindows(w, 'c1', 5, DATA), { opened: [], consumed: [9, 20], pending: false });
    assert.deepEqual(a.windowsUsed, [9, 20]);
    const hold = { tuning: { STILL_KNOT_MODE: 'hold' } };
    assert.deepEqual(E.detectWindows(w, 'c2', 5, DATA, hold), { opened: [], consumed: [], pending: false });
    assert.deepEqual(b.windowsUsed, []);
    C.setHeldItem(b, null, DATA);
    assert.deepEqual(E.refreshPending(w, 'c2', DATA, hold), { pending: true, changed: true });
    assert.deepEqual(w.pendingShifts, ['c2']);
  });

  it('a stored creature holds its window until it rejoins the party (tunable)', () => {
    const w = world();
    const c = mk('c1', 'sloshkin', 25);
    w.box.push(c);
    const { bus, events } = spyBus();
    const r = E.detectWindows(w, 'c1', 19, DATA, { bus });
    assert.deepEqual(r, { opened: [20], consumed: [], pending: false });
    assert.deepEqual(events, [['shift:window', { uid: 'c1', level: 20, held: true }]]);
    assert.deepEqual(w.pendingShifts, []);
    assert.deepEqual(E.refreshPending(w, 'c1', DATA, { tuning: { HOLD_WINDOWS_IN_BOX: false } }), { pending: true, changed: true });
    assert.deepEqual(E.refreshPending(w, 'c1', DATA), { pending: false, changed: true });
  });

  it('refreshPending removes duplicates and unknown uids; detectWindows on an unknown uid is inert', () => {
    const w = world();
    w.pendingShifts.push('zz', 'zz');
    assert.deepEqual(E.refreshPending(w, 'zz', DATA), { pending: false, changed: true });
    assert.deepEqual(w.pendingShifts, []);
    assert.deepEqual(E.detectWindows(w, 'nobody', 1, DATA), { opened: [], consumed: [], pending: false });
  });

  it('is deterministic: same inputs, same world', () => {
    const run = () => {
      const w = world('DET');
      w.party.push(mk('c1', 'sloshkin', 5), mk('c2', 'wirewhisk', 3));
      for (const c of w.party) {
        const from = c.level;
        C.gainExp(c, 5000, DATA);
        E.detectWindows(w, c.uid, from, DATA);
      }
      return w;
    };
    assert.deepEqual(run(), run());
  });
});
