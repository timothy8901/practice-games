// js/battle/effects.js: the effect vocabulary, the move validator, tuning merge, the pure
// formulas under tuning overrides, the type chart builder and Ward checks.
// Run: node --test test/battle.effects.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_KEYS, STATUS_KINDS, MAJOR_STATUS, CHIP_KINDS, WARD_KINDS, DEFAULTS, mergeTuning, moveProblems, isDamaging, isSureHit, isChipMove,
  isSelfTargeting, moveTypeFor, stageMult, critChance, damageRoll, damageFormula, captureOdds, captureBand, catchUpMult, createTypeChart,
  wordFor, wardCheck, wardHeldText, wardIndirect, isWard, strongTypesAgainst, immuneTypesOf,
} from '../js/battle/effects.js';
import { MOVES, TYPE_DATA } from './fixtures/battle/data.mjs';
import { getMove } from './fixtures/battle/helpers.mjs';

const chart = createTypeChart(TYPE_DATA.chart, TYPE_DATA.ordinary);

describe('vocabulary', () => {
  it('EFFECT_KEYS is exactly the 21 keys the architecture names plus `weather` (arena weather), and covers every fixture move', () => {
    assert.deepEqual(EFFECT_KEYS.slice().sort(), ['chance', 'charge', 'clearRaised', 'contact', 'drain', 'evasion', 'flinch', 'guard', 'highCrit', 'multiHit', 'plumbline',
      'popsDecoy', 'queuedType', 'recovery', 'revealMoves', 'scrap', 'selfKo', 'spread', 'stat', 'status', 'sureHit', 'weather'].sort());
    assert.ok(Object.isFrozen(EFFECT_KEYS));
    const used = new Set(MOVES.flatMap((m) => Object.keys(m.effect)));
    for (const k of used) assert.ok(EFFECT_KEYS.includes(k), k);
  });

  it('status, chip and Ward vocabularies', () => {
    assert.deepEqual(STATUS_KINDS, ['burn', 'poison', 'chill', 'numb', 'trap']);
    assert.deepEqual(MAJOR_STATUS, ['burn', 'poison', 'chill', 'numb']);
    assert.deepEqual(CHIP_KINDS, ['poison', 'burn', 'trap']);
    assert.deepEqual(WARD_KINDS, ['strong-only', 'no-status', 'min-power']);
  });

  it('moveProblems: every fixture move is valid; malformed rows are named', () => {
    for (const m of MOVES) assert.deepEqual(moveProblems(m), [], m.id);
    const bad = moveProblems({ id: 'x', category: 'magic', power: -1, accuracy: 120, pp: 0, priority: 0.5, effect: { warp: 1, status: { kind: 'sleep' }, stat: [{ stat: 'luck', target: 'self', stages: 1 }], multiHit: [3, 1], flinch: 2 } });
    for (const want of ['bad category', 'power', 'accuracy', 'pp', 'priority', 'unknown effect key "warp"', 'unknown status kind sleep', 'bad stat entry', 'multiHit', 'flinch']) {
      assert.ok(bad.some((p) => p.includes(want)), `${want}: ${bad.join('; ')}`);
    }
    assert.deepEqual(moveProblems(null), ['move ?: not an object']);
    assert.ok(moveProblems({ id: 'y', category: 'status', power: 0, accuracy: null, pp: 5, priority: 0 })[0].includes('effect must be an object'));
  });

  it('move classification helpers', () => {
    assert.ok(isDamaging(getMove('tap')) && !isDamaging(getMove('settle')));
    assert.ok(isSureHit(getMove('sure-pinch')) && isSureHit(getMove('plumbline')) && !isSureHit(getMove('tap')));
    assert.ok(isChipMove(getMove('corrode')) && isChipMove(getMove('root-knot')) && !isChipMove(getMove('static-net')));
    assert.ok(isSelfTargeting(getMove('settle')) && isSelfTargeting(getMove('vesper-mend')) && !isSelfTargeting(getMove('dazzle')) && !isSelfTargeting(getMove('tap')));
    const tailfall = getMove('tailfall');
    assert.equal(moveTypeFor(tailfall, { typeQueue: ['Star', 'Kiln', 'Moss', 'Bolt'], typeIndex: 3 }), 'Star', 'wraps around the loop');
    assert.equal(moveTypeFor(tailfall, { typeQueue: null }), 'Star');
    assert.equal(moveTypeFor(tailfall, undefined), 'Star');
    assert.equal(moveTypeFor(getMove('tap'), { typeQueue: ['Star', 'Kiln'], typeIndex: 0 }), 'Plain');
  });
});

describe('mergeTuning', () => {
  it('returns the defaults untouched for nothing to merge, and a frozen merged copy otherwise', () => {
    assert.equal(mergeTuning(DEFAULTS, undefined), DEFAULTS);
    assert.equal(mergeTuning(DEFAULTS, {}), DEFAULTS);
    const t = mergeTuning(DEFAULTS, { stab: 2 });
    assert.ok(Object.isFrozen(t));
    assert.equal(t.stab, 2);
    assert.equal(t.critMult, DEFAULTS.critMult);
    assert.equal(DEFAULTS.stab, 1.5, 'defaults never change');
  });

  it('throws on unknown keys, undefined values and non-objects', () => {
    assert.throws(() => mergeTuning(DEFAULTS, { stabb: 2 }, 'x'), /x: unknown tuning key "stabb"/);
    assert.throws(() => mergeTuning(DEFAULTS, { stab: undefined }), RangeError);
    assert.throws(() => mergeTuning(DEFAULTS, [1]), TypeError);
    assert.throws(() => mergeTuning(DEFAULTS, 'fast'), TypeError);
    assert.equal(mergeTuning(DEFAULTS, { extra: 1 }, 'x', ['extra']).extra, 1);
  });

  it('DEFAULTS is deep-frozen', () => {
    assert.ok(Object.isFrozen(DEFAULTS) && Object.isFrozen(DEFAULTS.critRates) && Object.isFrozen(DEFAULTS.lantern) && Object.isFrozen(DEFAULTS.lantern[1]) && Object.isFrozen(DEFAULTS.captureBands[0]));
  });
});

describe('formulas under tuning', () => {
  it('stageMult is symmetric', () => {
    assert.deepEqual([-6, -2, -1, 0, 1, 2, 6].map(stageMult), [0.25, 0.5, 2 / 3, 1, 1.5, 2, 4]);
  });

  it('critChance clamps to the table and follows a tuned table', () => {
    assert.equal(critChance(-3), 1 / 16);
    assert.equal(critChance(0), 1 / 16);
    assert.equal(critChance(2), 1 / 4);
    assert.equal(critChance(99), 1 / 2);
    assert.equal(critChance(1, { critRates: [0, 0.9] }), 0.9);
    assert.equal(critChance(5, { critRates: [0, 0.9] }), 0.9);
  });

  it('damageRoll spans [damageRollMin, 1)', () => {
    assert.equal(damageRoll(0), 0.85);
    assert.ok(Math.abs(damageRoll(0.999999) - 1) < 1e-6);
    assert.equal(damageRoll(0.5, { damageRollMin: 1 }), 1, 'a flat roll');
  });

  it('damageFormula reads stab, critMult and burnAttackMult from tuning', () => {
    const base = { level: 50, power: 100, attack: 100, defense: 100, typeMult: 1, stab: true, crit: true, rand: 1, burned: true };
    assert.equal(damageFormula(base), Math.floor(46 * 1.5 * 1.5 * 0.5));
    assert.equal(damageFormula(base, { stab: 1, critMult: 1, burnAttackMult: 1 }), 46);
    assert.equal(damageFormula({ ...base, defense: 0 }), damageFormula({ ...base, defense: 1 }), 'defense floors at 1');
  });

  it('captureOdds reads Lantern grades, status multipliers, fail bonus and the clamp from tuning', () => {
    const p = { catchRate: 45, hp: 100, maxHp: 100, status: null, grade: 1 };
    const lantern = { 1: { mult: 1, price: 1, name: 'L' }, big: { mult: 10, price: 2, name: 'Big' }, sure: { mult: Infinity, price: null, name: 'S' } };
    assert.ok(captureOdds({ ...p, grade: 'big' }, { lantern }) > captureOdds(p, { lantern }));
    assert.equal(captureOdds({ ...p, grade: 'sure' }, { lantern }), 1);
    assert.throws(() => captureOdds({ ...p, grade: 2 }, { lantern }), RangeError);
    assert.equal(captureOdds({ ...p, status: 'burn' }, { captureStatusMult: { burn: 1 } }), captureOdds(p));
    assert.equal(captureOdds({ ...p, catchRate: 255, hp: 1, grade: 3 }, { captureOddsMax: 0.5 }), 0.5);
    assert.equal(captureOdds({ ...p, catchRate: 1 }, { captureOddsMin: 0.2 }), 0.2);
    assert.ok(Math.abs(captureOdds({ ...p, fails: 2 }, { captureFailBonus: 0.1, captureFailCap: 1 }) - captureOdds(p) - 0.2) < 1e-12);
  });

  it('captureOdds stays finite and bounded for degenerate HP inputs', () => {
    for (const [hp, maxHp] of [[0, 100], [500, 100], [5, 0], [-3, 10]]) {
      const v = captureOdds({ catchRate: 45, hp, maxHp, status: null, grade: 1 });
      assert.ok(Number.isFinite(v) && v >= 0.01 && v <= 0.99, `${hp}/${maxHp}: ${v}`);
    }
  });

  it('captureBand follows tuned bands; the last band catches everything', () => {
    const bands = [[0.5, 'Slim'], [Infinity, 'Likely']];
    assert.equal(captureBand(0.2, { captureBands: bands }), 'Slim');
    assert.equal(captureBand(0.9, { captureBands: bands }), 'Likely');
    assert.equal(captureBand(5, { captureBands: [[0.5, 'Slim'], [1, 'Fair']] }), 'Fair');
  });

  it('catchUpMult follows tuned steps', () => {
    assert.equal(catchUpMult(10, 20, { catchUpEvery: 10, catchUpStep: 1, catchUpCap: 5 }), 2);
    assert.equal(catchUpMult(10, 90, { catchUpEvery: 10, catchUpStep: 1, catchUpCap: 5 }), 5);
    assert.equal(catchUpMult(10, null, { catchUpCap: 9 }), 1);
  });
});

describe('createTypeChart', () => {
  it('builds lookups from a table and exposes types / ordinary / has', () => {
    assert.equal(chart.types.length, 13);
    assert.equal(chart.ordinary.length, 12);
    assert.ok(chart.has('Brine') && !chart.has('Fire'));
    assert.equal(chart.mult(null, 'Hollow'), 1);
    assert.throws(() => chart.mult(null, 'Fire'), RangeError);
    assert.throws(() => chart.mult('Fire', 'Plain'), /unknown attacking type Fire/);
    assert.throws(() => chart.effectiveness('Plain', ['Water']), /unknown defending type Water/);
    assert.deepEqual(strongTypesAgainst(chart, ['Glass', 'Gust']), ['Kiln', 'Rime']);
    assert.deepEqual(immuneTypesOf(chart, ['Hollow']), ['Plain', 'Grit']);
  });

  it('works for any content: a two-type toy chart', () => {
    const toy = createTypeChart({ Sun: { Sun: 1, Moon: 2 }, Moon: { Sun: 0.5, Moon: 0 } });
    assert.deepEqual(toy.ordinary, ['Sun', 'Moon']);
    assert.deepEqual(toy.effectiveness('Sun', ['Moon']), { mult: 2, word: 'Strong' });
    assert.deepEqual(toy.effectiveness('Moon', ['Moon']), { mult: 0, word: 'Blocked' });
  });

  it('rejects a missing, ragged or invalid table', () => {
    assert.throws(() => createTypeChart(null), TypeError);
    assert.throws(() => createTypeChart({ A: { A: 1, B: 1 }, B: { A: 1 } }), /B -> B/);
    assert.throws(() => createTypeChart({ A: { A: -1 } }), TypeError);
    assert.throws(() => createTypeChart({ A: { A: 1 } }, ['B']), /ordinary type B/);
    assert.throws(() => createTypeChart({ A: 5 }), TypeError);
  });

  it('wordFor maps multipliers to the four words', () => {
    assert.deepEqual([0, 0.25, 0.5, 1, 2, 4].map(wordFor), ['Blocked', 'Weak', 'Weak', 'Neutral', 'Strong', 'Strong']);
  });
});

describe('Wards', () => {
  const ward = (kind, minPower) => ({ name: 'TestWard', ward: { kind, minPower } });

  it('strong-only, no-status and min-power, with Scrap never piercing and immunity first', () => {
    const scrap = getMove('scrap');
    assert.equal(wardCheck(ward('strong-only'), getMove('tap'), ['Glass', 'Gust'], 'Plain', chart).reason, 'ward');
    assert.equal(wardCheck(ward('strong-only'), getMove('kiln-maw'), ['Glass', 'Gust'], 'Kiln', chart).lands, true);
    assert.equal(wardCheck(ward('strong-only'), getMove('scorch'), ['Glass'], 'Kiln', chart).lands, true);
    assert.equal(wardCheck(ward('no-status'), getMove('scorch'), ['Glass'], 'Kiln', chart).lands, false);
    assert.equal(wardCheck(ward('no-status'), getMove('tap'), ['Glass'], 'Plain', chart).lands, true);
    assert.equal(wardCheck(ward('min-power', 50), getMove('tap'), ['Rime'], 'Plain', chart).lands, false);
    assert.equal(wardCheck(ward('min-power', 50), getMove('shadowbox'), ['Rime'], 'Hollow', chart).lands, true);
    for (const k of WARD_KINDS) assert.equal(wardCheck(ward(k, 1), scrap, ['Plain'], null, chart).lands, false, k);
    assert.equal(wardCheck(ward('strong-only'), getMove('tap'), ['Hollow'], 'Plain', chart).reason, 'immune');
    assert.equal(wardCheck(null, getMove('tap'), ['Brine'], 'Plain', chart).lands, true);
    assert.equal(wardCheck({ name: 'X', ward: { kind: 'future-kind' } }, getMove('tap'), ['Brine'], 'Plain', chart).lands, true, 'an unknown kind never blocks');
    assert.equal(wardCheck(ward('strong-only'), getMove('tailfall'), ['Glass', 'Gust'], 'Kiln', chart).lands, true, 'the queued type is what counts');
  });

  it('readout header and indirect list per kind', () => {
    assert.equal(wardHeldText(ward('strong-only')), 'TestWard held. Only Strong hits get through.');
    assert.equal(wardHeldText(ward('no-status')), 'TestWard held. Status techniques fail against it.');
    assert.equal(wardHeldText(ward('min-power', 40)), 'TestWard held. Hits under 40 power do nothing.');
    assert.equal(wardHeldText({ name: 'Plain' }), 'Plain held.');
    assert.deepEqual(wardIndirect(ward('strong-only')), ['poison', 'burn', 'trap']);
    assert.deepEqual(wardIndirect(ward('no-status')), ['poison (from a damaging hit)', 'burn (from a damaging hit)']);
    assert.ok(isWard(ward('no-status')) && !isWard({ name: 'x', ward: null }) && !isWard(null));
  });
});
