// Adversarial tests for the RULES-SHIFT / RULES-CAPTURE lane (js/systems/forecast.js, js/systems/capture.js):
// determinism across processes, boundaries on every dial, malformed data, huge inputs, save round trips.
// Run: node --test test/rules-shift-capture.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as F from '../js/systems/forecast.js';
import * as C from '../js/systems/capture.js';
import { captureOdds as engineOdds, DEFAULTS as ENGINE_DEFAULTS } from '../js/battle/engine.js';
import { serialize, deserialize } from '../js/systems/creature.js';
import { validateWorld } from '../js/state/schema.js';
import { TUNING } from '../js/data/tuning.js';
import { DIALS as DIAL_ROWS } from '../js/data/dials.js';
import { DATA, FAMILIES, setup, spyBus, makeRng } from './fixtures/forecast.fixture.mjs';

const DIALS = ['drift', 'flux', 'freefall'];
const FIXTURE_URL = pathToFileURL(fileURLToPath(new URL('./fixtures/forecast.fixture.mjs', import.meta.url))).href;
const FORECAST_URL = pathToFileURL(fileURLToPath(new URL('../js/systems/forecast.js', import.meta.url))).href;

/** Data with some families replaced (fixture DATA is frozen; tables are shared). */
function withFamilies(overrides) {
  const fams = FAMILIES.map((f) => overrides[f.id] ?? f);
  for (const [id, f] of Object.entries(overrides)) if (!fams.some((x) => x.id === id)) fams.push(f);
  return { ...DATA, families: fams };
}

/** Forecasts at draw indexes 0..n-1 (positions the creature only). */
function sample(world, c, n, data = DATA, opts = {}) {
  const keep = c.shiftCount;
  const out = [];
  for (let i = 0; i < n; i++) {
    c.shiftCount = i;
    out.push(F.rollForecast(world, c, data, opts));
  }
  c.shiftCount = keep;
  return out;
}

/** The parts of a Forecast that must reproduce from a seed. */
const sig = (f) => ({ forms: f.cards.map((cd) => cd.formId), odds: f.cards.map((cd) => cd.odds), picked: f.picked, star: f.starTouched, roll: f.roll });

describe('determinism across processes (§9)', () => {
  it('a fresh Node process draws the same cards, picks and star slots on every dial', () => {
    const script = `
      const F = await import(${JSON.stringify(FORECAST_URL)});
      const fx = await import(${JSON.stringify(FIXTURE_URL)});
      const out = {};
      for (const dial of ['drift', 'flux', 'freefall']) {
        const { world, c } = fx.setup({ seedCode: 'XPROC-1', dial, bond: 2 });
        out[dial] = [];
        for (let i = 0; i < 12; i++) {
          c.shiftCount = i;
          const f = F.rollForecast(world, c, fx.DATA);
          out[dial].push({ forms: f.cards.map((cd) => cd.formId), odds: f.cards.map((cd) => cd.odds), picked: f.picked, star: f.starTouched, roll: f.roll });
        }
      }
      process.stdout.write(JSON.stringify(out));
    `;
    const child = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }));
    for (const dial of DIALS) {
      const { world, c } = setup({ seedCode: 'XPROC-1', dial, bond: 2 });
      assert.deepEqual(sample(world, c, 12).map(sig), child[dial], dial);
    }
  });

  it('a JSON round trip of the world (a save) reproduces the Forecast, the Reroll cost and the next Reroll', () => {
    const { world, c } = setup({ seedCode: 'SAVE-RT', starsalt: 20 });
    let f = F.rollForecast(world, c, DATA);
    for (let i = 0; i < 2; i++) f = /** @type {any} */ (F.reroll(world, c.uid, f, DATA)).forecast;
    assert.equal(f.rerolls, 2);
    const loaded = JSON.parse(JSON.stringify(world));
    const g = F.rollForecast(loaded, c.uid, DATA);
    assert.deepEqual(sig(g), sig(f));
    assert.equal(g.rerolls, 2, 'the Reroll count survives a reload');
    assert.equal(g.rerollCost, 4);
    const a = /** @type {any} */ (F.reroll(world, c.uid, f, DATA));
    const b = /** @type {any} */ (F.reroll(loaded, c.uid, g, DATA));
    assert.deepEqual(sig(a.forecast), sig(b.forecast));
    assert.equal(a.spent, 4);
    assert.equal(b.spent, 4);
    assert.deepEqual(validateWorld(loaded), []);
  });

  it('creature serialize/deserialize keeps the Shift stream position', () => {
    const { world, c } = setup({ seedCode: 'SER-RT', bond: 3 });
    c.shiftCount = 5;
    const before = F.rollForecast(world, c, DATA);
    world.party[0] = deserialize(serialize(c), DATA);
    assert.deepEqual(sig(F.rollForecast(world, 'c1', DATA)), sig(before));
  });

  it('two uids on one seed and one uid on two seeds diverge; a positioned opts.stream equals the default', () => {
    const a = setup({ seedCode: 'DIV-A', uid: 'c1' });
    const b = setup({ seedCode: 'DIV-A', uid: 'c2' });
    const d = setup({ seedCode: 'DIV-B', uid: 'c1' });
    const rolls = (s) => sample(s.world, s.c, 20).map((f) => f.roll);
    assert.notDeepEqual(rolls(a), rolls(b));
    assert.notDeepEqual(rolls(a), rolls(d));
    a.c.shiftCount = 7;
    const own = F.rollForecast(a.world, a.c, DATA);
    const viaStream = F.rollForecast(a.world, a.c, DATA, { stream: F.streamFor(a.world.run.seed, 'c1', 7) });
    assert.deepEqual(sig(viaStream), sig(own));
  });
});

describe('odds boundaries on every dial', () => {
  it('every Bond / steadied / Errant / empty-card combination stays whole, non-negative and sums to 100', () => {
    const empties = [[], ['up'], ['side'], ['down'], ['up', 'side'], ['side', 'down'], ['up', 'down']];
    for (const dial of DIALS) {
      const floor = F.DEFAULTS.DOWN_FLOOR[dial];
      for (const bond of [-3, 0, 1, 2, 3, 4, 5, 6, 99, Infinity, NaN, '2']) {
        for (const steadied of [false, true]) {
          for (const errant of [false, true]) {
            for (const empty of empties) {
              const o = F.cardOdds(dial, { bond: /** @type {any} */ (bond), steadied, errant, empty: /** @type {any} */ (empty) });
              const arr = [o.up, o.side, o.down];
              const tag = JSON.stringify({ dial, bond: String(bond), steadied, errant, empty });
              assert.ok(arr.every((x) => Number.isInteger(x) && x >= 0), tag);
              const dead = new Set([...empty, ...(errant && F.DEFAULTS.ERRANT_ZERO_DOWN[dial] ? ['down'] : [])]);
              // every card zeroed (an Errant with only a Down pool): nothing can land, rollForecast refuses it
              assert.equal(arr[0] + arr[1] + arr[2], dead.size === 3 ? 0 : 100, tag);
              assert.ok(o.bondTilt <= F.DEFAULTS.BOND_CAP[dial], tag);
              for (const d of empty) assert.equal(o[d], 0, tag);
              if (!errant && !empty.length) assert.ok(o.down >= floor, tag);
            }
          }
        }
      }
    }
  });

  it('full Bond reaches the rules-doc caps and steadied matches GDD-00 (Drift 50/45/5, Flux 40/40/20, Freefall 30/35/35)', () => {
    const at = (dial, st) => { const o = F.cardOdds(dial, st); return [o.up, o.side, o.down]; };
    assert.deepEqual(at('drift', { bond: 5 }), [55, 40, 5]);
    assert.deepEqual(at('flux', { bond: 5 }), [55, 35, 10]);
    assert.deepEqual(at('freefall', { bond: 5 }), [40, 30, 30]);
    assert.deepEqual(at('drift', { steadied: true }), [50, 45, 5]);
    assert.deepEqual(at('flux', { steadied: true }), [40, 40, 20]);
    assert.deepEqual(at('freefall', { steadied: true }), [30, 35, 35]);
    for (const row of DIAL_ROWS) {
      const o = F.cardOdds(row.id, { steadied: true }, { tuning: TUNING });
      assert.deepEqual({ up: o.up, side: o.side, down: o.down }, row.shift.steadied, `dials.js steadied row for ${row.id}`);
    }
  });

  it('an Errant whose only landable card would be Down cannot be forecast on Drift / Flux (no card can land)', () => {
    const data = withFamilies({ squallcoil: { id: 'squallcoil', name: 'errant', shiftTable: { squallcoil: { up: [], side: [], down: [{ form: 'puddlepip', w: 1 }] } } } });
    for (const dial of ['drift', 'flux']) {
      const { world, c } = setup({ speciesId: 'squallcoil', dial });
      assert.throws(() => F.rollForecast(world, c, data), (e) => e.code === 'EMPTY_POOL');
      assert.deepEqual(F.canForecast(world, c, data), { ok: false, reason: 'empty-pool' });
    }
    const { world, c } = setup({ speciesId: 'squallcoil', dial: 'freefall' });
    const f = F.rollForecast(world, c, data);
    assert.equal(f.cards[2].odds, 100);
    assert.equal(f.picked, 2);
  });

  it('pickIndex never lands on a 0% card, even at u just below 1 or exactly 0', () => {
    for (const odds of [[0, 100, 0], [100, 0, 0], [0, 0, 100], [50, 0, 50], [1, 0, 99]]) {
      for (const u of [0, 1e-12, 0.5, 0.999999999, 1 - Number.EPSILON]) {
        const i = F.pickIndex(odds, u);
        assert.ok(odds[i] > 0, `${odds} @ ${u} -> ${i}`);
      }
    }
  });
});

describe('pools: flattening, neverOnForecast, malformed and huge data', () => {
  const dummy = { speciesId: 'nobody', shiftlog: [] };

  it('Freefall flattens positive weights (rules §6.2, dials.js poolWeights "flat"); 0 still means never; dial rules win', () => {
    const entries = [{ form: 'a', w: 90 }, { form: 'b', w: 10 }, { form: 'z', w: { drift: 5, flux: 5, freefall: 0 } }];
    assert.deepEqual(F.cardPool(entries, 'freefall', dummy), [{ form: 'a', w: 50 }, { form: 'b', w: 50 }]);
    assert.deepEqual(F.cardPool(entries, 'drift', dummy), [{ form: 'a', w: 90 }, { form: 'b', w: 10 }, { form: 'z', w: 5 }]);
    assert.deepEqual(F.cardPool(entries, 'freefall', dummy, { rules: { poolWeights: 'source' } }), [{ form: 'a', w: 90 }, { form: 'b', w: 10 }]);
    assert.deepEqual(F.cardPool(entries, 'drift', dummy, { rules: { poolWeights: 'flat' } }).map((e) => e.w), [35, 35, 35]);
    assert.deepEqual(F.cardPool(entries, 'freefall', dummy, { tuning: { POOL_FLAT_DIALS: [] } }).map((e) => e.w), [90, 10]);
    assert.throws(() => F.tuningOf({ POOL_FLAT_DIALS: 'freefall' }), /POOL_FLAT_DIALS/);
  });

  it('a single-number pool on Freefall lands about evenly; on Drift it follows the weights', () => {
    const data = withFamilies({ sloshkin: { ...FAMILIES[0], shiftTable: { ...FAMILIES[0].shiftTable, sloshkin: {
      up: [{ form: 'siltback', w: 9 }, { form: 'bogmonarch', w: 1 }], side: [{ form: 'mudfist', w: 1 }], down: [{ form: 'puddlepip', w: 1 }],
    } } } });
    const count = (dial) => {
      const { world, c } = setup({ seedCode: 'FLAT', dial });
      const fs = sample(world, c, 2000, data);
      return fs.filter((f) => f.cards[0].formId === 'siltback').length / fs.length;
    };
    assert.ok(Math.abs(count('freefall') - 0.5) < 0.05);
    assert.ok(Math.abs(count('drift') - 0.9) < 0.04);
  });

  it('forms flagged neverOnForecast and unknown forms never reach a card or the star slot', () => {
    const data = withFamilies({ sloshkin: { ...FAMILIES[0], star: 'vagary', shiftTable: { ...FAMILIES[0].shiftTable, sloshkin: {
      up: [{ form: 'vagary', w: 1000 }, { form: 'siltback', w: 1 }, { form: 'no-such-form', w: 1000 }],
      side: [{ form: 'mudfist', w: 1 }], down: [{ form: 'puddlepip', w: 1 }],
    } } } });
    const { world, c } = setup({ seedCode: 'NOFC', dial: 'drift' });
    const fs = sample(world, c, 400, data, { tuning: { STAR_CHANCE: 1 } });
    for (const f of fs) {
      assert.equal(f.cards[0].formId, 'siltback');
      assert.equal(f.starTouched, null);
      assert.equal(f.cards[1].formId, 'mudfist');
    }
  });

  it('malformed weights throw a TypeError naming the form; garbage entries and non-array cards are skipped', () => {
    for (const w of [NaN, -1, Infinity, 'heavy', { flux: -2 }, { flux: 'x' }]) {
      assert.throws(() => F.cardPool([{ form: 'a', w }], 'flux', dummy), (e) => e instanceof TypeError && /"a"/.test(e.message), JSON.stringify(w));
    }
    assert.deepEqual(F.cardPool([null, 7, {}, { form: '' }, { form: 3, w: 1 }, { form: 'ok', w: 2 }], 'flux', dummy), [{ form: 'ok', w: 2 }]);
    assert.deepEqual(F.cardPool(/** @type {any} */ ({ form: 'a', w: 1 }), 'flux', dummy), []);
    assert.deepEqual(F.cardPool(undefined, 'flux', dummy), []);
    // a whole row of garbage behaves as empty cards
    const data = withFamilies({ sloshkin: { ...FAMILIES[0], shiftTable: { ...FAMILIES[0].shiftTable, sloshkin: { up: 'nope', side: {}, down: [{ form: 'puddlepip', w: 1 }] } } } });
    const { world, c } = setup({ dial: 'flux' });
    const f = F.rollForecast(world, c, data);
    assert.deepEqual(f.cards.map((cd) => cd.empty), [true, true, false]);
    assert.deepEqual(f.cards.map((cd) => cd.odds), [0, 0, 100]);
  });

  it('a 20 000-entry pool resolves quickly, deterministically and within its weights', () => {
    const big = [];
    for (let i = 0; i < 20000; i++) big.push({ form: i % 2 ? 'siltback' : 'skeinwing', w: (i % 7) + 1 });
    const data = withFamilies({ sloshkin: { ...FAMILIES[0], shiftTable: { ...FAMILIES[0].shiftTable, sloshkin: { up: big, side: [{ form: 'mudfist', w: 1 }], down: [] } } } });
    const { world, c } = setup({ seedCode: 'BIG' });
    const t0 = performance.now();
    const a = F.rollForecast(world, c, data);
    const ms = performance.now() - t0;
    assert.ok(ms < 1000, `took ${ms} ms`);
    assert.deepEqual(sig(F.rollForecast(world, c, data)), sig(a));
    assert.ok(['siltback', 'skeinwing'].includes(a.cards[0].formId));
  });

  it('huge stream positions and huge Reroll counts stay well-defined', () => {
    const { world, c } = setup({ seedCode: 'HUGE', starsalt: 3 });
    c.shiftCount = 2 ** 40;
    const f = F.rollForecast(world, c, DATA, { rerolls: 10000 });
    assert.equal(f.draw, 2 ** 40);
    assert.equal(f.rerollCost, Number.MAX_SAFE_INTEGER);
    assert.equal(f.canReroll, false);
    assert.equal(f.rerollReason, 'starsalt');
    assert.throws(() => F.streamFor(world.run.seed, 'c1', -1), TypeError);
    assert.throws(() => F.streamFor(world.run.seed, 'c1', 1.5), TypeError);
    assert.throws(() => F.streamFor(-1, 'c1', 0), TypeError);
    assert.throws(() => F.streamFor(world.run.seed, '', 0), TypeError);
  });
});

describe('Still Knot, windows and refusals that must change nothing', () => {
  it('a held Still Knot blocks the Forecast, Accept and a pending Reroll without spending anything', () => {
    const { world, c } = setup({ starsalt: 5 });
    const f = F.rollForecast(world, c, DATA);
    c.stillKnot = true;
    assert.throws(() => F.rollForecast(world, c, DATA), (e) => e.code === 'STILL_KNOT');
    assert.deepEqual(F.canForecast(world, c, DATA), { ok: false, reason: 'still-knot' });
    assert.throws(() => F.applyShift(world, 'c1', 'siltback', DATA), (e) => e.code === 'STILL_KNOT');
    assert.throws(() => F.accept(world, 'c1', f, DATA), (e) => e.code === 'STILL_KNOT');
    assert.throws(() => F.reroll(world, 'c1', f, DATA), (e) => e.code === 'STILL_KNOT');
    assert.equal(world.wallet.starsalt, 5);
    assert.equal(c.shiftCount, 0);
    assert.equal(c.speciesId, 'sloshkin');
    assert.equal(world.stats.rerolls, 0);
  });

  it('Shifting into a form that never Shifts still uses the window up and clears pendingShifts', () => {
    const data = withFamilies({ sloshkin: { ...FAMILIES[0], shiftTable: { ...FAMILIES[0].shiftTable, sloshkin: { up: [{ form: 'stillox', w: 1 }], side: [], down: [] } } } });
    const { world, c } = setup({ dial: 'flux' });
    c.level = 34;
    c.windowsUsed = [9];
    F.applyShift(world, 'c1', 'stillox', data); // two windows were open (20, 34)
    assert.deepEqual(c.windowsUsed, [9, 20]);
    assert.deepEqual(world.pendingShifts, []);
    assert.throws(() => F.rollForecast(world, c, data), (e) => e.code === 'NEVER_SHIFTS');
  });

  it('a refused Accept (bad Heartmark pin) leaves the window, pending list, draw and Shiftlog untouched', () => {
    const { world, c } = setup();
    c.heartmark = null;
    const before = JSON.stringify(world);
    assert.throws(() => F.applyShift(world, 'c1', 'siltback', DATA, { heartmark: 'not-a-current-move' }));
    assert.throws(() => F.applyShift(world, 'c1', 'no-such-form', DATA), RangeError);
    assert.equal(JSON.stringify(world), before);
  });

  it('Accept and Anchor reset the Reroll count, so the next window starts at cost 1 again', () => {
    const { world, c } = setup({ starsalt: 30, anchors: 1 });
    c.level = 34; // windows 20 and 34 open
    let f = F.rollForecast(world, c, DATA);
    f = /** @type {any} */ (F.reroll(world, 'c1', f, DATA)).forecast;
    f = /** @type {any} */ (F.reroll(world, 'c1', f, DATA)).forecast;
    assert.equal(F.rerollsTaken(world, 'c1'), 2);
    F.applyShift(world, 'c1', 'skeinwing', DATA); // a form with its own Shift table row, so the next window can be forecast
    assert.equal(F.rerollsTaken(world, 'c1'), 0);
    let g = F.rollForecast(world, c, DATA);
    assert.equal(g.rerollCost, 1);
    g = /** @type {any} */ (F.reroll(world, 'c1', g, DATA)).forecast;
    assert.equal(g.rerollCost, 2);
    assert.equal(/** @type {any} */ (F.anchor(world, 'c1', DATA)).ok, true);
    assert.equal(F.rerollsTaken(world, 'c1'), 0);
    assert.deepEqual(validateWorld(world), []);
  });

  it('a reload between Rerolls keeps escalating (no reset by saving and loading)', () => {
    const { world, c } = setup({ seedCode: 'RELOAD', starsalt: 30 });
    let f = F.rollForecast(world, c, DATA);
    f = /** @type {any} */ (F.reroll(world, c.uid, f, DATA)).forecast;
    const loaded = JSON.parse(JSON.stringify(world));
    const g = F.rollForecast(loaded, c.uid, DATA);
    const r = /** @type {any} */ (F.reroll(loaded, c.uid, g, DATA));
    assert.equal(r.spent, 2);
    assert.equal(loaded.wallet.starsalt, 27);
  });
});

describe('dial rules (data/dials.js) and every dial end to end', () => {
  it('rerollCostMult and anchorsAllowed from the dial row win over tuning', () => {
    assert.equal(F.rerollCost(1, { dial: 'flux', rules: { rerollCostMult: 3 } }), 6);
    assert.equal(F.rerollCost(1, { dial: 'flux', rules: { rerollCostMult: 'x' } }), 2);
    const { world, c } = setup({ anchors: 3 });
    const f = F.rollForecast(world, c, DATA, { rules: { anchorsAllowed: false } });
    assert.equal(f.canAnchor, false);
    assert.equal(f.anchorReason, 'disabled');
    assert.deepEqual(F.anchor(world, 'c1', DATA, { rules: { anchorsAllowed: false } }), { ok: false, reason: 'disabled', cost: 1 });
    assert.equal(world.wallet.anchors, 3);
  });

  for (const dial of DIALS) {
    it(`${dial}: roll -> reroll -> accept keeps the world valid and the stream consistent, with data/tuning.js as tuning`, () => {
      const { world, c } = setup({ seedCode: `E2E-${dial}`, dial, starsalt: 10, bond: 5 });
      const opts = { tuning: TUNING, rules: { ...DIAL_ROWS.find((d) => d.id === dial).rules, ...DIAL_ROWS.find((d) => d.id === dial).shift } };
      const f0 = F.rollForecast(world, c, DATA, opts);
      assert.equal(f0.cards.reduce((a, cd) => a + cd.odds, 0), 100);
      const r = /** @type {any} */ (F.reroll(world, 'c1', f0, DATA, opts));
      assert.equal(r.ok, true);
      const res = F.accept(world, 'c1', r.forecast, DATA, opts);
      assert.equal(c.speciesId, res.card.formId);
      assert.equal(c.shiftCount, 2);
      assert.deepEqual(validateWorld(world), []);
    });
  }
});

describe('presets and events under edge states', () => {
  it('auto-anchor with no window opens nothing to anchor and falls back to an open Forecast; auto-up never accepts a tie', () => {
    const { world, c } = setup({ anchors: 2 });
    c.windowsUsed = [9, 20];
    world.settings.autoAnchor = { c1: 'auto-anchor' };
    const r = F.runPreset(world, 'c1', DATA);
    assert.equal(r.action, 'open');
    assert.equal(world.wallet.anchors, 2);
    const tie = { preset: 'auto-up', canAnchor: false, cards: [{ odds: 40, empty: false }, { odds: 40, empty: false }, { odds: 20, empty: false }] };
    assert.equal(F.autoDecision(/** @type {any} */ (tie)), null);
    assert.equal(F.autoDecision(/** @type {any} */ (tie), { tuning: { AUTO_UP_STRICT: false } }), 'accept');
  });

  it('shift:resolved fires exactly once per Accept and per Anchor, after the world changed', () => {
    const { world, c } = setup({ anchors: 1 });
    c.level = 34;
    const seen = [];
    const bus = { emit: (e, p) => { if (e === 'shift:resolved') seen.push({ p, species: c.speciesId, count: c.shiftCount }); } };
    const f = F.rollForecast(world, c, DATA);
    F.accept(world, 'c1', f, DATA, { bus });
    F.anchor(world, 'c1', DATA, { bus });
    assert.equal(seen.length, 2);
    assert.equal(seen[0].species, seen[0].p.to);
    assert.equal(seen[0].count, 1);
    assert.equal(seen[1].p.anchored, true);
    assert.equal(seen[1].count, 2);
  });
});

describe('capture: adversarial', () => {
  const foe = (hp = 40, max = 40, status = null) => ({ speciesId: 'sloshkin', hp, stats: { hp: max }, status: status ? { kind: status } : null });

  it('odds rolled equal the percent shown, stay inside the clamp and within half a point of the engine', () => {
    for (const catchRate of [3, 45, 90, 190, 255]) {
      for (const hp of [1, 7, 20, 40]) {
        for (const status of [null, 'chill', 'burn']) {
          for (const fails of [0, 1, 5, 50]) {
            for (const grade of [1, 2, 3]) {
              const o = C.captureOdds(foe(hp, 40, status), { grade, fails, catchRate }, { dial: 'flux' });
              assert.ok(Math.abs(o.p * 100 - o.pct) < 1e-9);
              assert.equal(o.shown, o.pct);
              assert.ok(o.p >= 0.01 && o.p <= 0.99);
              const raw = engineOdds({ catchRate, hp, maxHp: 40, status, grade, fails }, ENGINE_DEFAULTS);
              assert.ok(Math.abs(o.p - raw) <= 0.005 + 1e-12);
            }
          }
        }
      }
    }
  });

  it('rounding never leaves a clamp that is not a whole percent', () => {
    const t = { CAPTURE_ODDS_MIN: 0.004, CAPTURE_ODDS_MAX: 0.996 };
    const low = C.captureOdds(foe(40), { grade: 1, catchRate: 0 }, { dial: 'drift', tuning: t });
    const high = C.captureOdds(foe(1), { grade: 3, catchRate: 255, fails: 9 }, { dial: 'drift', tuning: t });
    assert.equal(low.p, 0.01);
    assert.equal(high.p, 0.99);
    const tight = C.captureOdds(foe(40), { grade: 1, catchRate: 0 }, { dial: 'drift', tuning: { CAPTURE_ODDS_MIN: 0.001, CAPTURE_ODDS_MAX: 0.004 } });
    assert.equal(tight.p, 0.001, 'no whole percent inside the clamp: the exact odds are rolled');
  });

  it('every dial shows the right display, dial rules override, unknown dials need rules', () => {
    for (const dial of DIALS) {
      const o = C.captureOdds(foe(10), { grade: 1, catchRate: 120 }, { dial });
      assert.equal(o.display, dial === 'freefall' ? 'band' : 'percent');
      assert.equal(typeof o.shown, dial === 'freefall' ? 'string' : 'number');
      assert.equal(typeof o.next.shown, typeof o.shown);
    }
    assert.equal(C.captureOdds(foe(), { grade: 1, catchRate: 100 }, { dial: 'custom', rules: { captureDisplay: 'bands' } }).display, 'band');
    assert.equal(C.captureOdds(foe(), { grade: 1, catchRate: 100 }, { dial: 'freefall', rules: { captureDisplay: 'exact' } }).display, 'percent');
    assert.throws(() => C.captureOdds(foe(), { grade: 1, catchRate: 100 }, { dial: 'custom' }), RangeError);
    assert.throws(() => C.captureOdds(foe(), { grade: 1, catchRate: 100 }, {}), RangeError);
  });

  it('malformed targets and contexts throw instead of producing NaN odds', () => {
    for (const hp of [NaN, -1, Infinity, '10', undefined]) {
      assert.throws(() => C.captureOdds({ speciesId: 'sloshkin', hp, stats: { hp: 40 } }, { grade: 1, catchRate: 45 }, { dial: 'flux' }), RangeError, String(hp));
    }
    for (const maxHp of [0, -5, NaN]) {
      assert.throws(() => C.captureOdds(foe(10), { grade: 1, catchRate: 45, maxHp }, { dial: 'flux' }), RangeError, String(maxHp));
    }
    assert.throws(() => C.captureOdds(foe(), { grade: 9, catchRate: 45 }, { dial: 'flux' }), RangeError);
    assert.throws(() => C.captureOdds(foe(), { grade: 1, catchRate: NaN }, { dial: 'flux' }), RangeError);
    assert.throws(() => C.captureOdds(foe(), { grade: 1 }, { dial: 'flux' }), RangeError);
    assert.throws(() => C.captureOdds(null, { grade: 1 }, { dial: 'flux' }), TypeError);
    assert.throws(() => C.captureOdds(foe(), null, { dial: 'flux' }), TypeError);
    // a sure catch needs no catch rate and no valid HP
    assert.equal(C.captureOdds({ hp: NaN }, { grade: 'sure' }, { dial: 'freefall' }).p, 1);
  });

  it('huge and odd inputs: fails, HP over max, Stance at 0 HP, catch rate above 255', () => {
    const a = C.captureOdds(foe(10), { grade: 1, catchRate: 45, fails: 1e12 }, { dial: 'flux' });
    assert.equal(a.bonus, 0.15);
    assert.equal(C.captureOdds(foe(999, 40), { grade: 1, catchRate: 45 }, { dial: 'flux' }).p, C.captureOdds(foe(40, 40), { grade: 1, catchRate: 45 }, { dial: 'flux' }).p);
    assert.equal(C.captureOdds(foe(0), { grade: 1, catchRate: 45, stance: true }, { dial: 'flux' }).p, C.captureOdds(foe(1), { grade: 1, catchRate: 45 }, { dial: 'flux' }).p);
    assert.equal(C.captureOdds(foe(1), { grade: 3, catchRate: 1e9 }, { dial: 'flux' }).p, 0.99);
    assert.equal(C.failBonus(Infinity), 0.15);
    assert.equal(C.failBonus(NaN), 0);
    assert.equal(C.failBonus(-4), 0);
    const s = C.stanceFloor(5, 1e15, { stance: true });
    assert.deepEqual(s, { hp: 1, dealt: 4, floored: true });
    assert.deepEqual(C.stanceFloor(NaN, NaN, { stance: true }), { hp: 0, dealt: 0, floored: false });
  });

  it('data/tuning.js works as the capture tuning (GDD bands, 95% clamp)', () => {
    const lo = C.captureOdds(foe(40), { grade: 1, catchRate: 10 }, { dial: 'freefall', tuning: TUNING });
    const hi = C.captureOdds(foe(1), { grade: 3, catchRate: 255 }, { dial: 'freefall', tuning: TUNING });
    assert.equal(lo.shown, 'Slim');
    assert.equal(hi.p, 0.95);
    assert.equal(hi.shown, 'Sure');
  });

  it('attemptCapture is deterministic per seed, draws exactly once for ordinary odds and never for the sure catch', () => {
    const run = (seed) => {
      const rng = makeRng(seed);
      return Array.from({ length: 200 }, (_, i) => C.attemptCapture(rng, (i % 99 + 1) / 100).success);
    };
    assert.deepEqual(run('CAP-1'), run('CAP-1'));
    assert.notDeepEqual(run('CAP-1'), run('CAP-2'));
    let draws = 0;
    const counting = { chance: (p) => { draws++; return false; } };
    C.attemptCapture(/** @type {any} */ (counting), 0.5);
    assert.equal(draws, 1);
    const sure = C.captureOdds(foe(), { grade: 'sure' }, { dial: 'flux' });
    const r = C.attemptCapture(/** @type {any} */ (counting), sure);
    assert.equal(draws, 1);
    assert.equal(r.success, true);
    assert.equal(r.segments, 3);
    for (let i = 0; i < 100; i++) assert.equal(C.attemptCapture(makeRng(`z${i}`), 0).success, false);
    for (const bad of [NaN, -0.1, 1.1, '0.5', null, {}]) assert.throws(() => C.attemptCapture(makeRng('x'), /** @type {any} */ (bad)), TypeError);
    assert.throws(() => C.attemptCapture(/** @type {any} */ ({}), 0.5), TypeError);
  });

  it('a long attempt sequence converges on the shown odds', () => {
    const rng = makeRng('CAP-RATE');
    const o = C.captureOdds(foe(20), { grade: 1, catchRate: 90 }, { dial: 'drift' });
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (C.attemptCapture(rng, o).success) hits++;
    assert.ok(Math.abs(hits / N - o.p) < 0.015, `${hits / N} vs ${o.p}`);
  });
});

describe('a bus is optional everywhere; events carry plain data', () => {
  it('payloads JSON round-trip (no references to world objects leak)', () => {
    const { world, c } = setup({ anchors: 1, starsalt: 2 });
    c.level = 34;
    const { bus, events } = spyBus();
    let f = F.rollForecast(world, c, DATA);
    f = /** @type {any} */ (F.reroll(world, 'c1', f, DATA, { bus })).forecast;
    F.accept(world, 'c1', f, DATA, { bus });
    F.anchor(world, 'c1', DATA, { bus });
    for (const [, p] of events) assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    const resolved = events.filter(([e]) => e === 'shift:resolved').map(([, p]) => p);
    // mutating the world afterwards must not change an emitted payload
    const snap = JSON.stringify(resolved);
    c.shiftlog.push('mutated');
    c.memory.push('mutated');
    assert.equal(JSON.stringify(resolved), snap);
  });
});
