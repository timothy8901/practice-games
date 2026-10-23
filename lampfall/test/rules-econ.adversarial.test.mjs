// Adversarial tests for lane RULES-ECON (js/systems/{econ,wallet,bag,loans,shops}.js and the econ parts
// of state/schema + state/migrate). Written by the lane verifier.
// Run: node --test test/rules-econ.adversarial.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as econ from '../js/systems/econ.js';
import * as wallet from '../js/systems/wallet.js';
import * as bag from '../js/systems/bag.js';
import * as loans from '../js/systems/loans.js';
import * as shops from '../js/systems/shops.js';
import * as clockSys from '../js/systems/clockSys.js';
import { createClock, MINUTES_PER_DAY } from '../js/core/time.js';
import { createBus } from '../js/core/events.js';
import { createNewWorld, validateWorld, SCHEMA_VERSION } from '../js/state/schema.js';
import { migrateWorld } from '../js/state/migrate.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createPersist } from '../js/state/persist.js';
import { createRegistry } from '../js/data/registry.js';
import { createRunner } from '../js/script/runner.js';
import { TUNING } from '../js/data/tuning.js';
import { LOANS as REAL_LOANS, COMMISSIONS as REAL_COMMISSIONS, COMMONS as REAL_COMMONS } from '../js/data/loans.js';
import { ITEMS, SHOPS, LOANS, MOVES, TABLES, DAY, at, freshWorld, recBus } from './fixtures/econ.fixture.mjs';

/** Collections rows shaped like js/data/collections.js (fish, a shore find, fruit). */
const COLLECTIONS = Object.freeze([
  { id: 'perch', name: 'Perch', kind: 'fish', price: 180 },
  { id: 'cockle', name: 'Cockle', kind: 'relic', group: 'shore', price: 100 },
  { id: 'fossil-fern', name: 'Fern Fossil', kind: 'relic', group: 'fossil', price: 700 },
  { id: 'apple', name: 'Apple', kind: 'fruit', price: 120, ripePrice: 150 },
]);
const WITH_COLL = Object.freeze({ ...TABLES, collections: COLLECTIONS });
const ctxAt = (now, extra = {}) => ({ data: TABLES, now, ...extra });
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

// -------------------------------------------------------------------------------------------------
describe('econ day and clock boundaries', () => {
  test('the economy day turns at exactly 06:00, never at midnight', () => {
    assert.equal(econ.econDay(at(3, 5, 59)), 2);
    assert.equal(econ.econDay(at(3, 6, 0)), 3);
    assert.equal(econ.econDay(at(3, 0, 0)), 2);
    assert.equal(econ.econDay(at(2, 23, 59)), 2);
    assert.equal(econ.econDay(0), 0, 'before the first 06:00 clamps to 0');
    assert.equal(econ.gameDay(econ.econDay(createNewWorld({ seedCode: 'A' }).clock.total)), 1, 'the arrival evening is GDD day 1');
  });

  test('Starsalt cap: 3 at 23:59, none at 00:00-05:59, 3 again at 06:00', () => {
    const w = freshWorld({ main: 100_000 });
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 3, ctxAt(at(4, 23, 59))).ok, true);
    assert.equal(wallet.starsaltLeftToday(w, { now: at(5, 0, 0) }), 0);
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 1, ctxAt(at(5, 5, 59))).ok, false);
    assert.equal(wallet.starsaltLeftToday(w, { now: at(5, 6, 0) }), 3);
    assert.equal(shops.buy(w, 'raft', 'starsalt', 3, ctxAt(at(5, 12, 0))).ok, true, 'the Raft shares the cap and resets with it');
    assert.equal(shops.buy(w, 'ludo', 'starsalt', 1, ctxAt(at(5, 22, 0))).reason, 'daily-cap');
    assert.equal(w.wallet.starsalt, 6);
    assert.equal(w.wallet.main, 100_000 - 6 * 800);
  });

  test('exact shop-hour edges (half-open [open, close))', () => {
    const w = freshWorld();
    const open = (id, h, m) => shops.isOpen(w, id, ctxAt(at(4, h, m)));
    assert.equal(open('pells', 7, 59), false);
    assert.equal(open('pells', 8, 0), true);
    assert.equal(open('pells', 21, 59), true);
    assert.equal(open('pells', 22, 0), false);
    assert.equal(open('ludo', 21, 59), false);
    assert.equal(open('ludo', 22, 0), true);
    assert.equal(open('ludo', 0, 0), true);
    assert.equal(open('ludo', 7, 59), true);
    assert.equal(open('ludo', 8, 0), false);
  });

  test('someone is always buying, at every minute of three whole days', () => {
    const w = freshWorld();
    for (let t = at(3, 0); t < at(6, 0); t++) {
      assert.ok(shops.buyersAt(w, ctxAt(t)).length > 0, `no buyer at ${t}`);
    }
  });

  test('the Raft opens on GDD day 3 at 12:00; its 01:00 tail still belongs to the evening before', () => {
    const w = freshWorld();
    assert.equal(shops.isOpen(w, 'raft', ctxAt(at(1, 12))), false, 'GDD day 2');
    assert.equal(shops.isOpen(w, 'raft', ctxAt(at(2, 1, 59))), false, '01:59 after GDD day 2');
    assert.equal(shops.isOpen(w, 'raft', ctxAt(at(2, 11, 59))), false, 'before opening');
    assert.equal(shops.isOpen(w, 'raft', ctxAt(at(2, 12))), true);
    assert.equal(shops.isOpen(w, 'raft', ctxAt(at(3, 1, 59))), true, 'day 3 night tail');
    assert.equal(shops.isOpen(w, 'raft', ctxAt(at(3, 2, 0))), false);
  });

  test('builds: a payment at 05:39 lands at 05:40 the same morning; one at 05:40 waits a day', () => {
    const a = freshWorld({ main: 6000 });
    loans.pay(a, 6000, ctxAt(at(2, 5, 39)));
    assert.equal(loans.buildQueue(a)[0].readyDay, 2);
    assert.deepEqual(loans.landDue(a, ctxAt(at(2, 5, 39))).landed, []);
    assert.equal(loans.landDue(a, ctxAt(at(2, 5, 40))).landed.length, 1);
    const b = freshWorld({ main: 6000 });
    loans.pay(b, 6000, ctxAt(at(2, 5, 40)));
    assert.equal(loans.buildQueue(b)[0].readyDay, 3);
    assert.deepEqual(loans.landDue(b, ctxAt(at(2, 23, 59))).landed, []);
  });

  test('landDue is idempotent and lands an overdue backlog oldest first', () => {
    const w = freshWorld({ main: 21_000 });
    loans.pay(w, 6000, ctxAt(at(1, 10)));
    loans.pay(w, 15_000, ctxAt(at(1, 11)));
    const bus = recBus();
    const r = loans.landDue(w, { data: TABLES, now: at(9, 12), bus });
    assert.deepEqual(r.landed.map((b) => b.id), ['bedsit', 'cottage']);
    assert.deepEqual(loans.landDue(w, { data: TABLES, now: at(9, 12), bus }).landed, []);
    assert.equal(bus.of('loan:built').length, 2);
    assert.equal(bag.slots(w).total, 30, 'the cottage satchel +10 applies once');
  });

  test('Relighting: Lamp Room at 05:40 fires at 18:00 that day; a late landDue after dusk fires next dusk', () => {
    const run = (landAt) => {
      const w = freshWorld({ main: 300_000 });
      const ctx = ctxAt(at(1, 10));
      for (let i = 0; i < 7; i++) {
        if (loans.needsCommission(w, ctx)) loans.chooseCommission(w, loans.commissionOptions(w, ctx)[0], ctx);
        loans.pay(w, 100_000, ctx);
      }
      assert.equal(loans.isPaidOff(w, ctx), true);
      for (let d = 2; d < 8; d++) loans.landDue(w, ctxAt(at(d, 5, 40)));
      assert.equal(loans.checkRelighting(w, ctxAt(at(7, 12))).set, false, 'Lamp Room not landed yet');
      return { w, r: loans.landDue(w, ctxAt(landAt)) };
    };
    const { w, r } = run(at(8, 5, 40));
    assert.deepEqual(r.relighting, { set: true, day: 8 });
    assert.equal(w.flags['sp.lamp-room-built'], true);
    assert.equal(loans.relightingDue(w, { now: at(8, 17, 59) }), false);
    assert.equal(loans.relightingDue(w, { now: at(8, 18, 0) }), true);
    loans.markRelit(w);
    assert.equal(loans.relightingDue(w, { now: at(9, 18, 0) }), false);
    assert.equal(loans.checkRelighting(w, ctxAt(at(9, 19))).set, false, 'sets once');
    const late = run(at(8, 18, 0));
    assert.equal(late.r.relighting.day, 9);
  });

  test('Wanted Today: one stack a day survives midnight and resets at 06:00', () => {
    const w = freshWorld();
    let day = null;
    let wantedId = null;
    for (let d = 1; d < 40 && !wantedId; d++) {
      const list = shops.wantedToday(w, 'pells', d, { data: TABLES });
      if (list.includes('pear')) { day = d; wantedId = 'pear'; }
    }
    assert.ok(wantedId, 'pear is wanted on some day');
    bag.give(w, 'pear', 30, { data: TABLES });
    const r1 = shops.sell(w, 'pells', 'pear', 10, ctxAt(at(day, 21, 0)));
    assert.equal(r1.wantedUnits, 10, 'one stack = 10 pears (fruit stacks to 10)');
    assert.equal(r1.earned, 10 * 180);
    // after midnight Pell's is shut; at Ludo the Wanted board does not apply
    const r2 = shops.sell(w, 'ludo', 'pear', 1, ctxAt(at(day + 1, 1, 0)));
    assert.equal(r2.wantedUnits, 0);
    assert.equal(r2.earned, 120);
    assert.equal(shops.wantedLeft(w, 'pells', 'pear', ctxAt(at(day + 1, 5, 59))), 0, 'still the same shop day');
  });

  test('collectGlint values the Glint by economy day: 05:59 is still yesterday', () => {
    const w = freshWorld();
    assert.equal(wallet.collectGlint(w, { now: at(3, 5, 59) }).value, 500 + 60 * 3);
    assert.equal(wallet.collectGlint(w, { now: at(3, 6, 0) }).value, 500 + 60 * 4);
    assert.equal(wallet.collectGlint(w, { now: at(3, 7), gameDay: 0 }).value, 560, 'day clamps to 1');
  });
});

// -------------------------------------------------------------------------------------------------
describe('stacks, slots and overflow', () => {
  test('fruit stacks to 10 although the row says 99; shore finds from collections stack to 10 too', () => {
    const w = freshWorld();
    const r = bag.give(w, 'pear', 25, { data: WITH_COLL });
    assert.deepEqual(bag.pocketList(w, 'finds'), [{ id: 'pear', n: 10 }, { id: 'pear', n: 10 }, { id: 'pear', n: 5 }]);
    assert.equal(r.added, 25);
    bag.give(w, 'cockle', 12, { data: WITH_COLL });
    assert.equal(bag.pocketList(w, 'finds').filter((s) => s.id === 'cockle').map((s) => s.n).join(','), '10,2');
    assert.equal(bag.stackLimit(bag.itemRow('fossil-fern', { data: WITH_COLL })), 99, 'fossils are not shells');
  });

  test('a collections id is a real item: give, count, sell at full price, crate, validateWorld', () => {
    const w = freshWorld();
    const reg = createRegistry({ ...TABLES, collections: COLLECTIONS });
    for (const data of [WITH_COLL, reg]) {
      const g = bag.give(w, 'perch', 3, { data });
      assert.equal(g.ok, true, JSON.stringify(g));
      assert.equal(g.pocket, 'finds');
    }
    assert.equal(bag.count(w, 'perch'), 6);
    const s = shops.sell(w, 'pells', 'perch', 2, { data: reg, now: at(2, 10) });
    assert.equal(s.ok, true);
    assert.equal(s.earned - s.wantedUnits * 90, 360, 'full price (180 each), Wanted bonus aside');
    assert.equal(shops.crateDeposit(w, 'perch', 4, { data: reg }).ok, true);
    assert.equal(shops.settleCrate(w, { data: reg }).earned, Math.floor(180 * 4 * 0.9));
    bag.give(w, 'apple', 1, { data: reg });
    const has = { has: (t, id) => (t === 'items' || t === 'collections' ? reg.has(t, id) : true) };
    assert.deepEqual(validateWorld(w, has), []);
    assert.ok(shops.wantedToday(w, 'pells', 2, { data: reg }).length === 3);
    const pool = new Set();
    for (let d = 0; d < 60; d++) for (const id of shops.wantedToday(w, 'pells', d, { data: WITH_COLL })) pool.add(id);
    assert.ok(pool.has('perch') || pool.has('apple') || pool.has('cockle'), 'Wanted Today can name a gathered good');
  });

  test('an id missing from every item table is still unknown', () => {
    const w = freshWorld();
    assert.equal(bag.give(w, 'ghost', 1, { data: WITH_COLL }).reason, 'unknown-item');
    assert.equal(shops.sell(w, 'pells', 'ghost', 1, { data: WITH_COLL, now: at(2, 10) }).reason, 'unknown-item');
  });

  test('a full satchel spills to one basket per tile; keepsakes and tools never spill', () => {
    const w = freshWorld();
    const ids = ['tallow-wick', 'brass-wick', 'salve', 'ether', 'poultice', 'crackdust', 'revive', 'full-salve'];
    for (let i = 0; i < 20; i++) bag.give(w, ids[i % ids.length], 20, { data: TABLES });
    assert.equal(bag.slots(w).free, 0);
    const spill = bag.give(w, 'pear', 3, { data: TABLES });
    assert.equal(spill.overflow, 3);
    const spill2 = bag.give(w, 'pear', 2, { data: TABLES });
    assert.equal(spill2.basketId, spill.basketId, 'same tile, same basket');
    const elsewhere = bag.give(w, 'pear', 1, { data: TABLES, at: { mapId: 'harbor', x: 9, y: 9 } });
    assert.notEqual(elsewhere.basketId, spill.basketId);
    assert.equal(bag.give(w, 'heirloom-bell', 1, { data: TABLES }).overflow, 0, 'keepsake: no slot');
    assert.equal(bag.give(w, 'rod', 1, { data: TABLES }).overflow, 0, 'tool: no slot');
    assert.equal(bag.roomFor(w, 'pear', { data: TABLES }), 0);
    bag.expand(w, 10, { data: TABLES });
    const t = bag.takeBasket(w, spill.basketId, { data: TABLES });
    assert.deepEqual(t.moved, [{ id: 'pear', n: 5 }]);
    assert.equal(t.removed, true);
    assert.equal(bag.baskets(w).length, 1);
  });

  test('roomFor a one-of-a-kind in a slotted pocket honours a full satchel (gives would spill)', () => {
    const items = [...ITEMS, { id: 'lucky-knot', name: 'Lucky Knot', pocket: 'held', price: 0, stack: 1, oneOfAKind: true }];
    const data = { ...TABLES, items };
    const w = freshWorld();
    assert.equal(bag.roomFor(w, 'lucky-knot', { data }), 1);
    for (let i = 0; i < 20; i++) bag.give(w, 'disc-chip', 1, { data });
    assert.equal(bag.slots(w, { data }).free, 0);
    assert.equal(bag.roomFor(w, 'lucky-knot', { data }), 0);
    assert.equal(bag.give(w, 'lucky-knot', 1, { data }).overflow, 1);
    assert.equal(bag.roomFor(w, 'lucky-knot', { data }), 0, 'held in a basket counts');
    assert.equal(bag.give(w, 'lucky-knot', 1, { data }).reason, 'already-held');
  });

  test('expand clamps at 40 and reports only what it added', () => {
    const w = freshWorld();
    assert.equal(bag.expand(w, 10).added, 10);
    assert.equal(bag.expand(w, 15).added, 10);
    assert.equal(bag.expand(w, 1).added, 0);
    assert.equal(bag.slots(w).total, 40);
    assert.equal(w.bag.extraSlots, 20);
  });

  test('take is all-or-nothing across stacks and pockets; malformed counts throw before writing', () => {
    const w = freshWorld();
    bag.give(w, 'pear', 25, { data: TABLES });
    const before = structuredClone(w.bag);
    assert.equal(bag.take(w, 'pear', 26, { data: TABLES }).reason, 'not-enough');
    assert.deepEqual(w.bag, before);
    for (const n of [0, -1, 1.5, NaN, '3', Infinity]) assert.throws(() => bag.take(w, 'pear', /** @type {any} */ (n), { data: TABLES }), RangeError);
    for (const n of [0, -2, 0.5]) assert.throws(() => bag.give(w, 'pear', n, { data: TABLES }), RangeError);
    assert.throws(() => bag.give(w, '', 1, { data: TABLES }), TypeError);
    assert.deepEqual(w.bag, before);
    assert.equal(bag.take(w, 'pear', 25, { data: TABLES }).left, 0);
    assert.deepEqual(bag.pocketList(w, 'finds'), []);
  });
});

// -------------------------------------------------------------------------------------------------
describe('zero balances and the blackout', () => {
  test('blackout cost table: nothing under 500, never below 500, 10%, cap 1,500', () => {
    const cases = [[0, 0], [499, 0], [500, 0], [501, 1], [550, 50], [5000, 500], [5555, 555], [15_000, 1500], [15_009, 1500], [1_000_000, 1500]];
    for (const [main, lost] of cases) {
      const w = freshWorld({ main });
      const r = wallet.blackout(w);
      assert.equal(r.lost, lost, `main ${main}`);
      assert.equal(w.wallet.main, main - lost);
      assert.ok(main < 500 || w.wallet.main >= 500);
      assert.equal(r.refund, Math.floor(lost / 2));
    }
  });

  test('the Keeper\'s Purse returns every button over exactly three Glints, even for odd amounts', () => {
    for (const main of [501, 502, 503, 5_550, 9_990, 20_000]) {
      const w = freshWorld({ main });
      const { refund } = wallet.blackout(w);
      let back = 0;
      for (let i = 0; i < 3; i++) back += wallet.collectGlint(w, { now: at(2 + i, 9) }).refund;
      assert.equal(back, refund, `main ${main}`);
      assert.equal(w.wallet.purse, 0);
      assert.equal(w.wallet.purseGlints, 0);
      assert.equal(wallet.collectGlint(w, { now: at(9, 9) }).refund, 0);
    }
  });

  test('a second blackout mid-refund adds to the purse and restarts the three Glints', () => {
    const w = freshWorld({ main: 10_000 });
    wallet.blackout(w);
    wallet.collectGlint(w, { now: at(2, 9) });
    const left = w.wallet.purse;
    const r = wallet.blackout(w);
    assert.equal(w.wallet.purse, left + r.refund);
    assert.equal(w.wallet.purseGlints, 3);
  });

  test('zero amounts and empty wallets', () => {
    const w = freshWorld();
    assert.equal(wallet.spend(w, 0).ok, true);
    assert.equal(wallet.canAfford(w, 0), true);
    const bus = recBus();
    wallet.earn(w, 0, { bus });
    assert.equal(bus.events.length, 0, 'no event for a zero change');
    assert.deepEqual(loans.pay(w, 1, ctxAt(at(1, 10))), { ok: false, reason: 'insufficient', balance: 0, short: 1 });
    assert.equal(w.loans.paid, 0);
    assert.equal(shops.buy(w, 'pells', 'salve', 1, ctxAt(at(1, 9))).reason, 'insufficient');
    assert.equal(wallet.adjust(w, -50).delta, 0, 'adjust clamps at 0');
    assert.equal(w.wallet.main, 0);
  });

  test('shares after payoff: Spire credits nothing, a resident share goes to the jar', () => {
    const w = freshWorld({ main: 278_000 });
    const ctx = ctxAt(at(1, 10));
    for (let i = 0; i < 7; i++) {
      if (loans.needsCommission(w, ctx)) loans.chooseCommission(w, loans.commissionOptions(w, ctx)[0], ctx);
      loans.pay(w, 80_000, ctx);
    }
    assert.equal(w.wallet.main, 0);
    assert.equal(loans.spireShare(w, 'turn-spire', ctx).reason, 'nothing-owed');
    assert.deepEqual(loans.residentShare(w, 'th-a', ctx), { ok: true, to: 'jar', credited: 4000, jar: 4000 });
    assert.equal(loans.pay(w, 1, ctx).reason, 'nothing-owed');
  });

  test('a Spire share on the last loan bigger than its balance clears it and wastes the rest', () => {
    const w = freshWorld({ main: 278_000 - 1000 });
    const ctx = ctxAt(at(1, 10));
    for (let i = 0; i < 7; i++) {
      if (loans.needsCommission(w, ctx)) loans.chooseCommission(w, loans.commissionOptions(w, ctx)[0], ctx);
      loans.pay(w, Math.min(80_000, w.wallet.main), ctx);
    }
    assert.equal(loans.balance(w, ctx), 1000);
    const r = loans.spireShare(w, 'spire-x', ctx);
    assert.equal(r.share, 8000);
    assert.equal(r.credited, 1000);
    assert.equal(loans.isPaidOff(w, ctx), true);
    assert.equal(w.loans.tally.length, 7);
  });
});

// -------------------------------------------------------------------------------------------------
describe('malformed data fails loudly or safely, never half-way', () => {
  test('a fractional sell price floors; the sale is atomic (it used to remove the item, then throw)', () => {
    const items = ITEMS.map((i) => (i.id === 'salve' ? { ...i, sell: 12.5 } : i));
    const data = { ...TABLES, items };
    const w = freshWorld();
    bag.give(w, 'salve', 3, { data });
    const r = shops.sell(w, 'ludo', 'salve', 3, { data, now: at(1, 23) });
    assert.equal(r.ok, true);
    assert.equal(r.earned, 36);
    assert.equal(w.wallet.main, 36);
    assert.equal(bag.count(w, 'salve'), 0);
    assert.equal(shops.crateValue({ id: 'x', price: 99.9, kind: 'fish' }, 1), 89);
  });

  test('an unpriced item is never sold for free and is left off the listing', () => {
    for (const price of [undefined, null, NaN, -5, '100']) {
      const items = ITEMS.map((i) => (i.id === 'salve' ? { ...i, price } : i));
      const data = { ...TABLES, items };
      const w = freshWorld({ main: 1000 });
      assert.deepEqual(shops.buy(w, 'pells', 'salve', 2, { data, now: at(1, 9) }), { ok: false, reason: 'unpriced' }, String(price));
      assert.equal(bag.count(w, 'salve'), 0);
      assert.equal(w.wallet.main, 1000);
      assert.equal(shops.listing(w, 'pells', { data, now: at(1, 9) }).some((l) => l.item === 'salve'), false);
      assert.equal(shops.leftToday(w, 'pells', 'salve', { data, now: at(1, 9) }), 0);
    }
  });

  test('Freefall: anchor stones are neither listed nor sold anywhere; Drift and Flux see them', () => {
    const w = freshWorld({ main: 10_000, dial: 'freefall' });
    assert.equal(shops.listing(w, 'pells', ctxAt(at(1, 9))).some((l) => l.item === 'anchor-stone'), false);
    assert.equal(shops.leftToday(w, 'anchorage', 'anchor-stone', ctxAt(at(1, 9))), 0);
    assert.equal(shops.buy(w, 'anchorage', 'anchor-stone', 1, ctxAt(at(1, 9))).reason, 'not-sold');
    assert.equal(w.wallet.main, 10_000);
    for (const dial of ['drift', 'flux']) {
      const v = freshWorld({ main: 10_000, dial });
      assert.equal(shops.listing(v, 'pells', ctxAt(at(1, 9))).some((l) => l.item === 'anchor-stone'), true, dial);
    }
  });

  test('a ladder row without an amount, with a NaN tier or a duplicate tier throws (it used to self-clear)', () => {
    const bad = [
      [{ id: 'tier-1', tier: 1 }, { id: 'tier-2', tier: 2, amount: 100 }],
      [{ id: 'tier-1', tier: 1, amount: NaN }],
      [{ id: 'tier-x', tier: 'x', amount: 100 }],
      [{ id: 'tier-1', tier: 1, amount: 100 }, { id: 'tier-1b', tier: 1, amount: 200 }],
      [{ id: 'tier-1', tier: 1, amount: -1 }],
      [{ id: 'tier-1', tier: 1, amount: 2.5 }],
    ];
    for (const rows of bad) {
      const w = freshWorld({ main: 5000 });
      const before = structuredClone(w);
      const data = { ...TABLES, loans: rows };
      assert.throws(() => loans.pay(w, 100, { data, now: at(1, 10) }), TypeError, JSON.stringify(rows));
      assert.throws(() => loans.status(w, { data }), TypeError);
      assert.deepEqual(w, before);
    }
  });

  test('a commons row with a broken cost throws instead of corrupting the jar', () => {
    const w = freshWorld({ main: 5000 });
    loans.depositJar(w, 5000);
    const data = { ...TABLES, commons: [{ id: 'quay-lamps', cost: NaN }] };
    assert.throws(() => loans.fundProject(w, 'quay-lamps', { data }), TypeError);
    assert.equal(w.loans.commons.jar, 5000);
    assert.deepEqual(w.loans.commons.built, []);
  });

  test('malformed tuning values throw TypeError naming the key; unknown keys are ignored', () => {
    assert.throws(() => wallet.blackout(freshWorld({ main: 9000 }), { tuning: { blackoutCap: -1 } }), /blackoutCap/);
    assert.throws(() => bag.slots(freshWorld(), { tuning: { bagSlotsBase: 1.5 } }), /bagSlotsBase/);
    assert.throws(() => bag.stackLimit({ id: 'x', group: 'shore' }, { tuning: { stackByGroup: { shore: 0 } } }), /stackByGroup/);
    assert.throws(() => loans.ladder({ tuning: { loanLadder: [] } }), /loanLadder/);
    assert.throws(() => shops.sellValue({ id: 'x', price: 10 }, { tuning: { spareSellRate: 2 } }), /spareSellRate/);
    assert.throws(() => wallet.starsaltLeftToday(freshWorld(), { tuning: { econDayStartMinute: 1440 } }), /econDayStartMinute/);
    assert.equal(wallet.blackout(freshWorld({ main: 9000 }), { tuning: { nonsense: 'x' } }).lost, 900);
  });

  test('broken shop rows: no hours = closed, non-array stock = empty shelf, junk rows skipped', () => {
    const data = { ...TABLES, shops: [
      { id: 'nohours', stock: [{ item: 'salve' }], buys: ['fish'] },
      { id: 'junk', hours: [0, 0], stock: 'salve', buys: [] },
      { id: 'mixed', hours: [0, 0], stock: [null, 7, { item: 3 }, { item: 'salve', qty: 'two' }], buys: [] },
    ] };
    const w = freshWorld({ main: 1000 });
    assert.equal(shops.isOpen(w, 'nohours', { data, now: at(1, 12) }), false);
    assert.deepEqual(shops.stockFor(w, 'junk', 1, { data }), []);
    assert.deepEqual(shops.stockFor(w, 'mixed', 1, { data }), [{ item: 'salve', qty: null, staple: true, pool: null }]);
    assert.equal(shops.buy(w, 'nope', 'salve', 1, { data }).reason, 'unknown-shop');
  });

  test('every RULES-ECON tuning key in js/data/tuning.js passes its module spec', () => {
    for (const m of [wallet, bag, loans, shops]) {
      const t = m.tuningOf({ tuning: TUNING });
      for (const k of m.TUNING_KEYS) if (k in TUNING) assert.deepEqual(t[k], TUNING[k], k);
    }
  });

  test('the real data/loans.js tables drive the ladder, commissions and Commons', () => {
    const data = { ...TABLES, loans: REAL_LOANS, commissions: REAL_COMMISSIONS, commons: REAL_COMMONS };
    assert.equal(loans.ladderTotal({ data }), 278_000);
    assert.deepEqual(loans.ladder({ data }).map((r) => r.commission), [false, false, true, true, true, true, false]);
    assert.deepEqual(loans.commissionRooms({ data }), ['training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery']);
    const w = freshWorld({ main: 300_000 });
    const ctx = { data, now: at(1, 10) };
    for (const room of ['cellar', 'gallery', 'workshop', 'greenhouse']) {
      while (!loans.needsCommission(w, ctx)) loans.pay(w, 100_000, ctx);
      assert.equal(loans.chooseCommission(w, room, ctx).ok, true);
    }
    while (!loans.isPaidOff(w, ctx)) loans.pay(w, 100_000, ctx);
    for (let d = 2; d < 10; d++) loans.landDue(w, { data, now: at(d, 6) });
    assert.equal(bag.slots(w, ctx).total, 40, 'cottage +10 and Cellar +10');
    assert.equal(loans.relightingDue(w, { data, now: at(9, 18) }), true);
    loans.depositJar(w, 3000, ctx);
    assert.deepEqual(loans.commonsStatus(w, ctx).find((p) => p.id === 'dark-house-1'), { id: 'dark-house-1', cost: 3000, share: 2100, built: false, unlocked: true, affordable: true });
    assert.equal(loans.commonsStatus(w, ctx).find((p) => p.id === 'training-yard-green').unlocked, false, 'badge 5');
  });
});

// -------------------------------------------------------------------------------------------------
describe('tierUp and loads against a changed ladder', () => {
  test('tierUp offers the next loan when the open one is already at zero, and is a no-op otherwise', () => {
    const w = freshWorld();
    assert.deepEqual(loans.tierUp(w, ctxAt(at(1, 10))), { cleared: [], tier: 1 });
    w.loans.paid = 6000; // e.g. a save loaded after the data lowered loan 1
    const r = loans.tierUp(w, ctxAt(at(1, 10)));
    assert.equal(r.tier, 2);
    assert.equal(r.cleared.length, 1);
    assert.equal(r.cleared[0].build, 'bedsit');
    assert.equal(w.loans.builds.length, 1);
    assert.deepEqual(loans.tierUp(w, ctxAt(at(1, 10))).cleared, []);
  });

  test('tierUp never queues a second build for a tier that already has one', () => {
    const w = freshWorld();
    w.loans.tier = 7;
    w.loans.paid = 80_000;
    w.loans.builds.push({ id: 'lamp-room', tier: 7, startedDay: 0, readyDay: 1, choice: null, done: false });
    const r = loans.tierUp(w, ctxAt(at(1, 10)));
    assert.equal(r.cleared.length, 1, 'the last stick splits once');
    assert.equal(w.loans.builds.length, 1);
    assert.deepEqual(loans.tierUp(w, ctxAt(at(1, 10))).cleared, []);
  });
});

// -------------------------------------------------------------------------------------------------
describe('script runner: an asked take is the one-of-a-kind confirm', () => {
  test('the runner hands bag.take the confirm after the player says yes', () => {
    const reg = createRegistry({ items: ITEMS, shops: SHOPS, loans: LOANS, moves: MOVES });
    const w = freshWorld();
    bag.give(w, 'heirloom-bell', 1, { data: reg });
    const run = (answer) => {
      const runner = createRunner([{ op: 'take', item: 'heirloom-bell', ask: true }], { world: w, data: reg, systems: { take: bag.take, give: bag.give } });
      const req = runner.step();
      assert.equal(req.op, 'take');
      assert.equal(req.ask, true);
      assert.deepEqual(runner.step(answer), { done: true });
    };
    run(false);
    assert.equal(bag.count(w, 'heirloom-bell'), 1, 'No keeps it');
    run(true);
    assert.equal(bag.count(w, 'heirloom-bell'), 0, 'Yes hands it over (the bell goes to its door)');
  });
});

// -------------------------------------------------------------------------------------------------
describe('determinism', () => {
  const here = fileURLToPath(import.meta.url);
  const SCRIPT = `
    const shops = await import(${JSON.stringify(new URL('../js/systems/shops.js', import.meta.url).href)});
    const fx = await import(${JSON.stringify(new URL('./fixtures/econ.fixture.mjs', import.meta.url).href)});
    const w = fx.freshWorld({ seedCode: 'DET-ECON-7' });
    const out = [];
    for (let d = 0; d < 40; d++) out.push([shops.stockFor(w, 'pells', d, { data: fx.TABLES }).map((l) => l.item), shops.wantedToday(w, 'pells', d, { data: fx.TABLES })]);
    process.stdout.write(JSON.stringify(out));
  `;
  test('stock and Wanted Today are identical across processes and independent of call order', () => {
    const child = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT], { cwd: here.replace(/\/[^/]+$/, ''), encoding: 'utf8' }));
    const w = freshWorld({ seedCode: 'DET-ECON-7' });
    const mine = [];
    for (let d = 39; d >= 0; d--) mine[d] = [shops.stockFor(w, 'pells', d, { data: TABLES }).map((l) => l.item), shops.wantedToday(w, 'pells', d, { data: TABLES })];
    assert.deepEqual(mine, child);
    const discs = new Set(mine.map(([s]) => s.filter((x) => x.startsWith('disc-')).join('+')));
    assert.ok(discs.size > 1, 'the disc rotation varies across days');
    assert.ok(mine.every(([s]) => s.filter((x) => x.startsWith('disc-')).length === 2), 'two discs a day');
  });

  test('a different seed gives a different run of shelves', () => {
    const a = freshWorld({ seedCode: 'SEED-A' });
    const b = freshWorld({ seedCode: 'SEED-B' });
    const shelf = (w) => Array.from({ length: 30 }, (_, d) => shops.stockFor(w, 'pells', d, { data: TABLES }).map((l) => l.item).join()).join('|');
    assert.notEqual(shelf(a), shelf(b));
  });
});

// -------------------------------------------------------------------------------------------------
describe('save round trips', () => {
  function game(seedCode = 'ECON-SAVE') {
    const store = createStore(createNewWorld({ seedCode, lease: { name: 'Sorrel', mapId: 'harbor' } }));
    const rngs = createRngs(store);
    const clock = createClock(clockSys.optionsFrom(store.world));
    clockSys.restoreFrom(store.world, clock);
    store.onSnapshot((w) => clockSys.serializeInto(w, clock));
    const scenes = { top: () => ({ name: 'overworld' }), has: () => false, isTransitioning: () => false };
    return { store, rngs, clock, bus: store.bus, scenes };
  }

  test('bag, wallet, loans and shops survive save -> load byte for byte, and play on identically', () => {
    const G = game();
    const ctx = (now) => ({ data: TABLES, now });
    G.store.tx('econ', (w) => {
      w.player.x = 4; // the basket lands at the player's feet
      wallet.earn(w, 40_000);
      for (let i = 0; i < 20; i++) bag.give(w, 'salve', 20, ctx(at(1, 9)));
      bag.give(w, 'pear', 7, ctx(at(1, 9)));
      bag.give(w, 'heirloom-bell', 1, ctx(at(1, 9)));
      shops.buy(w, 'ludo', 'starsalt', 2, ctx(at(1, 23)));
      wallet.blackout(w);
      loans.errand(w, 'e1', ctx(at(1, 18)));
      loans.pay(w, 5500, ctx(at(1, 19)));
      loans.chooseRoof(w, 1, 'ochre');
      bag.take(w, 'salve', 20, ctx(at(1, 20)));
      shops.crateDeposit(w, 'salve', 5, ctx(at(1, 21)));
      loans.depositJar(w, 1234, ctx(at(1, 21)));
      shops.sell(w, 'ludo', 'salve', 1, ctx(at(1, 22)));
    });
    const p = createPersist({ storage: new Map(), prefix: 'E.', now: () => 1 });
    const res = p.saveManual(G, 1);
    assert.equal(res.ok, true, JSON.stringify(res.error));
    const loaded = p.load('manual:1');
    assert.equal(loaded.ok, true, JSON.stringify(loaded.error));
    const L = loaded.world;
    for (const k of ['bag', 'wallet', 'loans', 'shops', 'flags']) assert.deepEqual(L[k], G.store.world[k], k);
    assert.deepEqual(validateWorld(L), []);
    // both copies play the same next day
    const play = (w) => {
      const out = [];
      out.push(loans.landDue(w, ctx(at(2, 5, 40))).landed.map((b) => [b.id, b.choice]));
      out.push(shops.settleCrate(w, ctx(at(2, 6))).earned);
      out.push(wallet.collectGlint(w, ctx(at(2, 9))));
      out.push(shops.listing(w, 'pells', ctx(at(2, 9))).map((l) => l.item));
      out.push(bag.takeBasket(w, w.bag.baskets[0]?.id ?? 'none', ctx(at(2, 9))));
      out.push(loans.status(w, ctx(at(2, 10))));
      return out;
    };
    const a = structuredClone(G.store.world);
    assert.deepEqual(play(L), play(a));
    assert.deepEqual(L.wallet, a.wallet);
  });

  test('a v2 save with the old pockets migrates into the satchel tabs and validates', () => {
    const w = createNewWorld({ seedCode: 'OLD' });
    const v2 = structuredClone(w);
    v2.v = 2;
    v2.bag = { pockets: { items: [{ id: 'salve', n: 3 }], catch: [{ id: 'tallow-wick', n: 5 }, { id: 'tallow-wick', n: 2 }], key: [{ id: 'reading-glass', n: 1 }], tools: [] }, capacity: { items: 0, catch: 0, key: 0, tools: 0 } };
    delete v2.shops;
    for (const k of ['purseGlints', 'starsaltDay', 'starsaltBought', 'anchorGrants']) delete v2.wallet[k];
    for (const k of ['errands', 'spireShares', 'tally', 'log']) delete v2.loans[k];
    const r = migrateWorld(v2);
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.world.v, SCHEMA_VERSION);
    assert.deepEqual(r.world.bag.pockets.medicine, [{ id: 'salve', n: 3 }]);
    assert.deepEqual(r.world.bag.pockets.wicks, [{ id: 'tallow-wick', n: 7 }]);
    assert.deepEqual(r.world.bag.pockets.keepsakes, [{ id: 'reading-glass', n: 1 }]);
    assert.deepEqual(r.world.shops, { day: -1, sold: {}, wantedSold: {}, crate: [] });
    assert.equal(r.world.wallet.starsaltDay, -1);
    assert.deepEqual(validateWorld(r.world), []);
    const n = bag.normalize(r.world, { data: TABLES });
    assert.equal(n.spilled, 0);
    assert.equal(bag.count(r.world, 'tallow-wick'), 7);
  });
});

// -------------------------------------------------------------------------------------------------
describe('60 in-game days of clock + economy', () => {
  test('no drift, no NaN, money conserved, the ladder paid and the lamp relit', () => {
    const data = WITH_COLL;
    const w = freshWorld({ main: 0, seedCode: 'LONG-RUN-60' });
    const clock = createClock(clockSys.optionsFrom(w));
    clockSys.restoreFrom(w, clock);
    const start = w.clock.total;
    const bus = createBus();
    const deltas = { main: 0, starsalt: 0, anchors: 0, purse: 0 };
    bus.on('wallet:changed', (p) => { deltas[p.currency] += p.delta; });
    let paidEvents = 0;
    bus.on('loan:paid', (p) => { paidEvents += p.amount; });
    const ctx = (extra = {}) => ({ data, bus, now: w.clock.total, ...extra });
    let anchorsSeen = 0;
    let glintDay = -1;
    let badges = 0;
    const check = (where) => {
      for (const [k, v] of Object.entries(w.wallet)) if (typeof v === 'number') assert.ok(isNonNegInt(v) || (k === 'starsaltDay' && v === -1), `${where}: wallet.${k}=${v}`);
      assert.ok(isNonNegInt(w.loans.paid) && isNonNegInt(w.loans.commons.jar), `${where}: loans`);
      assert.ok(!/NaN|Infinity/.test(String(Object.values(w.wallet))), where);
      for (const e of w.loans.log) assert.ok(isNonNegInt(e.amount) && Number.isInteger(e.day), `${where}: log`);
      for (const stacks of Object.values(w.bag.pockets)) for (const s of stacks) assert.ok(isNonNegInt(s.n) && s.n >= 1, `${where}: stack`);
    };
    bus.on('clock:anchor', ({ id }) => {
      anchorsSeen++;
      if (id === 'builds') loans.landDue(w, ctx());
      if (id === 'morning') shops.settleCrate(w, ctx());
    });
    bus.on('clock:hour', ({ hour }) => {
      const c = ctx();
      const day = econ.econDay(w.clock.total);
      if (hour === 7) {
        bag.give(w, 'apple', 12, c);
        bag.give(w, 'cockle', 4, c);
        bag.give(w, 'perch', 3, c);
        bag.give(w, 'john-dory', 4, c);
        for (const b of bag.baskets(w)) bag.takeBasket(w, b.id, c);
      }
      if (hour === 9) {
        for (const id of ['apple', 'cockle', 'perch', 'john-dory']) {
          const n = bag.count(w, id);
          if (n > 0) assert.equal(shops.sell(w, 'pells', id, n, c).ok, true, id);
        }
        if (w.wallet.main >= 200) shops.buy(w, 'pells', 'tallow-wick', 2, c);
      }
      if (hour === 10 && glintDay !== day) { glintDay = day; wallet.collectGlint(w, c); }
      if (hour === 12 && day % 7 === 3) wallet.blackout(w, c);
      if (hour === 13 && day % 8 === 7 && badges < 6) {
        badges++;
        loans.spireShare(w, `spire-${badges}`, c);
        wallet.onBadge(w, `spire-${badges}`, c);
      }
      if (hour === 16) {
        if (day % 5 === 4) loans.residentShare(w, `thread-${day}`, c);
        if (loans.needsCommission(w, c)) loans.chooseCommission(w, loans.commissionOptions(w, c)[0], c);
        const spare = w.wallet.main - 500;
        if (spare > 0 && !loans.isPaidOff(w, c)) loans.pay(w, spare, c);
        for (const b of loans.buildQueue(w)) if (b.choice === null) loans.chooseRoof(w, b.id, 'heather', c);
      }
      if (hour === 21 && bag.count(w, 'tallow-wick') > 4) shops.crateDeposit(w, 'tallow-wick', 2, c);
      if (hour === 23 && w.wallet.main > 10_000) shops.buy(w, 'ludo', 'starsalt', 1, c);
      check(`day ${day} ${hour}:00`);
    });
    const startMain = w.wallet.main;
    for (let i = 0; i < 60 * MINUTES_PER_DAY * 4; i++) clockSys.tick(w, clock, 250, { bus });
    assert.equal(w.clock.total, start + 60 * MINUTES_PER_DAY, 'the clock did not drift');
    assert.equal(anchorsSeen, 120, 'two anchors a day');
    assert.equal(w.wallet.main - startMain, deltas.main, 'every button change was announced');
    assert.equal(w.wallet.purse, deltas.purse);
    assert.equal(w.wallet.starsalt, deltas.starsalt);
    assert.equal(loans.isPaidOff(w, { data }), true, `paid off (tier ${w.loans.tier}, paid ${w.loans.paid})`);
    assert.equal(paidEvents, 278_000, 'every loan credit is accounted for exactly once');
    assert.equal(w.loans.tally.length, 7);
    assert.equal(w.loans.scaffold, 7);
    assert.ok(w.loans.builds.every((b) => b.done && b.choice !== null));
    assert.equal(new Set(w.loans.builds.map((b) => b.readyDay)).size, w.loans.builds.length, 'one build a night');
    assert.equal(w.flags['sp.lamp-room-built'], true);
    assert.ok(Number.isInteger(w.flags['sys.relighting-due']));
    assert.equal(loans.relightingDue(w, { data }), true);
    assert.equal(bag.slots(w, { data }).total, 40, 'cottage + Cellar');
    assert.equal(w.wallet.starsaltBought <= 3, true);
    const has = { has: (t, id) => (t === 'items' || t === 'collections' ? econ.itemOf(data, id) !== null : true) };
    assert.deepEqual(validateWorld(w, has), []);
    assert.equal(loans.status(w, { data }).totalOwed, 0);
  });
});

// -------------------------------------------------------------------------------------------------
describe('debug hook give goes through systems/bag', () => {
  test('__game.give places by the data row, spills to a basket, and keeps unknown probe ids valid', async () => {
    const { installDebugHook, FALLBACK_POCKET } = await import('../js/debug/hook.js');
    const store = createStore(freshWorld());
    const G = {
      store, get world() { return store.world; }, bus: store.bus,
      scenes: { top: () => ({ name: 'overworld' }), stack: [], isTransitioning: false },
      loop: { paused: false, pause() {}, resume() {}, step() {} },
      persist: { autosave: () => ({ ok: true }), load: () => ({ ok: false }) },
      rngs: { fresh: (label) => ({ label }) },
      data: createRegistry({ items: ITEMS, shops: SHOPS, loans: LOANS, moves: MOVES }),
      perf: { fps: 60 }, flags: { noanim: false }, speed: 1, tweens: { count: 0 }, saves: [],
    };
    const seen = [];
    store.bus.on('bag:changed', (p) => seen.push(p));
    const hook = installDebugHook(G, { target: new EventTarget(), expose: false });
    assert.equal(hook.give('tallow-wick', 25), 25);
    assert.deepEqual(bag.pocketList(store.world, 'wicks'), [{ id: 'tallow-wick', n: 20 }, { id: 'tallow-wick', n: 5 }]);
    assert.equal(hook.give('heirloom-bell', 1), 1);
    assert.equal(hook.give('heirloom-bell', 1), 0, 'a second one-of-a-kind is refused');
    assert.equal(hook.give('debug-probe', 2), 2);
    assert.deepEqual(store.world.bag.pockets[FALLBACK_POCKET], [{ id: 'debug-probe', n: 2 }]);
    assert.ok(seen.every((p) => typeof p.count === 'number' && p.source === 'debug'));
    assert.deepEqual(validateWorld(store.world), []);
    assert.equal(hook.earn(-10), 0);
    hook.uninstall();
  });
});
