// Unit tests for js/systems/forecast.js. Run: node --test test/systems.forecast.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/forecast.js';
import { validateWorld } from '../js/state/schema.js';
import { makeRng } from '../js/core/rng.js';
import { forkFor } from '../js/state/rngs.js';
import { DATA, SLOSHKIN_ROW, setup, mk, spyBus } from './fixtures/forecast.fixture.mjs';

/** Rolls `n` Forecasts for one creature at draw indexes 0..n-1 (positioning only; nothing consumed). */
function sample(world, c, n, opts = {}) {
  const out = [];
  const keep = c.shiftCount;
  for (let i = 0; i < n; i++) {
    c.shiftCount = i;
    out.push(F.rollForecast(world, c, DATA, opts));
  }
  c.shiftCount = keep;
  return out;
}

const formsOf = (f) => f.cards.map((cd) => cd.formId);

describe('DEFAULTS and tuning', () => {
  it('carry the rules-doc / GDD-00 numbers and are deep-frozen', () => {
    assert.deepEqual(F.DEFAULTS.CARD_ODDS.drift, { up: 50, side: 40, down: 10 });
    assert.deepEqual(F.DEFAULTS.CARD_ODDS.flux, { up: 40, side: 35, down: 25 });
    assert.deepEqual(F.DEFAULTS.CARD_ODDS.freefall, { up: 30, side: 30, down: 40 });
    assert.deepEqual(F.DEFAULTS.BOND_CAP, { drift: 5, flux: 15, freefall: 10 });
    assert.equal(F.DEFAULTS.STAR_CHANCE, 0.02);
    assert.equal(F.DEFAULTS.SHIFTLOG_PULL, 5);
    assert.ok(Object.isFrozen(F.DEFAULTS) && Object.isFrozen(F.DEFAULTS.CARD_ODDS.flux) && Object.isFrozen(F.DEFAULTS.SILHOUETTE_DIALS));
    assert.deepEqual([...F.TUNING_KEYS].sort(), Object.keys(F.DEFAULTS).sort());
  });

  it('tuningOf merges known keys, ignores foreign keys, caches and rejects malformed values', () => {
    assert.equal(F.tuningOf(null), F.DEFAULTS);
    const o = { STAR_CHANCE: 0.5, MOVE_SLOTS: 9 };
    const t = F.tuningOf(o);
    assert.equal(t.STAR_CHANCE, 0.5);
    assert.equal(/** @type {any} */ (t).MOVE_SLOTS, undefined);
    assert.equal(F.tuningOf(o), t);
    assert.ok(Object.isFrozen(t));
    assert.throws(() => F.tuningOf({ CARD_ODDS: { drift: { up: 50, side: 40, down: 20 } } }), /CARD_ODDS/);
    assert.throws(() => F.tuningOf({ STAR_CARD: 'middle' }), /STAR_CARD/);
    assert.throws(() => F.tuningOf({ REROLL_GROWTH: 0.5 }), /REROLL_GROWTH/);
    assert.throws(() => F.tuningOf(3), TypeError);
    // the override object itself is not frozen by resolving it
    const mine = { BOND_CAP: { drift: 1, flux: 1, freefall: 1 } };
    F.tuningOf(mine);
    assert.ok(!Object.isFrozen(mine.BOND_CAP));
  });
});

describe('cardOdds', () => {
  it('base odds per dial', () => {
    for (const dial of ['drift', 'flux', 'freefall']) {
      const o = F.cardOdds(dial);
      assert.deepEqual([o.up, o.side, o.down], [F.DEFAULTS.CARD_ODDS[dial].up, F.DEFAULTS.CARD_ODDS[dial].side, F.DEFAULTS.CARD_ODDS[dial].down]);
      assert.equal(o.bondTilt, 0);
    }
  });

  it('Bond moves 5 points per pip Down -> Up, capped per dial, Down never below the floor (rules §4.3)', () => {
    const pick = (o) => [o.up, o.side, o.down];
    assert.deepEqual(pick(F.cardOdds('flux', { bond: 3 })), [55, 35, 10]); // the mockup
    assert.deepEqual(pick(F.cardOdds('flux', { bond: 5 })), [55, 35, 10]);
    assert.deepEqual(pick(F.cardOdds('flux', { bond: 1 })), [45, 35, 20]);
    assert.deepEqual(pick(F.cardOdds('drift', { bond: 1 })), [55, 40, 5]);
    assert.deepEqual(pick(F.cardOdds('drift', { bond: 5 })), [55, 40, 5]);
    assert.deepEqual(pick(F.cardOdds('freefall', { bond: 5 })), [40, 30, 30]);
    assert.equal(F.cardOdds('freefall', { bond: 5 }).bondTilt, 10);
    // the floor binds before the cap
    const t = { DOWN_FLOOR: { drift: 8, flux: 0, freefall: 0 } };
    assert.deepEqual(pick(F.cardOdds('drift', { bond: 5 }, { tuning: t })), [52, 40, 8]);
    // junk bond counts as 0
    assert.deepEqual(pick(F.cardOdds('flux', { bond: -3 })), [40, 35, 25]);
    assert.deepEqual(pick(F.cardOdds('flux', { bond: /** @type {any} */ ('x') })), [40, 35, 25]);
  });

  it('steadied moves 5 Down -> Side after Bond (GDD-00 lit.steadied)', () => {
    const pick = (o) => [o.up, o.side, o.down];
    assert.deepEqual(pick(F.cardOdds('drift', { steadied: true })), [50, 45, 5]);
    assert.deepEqual(pick(F.cardOdds('flux', { steadied: true })), [40, 40, 20]);
    assert.deepEqual(pick(F.cardOdds('freefall', { steadied: true })), [30, 35, 35]);
    assert.deepEqual(pick(F.cardOdds('drift', { bond: 1, steadied: true })), [55, 40, 5]);
  });

  it('an Errant Down card is 0% on Drift / Flux only, its points spread in proportion', () => {
    const d = F.cardOdds('drift', { errant: true });
    assert.equal(d.down, 0);
    assert.equal(d.up + d.side, 100);
    assert.deepEqual([d.up, d.side], [56, 44]); // 50:40 of 10 -> 5.56 / 4.44
    assert.equal(F.cardOdds('flux', { errant: true }).down, 0);
    assert.equal(F.cardOdds('freefall', { errant: true }).down, 40);
    assert.equal(F.cardOdds('freefall', { errant: true }).errant, false);
  });

  it('empty cards are 0% and the odds still sum to 100', () => {
    const o = F.cardOdds('flux', { empty: ['down'] });
    assert.equal(o.down, 0);
    assert.equal(o.up + o.side + o.down, 100);
    const two = F.cardOdds('flux', { empty: ['side', 'down'] });
    assert.deepEqual([two.up, two.side, two.down], [100, 0, 0]);
  });

  it('rejects an unknown dial', () => {
    assert.throws(() => F.cardOdds('custom'), (e) => e instanceof F.ForecastError && e.code === 'BAD_DIAL');
  });
});

describe('redistribute and pickIndex', () => {
  it('largest remainder keeps whole numbers summing to 100', () => {
    for (const odds of [[50, 40, 10], [33, 33, 34], [1, 1, 98], [0, 0, 100]]) {
      for (const z of [0, 1, 2]) {
        const r = F.redistribute(odds, new Set([z]));
        assert.equal(r[z], 0);
        assert.equal(r.reduce((a, b) => a + b, 0), 100);
        assert.ok(r.every(Number.isInteger));
      }
    }
    assert.deepEqual(F.redistribute([0, 0, 100], new Set([2])), [50, 50, 0]);
  });

  it('pickIndex maps a uniform onto the odds and skips 0% cards', () => {
    assert.equal(F.pickIndex([50, 40, 10], 0), 0);
    assert.equal(F.pickIndex([50, 40, 10], 0.4999), 0);
    assert.equal(F.pickIndex([50, 40, 10], 0.5), 1);
    assert.equal(F.pickIndex([50, 40, 10], 0.9), 2);
    assert.equal(F.pickIndex([50, 40, 10], 0.999999), 2);
    assert.equal(F.pickIndex([60, 40, 0], 0.999999), 1);
    assert.equal(F.pickIndex({ up: 0, side: 0, down: 100 }, 0), 2);
  });
});

describe('cardPool (creatures §6.3)', () => {
  const c = { speciesId: 'skeinwing', shiftlog: ['sloshkin', 'skeinwing'] };
  it('drops the current form and spreads its weight in proportion', () => {
    const row = [{ form: 'a', w: 30 }, { form: 'b', w: 30 }, { form: 'skeinwing', w: 40 }];
    const pool = F.cardPool(row, 'flux', { speciesId: 'skeinwing', shiftlog: [] });
    assert.deepEqual(pool.map((e) => e.form), ['a', 'b']);
    assert.ok(Math.abs(pool[0].w - 50) < 1e-9 && Math.abs(pool[1].w - 50) < 1e-9);
  });
  it('adds the Shiftlog pull to held forms with a weight on this dial', () => {
    const pool = F.cardPool([{ form: 'sloshkin', w: { drift: 100, flux: 70, freefall: 50 } }, { form: 'puddlepip', w: { drift: 0, flux: 30, freefall: 50 } }], 'flux', c);
    assert.deepEqual(pool, [{ form: 'sloshkin', w: 75 }, { form: 'puddlepip', w: 30 }]);
    // a 0-weight form stays out on that dial unless PULL_REVIVES_ZERO
    const drift = F.cardPool([{ form: 'sloshkin', w: 0 }], 'drift', c);
    assert.deepEqual(drift, []);
    assert.deepEqual(F.cardPool([{ form: 'sloshkin', w: 0 }], 'drift', c, { tuning: { PULL_REVIVES_ZERO: true } }), [{ form: 'sloshkin', w: 5 }]);
  });
  it('uses per-dial weights, merges duplicates, multiplies the tilted type and rejects bad weights', () => {
    const pool = F.cardPool(SLOSHKIN_ROW.up, 'drift', { speciesId: 'sloshkin', shiftlog: ['sloshkin'] });
    assert.deepEqual(pool.map((e) => [e.form, e.w]), [['siltback', 70], ['skeinwing', 20], ['bogmonarch', 10]]);
    assert.deepEqual(F.cardPool([{ form: 'a', w: 1 }, { form: 'a', w: 2 }], 'flux', { speciesId: 'x' }), [{ form: 'a', w: 3 }]);
    const typesOf = (id) => (id === 'a' ? ['Brine'] : ['Grit']);
    assert.deepEqual(F.cardPool([{ form: 'a', w: 10 }, { form: 'b', w: 10 }], 'flux', { speciesId: 'x' }, { tilt: 'Brine', typesOf }), [{ form: 'a', w: 20 }, { form: 'b', w: 10 }]);
    assert.throws(() => F.cardPool([{ form: 'a', w: -1 }], 'flux', { speciesId: 'x' }), TypeError);
    assert.throws(() => F.cardPool([{ form: 'a', w: { flux: NaN } }], 'flux', { speciesId: 'x' }), TypeError);
    assert.deepEqual(F.cardPool(null, 'flux', { speciesId: 'x' }), []);
  });
});

describe('rollForecast', () => {
  it('draws three cards from the family pools with full card data (the Flux mockup)', () => {
    const { world, c } = setup({ bond: 3 });
    const f = F.rollForecast(world, c, DATA);
    assert.deepEqual(f.cards.map((cd) => cd.dir), ['up', 'side', 'down']);
    assert.deepEqual(f.odds, { up: 55, side: 35, down: 10 });
    assert.equal(f.bondTilt, 15);
    assert.equal(f.cards.reduce((a, cd) => a + cd.odds, 0), 100);
    assert.ok(SLOSHKIN_ROW.up.some((e) => e.form === f.cards[0].formId));
    assert.ok(SLOSHKIN_ROW.side.some((e) => e.form === f.cards[1].formId) || f.cards[1].isStarTouched);
    assert.ok(SLOSHKIN_ROW.down.some((e) => e.form === f.cards[2].formId));
    for (const cd of f.cards) {
      assert.equal(cd.from, 'sloshkin');
      assert.equal(cd.draw, 0);
      assert.equal(cd.movesTotal, c.moves.length);
      assert.ok(cd.keepsMoves >= 1 && cd.keepsMoves <= c.moves.length);
      assert.equal(cd.keepsMoves + cd.toMemory.length, c.moves.length);
      assert.equal(typeof cd.ability, 'string');
      assert.deepEqual(cd.types, DATA.species[cd.formId].types);
    }
    assert.equal(f.heartmark, c.heartmark);
    assert.equal(f.dial, 'flux');
    assert.equal(f.uid, 'c1');
    assert.equal(f.formId, 'sloshkin');
    assert.ok([0, 1, 2].includes(f.picked));
    assert.equal(f.picked, F.pickIndex(f.odds, f.roll));
    // JSON-safe
    assert.deepEqual(JSON.parse(JSON.stringify(f)), f);
  });

  it('reads only: the world is unchanged and no draw is consumed', () => {
    const { world, c } = setup({ starsalt: 5, anchors: 1 });
    const before = JSON.stringify(world);
    F.rollForecast(world, c, DATA);
    F.rollForecast(world, 'c1', DATA);
    assert.equal(JSON.stringify(world), before);
  });

  it('statTotalDelta and keepsMoves match the Shift that lands (stat floor included)', () => {
    const { world, c } = setup({ dial: 'drift' });
    const f = F.rollForecast(world, c, DATA);
    const down = f.cards[2];
    assert.ok(down.statTotalDelta < 0);
    const r = F.applyShift(world, 'c1', down.formId, DATA, { consumeWindow: false });
    assert.equal(r.statDelta, down.statTotalDelta);
    assert.equal(r.kept.length, down.keepsMoves);
  });

  it('marks Ward abilities and uses the per-seed ability / Ward placement when the run has one', () => {
    const { world, c } = setup();
    const f = F.rollForecast(world, c, DATA);
    assert.equal(f.cards[2].formId, 'puddlepip');
    assert.equal(f.cards[2].isWard, true);
    world.run.gen.abilities.puddlepip = 'tidecall';
    assert.equal(F.rollForecast(world, c, DATA).cards[2].ability, 'tidecall');
    assert.equal(F.rollForecast(world, c, DATA).cards[2].isWard, false);
    world.run.gen.wards.puddlepip = 'stillcoat';
    assert.equal(F.rollForecast(world, c, DATA).cards[2].ability, 'stillcoat');
  });

  it('the current form never appears and directions follow the current form', () => {
    const { world, c } = setup({ speciesId: 'skeinwing', dial: 'flux' });
    for (const f of sample(world, c, 200)) {
      assert.ok(!formsOf(f).includes('skeinwing'));
      assert.ok(['bogmonarch', 'lumenveil'].includes(f.cards[0].formId));
      assert.ok(f.cards[1].formId === 'siltback' || f.cards[1].isStarTouched);
    }
  });

  it('an empty pool shows an empty 0% card and the others take its odds', () => {
    const { world, c } = setup({ speciesId: 'puddlepip', dial: 'flux' });
    const f = F.rollForecast(world, c, DATA);
    assert.equal(f.cards[2].empty, true);
    assert.equal(f.cards[2].formId, null);
    assert.equal(f.cards[2].odds, 0);
    assert.equal(f.cards[0].odds + f.cards[1].odds, 100);
    for (const g of sample(world, c, 100)) assert.notEqual(g.picked, 2);
  });

  it('refuses forms that never Shift, forms with no table row, all-empty pools and unknown dials', () => {
    const v = setup({ speciesId: 'vagary' });
    assert.throws(() => F.rollForecast(v.world, v.c, DATA), (e) => e.code === 'NEVER_SHIFTS');
    assert.deepEqual(F.canForecast(v.world, v.c, DATA), { ok: false, reason: 'never-shifts' });
    const t = setup({ speciesId: 'tossup' });
    assert.throws(() => F.rollForecast(t.world, t.c, DATA), (e) => e.code === 'NO_TABLE');
    assert.deepEqual(F.canForecast(t.world, t.c, DATA), { ok: false, reason: 'no-table' });
    const m = setup({ speciesId: 'mudfist' });
    assert.throws(() => F.rollForecast(m.world, m.c, DATA), (e) => e.code === 'EMPTY_POOL');
    assert.deepEqual(F.canForecast(m.world, m.c, DATA), { ok: false, reason: 'empty-pool' });
    const s = setup();
    assert.throws(() => F.rollForecast(s.world, s.c, DATA, { dial: 'custom' }), (e) => e.code === 'BAD_DIAL');
    assert.deepEqual(F.canForecast(s.world, s.c, DATA), { ok: true });
    assert.deepEqual(F.canForecast(s.world, 'nobody', DATA), { ok: false, reason: 'no-creature' });
    s.c.stillKnot = true;
    assert.deepEqual(F.canForecast(s.world, s.c, DATA), { ok: false, reason: 'still-knot' });
    assert.throws(() => F.rollForecast(s.world, 'nobody', DATA), (e) => e.code === 'NO_CREATURE');
  });

  it('falls back to the current form\'s own family table', () => {
    const { world, c } = setup({ speciesId: 'squallcoil' });
    c.familyId = 'sloshkin'; // e.g. a Sloshkin that Shifted into a form of another family
    const f = F.rollForecast(world, c, DATA);
    assert.deepEqual(formsOf(f).slice(0, 1), ['vesperay']);
  });
});

describe('determinism (§9)', () => {
  it('same seed + same creature = same Forecast; the stream is the shift:<uid> fork at shiftCount', () => {
    const a = setup({ seedCode: 'SEED-A' });
    const b = setup({ seedCode: 'SEED-A' });
    assert.deepEqual(F.rollForecast(a.world, a.c, DATA), F.rollForecast(b.world, b.c, DATA));
    const stream = forkFor(a.world.run.seed, 'shift:c1').fork(0);
    assert.deepEqual(F.rollForecast(a.world, a.c, DATA, { stream }), F.rollForecast(a.world, a.c, DATA));
    assert.deepEqual(F.shiftStream(a.world, a.c).state(), F.streamFor(a.world.run.seed, 'c1', 0).state());
  });

  it('10 rerolls give identical card sequences on two worlds with the same seed', () => {
    const run = () => {
      const { world } = setup({ seedCode: 'SEED-R', starsalt: 2000 });
      let f = F.rollForecast(world, 'c1', DATA);
      const seq = [formsOf(f).concat(f.picked)];
      for (let i = 0; i < 10; i++) {
        const r = F.reroll(world, 'c1', f, DATA);
        assert.equal(r.ok, true);
        f = r.forecast;
        seq.push(formsOf(f).concat(f.picked));
      }
      return { seq, world };
    };
    const x = run();
    const y = run();
    assert.deepEqual(x.seq, y.seq);
    assert.equal(x.world.party[0].shiftCount, 10);
  });

  it('a Forecast at shiftCount n equals the one reached by n rerolls (a save reproduces the cards)', () => {
    const { world } = setup({ seedCode: 'SEED-P', starsalt: 100 });
    let f = F.rollForecast(world, 'c1', DATA);
    for (let i = 0; i < 4; i++) f = /** @type {any} */ (F.reroll(world, 'c1', f, DATA)).forecast;
    const fresh = setup({ seedCode: 'SEED-P' });
    fresh.c.shiftCount = 4;
    const g = F.rollForecast(fresh.world, fresh.c, DATA);
    assert.deepEqual(formsOf(g), formsOf(f));
    assert.equal(g.picked, f.picked);
    assert.equal(g.roll, f.roll);
  });

  it('different seeds and different uids diverge', () => {
    const sig = (world, c) => sample(world, c, 12).map((f) => formsOf(f).join(',') + f.picked).join('|');
    const a = setup({ seedCode: 'SEED-1' });
    const b = setup({ seedCode: 'SEED-2' });
    const u = setup({ seedCode: 'SEED-1', uid: 'c2' });
    assert.notEqual(sig(a.world, a.c), sig(b.world, b.c));
    assert.notEqual(sig(a.world, a.c), sig(u.world, u.c));
  });

  it('streamFor validates its inputs', () => {
    assert.throws(() => F.streamFor(-1, 'c1', 0), TypeError);
    assert.throws(() => F.streamFor(1, '', 0), TypeError);
    assert.throws(() => F.streamFor(1, 'c1', 1.5), TypeError);
  });
});

describe('distributions', () => {
  const N = 3000;
  it('Star-touched takes the Side slot about 2% of the time, at the Side odds', () => {
    const { world, c } = setup({ seedCode: 'SEED-STAR', dial: 'drift' });
    const fs = sample(world, c, N);
    const stars = fs.filter((f) => f.starTouched);
    const rate = stars.length / N;
    assert.ok(rate > 0.01 && rate < 0.03, `star rate ${rate}`);
    for (const f of stars) {
      assert.equal(f.cards[1].formId, 'star-touched-sloshkin');
      assert.equal(f.cards[1].isStarTouched, true);
      assert.equal(f.cards[1].odds, 40);
    }
    for (const f of fs) assert.ok(f.starTouched || f.cards[1].formId !== 'star-touched-sloshkin');
  });

  it('pool weights follow the dial (Drift: Siltback ~70%, Lumenveil never) and picks follow the odds', () => {
    const { world, c } = setup({ seedCode: 'SEED-DIST', dial: 'drift' });
    const fs = sample(world, c, N);
    const up = {};
    for (const f of fs) up[f.cards[0].formId] = (up[f.cards[0].formId] ?? 0) + 1;
    assert.equal(up.lumenveil ?? 0, 0);
    assert.ok(Math.abs(up.siltback / N - 0.7) < 0.04, `siltback ${up.siltback / N}`);
    assert.ok(Math.abs(up.skeinwing / N - 0.2) < 0.04);
    assert.ok(fs.every((f) => f.cards[2].formId === 'puddlepip')); // Chillnub is 0 on Drift
    const picks = [0, 0, 0];
    for (const f of fs) picks[f.picked]++;
    assert.ok(Math.abs(picks[0] / N - 0.5) < 0.04 && Math.abs(picks[1] / N - 0.4) < 0.04 && Math.abs(picks[2] / N - 0.1) < 0.03, `picks ${picks}`);
  });

  it('a held type tilt guarantees a card of that type and never changes the odds', () => {
    const { world, c } = setup({ seedCode: 'SEED-TILT', dial: 'drift', heldItem: 'fx-rime-glass' });
    const base = setup({ seedCode: 'SEED-TILT', dial: 'drift' });
    const tilted = sample(world, c, 300);
    const plain = sample(base.world, base.c, 300);
    // Chillnub (Rime) is 0 on Drift, so no pool has a Rime form: the tilt cannot apply
    assert.ok(tilted.every((f) => f.tilt && f.tilt.type === 'Rime' && !f.tilt.applied));
    // on Flux Chillnub is in the Down pool
    world.run.dial = 'flux';
    base.world.run.dial = 'flux';
    const tf = sample(world, c, 300);
    const pf = sample(base.world, base.c, 300);
    assert.ok(tf.every((f) => f.cards.some((cd) => cd.types.includes('Rime'))));
    assert.ok(pf.some((f) => !f.cards.some((cd) => cd.types.includes('Rime'))));
    assert.ok(tf.some((f) => f.tilt.applied));
    for (let i = 0; i < 300; i++) assert.deepEqual(tf[i].odds, pf[i].odds);
    assert.equal(plain[0].tilt, null);
    // explicit opts.tilt wins over the held item; null disables it
    assert.equal(F.rollForecast(world, c, DATA, { tilt: null }).tilt, null);
    assert.equal(F.rollForecast(base.world, base.c, DATA, { tilt: 'Grit' }).tilt.type, 'Grit');
  });

  it('an Errant\'s Down card shows 0% on Drift / Flux and never lands', () => {
    const { world, c } = setup({ speciesId: 'squallcoil', dial: 'flux' });
    const fs = sample(world, c, 400);
    for (const f of fs) {
      assert.equal(f.errant, true);
      assert.equal(f.cards[2].odds, 0);
      assert.equal(f.cards[2].formId, 'puddlepip'); // still shown
      assert.notEqual(f.picked, 2);
    }
    world.run.dial = 'freefall';
    const ff = F.rollForecast(world, c, DATA);
    assert.equal(ff.errant, false);
    assert.equal(ff.cards[2].odds, 40);
    assert.equal(F.rollForecast(world, c, DATA, { dial: 'flux', errant: false }).cards[2].odds, 25);
  });
});

describe('silhouettes and markSeen', () => {
  it('unseen forms are silhouettes and unread abilities hidden on Freefall only', () => {
    const { world, c } = setup({ dial: 'freefall' });
    const f = F.rollForecast(world, c, DATA);
    assert.ok(f.cards.every((cd) => cd.silhouette && cd.abilityHidden));
    world.fieldLog.forms[f.cards[0].formId] = { seen: true, read: false, held: false, ability: null };
    const g = F.rollForecast(world, c, DATA);
    assert.equal(g.cards[0].silhouette, false);
    assert.equal(g.cards[0].abilityHidden, true);
    const flux = F.rollForecast(world, c, DATA, { dial: 'flux' });
    assert.ok(flux.cards.every((cd) => !cd.silhouette && !cd.abilityHidden));
  });

  it('markSeen marks face-up cards (not silhouettes) through the Field Log', () => {
    const { world, c } = setup({ dial: 'flux' });
    const { bus, events } = spyBus();
    const f = F.rollForecast(world, c, DATA);
    const first = F.markSeen(world, f, { bus });
    assert.deepEqual(first, formsOf(f));
    assert.ok(formsOf(f).every((id) => world.fieldLog.forms[id].seen));
    assert.equal(events.filter(([e]) => e === 'fieldLog:seen').length, 3);
    assert.deepEqual(F.markSeen(world, f, { bus }), []);
    const ff = setup({ dial: 'freefall' });
    const sil = F.rollForecast(ff.world, ff.c, DATA);
    assert.deepEqual(F.markSeen(ff.world, sil), []);
    assert.deepEqual(F.markSeen(ff.world, sil, { tuning: { SILHOUETTE_MARKS_SEEN: true } }), formsOf(sil));
  });
});

describe('flip', () => {
  it('without an rng lands on the card drawn with the Forecast', () => {
    const { world, c } = setup();
    for (const f of sample(world, c, 50)) {
      const r = F.flip(f);
      assert.equal(r.index, f.picked);
      assert.equal(r.card, f.cards[f.picked]);
    }
  });
  it('with an rng draws one uniform and follows the odds', () => {
    const { world, c } = setup({ dial: 'drift' });
    const f = F.rollForecast(world, c, DATA);
    const rng = makeRng('flip');
    const n = [0, 0, 0];
    for (let i = 0; i < 4000; i++) n[F.flip(f, rng).index]++;
    assert.ok(Math.abs(n[0] / 4000 - 0.5) < 0.03 && Math.abs(n[2] / 4000 - 0.1) < 0.02, `${n}`);
    const a = makeRng('same');
    const b = makeRng('same');
    assert.equal(F.flip(f, a).index, F.flip(f, b).index);
  });
  it('refuses a Forecast whose cards are all 0%', () => {
    const { world, c } = setup();
    const f = F.rollForecast(world, c, DATA);
    const broken = { ...f, cards: f.cards.map((cd) => ({ ...cd, odds: 0 })) };
    assert.throws(() => F.flip(/** @type {any} */ (broken)), (e) => e.code === 'BAD_CARD');
  });
});

describe('applyShift and accept', () => {
  it('applies the form, appends the Shiftlog, consumes the window and a draw, marks Held, emits shift:resolved', () => {
    const { world, c } = setup({ seedCode: 'SEED-ACC' });
    const { bus, events } = spyBus();
    const f = F.rollForecast(world, c, DATA);
    const card = f.cards[f.picked];
    const r = F.accept(world, 'c1', f, DATA, { bus });
    assert.equal(r.index, f.picked);
    assert.equal(r.card, card);
    assert.equal(c.speciesId, card.formId);
    assert.deepEqual(c.shiftlog, ['sloshkin', card.formId]);
    assert.equal(c.shiftCount, 1);
    assert.deepEqual(c.windowsUsed, [9, 20]);
    assert.deepEqual(world.pendingShifts, []);
    assert.equal(world.fieldLog.forms[card.formId].held, true);
    assert.equal(world.stats.forecasts, 1);
    assert.equal(c.level, 20);
    assert.equal(r.result.level, 20);
    assert.equal(r.result.dir, card.dir);
    const ev = events.find(([e]) => e === 'shift:resolved');
    assert.ok(ev);
    assert.equal(ev[1].anchored, false);
    assert.equal(ev[1].to, card.formId);
    assert.ok(events.some(([e]) => e === 'fieldLog:held'));
    assert.deepEqual(validateWorld(world), []);
  });

  it('rejects stale cards and Forecasts, empty cards and 0% cards', () => {
    const { world, c } = setup({ starsalt: 10 });
    const f = F.rollForecast(world, c, DATA);
    const r = /** @type {any} */ (F.reroll(world, 'c1', f, DATA));
    assert.throws(() => F.applyShift(world, 'c1', f.cards[0], DATA), (e) => e.code === 'STALE');
    assert.throws(() => F.accept(world, 'c1', f, DATA), (e) => e.code === 'STALE');
    assert.throws(() => F.reroll(world, 'c1', f, DATA), (e) => e.code === 'STALE');
    assert.throws(() => F.applyShift(world, 'c1', { ...r.forecast.cards[0], empty: true, formId: null }, DATA), (e) => e.code === 'BAD_CARD');
    assert.throws(() => F.applyShift(world, 'c1', { ...r.forecast.cards[0], odds: 0 }, DATA), (e) => e.code === 'ZERO_ODDS');
    assert.throws(() => F.applyShift(world, 'nobody', 'siltback', DATA), (e) => e.code === 'NO_CREATURE');
    assert.throws(() => F.applyShift(world, 'c1', 'siltback', DATA, { dial: 'custom' }), (e) => e.code === 'BAD_DIAL');
    assert.equal(c.speciesId, 'sloshkin');
  });

  it('a bare form id applies without a window when consumeWindow is false; the first Shift pins a Heartmark technique', () => {
    const { world, c } = setup();
    c.heartmark = null;
    const move = c.moves[1].id;
    const r = F.applyShift(world, 'c1', 'puddlepip', DATA, { consumeWindow: false, heartmark: move });
    assert.equal(r.level, null);
    assert.equal(c.heartmark, move);
    assert.deepEqual(world.pendingShifts, ['c1']);
    assert.equal(c.shiftCount, 1);
  });

  it('a Shift keeps level, EXP, held item, nickname, Bond and trained points (rules §2.6)', () => {
    const { world, c } = setup({ heldItem: 'fx-brine-glass', bond: 2 });
    c.nickname = 'PUDDLE';
    c.trained.atk = 40;
    const keep = { level: c.level, exp: c.exp, heldItem: c.heldItem, nickname: c.nickname, bond: c.bond, trained: { ...c.trained }, heartmark: c.heartmark };
    F.applyShift(world, 'c1', 'mudfist', DATA);
    assert.deepEqual({ level: c.level, exp: c.exp, heldItem: c.heldItem, nickname: c.nickname, bond: c.bond, trained: { ...c.trained }, heartmark: c.heartmark }, keep);
  });
});

describe('reroll', () => {
  it('rerollCost escalates 1, 2, 4, 8 ... with a per-dial multiplier', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((n) => F.rerollCost(n)), [1, 2, 4, 8, 16]);
    assert.equal(F.rerollCost(2, { dial: 'flux', tuning: { REROLL_COST_MULT: { drift: 1, flux: 3, freefall: 1 } } }), 12);
    assert.equal(F.rerollCost(0, { tuning: { REROLL_BASE: 2, REROLL_GROWTH: 3 } }), 2);
    assert.equal(F.rerollCost(2, { tuning: { REROLL_BASE: 2, REROLL_GROWTH: 3 } }), 18);
    assert.equal(F.rerollCost(2000), Number.MAX_SAFE_INTEGER);
    assert.throws(() => F.rerollCost(-1), TypeError);
  });

  it('spends escalating Starsalt, consumes a draw, counts the stat and returns the next Forecast', () => {
    const { world, c } = setup({ starsalt: 7 });
    const { bus, events } = spyBus();
    let f = F.rollForecast(world, c, DATA);
    assert.equal(f.rerollCost, 1);
    const costs = [];
    for (let i = 0; i < 3; i++) {
      const r = /** @type {any} */ (F.reroll(world, 'c1', f, DATA, { bus }));
      assert.equal(r.ok, true);
      costs.push(r.spent);
      f = r.forecast;
    }
    assert.deepEqual(costs, [1, 2, 4]);
    assert.equal(world.wallet.starsalt, 0);
    assert.equal(c.shiftCount, 3);
    assert.equal(world.stats.rerolls, 3);
    assert.equal(f.rerolls, 3);
    assert.equal(f.rerollCost, 8);
    assert.equal(f.canReroll, false);
    assert.equal(f.rerollReason, 'starsalt');
    assert.ok(events.some(([e, p]) => e === 'wallet:changed' && p.currency === 'starsalt'));
    const refused = F.reroll(world, 'c1', f, DATA);
    assert.deepEqual(refused, { ok: false, reason: 'starsalt', cost: 8 });
    assert.equal(c.shiftCount, 3);
  });

  it('is locked until the first badge (rules §4.6)', () => {
    const { world, c } = setup({ starsalt: 5, badges: [] });
    const f = F.rollForecast(world, c, DATA);
    assert.equal(f.canReroll, false);
    assert.equal(f.rerollReason, 'locked');
    assert.deepEqual(F.reroll(world, 'c1', f, DATA), { ok: false, reason: 'locked', cost: 1 });
    assert.equal(world.wallet.starsalt, 5);
    assert.equal(c.shiftCount, 0);
  });
});

describe('anchor', () => {
  it('spends a stone, uses the window up, consumes a draw and emits shift:resolved', () => {
    const { world, c } = setup({ anchors: 2 });
    const { bus, events } = spyBus();
    const r = F.anchor(world, 'c1', DATA, { bus });
    assert.deepEqual(r, { ok: true, uid: 'c1', level: 20, spent: 1 });
    assert.equal(world.wallet.anchors, 1);
    assert.equal(c.speciesId, 'sloshkin');
    assert.equal(c.shiftCount, 1);
    assert.deepEqual(c.windowsUsed, [9, 20]);
    assert.deepEqual(world.pendingShifts, []);
    assert.equal(world.stats.anchors, 1);
    assert.equal(world.stats.forecasts, 1);
    const ev = events.find(([e]) => e === 'shift:resolved');
    assert.equal(ev[1].anchored, true);
    // the window does not re-open
    assert.deepEqual(F.anchor(world, 'c1', DATA), { ok: false, reason: 'no-window', cost: 1 });
    assert.equal(F.anchor(world, 'c1', DATA, { requireWindow: false }).ok, true);
  });

  it('refuses without stones, under Ride the Dice; Restless costs two; Keeper\'s Anchor is free', () => {
    const none = setup({ anchors: 0 });
    assert.deepEqual(F.anchor(none.world, 'c1', DATA), { ok: false, reason: 'no-stones', cost: 1 });
    assert.equal(F.rollForecast(none.world, none.c, DATA).canAnchor, false);
    assert.equal(F.rollForecast(none.world, none.c, DATA).anchorReason, 'no-stones');
    const free = F.anchor(none.world, 'c1', DATA, { freeAnchor: true });
    assert.equal(free.ok, true);
    assert.equal(/** @type {any} */ (free).spent, 0);

    const dice = setup({ anchors: 3, challenges: ['ride-the-dice'] });
    assert.deepEqual(F.anchor(dice.world, 'c1', DATA), { ok: false, reason: 'disabled', cost: 1 });
    assert.equal(dice.world.wallet.anchors, 3);

    const restless = setup({ anchors: 1, challenges: ['restless'] });
    assert.equal(F.anchorCost(restless.world), 2);
    assert.deepEqual(F.anchor(restless.world, 'c1', DATA), { ok: false, reason: 'no-stones', cost: 2 });
    restless.world.wallet.anchors = 2;
    assert.equal(F.anchor(restless.world, 'c1', DATA).ok, true);
    assert.equal(restless.world.wallet.anchors, 0);
    assert.equal(F.anchorCost(restless.world, { challenges: [] }), 1);
  });
});

describe('presets (rules §2.3)', () => {
  it('autoDecision: Auto-Anchor while possible, Auto-accept Up when Up leads', () => {
    const { world, c } = setup({ anchors: 1 });
    const f = F.rollForecast(world, c, DATA);
    assert.equal(F.autoDecision(f), null);
    assert.equal(F.autoDecision(f, { preset: 'auto-anchor' }), 'anchor');
    assert.equal(F.autoDecision({ ...f, canAnchor: false }, { preset: 'auto-anchor' }), null);
    assert.equal(F.autoDecision(f, { preset: 'auto-up' }), 'accept'); // Flux 40/35/25
    const ff = F.rollForecast(world, c, DATA, { dial: 'freefall' });
    assert.equal(F.autoDecision(ff, { preset: 'auto-up' }), null); // 30/30/40
    const tie = { ...f, cards: [{ ...f.cards[0], odds: 40 }, { ...f.cards[1], odds: 40 }, { ...f.cards[2], odds: 20 }] };
    assert.equal(F.autoDecision(/** @type {any} */ (tie), { preset: 'auto-up' }), null);
    assert.equal(F.autoDecision(/** @type {any} */ (tie), { preset: 'auto-up', tuning: { AUTO_UP_STRICT: false } }), 'accept');
  });

  it('runPreset anchors, accepts or opens', () => {
    const a = setup({ anchors: 1 });
    a.world.settings.autoAnchor.c1 = 'auto-anchor';
    const r1 = F.runPreset(a.world, 'c1', DATA);
    assert.equal(r1.action, 'anchored');
    assert.equal(a.world.wallet.anchors, 0);

    const b = setup({ anchors: 0 });
    b.world.settings.autoAnchor.c1 = 'auto-anchor';
    const r2 = F.runPreset(b.world, 'c1', DATA);
    assert.equal(r2.action, 'open');
    assert.equal(/** @type {any} */ (r2).forecast.preset, 'auto-anchor');

    const u = setup({ dial: 'flux' });
    u.world.settings.autoAnchor.c1 = 'auto-up';
    const r3 = /** @type {any} */ (F.runPreset(u.world, 'c1', DATA));
    assert.equal(r3.action, 'accepted');
    assert.equal(u.c.speciesId, r3.card.formId);
    assert.equal(u.c.shiftCount, 1);

    const n = setup({ dial: 'freefall' });
    n.world.settings.autoAnchor.c1 = 'auto-up';
    assert.equal(F.runPreset(n.world, 'c1', DATA).action, 'open');
    assert.equal(F.runPreset(setup().world, 'c1', DATA).action, 'open');
  });
});

describe('mk sanity', () => {
  it('fixture creatures start with their form in the Shiftlog', () => {
    assert.deepEqual(mk('c9', 'sloshkin', 10).shiftlog, ['sloshkin']);
  });
});
