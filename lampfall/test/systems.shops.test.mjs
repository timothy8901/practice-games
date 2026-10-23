// Unit tests for js/systems/shops.js. Run: node --test test/systems.shops.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as shops from '../js/systems/shops.js';
import * as bag from '../js/systems/bag.js';
import { validateWorld } from '../js/state/schema.js';
import { makeRng } from '../js/core/rng.js';
import { freshWorld, recBus, TABLES, REGISTRY, ITEM_CHECK, at, DAY } from './fixtures/econ.fixture.mjs';

const C = (extra = {}) => ({ data: TABLES, ...extra });
const NOON = (d = 1) => at(d, 12);

describe('shops: hours', () => {
  it('withinHours handles plain, wrapping and all-day ranges', () => {
    assert.equal(shops.withinHours([480, 1320], 479), false);
    assert.equal(shops.withinHours([480, 1320], 480), true);
    assert.equal(shops.withinHours([480, 1320], 1319), true);
    assert.equal(shops.withinHours([480, 1320], 1320), false);
    assert.equal(shops.withinHours([1320, 480], 1320), true);
    assert.equal(shops.withinHours([1320, 480], 0), true);
    assert.equal(shops.withinHours([1320, 480], 479), true);
    assert.equal(shops.withinHours([1320, 480], 480), false);
    assert.equal(shops.withinHours([0, 1440], 777), true);
    assert.equal(shops.withinHours([600, 600], 5), true);
    assert.equal(shops.withinHours(null, 5), false);
    assert.equal(shops.withinHours([480, 1320], DAY + 600), true, 'totals reduce to minute of day');
  });

  it('Pell\'s 08:00-22:00 and Ludo 22:00-08:00', () => {
    const w = freshWorld();
    assert.equal(shops.isOpen(w, 'pells', C({ now: at(1, 7, 59) })), false);
    assert.equal(shops.isOpen(w, 'pells', C({ now: at(1, 8) })), true);
    assert.equal(shops.isOpen(w, 'ludo', C({ now: at(1, 8) })), false);
    assert.equal(shops.isOpen(w, 'ludo', C({ now: at(1, 23) })), true);
    assert.equal(shops.isOpen(w, 'ludo', C({ now: at(2, 3) })), true);
    assert.equal(shops.isOpen(w, 'nope', C()), false);
  });

  it('the Raft opens from day 3 (12:00-02:00), its after-midnight hours counting as the evening\'s day', () => {
    const w = freshWorld();
    assert.equal(shops.isOpen(w, 'raft', C({ now: at(1, 13) })), false, 'GDD day 2');
    assert.equal(shops.isOpen(w, 'raft', C({ now: at(2, 1) })), false, '01:00 after GDD day 2');
    assert.equal(shops.isOpen(w, 'raft', C({ now: at(2, 12) })), true, 'GDD day 3');
    assert.equal(shops.isOpen(w, 'raft', C({ now: at(3, 1) })), true);
    assert.equal(shops.isOpen(w, 'raft', C({ now: at(3, 3) })), false);
  });

  it('a shop cond gates it (cond DSL)', () => {
    const w = freshWorld();
    const row = { id: 'market', hours: [0, 1440], buys: ['fruit'], stock: [], cond: { badge: 1 } };
    assert.equal(shops.isOpen(w, row, C()), false);
    w.badges.push('turn');
    assert.equal(shops.isOpen(w, row, C()), true);
  });

  it('someone is always buying: a buyer is open at every minute of the day', () => {
    const w = freshWorld();
    for (let m = 0; m < DAY; m++) {
      const buyers = shops.buyersAt(w, C({ now: at(5, 0, m) }));
      assert.ok(buyers.length > 0, `no buyer at minute ${m}`);
    }
    assert.deepEqual(shops.buyersAt(w, C({ now: at(5, 9) })), ['pells']);
    assert.deepEqual(shops.buyersAt(w, C({ now: at(5, 23) })), ['ludo', 'raft']);
  });
});

describe('shops: stock', () => {
  it('staples are always there; two discs rotate daily; conds gate rows', () => {
    const w = freshWorld();
    const lines = shops.stockFor(w, 'pells', 4, C());
    assert.deepEqual(lines.filter((l) => l.staple).map((l) => l.item), ['tallow-wick', 'salve', 'brass-wick', 'anchor-stone']);
    const discs = lines.filter((l) => !l.staple);
    assert.equal(discs.length, 2);
    assert.ok(discs.every((l) => l.pool === 'discs' && l.item.startsWith('disc-')));
    w.badges.push('turn', 'ward', 'weather');
    const later = shops.stockFor(w, 'pells', 4, C()).map((l) => l.item);
    assert.ok(later.includes('skyglass-wick') && later.includes('ether'));
  });

  it('is deterministic per seed, shop and day, and varies across days', () => {
    const a = freshWorld();
    const b = freshWorld();
    const draws = new Set();
    for (let d = 0; d < 12; d++) {
      const x = shops.stockFor(a, 'pells', d, C()).map((l) => l.item).join();
      assert.equal(shops.stockFor(b, 'pells', d, C()).map((l) => l.item).join(), x);
      draws.add(x);
    }
    assert.ok(draws.size > 1, 'the disc rotation changes');
    const other = freshWorld({ seedCode: 'OTHER-SEED' });
    const differs = [...Array(12).keys()].some((d) => shops.stockFor(other, 'pells', d, C()).map((l) => l.item).join() !== shops.stockFor(a, 'pells', d, C()).map((l) => l.item).join());
    assert.ok(differs, 'another seed draws differently');
  });

  it('defaults to today and honours an explicit rng and rotation counts', () => {
    const w = freshWorld();
    assert.deepEqual(shops.stockFor(w, 'pells', undefined, C({ now: at(4, 9) })), shops.stockFor(w, 'pells', 4, C()));
    const rng = makeRng(42);
    assert.deepEqual(shops.stockFor(w, 'pells', 4, C({ rng })), shops.stockFor(w, 'pells', 4, C({ rng: makeRng(42) })));
    const row = { ...TABLES.shops[0], rotations: { discs: 4 } };
    assert.equal(shops.stockFor(w, row, 1, C()).filter((l) => !l.staple).length, 4);
    assert.equal(shops.stockFor(w, { ...row, rotations: { discs: 0 } }, 1, C()).filter((l) => !l.staple).length, 0);
    assert.deepEqual(shops.stockFor(w, 'nope', 1, C()), []);
  });

  it('leftToday reflects qty, the Starsalt cap and one-of-a-kind', () => {
    const w = freshWorld({ main: 10_000 });
    assert.equal(shops.leftToday(w, 'ludo', 'starsalt', C({ now: at(1, 23) })), 3);
    assert.equal(shops.leftToday(w, 'pells', 'salve', C({ now: NOON() })), Infinity);
    assert.equal(shops.leftToday(w, 'pells', 'pear', C({ now: NOON() })), 0, 'not stocked');
    assert.equal(shops.leftToday(w, 'nope', 'pear', C()), 0);
  });
});

describe('shops: buying', () => {
  it('charges the fixed price and puts the item in the satchel', () => {
    const w = freshWorld({ main: 1000 });
    const bus = recBus();
    const r = shops.buy(w, 'pells', 'salve', 3, C({ now: NOON(), bus }));
    assert.deepEqual(r, { ok: true, spent: 240, unitPrice: 80, added: 3, overflow: 0, basketId: null, after: 760 });
    assert.equal(bag.count(w, 'salve', undefined, C()), 3);
    assert.deepEqual(bus.of('shop:bought'), [{ shopId: 'pells', itemId: 'salve', n: 3, spent: 240 }]);
    assert.equal(bus.of('wallet:changed')[0].source, 'shop:pells');
    assert.deepEqual(validateWorld(w, ITEM_CHECK), []);
  });

  it('applies the shop price multiplier', () => {
    const w = freshWorld({ main: 5000 });
    assert.equal(shops.buy(w, 'anchorage', 'still-knot', 1, C({ now: NOON() })).spent, 2200);
  });

  it('refuses closed, unstocked, unknown and unaffordable purchases without side effects', () => {
    const w = freshWorld({ main: 50 });
    assert.deepEqual(shops.buy(w, 'pells', 'salve', 1, C({ now: at(1, 23) })), { ok: false, reason: 'closed' });
    assert.deepEqual(shops.buy(w, 'pells', 'pear', 1, C({ now: NOON() })), { ok: false, reason: 'not-stocked' });
    assert.deepEqual(shops.buy(w, 'pells', 'nope', 1, C({ now: NOON() })), { ok: false, reason: 'unknown-item' });
    assert.deepEqual(shops.buy(w, 'nope', 'salve', 1, C({ now: NOON() })), { ok: false, reason: 'unknown-shop' });
    assert.deepEqual(shops.buy(w, 'pells', 'salve', 1, C({ now: NOON() })), { ok: false, reason: 'insufficient', short: 30 });
    assert.equal(shops.buy(w, 'pells', 'salve', 1, C({ now: at(1, 23), anyHour: true })).reason, 'insufficient', 'anyHour skips the clock');
    assert.equal(w.wallet.main, 50);
    assert.deepEqual(w.shops.sold, {});
    assert.throws(() => shops.buy(w, 'pells', 'salve', 0, C()), RangeError);
  });

  it('Starsalt: 800 each, capped at 3 a day across Ludo and the Raft', () => {
    const w = freshWorld({ main: 10_000 });
    const raft = shops.buy(w, 'raft', 'starsalt', 2, C({ now: at(3, 13) }));
    assert.deepEqual([raft.ok, raft.spent, w.wallet.starsalt], [true, 1600, 2]);
    assert.deepEqual(shops.buy(w, 'ludo', 'starsalt', 2, C({ now: at(3, 23) })), { ok: false, reason: 'daily-cap', left: 1 });
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 1, C({ now: at(4, 1) })).ok, true, 'Ludo after midnight shares the cap');
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 1, C({ now: at(4, 2) })).reason, 'daily-cap');
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 3, C({ now: at(4, 23) })).ok, true, 'a new shop day');
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 1, C({ now: at(4, 23) })).reason, 'sold-out', 'Ludo\'s own qty 3');
    assert.deepEqual(validateWorld(w), []);
  });

  it('anchor stones: Flux buys at 500 into the wallet; Freefall cannot buy', () => {
    const w = freshWorld({ main: 2000, dial: 'flux' });
    const r = shops.buy(w, 'pells', 'anchor-stone', 2, C({ now: NOON() }));
    assert.deepEqual([r.ok, r.spent, w.wallet.anchors], [true, 1000, 2]);
    const ff = freshWorld({ main: 2000, dial: 'freefall' });
    assert.deepEqual(shops.buy(ff, 'pells', 'anchor-stone', 1, C({ now: NOON() })), { ok: false, reason: 'not-sold' });
    assert.equal(ff.wallet.main, 2000);
  });

  it('Freefall asks to confirm a disc above 2,500', () => {
    const w = freshWorld({ main: 20_000, dial: 'freefall' });
    const row = { ...TABLES.shops[0], rotations: { discs: 4 } };
    const data = { ...TABLES, shops: [row, ...TABLES.shops.slice(1)] };
    assert.deepEqual(shops.buy(w, 'pells', 'disc-ember', 1, { data, now: NOON() }), { ok: false, needsConfirm: true, itemId: 'disc-ember', unitPrice: 3000 });
    assert.equal(w.wallet.main, 20_000);
    assert.equal(shops.buy(w, 'pells', 'disc-ember', 1, { data, now: NOON(), confirm: true }).ok, true);
    assert.equal(shops.buy(w, 'pells', 'disc-chip', 1, { data, now: NOON() }).ok, true, '1,500 needs no confirm');
    const flux = freshWorld({ main: 20_000, dial: 'flux' });
    assert.equal(shops.buy(flux, 'pells', 'disc-tide', 1, { data, now: NOON() }).ok, true, 'only Freefall asks');
  });

  it('a per-row qty caps a day; one-of-a-kind sells once', () => {
    const w = freshWorld({ main: 10_000 });
    const data = { ...TABLES, shops: [{ id: 'stall', keeper: 'x', hours: [0, 1440], priceMult: 1, buys: [], stock: [{ item: 'salve', qty: 2 }, { item: 'heirloom-bell' }] }] };
    assert.equal(shops.buy(w, 'stall', 'salve', 2, { data, now: NOON() }).ok, true);
    assert.deepEqual(shops.buy(w, 'stall', 'salve', 1, { data, now: NOON() }), { ok: false, reason: 'sold-out', left: 0 });
    assert.equal(shops.buy(w, 'stall', 'salve', 2, { data, now: NOON(2) }).ok, true, 'resets the next day');
    assert.equal(shops.buy(w, 'stall', 'heirloom-bell', 2, { data, now: NOON() }).reason, 'already-held');
    assert.equal(shops.buy(w, 'stall', 'heirloom-bell', 1, { data, now: NOON() }).ok, true);
    assert.equal(shops.buy(w, 'stall', 'heirloom-bell', 1, { data, now: NOON() }).reason, 'already-held');
    assert.equal(shops.leftToday(w, 'stall', 'heirloom-bell', { data, now: NOON() }), 0);
  });

  it('purchases that do not fit spill into the basket at your feet', () => {
    const w = freshWorld({ main: 10_000 });
    for (let i = 0; i < 20; i++) bag.give(w, 'still-knot', 5, C());
    const r = shops.buy(w, 'pells', 'salve', 2, C({ now: NOON() }));
    assert.deepEqual([r.ok, r.added, r.overflow, r.basketId], [true, 0, 2, 'b1']);
  });
});

describe('shops: selling', () => {
  it('goods sell at full price to Pell\'s; spare items at their sell price to Ludo', () => {
    const w = freshWorld();
    bag.give(w, 'john-dory', 2, C());
    bag.give(w, 'salve', 4, C());
    const bus = recBus();
    const quote = shops.sellQuote(w, 'pells', 'john-dory', 2, C({ now: NOON() }));
    assert.equal(quote.unit, 2400, 'full price');
    const r = shops.sell(w, 'pells', 'john-dory', 2, C({ now: NOON(), bus }));
    assert.equal(r.earned, quote.total);
    assert.equal(w.wallet.main, quote.total);
    assert.equal(bus.of('shop:sold')[0].itemId, 'john-dory');
    assert.deepEqual(shops.sell(w, 'pells', 'salve', 1, C({ now: NOON() })), { ok: false, reason: 'not-buying' });
    const ludo = shops.sell(w, 'ludo', 'salve', 4, C({ now: at(1, 23) }));
    assert.deepEqual([ludo.ok, ludo.earned, ludo.left], [true, 160, 0]);
    assert.deepEqual(validateWorld(w, ITEM_CHECK), []);
  });

  it('refuses closed shops, unknown items, worthless and missing items', () => {
    const w = freshWorld();
    bag.give(w, 'pear', 2, C());
    bag.give(w, 'rod', 1, C());
    assert.equal(shops.sell(w, 'pells', 'pear', 1, C({ now: at(1, 23) })).reason, 'closed');
    assert.equal(shops.sell(w, 'pells', 'nope', 1, C({ now: NOON() })).reason, 'unknown-item');
    assert.equal(shops.sell(w, 'ludo', 'rod', 1, C({ now: at(1, 23) })).reason, 'worthless');
    assert.deepEqual(shops.sell(w, 'pells', 'pear', 5, C({ now: NOON() })), { ok: false, reason: 'not-enough', have: 2 });
    assert.equal(shops.sell(w, 'ludo', 'starsalt', 1, C({ now: at(1, 23) })).reason, 'not-buying', 'Starsalt is never sold back');
    assert.equal(shops.sell(w, 'nope', 'pear', 1, C()).reason, 'unknown-shop');
  });

  it('a one-of-a-kind sale asks first', () => {
    const w = freshWorld();
    bag.give(w, 'heirloom-bell', 1, C());
    assert.deepEqual(shops.sell(w, 'ludo', 'heirloom-bell', 1, C({ now: at(1, 23) })), { ok: false, needsConfirm: true, itemId: 'heirloom-bell' });
    assert.equal(shops.sell(w, 'ludo', 'heirloom-bell', 1, C({ now: at(1, 23), confirm: true })).earned, 500);
  });

  it('Wanted Today: three items at +50%, one stack each a day', () => {
    const w = freshWorld();
    const day = 2;
    const wanted = shops.wantedToday(w, 'pells', day, C());
    assert.equal(wanted.length, 3);
    assert.deepEqual(shops.wantedToday(freshWorld(), 'pells', day, C()), wanted, 'deterministic');
    assert.deepEqual(shops.wantedToday(w, 'ludo', day, C()), [], 'only the Wanted board shop');
    const pool = TABLES.items.filter((i) => ['fish', 'fruit', 'bug', 'fossil', 'relic', 'shell'].includes(i.kind)).map((i) => i.id);
    assert.ok(wanted.every((id) => pool.includes(id)));
    // find a day that wants pears, then sell 12: 10 at 180 and 2 at 120
    let d = 0;
    while (!shops.wantedToday(w, 'pells', d, C()).includes('pear')) d++;
    bag.give(w, 'pear', 30, C());
    const now = at(d, 12);
    assert.equal(shops.wantedLeft(w, 'pells', 'pear', C({ now })), 10);
    assert.deepEqual(shops.sellQuote(w, 'pells', 'pear', 12, C({ now })), { unit: 120, wantedUnit: 180, wantedUnits: 10, total: 10 * 180 + 2 * 120 });
    const r = shops.sell(w, 'pells', 'pear', 12, C({ now }));
    assert.deepEqual([r.earned, r.wantedUnits], [2040, 10]);
    assert.equal(shops.sell(w, 'pells', 'pear', 5, C({ now })).earned, 600, 'the day\'s wanted stack is used up');
    const tomorrow = shops.wantedToday(w, 'pells', d + 1, C()).includes('pear');
    assert.equal(shops.wantedLeft(w, 'pells', 'pear', C({ now: at(d + 1, 12) })), tomorrow ? 10 : 0, 'counters reset with the day');
  });

  it('a wantedPool limits the board', () => {
    const w = freshWorld();
    const row = { ...TABLES.shops[0], wantedPool: ['moth', 'ammonite', 'shell', 'nope'] };
    const wanted = shops.wantedToday(w, row, 3, C());
    assert.deepEqual([...wanted].sort(), ['ammonite', 'moth', 'shell']);
  });
});

describe('shops: preview and listing', () => {
  it('"After: n" for buying and selling', () => {
    const w = freshWorld({ main: 1000 });
    bag.give(w, 'pear', 3, C());
    assert.deepEqual(shops.preview(w, 'pells', 'salve', 2, 'buy', C({ now: NOON() })), { unitPrice: 80, total: 160, afterMoney: 840, afterCount: 2, canAfford: true, wantedUnits: 0 });
    const s = shops.preview(w, 'pells', 'pear', 2, 'sell', C({ now: NOON(30) }));
    assert.equal(s.afterCount, 1);
    assert.equal(s.afterMoney, 1000 + s.total);
    assert.equal(shops.preview(w, 'pells', 'disc-tide', 1, 'buy', C()).canAfford, false);
    assert.equal(shops.preview(w, 'nope', 'salve', 1, 'buy', C()).canAfford, false);
  });

  it('listing rows carry price, after, stock left and the disc\'s move', () => {
    const w = freshWorld({ main: 2000, dial: 'freefall' });
    const rows = shops.listing(w, 'pells', C({ now: NOON(), learnersOf: (m) => [`learner-of-${m}`] }));
    const salve = rows.find((r) => r.item === 'salve');
    assert.deepEqual([salve.price, salve.after, salve.left, salve.canAfford, salve.staple, salve.move], [80, 1920, null, true, true, null]);
    const disc = rows.find((r) => r.pocket === 'discs');
    assert.ok(disc.move && disc.moveName);
    assert.deepEqual(disc.learners, [`learner-of-${disc.move}`]);
    assert.equal(disc.confirm, disc.price > 2500);
    const ludo = shops.listing(w, 'ludo', C({ now: at(1, 23) }));
    assert.deepEqual(ludo.map((r) => [r.item, r.left]), [['starsalt', 3]]);
    assert.deepEqual(shops.listing(w, 'nope', C()), []);
  });

  it('the registry works as the data source', () => {
    const w = freshWorld({ main: 1000 });
    assert.equal(shops.buy(w, 'pells', 'salve', 1, { data: REGISTRY, now: NOON() }).ok, true);
    assert.ok(shops.listing(w, 'pells', { data: REGISTRY, now: NOON() }).length >= 6);
  });
});

describe('shops: Consignment Crate', () => {
  it('takes anything with a value and pays 90% overnight', () => {
    const w = freshWorld();
    bag.give(w, 'john-dory', 2, C());
    bag.give(w, 'salve', 3, C());
    const bus = recBus();
    assert.deepEqual(shops.crateDeposit(w, 'john-dory', 2, C({ bus })), { ok: true, inCrate: 2, estimate: 4320 });
    assert.equal(shops.crateDeposit(w, 'salve', 3, C()).estimate, 4320 + 108);
    assert.equal(bag.count(w, 'john-dory', undefined, C()), 0);
    assert.deepEqual(shops.crateWithdraw(w, 'salve', 1, C()), { ok: true, returned: 1, overflow: 0 });
    assert.deepEqual(shops.crateWithdraw(w, 'salve', 5, C()), { ok: false, reason: 'not-in-crate', have: 2 });
    assert.equal(shops.crateEstimate(w, C()), 4320 + 72);
    const r = shops.settleCrate(w, C({ bus }));
    assert.deepEqual(r, { earned: 4392, lines: [{ id: 'john-dory', n: 2, earned: 4320 }, { id: 'salve', n: 2, earned: 72 }] });
    assert.equal(w.wallet.main, 4392);
    assert.deepEqual(w.shops.crate, []);
    assert.equal(bus.of('crate:settled')[0].earned, 4392);
    assert.deepEqual(shops.settleCrate(w, C()), { earned: 0, lines: [] });
    assert.deepEqual(validateWorld(w, ITEM_CHECK), []);
  });

  it('refuses worthless, missing and unknown items; keepsakes ask first', () => {
    const w = freshWorld();
    bag.give(w, 'rod', 1, C());
    bag.give(w, 'heirloom-bell', 1, C());
    assert.equal(shops.crateDeposit(w, 'rod', 1, C()).reason, 'worthless');
    assert.equal(shops.crateDeposit(w, 'pear', 1, C()).reason, 'not-enough');
    assert.equal(shops.crateDeposit(w, 'nope', 1, C()).reason, 'unknown-item');
    assert.equal(shops.crateDeposit(w, 'heirloom-bell', 1, C()).needsConfirm, true);
    assert.equal(shops.crateDeposit(w, 'heirloom-bell', 1, C({ confirm: true })).ok, true);
  });

  it('lines the data no longer knows stay in the crate', () => {
    const w = freshWorld();
    w.shops.crate.push({ id: 'ghost', n: 1 }, { id: 'pear', n: 1 });
    assert.deepEqual(shops.settleCrate(w, C()), { earned: 108, lines: [{ id: 'pear', n: 1, earned: 108 }] });
    assert.deepEqual(w.shops.crate, [{ id: 'ghost', n: 1 }]);
  });
});

describe('shops: prices and tuning', () => {
  it('sellValue: goods full, spare at sell, else 50%; currencies 0', () => {
    const row = (id) => TABLES.items.find((i) => i.id === id);
    assert.equal(shops.sellValue(row('john-dory')), 2400);
    assert.equal(shops.sellValue(row('salve')), 40);
    assert.equal(shops.sellValue({ id: 'x', price: 301 }), 150);
    assert.equal(shops.sellValue(row('starsalt')), 0);
    assert.equal(shops.buyPrice(row('still-knot'), { priceMult: 1.1 }), 2200);
    assert.equal(shops.buyPrice({ price: 100 }, {}), 100);
    assert.equal(shops.crateValue(null, 3), 0);
  });

  it('defaults match GDD-00 and every key is listed', () => {
    const d = shops.DEFAULTS;
    assert.deepEqual([d.wantedTodayMult, d.wantedTodayCount, d.wantedStacksPerDay, d.crateRate, d.spareSellRate, d.rotatePickDefault, d.freefallDiscConfirmAbove], [1.5, 3, 1, 0.9, 0.5, 2, 2500]);
    assert.deepEqual([...shops.TUNING_KEYS].sort(), Object.keys(d).sort());
    assert.throws(() => shops.tuningOf({ tuning: { wantedTodayMult: 0.5 } }), TypeError);
    const w = freshWorld();
    w.shops.crate.push({ id: 'pear', n: 10 });
    assert.equal(shops.crateEstimate(w, C({ tuning: { crateRate: 0.5 } })), 600);
  });
});
