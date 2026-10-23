// Adversarial tests for lane RULES-CREATURE (js/systems/creature.js, party.js, exp.js), written by
// the lane verifier: cross-process determinism, boundaries, malformed data, huge inputs, every dial,
// serialize/deserialize round trips, the real battle engine end to end, and one regression test
// per bug fixed in verification. Run: node --test test/rules-creature.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../js/systems/party.js';
import * as C from '../js/systems/creature.js';
import * as E from '../js/systems/exp.js';
import { validateWorld, creatureDefaults, STAT_KEYS } from '../js/state/schema.js';
import { createBattle } from '../js/battle/engine.js';
import { foeAi } from '../js/battle/ai.js';
import { DATA as BATTLE_DATA } from './fixtures/battle/data.mjs';
import { DATA, REG, FAMILIES, ITEMS, SPECIES, mk, world, spyBus, makeRng, scenario } from './fixtures/rules-creature.fixture.mjs';
import { MOVES } from '../proto/battle/moves.js';
import { ABILITIES } from '../proto/battle/abilities.js';
import { TYPES } from '../proto/battle/types.js';

const FORM_IDS = Object.keys(SPECIES);
const SHIFTABLE = FORM_IDS.filter((id) => !SPECIES[id].flags?.neverShifts);
const fresh = (speciesId, level, extra = {}) => ({ ...mk('tmp', speciesId, level, extra), uid: '' });

describe('determinism', () => {
  it('the end-to-end scenario is identical in a separate Node process', async () => {
    const here = await scenario('XPROC');
    const fixtureUrl = new URL('./fixtures/rules-creature.fixture.mjs', import.meta.url).href;
    const code = `import(${JSON.stringify(fixtureUrl)}).then(async (m) => process.stdout.write(JSON.stringify(await m.scenario('XPROC'))));`;
    const child = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' }));
    assert.deepEqual(child, JSON.parse(JSON.stringify(here)));
    assert.deepEqual(validateWorld(here.world, REG), []);
  });

  it('two seeds diverge; the same seed twice in one process does not', async () => {
    const a = await scenario('SEED-A');
    const b = await scenario('SEED-A');
    const c = await scenario('SEED-B');
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.world.party.map((x) => x.mark), c.world.party.map((x) => x.mark));
  });

  it('creatures built from one rng still get their own Heartmark placement and Unfixed loop', () => {
    const rng = makeRng('shared');
    const marks = new Set();
    const loops = new Set();
    for (let i = 0; i < 60; i++) {
      const c = C.makeCreature({ uid: `c${i}`, speciesId: 'vagary', level: 30, rng }, DATA);
      marks.add(`${c.mark.x},${c.mark.y}`);
      loops.add(c.typeQueue.join());
    }
    assert.ok(marks.size >= 10, `only ${marks.size} distinct marks from one rng`);
    assert.ok(loops.size >= 10, `only ${loops.size} distinct loops from one rng`);
    // and the placement is a function of (rng seed, uid) only, never of how many creatures came first
    const lone = C.makeCreature({ uid: 'c42', speciesId: 'vagary', level: 30, rng: makeRng('shared') }, DATA);
    const again = C.makeCreature({ uid: 'c42', speciesId: 'vagary', level: 30, rng }, DATA);
    assert.deepEqual(lone.mark, again.mark);
    assert.deepEqual(lone.typeQueue, again.typeQueue);
  });

  it('a catch without a mark draws the same placement makeCreature would for that uid', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 10), DATA);
    const caught = C.serialize(C.makeCreature({ uid: 'c2', speciesId: 'rushling', level: 9 }, DATA));
    delete caught.mark;
    P.applyOutcome(w, { caught }, DATA, makeRng('battle:1'));
    const direct = C.makeCreature({ uid: 'c2', speciesId: 'rushling', level: 9, rng: makeRng('battle:1') }, DATA);
    assert.deepEqual(P.findCreature(w, 'c2').c.mark, direct.mark);
  });
});

describe('boundaries', () => {
  it('level 1 and the level cap: thresholds, bands, gainExp at the cap', () => {
    for (const g of Object.keys(E.DEFAULTS.GROWTH_CURVES)) {
      assert.equal(E.expForLevel(g, 1), 0);
      assert.equal(E.levelFromExp(g, 0), 1);
      assert.equal(E.levelFromExp(g, -50), 1);
      const cap = E.expForLevel(g, 100);
      assert.equal(E.levelFromExp(g, cap), 100);
      assert.equal(E.levelFromExp(g, cap - 1), 99);
      assert.equal(E.levelFromExp(g, cap * 10), 100);
      assert.deepEqual(E.expBand(g, 100), [cap, cap]);
      for (let L = 2; L < 100; L++) {
        const [lo, hi] = E.expBand(g, L);
        assert.equal(E.levelFromExp(g, lo), L);
        assert.equal(E.levelFromExp(g, hi), L);
        assert.equal(E.levelFromExp(g, hi + 1), L + 1);
      }
    }
    const top = mk('t', 'sloshkin', 100);
    const r = C.gainExp(top, 1e6, DATA);
    assert.equal(r.gained, 0);
    assert.equal(top.exp, E.expForLevel('medium-slow', 100));
    assert.equal(C.expToNext(top, DATA), 0);
    const one = mk('o', 'sloshkin', 1);
    assert.equal(one.exp, 0);
    assert.ok(one.moves.length >= 1);
  });

  it('exactly one EXP short of a level does not level; the exact threshold does', () => {
    const c = mk('b', 'sloshkin', 10);
    const need = C.expToNext(c, DATA);
    assert.equal(C.gainExp(c, need - 1, DATA).to, 10);
    assert.equal(C.gainExp(c, 1, DATA).to, 11);
    assert.equal(c.exp, E.expForLevel('medium-slow', 11));
  });

  it('catch-up multiplier table edges and the cap; damping edge at curve + DAMP_START', () => {
    const cases = [[0, 1], [4, 1], [5, 1.5], [9, 1.5], [10, 2], [14, 2], [15, 2.5], [19, 2.5], [20, 3], [99, 3]];
    for (const [under, m] of cases) assert.equal(E.catchUpMult(50 - under, 50), m, `${under} under`);
    assert.equal(E.catchUpMult(70, 50), 1, 'over the curve is never boosted');
    assert.equal(E.dampMult(60, 50, 'rematch'), 1, 'curve + 10 is not damped');
    assert.equal(E.dampMult(61, 50, 'rematch'), 0.5);
    for (const src of ['route', 'story', 'spire', 'duel', undefined, null]) assert.equal(E.dampMult(99, 50, src), 1);
  });

  it('windows at exactly the catch level follow SKIP_WINDOW_AT_CATCH_LEVEL; PIP_LEAD_LEVELS 0 shows no pip', () => {
    const at = mk('w', 'sloshkin', 20);
    assert.deepEqual(E.skipPassedWindows(at, DATA), [9, 20]);
    const keep = mk('w', 'sloshkin', 20);
    assert.deepEqual(E.skipPassedWindows(keep, DATA, { tuning: { SKIP_WINDOW_AT_CATCH_LEVEL: false } }), [9]);
    assert.deepEqual(E.openWindows(keep, DATA), [20]);
    const near = mk('n', 'sloshkin', 19);
    assert.equal(E.windowSoon(near, DATA), true);
    assert.equal(E.windowSoon(near, DATA, { tuning: { PIP_LEAD_LEVELS: 0 } }), false);
    assert.equal(E.windowSoon(mk('n', 'sloshkin', 18), DATA), false);
  });

  it('PARTY_MAX 1, BOX_CAPACITY 0 and YARD_CAP 0', () => {
    const tuning = Object.freeze({ PARTY_MAX: 1, BOX_CAPACITY: 0, YARD_CAP: 0 });
    const w = world();
    assert.equal(P.addCreature(w, fresh('sloshkin', 5), DATA, { tuning }).where, 'party');
    assert.deepEqual(P.addCreature(w, fresh('sloshkin', 5), DATA, { tuning }), { ok: false, reason: 'full' });
    assert.equal(P.toBox(w, 'c1', DATA, { tuning }).reason, 'last');
    const w2 = world();
    P.addCreature(w2, fresh('sloshkin', 5), DATA);
    P.addCreature(w2, fresh('tossup', 5), DATA, { to: 'box' });
    assert.equal(P.toYard(w2, 'c2', { tuning }).reason, 'yard-full');
    const award = E.computeAward({ kind: 'wild', defeated: [{ expYield: 100, level: 10 }], party: [{ uid: 'a', level: 5, participated: true }], yard: [{ uid: 'y', level: 1 }] }, null, { tuning });
    assert.deepEqual(award.totals.map((t) => t.uid), ['a']);
  });

  it('a level-0, empty or fainted-only battle gives nothing and never throws', () => {
    assert.deepEqual(E.computeAward({ kind: 'wild', defeated: [], party: [] }), { lines: [], totals: [] });
    assert.deepEqual(E.computeAward({ kind: 'wild', defeated: [{ expYield: 0, level: 50 }], party: [{ uid: 'a', level: 5, participated: true }] }).totals, []);
    assert.deepEqual(E.computeAward({ kind: 'wild', defeated: [{ expYield: 100, level: 50 }], party: [{ uid: 'a', level: 5, participated: true, fainted: true }] }).totals, []);
  });
});

describe('malformed data', () => {
  it('rejects non-object data, unknown ids and malformed creature options with typed errors', () => {
    for (const bad of [null, undefined, 3, 'tables']) assert.throws(() => E.dataLookup(bad), TypeError);
    assert.throws(() => C.makeCreature({ uid: 'x', speciesId: 'nope' }, DATA), RangeError);
    assert.throws(() => C.makeCreature({ uid: 'x', speciesId: 'sloshkin', moves: 'tap' }, DATA), TypeError);
    assert.throws(() => C.makeCreature({ uid: 'x', speciesId: 'sloshkin', moves: [3] }, DATA), TypeError);
    assert.throws(() => C.makeCreature({ uid: 'x', speciesId: 'sloshkin', moves: ['no-such-move'] }, DATA), RangeError);
    assert.throws(() => C.makeCreature({ uid: 'x', speciesId: 'sloshkin', heldItem: 7 }, DATA), TypeError);
    assert.throws(() => C.makeCreature({ uid: 7, speciesId: 'sloshkin' }, DATA), TypeError);
    assert.throws(() => C.setHeldItem(mk('x', 'sloshkin', 5), { id: 'fx-knot' }, DATA), TypeError);
    assert.throws(() => C.shiftTo(mk('x', 'sloshkin', 5), 'skeinwing', DATA, 'chaos'), RangeError);
    assert.throws(() => C.shiftTo(mk('x', 'sloshkin', 5), 'nope', DATA, 'flux'), RangeError);
  });

  it('a species row with no learnset gets FALLBACK_MOVE, else no move at all (never a hard-coded id)', () => {
    const bare = { ...SPECIES.sloshkin, id: 'bare', learnset: undefined, heartmark: null };
    const data = { species: { ...SPECIES, bare }, moves: MOVES, abilities: ABILITIES, types: TYPES };
    assert.deepEqual(C.makeCreature({ uid: 'b', speciesId: 'bare' }, data).moves, []);
    const fb = C.makeCreature({ uid: 'b', speciesId: 'bare', tuning: { FALLBACK_MOVE: 'tap' } }, data);
    assert.deepEqual(fb.moves.map((m) => m.id), ['tap']);
  });

  it('computeAward rejects non-finite levels and bad entries instead of silently awarding 0 or NaN', () => {
    const ok = { kind: 'wild', defeated: [{ expYield: 50, level: 10 }], party: [{ uid: 'a', level: 5, participated: true }] };
    assert.throws(() => E.computeAward({ ...ok, party: [{ uid: 'a', level: NaN }] }), TypeError);
    assert.throws(() => E.computeAward({ ...ok, party: [{ uid: 'a', level: '5' }] }), TypeError);
    assert.throws(() => E.computeAward({ ...ok, party: [{ level: 5 }] }), TypeError);
    assert.throws(() => E.computeAward({ ...ok, defeated: [{ expYield: 50 }] }), TypeError);
    assert.throws(() => E.computeAward({ ...ok, defeated: [null] }), TypeError);
    assert.throws(() => E.computeAward({ ...ok, curveLevel: 'ten' }), TypeError);
    assert.throws(() => E.computeAward({ ...ok, defeated: [{ speciesId: 'mudfist', level: 3 }] }), TypeError, 'needs data for speciesId');
    assert.throws(() => E.computeAward({ ...ok, defeated: [{ speciesId: 'nope', level: 3 }] }, DATA), RangeError);
    assert.throws(() => E.computeAward(null), TypeError);
  });

  it('tuning values outside their bounds are refused per key; checkTuning lists every problem', () => {
    const bad = { PARTY_MAX: 0, MAX_LEVEL: 101, STAT_FLOOR: { drift: -0.1 }, WINDOW_LEVELS: [0], STILL_KNOT_MODE: 'maybe', TYPO_KEY: 1, GROWTH_CURVES: { fast: { num: [1, 2], den: 1 } } };
    const problems = P.checkTuning(bad);
    for (const needle of ['TYPO_KEY', 'PARTY_MAX', 'MAX_LEVEL']) assert.ok(problems.some((p) => p.includes(needle)), needle);
    assert.throws(() => E.tuningOf({ WINDOW_LEVELS: [0] }), TypeError);
    assert.throws(() => E.tuningOf({ STILL_KNOT_MODE: 'maybe' }), TypeError);
    assert.throws(() => E.tuningOf({ GROWTH_CURVES: { fast: { num: [1, 2], den: 1 } } }), TypeError);
    assert.throws(() => C.tuningOf({ STAT_FLOOR: { drift: -0.1 } }), TypeError);
    assert.deepEqual(P.checkTuning(Object.freeze({ BENCH_SHARE: 0.5, MENDS_PER_BATTLE: 2, BOX_CAPACITY: 30 })), []);
  });

  it('deserialize self-heals hostile records (wrong types, junk, prototype keys) into schema-valid creatures', () => {
    const good = C.serialize(mk('h', 'vagary', 40));
    const hostile = {
      ...good,
      level: '40', exp: 'lots', hp: Infinity, bond: 99, mends: -1, trained: { hp: 1e9, atk: -5, def: 'x' },
      moves: [{ id: 'tap', pp: 1e9, maxPp: 3 }, { id: 'tap', pp: 1 }, null, { pp: 2 }],
      memory: ['a', 3, 'a', null], shiftlog: [1, 2], typeQueue: [5, null], typeIndex: -7,
      status: { kind: 'trap', turns: 2 }, heldItem: 42, stillKnot: 'yes', mark: { x: 1.5, y: 'a' },
      windowsUsed: [20, 'x', -1, 20, 9], caughtDay: 1.5, caughtMap: 3, wild: 'true', extra: 'drop me',
    };
    Object.defineProperty(hostile, '__proto__', { value: { polluted: true }, enumerable: true, configurable: true, writable: true });
    const d = C.deserialize(hostile, DATA);
    assert.deepEqual(Object.keys(d).sort(), Object.keys(creatureDefaults()).sort());
    const w = world();
    w.party.push(d);
    assert.deepEqual(validateWorld(w, REG), []);
    assert.equal(d.typeQueue, null, 'a loop with no string types is dropped');
    assert.deepEqual(d.types, SPECIES.vagary.types);
    assert.deepEqual(d.shiftlog, ['vagary']);
    assert.equal(d.stillKnot, false);
    assert.equal(d.heldItem, null);
    assert.deepEqual(d.windowsUsed, [9, 20]);
    assert.deepEqual(d.moves, [{ id: 'tap', pp: 3, maxPp: 3 }]);
    assert.equal(({}).polluted, undefined);
  });

  it('deserialize reads a missing level off the EXP and wraps an out-of-range Unfixed position', () => {
    const c = C.serialize(mk('x', 'sloshkin', 30));
    delete c.level;
    assert.equal(C.deserialize(c, DATA).level, 30);
    const v = C.serialize(mk('v', 'vagary', 40));
    v.typeIndex = 6;
    v.types = [v.typeQueue[2]];
    const d = C.deserialize(v, DATA);
    assert.equal(d.typeIndex, 2, '6 mod 4');
    assert.deepEqual(d.types, SPECIES.vagary.types, 'record keeps the form types; the loop position says the rest');
    assert.deepEqual(C.currentTypes(d), [v.typeQueue[2]]);
  });

  it('deserialize gives a move-less record the fallback move and derives stillKnot from the held item', () => {
    const c = C.serialize(mk('x', 'sloshkin', 5));
    c.moves = [];
    assert.equal(C.deserialize(c, DATA).moves.length, 1);
    const knot = { ...C.serialize(mk('k', 'sloshkin', 5)), heldItem: 'fx-knot', stillKnot: false };
    assert.equal(C.deserialize(knot, DATA).stillKnot, true, 'a known item row decides');
    const charm = { ...knot, heldItem: 'fx-charm', stillKnot: true };
    assert.equal(C.deserialize(charm, DATA).stillKnot, false);
    const unknownItem = { ...knot, heldItem: 'mystery', stillKnot: true };
    assert.equal(C.deserialize(unknownItem, DATA).stillKnot, true, 'no item row: trust the record');
  });

  it('applyOutcome ignores junk engine copies and throws on an unknown catch before writing anything', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 10), DATA);
    const before = JSON.stringify(w);
    assert.throws(() => P.applyOutcome(w, {
      party: [{ uid: 'c1', hp: 3 }],
      exp: [{ uid: 'c1', amount: 9999 }],
      caught: { ...C.serialize(mk('x', 'sloshkin', 5)), speciesId: 'no-such-form' },
    }, DATA), RangeError);
    assert.equal(JSON.stringify(w), before, 'nothing written');
    assert.throws(() => P.applyOutcome(w, { party: [], defeated: [{ level: 'x', expYield: 3 }] }, DATA), TypeError);
    assert.equal(JSON.stringify(w), before);
    const r = P.applyOutcome(w, { party: [{ uid: 'c1', hp: NaN, moves: 'x', status: 'burn' }, { uid: 5 }, 'junk', { uid: 'c1', hp: 0 }] }, DATA);
    assert.equal(w.party[0].hp, w.party[0].stats.hp, 'a NaN HP is ignored; the duplicate copy is ignored');
    assert.equal(w.party[0].status, null);
    assert.deepEqual(r.awards, []);
    assert.deepEqual(validateWorld(w), []);
  });

  it('dataLookup over mutable plain tables sees rows added later', () => {
    const families = FAMILIES.map((f) => ({ ...f }));
    const data = { species: SPECIES, moves: MOVES, abilities: ABILITIES, types: TYPES, families, items: [...ITEMS] };
    const c = mk('m', 'sedgehare', 5, { data });
    assert.deepEqual(E.windowLevels(c, data), E.DEFAULTS.WINDOW_LEVELS);
    const fam = families.find((f) => f.id === c.familyId);
    families.splice(families.indexOf(fam), 1, { ...fam, windows: [6, 7] });
    data.families = families.slice();
    assert.deepEqual(E.windowLevels(c, data), [6, 7], 'a replaced table is re-indexed');
    data.items.push({ id: 'late-knot', blocksShifts: true });
    assert.equal(C.setHeldItem(c, 'late-knot', data).prev, null);
    assert.equal(c.stillKnot, true, 'a row pushed into an array table is found');
  });

  it('a mutable tuning object is re-read on every call (no stale cache)', () => {
    const tuning = { BENCH_SHARE: 0.6, PARTY_MAX: 6, MENDS_PER_BATTLE: 3 };
    assert.equal(E.tuningOf(tuning).BENCH_SHARE, 0.6);
    tuning.BENCH_SHARE = 0.1;
    tuning.PARTY_MAX = 2;
    tuning.MENDS_PER_BATTLE = 1;
    assert.equal(E.tuningOf(tuning).BENCH_SHARE, 0.1);
    assert.equal(P.tuningOf(tuning).PARTY_MAX, 2);
    assert.equal(C.tuningOf(tuning).MENDS_PER_BATTLE, 1);
    const frozen = Object.freeze({ BENCH_SHARE: 0.4 });
    assert.equal(E.tuningOf(frozen), E.tuningOf(frozen), 'frozen overrides are cached by identity');
  });
});

describe('huge inputs', () => {
  it('gainExp with astronomically large amounts caps at the level cap and stays an integer', () => {
    for (const amount of [1e15, Number.MAX_SAFE_INTEGER, 1e300, Number.MAX_VALUE]) {
      const c = mk('h', 'tossup', 5);
      const r = C.gainExp(c, amount, DATA);
      assert.equal(c.level, 100);
      assert.ok(Number.isSafeInteger(c.exp));
      assert.equal(r.to, 100);
      assert.ok(c.moves.length <= 4);
    }
    assert.throws(() => C.gainExp(mk('h', 'tossup', 5), Infinity, DATA), TypeError);
  });

  it('clamps absurd construction options (level, bond, trained)', () => {
    const c = C.makeCreature({ uid: 'x', speciesId: 'sloshkin', level: 1e9, bond: 1e9, trained: { hp: 1e12, atk: -1e12 } }, DATA);
    assert.equal(c.level, 100);
    assert.equal(c.bond, 5);
    assert.equal(c.trained.hp, 252);
    assert.equal(c.trained.atk, 0);
    const low = C.makeCreature({ uid: 'y', speciesId: 'sloshkin', level: -1e9 }, DATA);
    assert.equal(low.level, 1);
  });

  it('computeAward over 5,000 foes and a full party stays fast, integer and order-stable', () => {
    const defeated = Array.from({ length: 5000 }, (_, i) => ({ expYield: 10 + (i % 200), level: 1 + (i % 100) }));
    const party = Array.from({ length: 6 }, (_, i) => ({ uid: `c${i + 1}`, level: 5 + i * 10, participated: i < 2 }));
    const t0 = Date.now();
    const a = E.computeAward({ kind: 'trainer', source: 'rematch', curveLevel: 40, defeated, party, yard: [{ uid: 'y1', level: 2 }] });
    assert.ok(Date.now() - t0 < 2000);
    assert.deepEqual(a.totals.map((t) => t.uid), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'y1']);
    for (const t of a.totals) assert.ok(Number.isSafeInteger(t.amount) && t.amount > 0);
  });

  it('a box of 500 creatures, a huge EXP batch and uid collisions after an import', () => {
    const w = world();
    const tuning = Object.freeze({ BOX_CAPACITY: 600 });
    for (let i = 0; i < 506; i++) P.addCreature(w, fresh(i % 2 ? 'tossup' : 'sloshkin', 3 + (i % 40)), DATA, { tuning });
    assert.equal(w.party.length, 6);
    assert.equal(w.box.length, 500);
    // an imported save with uids ahead of the counter
    w.box.push({ ...C.serialize(w.box[0]), uid: `c${Number(String(w.flags['sys.uid'] ?? 0)) + 1}` });
    const uid = P.nextUid(w);
    assert.equal(P.findCreature(w, uid), null);
    const r = P.applyOutcome(w, { exp: w.party.map((c) => ({ uid: c.uid, amount: 1e12 })) }, DATA, null, { tuning });
    assert.equal(r.levelUps.length, 6);
    assert.ok(w.party.every((c) => c.level === 100));
    w.box.pop();
    assert.deepEqual(validateWorld(w), []);
  });

  it('nickname sanitizes megabyte input and control characters', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 5), DATA);
    assert.equal(P.nickname(w, 'c1', 'x'.repeat(1 << 20)).reason, 'too-long');
    assert.equal(P.nickname(w, 'c1', '\u0000\u0007 \n\t').reason, 'empty');
    assert.deepEqual(P.nickname(w, 'c1', ' Pud\u0000dle  Jr '), { ok: true, nickname: 'Puddle Jr' });
  });
});

describe('every dial', () => {
  it('shiftTo applies the per-stat floor of every dial (and a custom one) to every form pair', () => {
    const tuning = Object.freeze({ STAT_FLOOR: { drift: 0.1, flux: 0.2, freefall: null, custom: 0.5, none: 0 } });
    for (const dial of ['drift', 'flux', 'freefall', 'custom', 'none']) {
      const f = tuning.STAT_FLOOR[dial];
      for (const fromId of SHIFTABLE) {
        for (const toId of FORM_IDS) {
          const c = mk('d', fromId, 30);
          const before = { ...c.base };
          const r = C.shiftTo(c, toId, DATA, dial, { tuning });
          for (const k of STAT_KEYS) {
            const target = SPECIES[toId].base[k];
            if (f === null) assert.equal(c.base[k], target);
            else {
              // exact integer bound: newBase >= old·(1−f), and never above the target unless floored
              const min = Math.ceil(Math.round(before[k] * (1 - f) * 1e6) / 1e6);
              assert.equal(c.base[k], Math.max(target, min), `${dial} ${fromId}->${toId} ${k}`);
              assert.ok(c.base[k] * 1 >= before[k] * (1 - f) - 1e-9);
            }
          }
          assert.equal(r.floored.length, STAT_KEYS.filter((k) => c.base[k] !== SPECIES[toId].base[k]).length);
          assert.equal(c.level, 30);
        }
      }
    }
  });

  it('a chain of Shifts on Drift never drops any stat more than 10% per step, and Freefall can fall all the way', () => {
    const order = ['skeinwing', 'puddlepip', 'tossup', 'sloshkin', 'puddlepip'].filter((id) => SPECIES[id]);
    const drift = mk('c', 'brinelance', 40);
    for (const id of order) {
      const prev = { ...drift.base };
      C.shiftTo(drift, id, DATA, 'drift');
      for (const k of STAT_KEYS) assert.ok(drift.base[k] >= Math.ceil(prev[k] * 0.9 - 1e-9));
    }
    const ff = mk('c', 'brinelance', 40);
    for (const id of order) C.shiftTo(ff, id, DATA, 'freefall');
    assert.deepEqual(ff.base, { ...SPECIES[order[order.length - 1]].base });
    assert.equal(ff.shiftlog.length, order.length + 1);
    assert.equal(ff.shiftCount, 0, 'Shift-stream draws are counted by systems/forecast');
  });

  it('every dial keeps what a Shift never touches (rules §2.6), on world creatures through a round trip', () => {
    for (const dial of ['drift', 'flux', 'freefall']) {
      const c = mk('k', 'sloshkin', 25, { heldItem: 'fx-charm', bond: 3, trained: { atk: 100 }, nickname: 'PUDDLE' });
      C.pinHeartmarkTechnique(c, c.moves[0].id, DATA, { force: true });
      const keep = { level: c.level, exp: c.exp, heldItem: c.heldItem, nickname: c.nickname, bond: c.bond, trained: { ...c.trained }, heartmark: c.heartmark, mark: { ...c.mark }, familyId: c.familyId };
      for (const id of ['tossup', 'brinelance', 'skeinwing', 'vagary']) {
        C.shiftTo(c, id, DATA, dial, { rng: makeRng(dial) });
        const back = C.deserialize(JSON.parse(JSON.stringify(C.serialize(c))), DATA);
        for (const [k, v] of Object.entries(keep)) assert.deepEqual(back[k], v, `${dial} ${id} ${k}`);
        assert.ok(back.moves.some((m) => m.id === keep.heartmark));
      }
    }
  });
});

describe('serialize / deserialize round trips', () => {
  it('random sequences of operations always round-trip exactly and stay schema-valid', () => {
    const rng = makeRng('roundtrip');
    const ops = ['exp', 'shift', 'learn', 'held', 'bond', 'status', 'hurt', 'heal', 'forget', 'pp'];
    for (let n = 0; n < 60; n++) {
      const c = C.makeCreature({ uid: `c${n}`, speciesId: rng.pick(FORM_IDS), level: rng.int(1, 60), rng }, DATA);
      for (let step = 0; step < 25; step++) {
        const op = rng.pick(ops);
        if (op === 'exp') C.gainExp(c, rng.int(0, 5000), DATA);
        else if (op === 'shift' && !SPECIES[c.speciesId].flags?.neverShifts) C.shiftTo(c, rng.pick(FORM_IDS), DATA, rng.pick(['drift', 'flux', 'freefall']), { rng });
        else if (op === 'learn') C.learnMove(c, rng.pick(Object.keys(MOVES)), DATA, { replaceIndex: rng.int(0, 3) });
        else if (op === 'held') C.setHeldItem(c, rng.pick(['fx-knot', 'fx-charm', null]), DATA);
        else if (op === 'bond') C.addBond(c, rng.int(-3, 3));
        else if (op === 'status') c.status = rng.pick([null, { kind: 'burn', turns: 2 }, { kind: 'numb', turns: 0 }]);
        else if (op === 'hurt') c.hp = rng.int(0, c.stats.hp);
        else if (op === 'heal') C.healFull(c);
        else if (op === 'forget') C.forgetMove(c, rng.int(0, 3));
        else if (op === 'pp') c.moves.forEach((m) => { m.pp = rng.int(0, m.maxPp); });
        const json = JSON.parse(JSON.stringify(C.serialize(c)));
        const back = C.deserialize(json, DATA);
        assert.deepEqual(back, C.serialize(c), `creature ${n} step ${step} op ${op}`);
        assert.deepEqual(C.deserialize(C.serialize(back), DATA), back, 'idempotent');
      }
      const w = world();
      w.party.push(C.deserialize(C.serialize(c), REG));
      assert.deepEqual(validateWorld(w, REG), [], `creature ${n}`);
    }
  });

  it('a whole world survives JSON and party.syncPending after a battle, a catch and Shifts', async () => {
    const r = await scenario('WORLD-TRIP');
    const w = JSON.parse(JSON.stringify(r.world));
    const res = P.syncPending(w, DATA);
    assert.equal(res.changed, false, 'pendingShifts was already in line');
    assert.deepEqual(w.pendingShifts, r.pending);
    assert.deepEqual(validateWorld(w, REG), []);
    w.pendingShifts.push('ghost', w.pendingShifts[0]);
    assert.equal(P.syncPending(w, DATA).changed, true);
    assert.deepEqual(w.pendingShifts, r.pending);
  });
});

describe('the real battle engine, end to end', () => {
  /** A seeded wild battle on engine copies; the lead is strong enough to win without switching. */
  function battle() {
    const w = world('E2E');
    P.giveCreature(w, { speciesId: 'sloshkin', level: 19 }, DATA, makeRng('g1'));
    P.giveCreature(w, { speciesId: 'scrapling', level: 6 }, DATA, makeRng('g2'));
    P.giveCreature(w, { speciesId: 'tossup', level: 4 }, DATA, makeRng('g3'));
    const copies = w.party.map((c) => C.serialize(c));
    const foe = C.serialize(C.makeCreature({ uid: 'f1', speciesId: 'mudfist', level: 6 }, DATA));
    const b = createBattle({ sides: [{ party: copies }, { party: [foe] }], kind: 'wild', data: BATTLE_DATA, dial: 'flux', rng: makeRng('e2e-b'), curveLevel: 16, foeAi });
    for (let n = 0; n < 100 && !b.result().ended; n++) b.submit([{ type: 'move', move: 0 }]);
    return { w, copies, res: b.result() };
  }

  it('applyOutcome awards exactly the EXP the engine announced, levels once, and leaves a valid world', () => {
    const { w, copies, res } = battle();
    assert.equal(res.outcome, 'win');
    const levelsBefore = Object.fromEntries(w.party.map((c) => [c.uid, c.level]));
    const out = P.applyOutcome(w, { ...res, party: copies, defeated: [{ speciesId: 'mudfist', level: 6 }], participants: ['c1'], kind: 'wild', curveLevel: 16 }, DATA);
    assert.deepEqual(out.awards, res.exp.map((e) => ({ uid: e.uid, amount: e.amount })));
    for (const e of res.exp) {
      const c = P.findCreature(w, e.uid).c;
      assert.equal(c.level, e.to, `${e.uid}: levelled once, to the engine's level`);
      assert.equal(e.from, levelsBefore[e.uid]);
      const copy = copies.find((x) => x.uid === e.uid);
      assert.equal(c.exp, copy.exp, `${e.uid}: same EXP as the engine copy`);
    }
    assert.deepEqual(validateWorld(w, REG), []);
  });

  it('the fallback path (engine EXP as given) lands on the same world', () => {
    const a = battle();
    const b = battle();
    P.applyOutcome(a.w, { ...a.res, party: a.copies, defeated: [{ speciesId: 'mudfist', level: 6 }], participants: ['c1'], kind: 'wild', curveLevel: 16 }, DATA);
    P.applyOutcome(b.w, { ...b.res, party: b.copies }, DATA);
    assert.deepEqual(a.w, b.w);
  });
});

describe('regressions fixed in verification', () => {
  it('addCreature replaces a non-string uid instead of storing it', () => {
    const w = world();
    for (const uid of [5, {}, null, '']) {
      const r = P.addCreature(w, { ...fresh('sloshkin', 5), uid }, DATA);
      assert.equal(typeof r.uid, 'string');
      assert.match(r.uid, /^c\d+$/);
    }
    assert.deepEqual(validateWorld(w), []);
  });

  it('addCreature normalizes the record (content checked, an in-battle Unfixed type reset)', () => {
    const w = world();
    assert.throws(() => P.addCreature(w, { ...fresh('sloshkin', 5), speciesId: 'nope' }, DATA), RangeError);
    assert.equal(w.party.length, 0);
    const v = mk('v', 'vagary', 40);
    v.typeIndex = 3;
    v.types = [v.typeQueue[3]];
    P.addCreature(w, v, DATA);
    assert.deepEqual(w.party[0].types, SPECIES.vagary.types);
    assert.equal(w.party[0].typeIndex, 3);
  });

  it('HP comes back as the engine copy\'s ratio when the engine levelled its copy', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 10), DATA);
    const copy = C.serialize(w.party[0]);
    const need = C.expToNext(copy, DATA);
    C.gainExp(copy, need, DATA); // the engine levels its copy in battle
    copy.hp = Math.floor(copy.stats.hp / 2);
    P.applyOutcome(w, { party: [copy], exp: [{ uid: copy.uid, amount: need }] }, DATA);
    assert.equal(w.party[0].level, copy.level);
    assert.equal(w.party[0].stats.hp, copy.stats.hp);
    assert.equal(w.party[0].hp, copy.hp, 'not drifted by a clamp against the pre-level max HP');
  });

  it('the PP of a move learned on a post-battle level-up is copied from the engine copy', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 4, { moves: ['tap'], heartmark: null }), DATA);
    const copy = C.serialize(w.party[0]);
    const need = E.expForLevel('medium-slow', 17) - copy.exp;
    const r = C.gainExp(copy, need, DATA);
    assert.ok(r.learned.length > 0);
    for (const m of copy.moves) m.pp = 1;
    P.applyOutcome(w, { party: [copy], exp: [{ uid: copy.uid, amount: need }] }, DATA);
    assert.deepEqual(w.party[0].moves.map((m) => [m.id, m.pp]), copy.moves.map((m) => [m.id, 1]));
  });

  it('fainted for the EXP split is read from the engine copy at the end of the battle', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 10), DATA);
    P.addCreature(w, fresh('tossup', 10), DATA);
    const copies = w.party.map((c) => C.serialize(c));
    copies[1].hp = 0;
    const r = P.applyOutcome(w, { party: copies, defeated: [{ speciesId: 'mudfist', level: 10 }], participants: ['c1'] }, DATA);
    assert.deepEqual(r.awards.map((a) => a.uid), ['c1']);
    assert.equal(w.party[1].hp, 0);
  });

  it('damping rounds in the engine\'s order for any DAMP_FACTOR', () => {
    const tuning = Object.freeze({ DAMP_FACTOR: 0.3, BENCH_SHARE: 0.7 });
    for (let lvl = 1; lvl <= 60; lvl++) {
      const input = { kind: 'trainer', source: 'rematch', curveLevel: 10, defeated: [{ expYield: 37 + lvl, level: lvl }], party: [{ uid: 'a', level: 40, participated: true }, { uid: 'b', level: 45 }] };
      const base = Math.floor(((37 + lvl) * lvl) / 7) * 1.5;
      const want = [Math.floor(Math.floor(base) * 0.3), Math.floor(Math.floor(base * 0.7) * 0.3)];
      const got = E.computeAward(input, null, { tuning }).lines.map((l) => l.amount);
      assert.deepEqual(got, want.filter((x) => x > 0), `foe level ${lvl}`);
    }
  });

  it('party.setHeldItem hides an open window under a Still Knot and restores it when the Knot comes off', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 5), DATA);
    P.giveExp(w, 'c1', E.expForLevel('medium-slow', 9) - w.party[0].exp, DATA);
    assert.deepEqual(w.pendingShifts, ['c1']);
    const { bus, events } = spyBus();
    const on = P.setHeldItem(w, 'c1', 'fx-knot', DATA, { bus });
    assert.deepEqual(on, { ok: true, prev: null, stillKnot: true, pending: false });
    assert.deepEqual(w.pendingShifts, []);
    assert.deepEqual(events, [['party:changed', { reason: 'held', uid: 'c1', item: 'fx-knot' }]]);
    // a window reached under the Knot is spent ('consume', GDD-00: "spends windows unused while held")
    P.giveExp(w, 'c1', E.expForLevel('medium-slow', 20) - w.party[0].exp, DATA);
    assert.deepEqual(w.party[0].windowsUsed, [20]);
    const off = P.setHeldItem(w, 'c1', null, DATA);
    assert.equal(off.prev, 'fx-knot');
    assert.equal(off.pending, true, 'the window open before the Knot comes back');
    assert.deepEqual(E.openWindows(w.party[0], DATA), [9]);
    assert.deepEqual(P.setHeldItem(w, 'nobody', null, DATA), { ok: false, reason: 'unknown' });
    assert.deepEqual(validateWorld(w), []);
  });

  it('release clears the creature\'s auto-anchor preset through systems/settings', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 5), DATA);
    P.addCreature(w, fresh('sloshkin', 5), DATA);
    w.settings.autoAnchor = { c1: 'auto-up', c2: 'auto-anchor' };
    const { bus, events } = spyBus();
    assert.equal(P.release(w, 'c2', DATA, { bus }).ok, true);
    assert.deepEqual(w.settings.autoAnchor, { c1: 'auto-up' });
    assert.ok(events.some(([e]) => e === 'settings:changed'));
    assert.deepEqual(validateWorld(w), []);
  });

  it('giveCreature builds and adds a gift from a script-style spec', () => {
    const w = world();
    const r = P.giveCreature(w, { species: 'sloshkin', level: 5, nick: 'PUDDLE' }, DATA, makeRng('gift'));
    assert.equal(r.ok, true);
    const c = P.findCreature(w, r.uid).c;
    assert.equal(c.nickname, 'PUDDLE');
    assert.equal(c.wild, false);
    assert.deepEqual(c.mark, C.makeCreature({ uid: r.uid, speciesId: 'sloshkin', rng: makeRng('gift') }, DATA).mark);
    assert.throws(() => P.giveCreature(w, { level: 5 }, DATA), TypeError);
    assert.throws(() => P.giveCreature(w, { species: 'sloshkin' }, DATA), TypeError);
    assert.throws(() => P.giveCreature(w, { species: 'nope', level: 5 }, DATA), RangeError);
    assert.deepEqual(validateWorld(w, REG), []);
  });

  it('a Shift onto a form with another growth curve keeps the creature on its own curve', () => {
    for (const [from, to] of [['sloshkin', 'tossup'], ['tossup', 'brinelance'], ['scrapling', 'vesperay'], ['brinelance', 'mudfist']]) {
      const c = mk('g', from, 30);
      const exp0 = c.exp;
      C.shiftTo(c, to, DATA, 'freefall');
      assert.equal(C.growthOf(c, DATA), SPECIES[from].growth);
      assert.equal(C.gainExp(c, 1, DATA).to, 30, `${from}->${to}: one EXP never re-levels`);
      assert.equal(c.exp, exp0 + 1);
      assert.equal(C.expToNext(c, DATA), E.expForLevel(SPECIES[from].growth, 31) - c.exp);
      const back = C.deserialize(JSON.parse(JSON.stringify(C.serialize(c))), DATA);
      assert.equal(back.exp, c.exp, `${from}->${to}: a load never re-clamps EXP`);
      assert.equal(back.level, 30);
    }
    // a first form missing from the data falls back to the current form's curve
    const lost = mk('l', 'sloshkin', 10);
    lost.shiftlog = ['retired-form', 'sloshkin'];
    assert.equal(C.growthOf(lost, DATA), 'medium-slow');
  });

  it('refreshPending keeps one copy of a uid that should stay pending', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 5), DATA);
    P.giveExp(w, 'c1', E.expForLevel('medium-slow', 9) - w.party[0].exp, DATA);
    w.pendingShifts.push('c1', 'c1');
    assert.deepEqual(E.refreshPending(w, 'c1', DATA), { pending: true, changed: true });
    assert.deepEqual(w.pendingShifts, ['c1']);
    assert.deepEqual(E.refreshPending(w, 'c1', DATA), { pending: true, changed: false });
  });

  it('deserialize drops Memory ids that are not moves', () => {
    const c = { ...C.serialize(mk('m', 'sloshkin', 5)), memory: ['tap', 'not-a-move', 'tap'] };
    assert.deepEqual(C.deserialize(c, DATA).memory, ['tap']);
  });

  it('heal lists each uid once', () => {
    const w = world();
    P.addCreature(w, fresh('sloshkin', 5), DATA);
    assert.deepEqual(P.heal(w, { uids: ['c1', 'c1', 'ghost'] }).healed, ['c1']);
  });
});
