// Unit tests for js/systems/wallet.js. Run: node --test test/systems.wallet.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as wallet from '../js/systems/wallet.js';
import { validateWorld } from '../js/state/schema.js';
import { freshWorld, recBus, at, TABLES } from './fixtures/econ.fixture.mjs';

describe('wallet: earn / spend / canAfford', () => {
  it('earns into main by default, uncapped, and emits wallet:changed', () => {
    const w = freshWorld();
    const bus = recBus();
    assert.deepEqual(wallet.earn(w, 250, { bus }), { ok: true, currency: 'main', earned: 250, balance: 250 });
    wallet.earn(w, 10_000_000, { bus });
    assert.equal(w.wallet.main, 10_000_250);
    assert.deepEqual(bus.of('wallet:changed')[0], { currency: 'main', delta: 250, balance: 250, source: 'earn' });
    assert.deepEqual(validateWorld(w), []);
  });

  it('earns and spends the other spendable currencies', () => {
    const w = freshWorld();
    wallet.earn(w, 3, { currency: 'starsalt' });
    wallet.earn(w, 2, { currency: 'anchors' });
    assert.equal(wallet.balance(w, 'starsalt'), 3);
    assert.equal(wallet.spend(w, 2, { currency: 'starsalt' }).balance, 1);
    assert.equal(wallet.spend(w, 1, { currency: 'anchors' }).balance, 1);
    assert.equal(wallet.canAfford(w, 1, 'anchors'), true);
    assert.equal(wallet.canAfford(w, 2, 'anchors'), false);
  });

  it('refuses to overspend and changes nothing', () => {
    const w = freshWorld({ main: 100 });
    const bus = recBus();
    assert.deepEqual(wallet.spend(w, 101, { bus }), { ok: false, reason: 'insufficient', currency: 'main', balance: 100, short: 1 });
    assert.equal(w.wallet.main, 100);
    assert.equal(bus.events.length, 0);
    assert.equal(wallet.spend(w, 100).balance, 0);
  });

  it('zero amounts are no-ops without events', () => {
    const w = freshWorld();
    const bus = recBus();
    assert.equal(wallet.earn(w, 0, { bus }).ok, true);
    assert.equal(wallet.spend(w, 0, { bus }).ok, true);
    assert.equal(bus.events.length, 0);
  });

  it('throws on malformed amounts and currencies', () => {
    const w = freshWorld();
    for (const bad of [-1, 1.5, NaN, Infinity, '5', null]) {
      assert.throws(() => wallet.earn(w, bad), RangeError);
      assert.throws(() => wallet.spend(w, bad), RangeError);
    }
    assert.throws(() => wallet.earn(w, 1, { currency: 'purse' }), TypeError, 'the purse only fills through blackout');
    assert.throws(() => wallet.earn(w, 1, { currency: 'gold' }), TypeError);
    assert.throws(() => wallet.balance(w, 'gold'), TypeError);
    assert.equal(wallet.balance(w, 'purse'), 0);
  });

  it('adjust (debug) adds signed deltas and clamps at zero', () => {
    const w = freshWorld();
    assert.equal(wallet.adjust(w, 40).balance, 40);
    assert.equal(wallet.adjust(w, -15.9).balance, 25);
    assert.deepEqual(wallet.adjust(w, -100), { currency: 'main', delta: -25, balance: 0 });
    assert.throws(() => wallet.adjust(w, NaN), TypeError);
  });

  it('exports the fixed currency keys', () => {
    assert.deepEqual([...wallet.CURRENCIES], ['main', 'starsalt', 'anchors', 'purse']);
  });
});

describe('wallet: blackout and the Keeper\'s Purse', () => {
  it('blackoutCost: 10%, capped at 1,500, nothing under 500, never below 500', () => {
    const cases = [[0, 0], [499, 0], [500, 0], [520, 20], [554, 54], [555, 55], [1000, 100], [5000, 500], [15000, 1500], [15009, 1500], [1_000_000, 1500]];
    for (const [main, cost] of cases) assert.equal(wallet.blackoutCost(main), cost, `main ${main}`);
    for (let main = 0; main < 30000; main += 37) {
      const c = wallet.blackoutCost(main);
      assert.ok(c >= 0 && c <= 1500, `cap at ${main}`);
      if (main >= 500) assert.ok(main - c >= 500, `floor at ${main}`);
      else assert.equal(c, 0);
    }
  });

  it('blackout drops the cost and puts half into the purse with three Glints to go', () => {
    const w = freshWorld({ main: 9000 });
    const bus = recBus();
    assert.deepEqual(wallet.blackout(w, { bus }), { lost: 900, refund: 450, balance: 8100, purse: 450, purseGlints: 3 });
    assert.deepEqual(bus.of('wallet:changed').map((p) => [p.currency, p.delta, p.source]), [['main', -900, 'blackout'], ['purse', 450, 'blackout']]);
    assert.deepEqual(validateWorld(w), []);
  });

  it('blackout under the floor costs nothing and leaves the purse alone', () => {
    const w = freshWorld({ main: 400 });
    const bus = recBus();
    assert.deepEqual(wallet.blackout(w, { bus }), { lost: 0, refund: 0, balance: 400, purse: 0, purseGlints: 0 });
    assert.equal(bus.events.length, 0);
  });

  it('a second blackout adds to the purse and restarts the countdown', () => {
    const w = freshWorld({ main: 20000 });
    wallet.blackout(w); // -1500, purse 750
    wallet.collectGlint(w, { gameDay: 1 }); // pays 250, 2 left
    assert.equal(w.wallet.purseGlints, 2);
    wallet.blackout(w); // main now 18000+560+250 -> 1500 cap, +750
    assert.equal(w.wallet.purse, 500 + 750);
    assert.equal(w.wallet.purseGlints, 3);
  });

  it('glintValue is 500 + 60 × the GDD day', () => {
    assert.equal(wallet.glintValue(1), 560);
    assert.equal(wallet.glintValue(14), 1340);
    assert.equal(wallet.glintValue(0), 560, 'clamps to day 1');
    assert.throws(() => wallet.glintValue(1.5), RangeError);
  });

  it('collectGlint uses the economy day: the arrival evening and the next pre-dawn are day 1', () => {
    const w = freshWorld();
    assert.equal(wallet.collectGlint(w, { now: at(0, 18, 40) }).value, 560);
    assert.equal(wallet.collectGlint(w, { now: at(1, 5, 5) }).value, 560, '05:05 before the 06:00 turnover');
    assert.equal(wallet.collectGlint(w, { now: at(1, 7) }).value, 620);
    assert.equal(wallet.collectGlint(w, { now: at(1, 17, 30), gameDay: 9 }).value, 1040, 'explicit gameDay wins');
    assert.equal(w.wallet.main, 560 + 560 + 620 + 1040);
  });

  it('the purse comes back in equal thirds over three Glints, exactly', () => {
    for (const [lostFrom, shares] of [[15000, [250, 250, 250]], [2500, [42, 42, 41]], [1000, [17, 17, 16]], [6000, [100, 100, 100]]]) {
      const w = freshWorld({ main: lostFrom });
      const { refund } = wallet.blackout(w);
      const got = [];
      for (let i = 0; i < 4; i++) got.push(wallet.collectGlint(w, { gameDay: 2 }).refund);
      assert.deepEqual(got, [...shares, 0], `from ${lostFrom}`);
      assert.equal(shares.reduce((a, b) => a + b, 0), refund);
      assert.equal(w.wallet.purse, 0);
      assert.equal(w.wallet.purseGlints, 0);
    }
  });

  it('collectGlint reports and emits value and refund', () => {
    const w = freshWorld({ main: 6000 });
    wallet.blackout(w);
    const bus = recBus();
    const r = wallet.collectGlint(w, { gameDay: 3, bus });
    assert.deepEqual(r, { value: 680, refund: 100, total: 780, balance: 5400 + 780, purseLeft: 200, glintsLeft: 2 });
    assert.deepEqual(bus.of('wallet:changed')[0], { currency: 'main', delta: 780, balance: 6180, source: 'glint', glint: 680, purse: 100 });
    assert.equal(wallet.purseShare(w), 100);
  });
});

describe('wallet: Starsalt', () => {
  it('buys at 800 with a cap of 3 a day', () => {
    const w = freshWorld({ main: 10_000 });
    const ctx = { now: at(1, 13) };
    assert.equal(wallet.starsaltLeftToday(w, ctx), 3);
    assert.deepEqual(wallet.buyStarsalt(w, 2, ctx), { ok: true, bought: 2, spent: 1600, starsalt: 2, leftToday: 1 });
    assert.deepEqual(wallet.buyStarsalt(w, 2, ctx), { ok: false, reason: 'daily-cap', leftToday: 1 });
    assert.equal(wallet.buyStarsalt(w, 1, ctx).leftToday, 0);
    assert.equal(wallet.buyStarsalt(w, 1, ctx).reason, 'daily-cap');
    assert.equal(w.wallet.main, 10_000 - 2400);
    assert.equal(w.wallet.starsalt, 3);
    assert.deepEqual(validateWorld(w), []);
  });

  it('the cap does not reset at midnight, only at the 06:00 turnover', () => {
    const w = freshWorld({ main: 10_000 });
    wallet.buyStarsalt(w, 3, { now: at(1, 23) });
    assert.equal(wallet.starsaltLeftToday(w, { now: at(2, 1) }), 0, 'Ludo after midnight is the same shop day');
    assert.equal(wallet.starsaltLeftToday(w, { now: at(2, 5, 59) }), 0);
    assert.equal(wallet.starsaltLeftToday(w, { now: at(2, 6) }), 3);
    assert.equal(wallet.buyStarsalt(w, 3, { now: at(2, 6) }).ok, true);
  });

  it('refuses when short of buttons, changing nothing', () => {
    const w = freshWorld({ main: 1000 });
    assert.deepEqual(wallet.buyStarsalt(w, 2, { now: at(1, 13) }), { ok: false, reason: 'insufficient', cost: 1600, balance: 1000 });
    assert.equal(w.wallet.starsalt, 0);
    assert.equal(w.wallet.starsaltDay, -1);
  });

  it('honours a shop unit price and a tuned cap', () => {
    const w = freshWorld({ main: 5000 });
    assert.equal(wallet.buyStarsalt(w, 1, { now: at(1, 13), unitPrice: 900 }).spent, 900);
    const tuning = { starsaltDailyCap: 5, starsaltPrice: 100 };
    assert.equal(wallet.starsaltLeftToday(w, { now: at(1, 13), tuning }), 4);
    assert.equal(wallet.buyStarsalt(w, 4, { now: at(1, 13), tuning }).spent, 400);
  });

  it('rejects malformed counts', () => {
    const w = freshWorld({ main: 5000 });
    assert.throws(() => wallet.buyStarsalt(w, 0), RangeError);
    assert.throws(() => wallet.buyStarsalt(w, 1.5), RangeError);
  });
});

describe('wallet: anchor stones', () => {
  it('per-dial rules: Drift 3 refilled per badge, Flux buys at 500, Freefall 1 per badge and none sold', () => {
    assert.deepEqual(wallet.anchorRulesFor('drift'), { start: 3, refillTo: 3, perBadge: 0, buyable: true });
    assert.deepEqual(wallet.anchorRulesFor('flux'), { start: 2, refillTo: 0, perBadge: 0, buyable: true });
    assert.deepEqual(wallet.anchorRulesFor('freefall'), { start: 0, refillTo: 0, perBadge: 1, buyable: false });
    assert.deepEqual(wallet.anchorRulesFor('mystery'), wallet.anchorRulesFor('flux'), 'unknown dial falls back');
  });

  it('buys on Flux at 500 and refuses on Freefall', () => {
    const flux = freshWorld({ main: 1200, dial: 'flux' });
    assert.deepEqual(wallet.buyAnchors(flux, 2), { ok: true, bought: 2, spent: 1000, anchors: 2 });
    assert.deepEqual(wallet.buyAnchors(flux, 1), { ok: false, reason: 'insufficient', cost: 500, balance: 200 });
    const ff = freshWorld({ main: 5000, dial: 'freefall' });
    assert.deepEqual(wallet.buyAnchors(ff, 1), { ok: false, reason: 'not-sold', dial: 'freefall' });
    assert.equal(ff.wallet.main, 5000);
    assert.equal(wallet.buyAnchors(ff, 1, { dial: 'flux' }).ok, true, 'ctx.dial overrides');
  });

  it('starting stones are granted once per run', () => {
    for (const [dial, n] of [['drift', 3], ['flux', 2], ['freefall', 0]]) {
      const w = freshWorld({ dial });
      assert.deepEqual(wallet.grantStartingAnchors(w), { ok: true, granted: n, anchors: n });
      assert.deepEqual(wallet.grantStartingAnchors(w), { ok: false, reason: 'already-granted' });
      assert.equal(w.wallet.anchors, n);
      assert.deepEqual(validateWorld(w), []);
    }
  });

  it('badges: Drift refills to 3, Freefall adds 1, Flux adds none; once per spire', () => {
    const drift = freshWorld({ dial: 'drift' });
    drift.wallet.anchors = 1;
    assert.equal(wallet.onBadge(drift, 'turn').anchors, 3);
    drift.wallet.anchors = 5;
    assert.equal(wallet.onBadge(drift, 'ward').granted, 0, 'refill never lowers');
    assert.equal(wallet.onBadge(drift, 'ward').reason, 'already-granted');
    const ff = freshWorld({ dial: 'freefall' });
    wallet.onBadge(ff, 'turn');
    wallet.onBadge(ff, 'ward');
    wallet.onBadge(ff, 'ward');
    assert.equal(ff.wallet.anchors, 2);
    const flux = freshWorld({ dial: 'flux' });
    assert.equal(wallet.onBadge(flux, 'turn').granted, 0);
    assert.throws(() => wallet.onBadge(flux, ''), TypeError);
  });

  it('a spire id can never collide with the start grant', () => {
    const w = freshWorld({ dial: 'drift' });
    wallet.onBadge(w, 'start');
    assert.equal(wallet.grantStartingAnchors(w).ok, true);
  });
});

describe('wallet: tuning', () => {
  it('reads ctx.tuning, then data.tuning, then the defaults', () => {
    assert.equal(wallet.tuningOf().blackoutCap, 1500);
    assert.equal(wallet.tuningOf({ data: { ...TABLES, tuning: { blackoutCap: 900 } } }).blackoutCap, 900);
    assert.equal(wallet.tuningOf({ tuning: { blackoutCap: 700 }, data: { tuning: { blackoutCap: 900 } } }).blackoutCap, 700);
    const w = freshWorld({ main: 100_000 });
    assert.equal(wallet.blackout(w, { tuning: { blackoutCap: 2000 } }).lost, 2000);
  });

  it('throws on a malformed designer value and ignores unknown keys', () => {
    assert.throws(() => wallet.tuningOf({ tuning: { blackoutCostFraction: 2 } }), TypeError);
    assert.throws(() => wallet.tuningOf({ tuning: { anchorRules: { drift: { start: -1 } } } }), TypeError);
    assert.equal(wallet.tuningOf({ tuning: { somethingElse: 'x' } }).glintBase, 500);
  });

  it('defaults match GDD-00 and every key is listed', () => {
    const d = wallet.DEFAULTS;
    assert.deepEqual([d.blackoutCostFraction, d.blackoutCap, d.blackoutFloor, d.purseRefundFraction, d.purseGlints], [0.1, 1500, 500, 0.5, 3]);
    assert.deepEqual([d.glintBase, d.glintPerDay, d.starsaltPrice, d.starsaltDailyCap, d.anchorPrice], [500, 60, 800, 3, 500]);
    assert.deepEqual([...wallet.TUNING_KEYS].sort(), Object.keys(d).sort());
    assert.ok(Object.isFrozen(d) && Object.isFrozen(d.anchorRules.drift));
  });
});
