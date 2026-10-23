// Unit tests for js/systems/capture.js. Run: node --test test/systems.capture.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../js/systems/capture.js';
import { captureOdds as engineOdds, DEFAULTS as ENGINE_DEFAULTS } from '../js/battle/engine.js';
import { makeRng } from '../js/core/rng.js';
import { DATA, mk } from './fixtures/forecast.fixture.mjs';

/** A wild target at `hp` of its max HP. */
function target(speciesId = 'squallcoil', hpFrac = 1, status = null) {
  const c = mk('w1', speciesId, 20);
  c.hp = Math.max(1, Math.round(c.stats.hp * hpFrac));
  c.status = status ? { kind: status, turns: 0 } : null;
  return c;
}

describe('DEFAULTS and tuning', () => {
  it('mirror the verified battle prototype and the rules (+3% per fail, cap +15%)', () => {
    assert.equal(K.DEFAULTS.CAPTURE_FAIL_BONUS, 0.03);
    assert.equal(K.DEFAULTS.CAPTURE_FAIL_CAP, 0.15);
    assert.equal(K.DEFAULTS.CAPTURE_FAIL_BONUS, ENGINE_DEFAULTS.captureFailBonus);
    assert.equal(K.DEFAULTS.CAPTURE_FAIL_CAP, ENGINE_DEFAULTS.captureFailCap);
    assert.equal(K.DEFAULTS.CAPTURE_ODDS_MIN, ENGINE_DEFAULTS.captureOddsMin);
    assert.equal(K.DEFAULTS.CAPTURE_ODDS_MAX, ENGINE_DEFAULTS.captureOddsMax);
    assert.deepEqual(K.DEFAULTS.CAPTURE_STATUS_MULT, { ...ENGINE_DEFAULTS.captureStatusMult });
    assert.deepEqual(K.DEFAULTS.CAPTURE_BANDS.map((b) => [...b]), ENGINE_DEFAULTS.captureBands.map((b) => [...b]));
    for (const [g, L] of Object.entries(ENGINE_DEFAULTS.lantern)) {
      assert.equal(K.DEFAULTS.LANTERNS[g].sure === true, L.mult === Infinity, g);
      if (L.mult !== Infinity) assert.equal(K.DEFAULTS.LANTERNS[g].mult, L.mult);
    }
    assert.deepEqual(K.DEFAULTS.CAPTURE_DISPLAY, { drift: 'percent', flux: 'percent', freefall: 'band' });
    assert.ok(Object.isFrozen(K.DEFAULTS) && Object.isFrozen(K.DEFAULTS.LANTERNS[1]) && Object.isFrozen(K.DEFAULTS.CAPTURE_BANDS[0]));
    assert.deepEqual([...K.TUNING_KEYS].sort(), Object.keys(K.DEFAULTS).sort());
  });

  it('tuningOf validates, ignores foreign keys, caches and never freezes the caller\'s object', () => {
    assert.equal(K.tuningOf(undefined), K.DEFAULTS);
    const mine = { CAPTURE_FAIL_CAP: 0.3, STAR_CHANCE: 1, CAPTURE_STATUS_MULT: { numb: 2 } };
    const t = K.tuningOf(mine);
    assert.equal(t.CAPTURE_FAIL_CAP, 0.3);
    assert.equal(K.tuningOf(mine), t);
    assert.ok(!Object.isFrozen(mine.CAPTURE_STATUS_MULT));
    assert.throws(() => K.tuningOf({ CAPTURE_FAIL_BONUS: 2 }), /CAPTURE_FAIL_BONUS/);
    assert.throws(() => K.tuningOf({ CAPTURE_BANDS: [[0.6, 'Fair'], [0.25, 'Low']] }), /CAPTURE_BANDS/);
    assert.throws(() => K.tuningOf({ LANTERNS: { 1: { mult: 0 } } }), /LANTERNS/);
    assert.throws(() => K.tuningOf({ CAPTURE_DISPLAY: { drift: 'exact' } }), /CAPTURE_DISPLAY/);
    assert.throws(() => K.tuningOf({ CAPTURE_ODDS_MIN: 0.9, CAPTURE_ODDS_MAX: 0.5 }), /MIN/);
    assert.throws(() => K.tuningOf('x'), TypeError);
  });
});

describe('captureOdds', () => {
  it('shows an exact whole percent on Drift and Flux and a band on Freefall (rules §15.4)', () => {
    const tg = target('tossup', 0.5);
    for (const dial of ['drift', 'flux']) {
      const o = K.captureOdds(tg, { grade: 1, data: DATA }, { dial });
      assert.equal(o.display, 'percent');
      assert.equal(o.shown, o.pct);
      assert.ok(Number.isInteger(o.pct));
    }
    const ff = K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'freefall' });
    assert.equal(ff.display, 'band');
    assert.equal(ff.shown, ff.band);
    assert.ok(['Low', 'Fair', 'Good'].includes(ff.band));
    // dial rules win (data/dials 'band' / engine 'exact' spellings)
    assert.equal(K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'drift', rules: { captureDisplay: 'bands' } }).display, 'band');
    assert.equal(K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'freefall', rules: { captureDisplay: 'exact' } }).display, 'percent');
    assert.equal(K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'custom', rules: { captureDisplay: 'percent' } }).display, 'percent');
    assert.throws(() => K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'custom' }), RangeError);
    assert.throws(() => K.captureOdds(tg, { grade: 1, data: DATA }), RangeError);
  });

  it('odds rolled are the odds shown, and equal the engine formula rounded to a whole percent', () => {
    for (const [sp, frac, status, grade, fails] of [['squallcoil', 1, null, 1, 0], ['tossup', 0.3, 'numb', 2, 1], ['sloshkin', 0.05, 'burn', 3, 4], ['vesperay', 0.6, null, 2, 9]]) {
      const tg = target(sp, frac, status);
      const o = K.captureOdds(tg, { grade, fails, data: DATA }, { dial: 'flux' });
      const raw = engineOdds({ catchRate: DATA.species[sp].catchRate, hp: tg.hp, maxHp: tg.stats.hp, status, grade, fails });
      assert.equal(o.p, Math.round(raw * 100) / 100, sp);
      assert.equal(o.p, o.pct / 100);
      const exact = K.captureOdds(tg, { grade, fails, data: DATA }, { dial: 'flux', tuning: { ROUND_TO_SHOWN: false } });
      assert.equal(exact.p, raw);
    }
  });

  it('each failed attempt adds 3%, capped at +15% (rules §15.4)', () => {
    const tg = target('sloshkin', 1);
    const base = K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'flux', tuning: { ROUND_TO_SHOWN: false } }).p;
    for (let f = 0; f <= 8; f++) {
      const o = K.captureOdds(tg, { grade: 1, fails: f, data: DATA }, { dial: 'flux', tuning: { ROUND_TO_SHOWN: false } });
      assert.ok(Math.abs(o.bonus - Math.min(0.15, f * 0.03)) < 1e-12);
      assert.ok(Math.abs(o.p - (base + Math.min(0.15, f * 0.03))) < 1e-9, `fails ${f}`);
      assert.equal(o.fails, f);
    }
    assert.equal(K.failBonus(3), 0.09);
    assert.equal(K.failBonus(100), 0.15);
    assert.equal(K.failBonus(-2), 0);
    assert.equal(K.failBonus(/** @type {any} */ ('junk')), 0);
    const o = K.captureOdds(tg, { grade: 1, fails: 1, data: DATA }, { dial: 'flux' });
    assert.equal(o.next.pct, o.pct + 3);
  });

  it('clamps ordinary Lanterns and lets the catch rate, HP, status, trap and grade move the odds', () => {
    const full = target('sloshkin', 1);
    const low = target('sloshkin', 0.02);
    const pFull = K.captureOdds(full, { grade: 1, data: DATA }, { dial: 'flux' }).p;
    const pLow = K.captureOdds(low, { grade: 1, data: DATA }, { dial: 'flux' }).p;
    assert.ok(pLow > pFull);
    assert.ok(K.captureOdds(full, { grade: 3, data: DATA }, { dial: 'flux' }).p > pFull);
    assert.ok(K.captureOdds(full, { grade: 1, data: DATA, trapped: true }, { dial: 'flux' }).p >= pFull);
    assert.ok(K.captureOdds(target('sloshkin', 1, 'numb'), { grade: 1, data: DATA }, { dial: 'flux' }).p > pFull);
    // a 3-rate form at full HP sits on the 1% floor
    assert.equal(K.captureOdds(target('squallcoil', 1), { grade: 1, data: DATA }, { dial: 'flux' }).p, 0.01);
    assert.equal(K.captureOdds(full, { grade: 1, catchRate: 0 }, { dial: 'flux' }).p, 0.01);
    assert.equal(K.captureOdds(low, { grade: 3, catchRate: 255, fails: 5 }, { dial: 'flux' }).p, 0.99);
    // explicit ctx overrides the target record
    assert.equal(K.captureOdds(full, { grade: 1, catchRate: 255, status: 'numb' }, { dial: 'flux' }).p,
      K.captureOdds(target('squallcoil', 1, 'numb'), { grade: 1, catchRate: 255 }, { dial: 'flux' }).p);
  });

  it('Capture Stance: odds are computed from at least 1 HP', () => {
    const tg = target('squallcoil', 1);
    tg.hp = 0;
    const o = K.captureOdds(tg, { grade: 1, data: DATA, stance: true }, { dial: 'flux' });
    tg.hp = 1;
    assert.equal(o.p, K.captureOdds(tg, { grade: 1, data: DATA }, { dial: 'flux' }).p);
  });

  it('the Keepsake Lantern is a sure catch that asks for a confirm (rules §15.5)', () => {
    const o = K.captureOdds(target('squallcoil'), { grade: 'sure' }, { dial: 'freefall' });
    assert.equal(o.p, 1);
    assert.equal(o.pct, 100);
    assert.equal(o.sure, true);
    assert.equal(o.confirm, true);
    assert.equal(o.next, null);
    assert.equal(o.band, 'Good');
    assert.equal(K.isSureGrade('sure'), true);
    assert.equal(K.isSureGrade(1), false);
    assert.equal(K.isSureGrade('nope'), false);
    assert.equal(K.captureOdds(target('squallcoil'), { grade: 1, data: DATA }, { dial: 'flux' }).confirm, false);
  });

  it('rejects unknown grades, missing catch rates and malformed arguments', () => {
    const tg = target();
    assert.throws(() => K.captureOdds(tg, { grade: 9, data: DATA }, { dial: 'flux' }), RangeError);
    assert.throws(() => K.captureOdds(tg, { grade: 1 }, { dial: 'flux' }), RangeError);
    assert.throws(() => K.captureOdds(tg, { grade: 1, catchRate: -1 }, { dial: 'flux' }), RangeError);
    assert.throws(() => K.captureOdds(/** @type {any} */ (null), { grade: 1 }, { dial: 'flux' }), TypeError);
    assert.throws(() => K.captureOdds(tg, /** @type {any} */ (null), { dial: 'flux' }), TypeError);
    assert.throws(() => K.captureOdds({ hp: 5, stats: { hp: 10 } }, { grade: 1, data: DATA }, { dial: 'flux' }), RangeError);
  });

  it('bands follow CAPTURE_BANDS and can be retuned (e.g. a four-word scale)', () => {
    assert.equal(K.bandFor(0.1), 'Low');
    assert.equal(K.bandFor(0.25), 'Fair');
    assert.equal(K.bandFor(0.59), 'Fair');
    assert.equal(K.bandFor(0.6), 'Good');
    const tuning = { CAPTURE_BANDS: [[0.2, 'Slim'], [0.5, 'Fair'], [0.999, 'Good'], [Infinity, 'Sure']] };
    assert.equal(K.bandFor(0.1, { tuning }), 'Slim');
    assert.equal(K.bandFor(1, { tuning }), 'Sure');
    assert.equal(K.captureOdds(target(), { grade: 'sure' }, { dial: 'freefall', tuning }).shown, 'Sure');
  });
});

describe('attemptCapture', () => {
  it('rolls exactly one draw on ordinary odds and is deterministic given the rng', () => {
    const a = makeRng('cap');
    const b = makeRng('cap');
    const ra = K.attemptCapture(a, 0.4);
    const rb = K.attemptCapture(b, 0.4);
    assert.deepEqual(ra, rb);
    assert.equal(ra.drew, true);
    const c = makeRng('cap');
    c.next();
    assert.deepEqual(a.state(), c.state());
    assert.equal(ra.success, makeRng('cap').next() < 0.4);
  });

  it('succeeds at about the shown rate and fills the meter by the odds on a fail', () => {
    const rng = makeRng('rate');
    let wins = 0;
    for (let i = 0; i < 5000; i++) {
      const r = K.attemptCapture(rng, 0.3);
      if (r.success) { wins++; assert.equal(r.segments, 3); } else assert.equal(r.segments, 0);
    }
    assert.ok(Math.abs(wins / 5000 - 0.3) < 0.02, `${wins}`);
    const fail = K.attemptCapture({ chance: () => false }, 0.7);
    assert.equal(fail.segments, 2);
    assert.equal(K.attemptCapture({ chance: () => false }, 0.99).segments, 2);
  });

  it('a sure catch succeeds without drawing; accepts a captureOdds result', () => {
    const rng = makeRng('sure');
    const before = rng.state();
    const o = K.captureOdds(target(), { grade: 'sure' }, { dial: 'flux' });
    const r = K.attemptCapture(rng, o);
    assert.deepEqual(r, { success: true, p: 1, segments: 3, drew: false });
    assert.deepEqual(rng.state(), before);
    assert.equal(K.attemptCapture(null, 1).success, true);
    const ord = K.captureOdds(target(), { grade: 1, data: DATA }, { dial: 'flux' });
    assert.equal(K.attemptCapture(makeRng('x'), ord).p, ord.p);
    assert.equal(K.attemptCapture(makeRng('x'), 0).success, false);
  });

  it('rejects odds outside [0, 1] and a missing rng', () => {
    assert.throws(() => K.attemptCapture(makeRng('x'), 1.5), TypeError);
    assert.throws(() => K.attemptCapture(makeRng('x'), -0.1), TypeError);
    assert.throws(() => K.attemptCapture(makeRng('x'), NaN), TypeError);
    assert.throws(() => K.attemptCapture(makeRng('x'), /** @type {any} */ ('0.5')), TypeError);
    assert.throws(() => K.attemptCapture(/** @type {any} */ (null), 0.5), TypeError);
  });
});

describe('stanceFloor (rules §15.2)', () => {
  it('stops party damage at 1 HP while the Stance is on', () => {
    assert.deepEqual(K.stanceFloor(10, 30, { stance: true }), { hp: 1, dealt: 9, floored: true });
    assert.deepEqual(K.stanceFloor(10, 5, { stance: true }), { hp: 5, dealt: 5, floored: false });
    assert.deepEqual(K.stanceFloor(1, 5, { stance: true, source: 'poison' }), { hp: 1, dealt: 0, floored: true });
  });
  it('does not floor self damage or when the Stance is off; never deals more than the HP', () => {
    assert.deepEqual(K.stanceFloor(10, 30, { stance: true, source: 'self' }), { hp: 0, dealt: 10, floored: false });
    assert.deepEqual(K.stanceFloor(10, 30), { hp: 0, dealt: 10, floored: false });
    assert.deepEqual(K.stanceFloor(0, 5, { stance: true }), { hp: 0, dealt: 0, floored: false });
    assert.deepEqual(K.stanceFloor(10, -4, { stance: true }), { hp: 10, dealt: 0, floored: false });
    assert.deepEqual(K.stanceFloor(10, 2.9), { hp: 8, dealt: 2, floored: false });
  });
});
