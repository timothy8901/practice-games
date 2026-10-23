// Unit tests for js/systems/bag.js. Run: node --test test/systems.bag.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as bag from '../js/systems/bag.js';
import { validateWorld, POCKET_IDS } from '../js/state/schema.js';
import { DATA } from '../js/data/index.js';
import { createRegistry } from '../js/data/registry.js';
import { createRunner } from '../js/script/runner.js';
import { freshWorld, recBus, TABLES, REGISTRY, ITEMS, ITEM_CHECK } from './fixtures/econ.fixture.mjs';

const ctx = (extra = {}) => ({ data: TABLES, ...extra });
const fill = (w, n) => { for (let i = 0; i < n; i++) bag.give(w, 'still-knot', 5, ctx()); }; // one full stack per call

describe('bag: pockets, tabs and item facts', () => {
  it('the satchel tabs are the GDD six and the schema adds tools', () => {
    assert.deepEqual([...bag.SATCHEL_TABS], ['wicks', 'medicine', 'discs', 'finds', 'held', 'keepsakes']);
    assert.deepEqual([...POCKET_IDS], [...bag.SATCHEL_TABS, 'tools']);
    const w = freshWorld();
    for (const p of POCKET_IDS) assert.deepEqual(w.bag.pockets[p], []);
  });

  it('stack limits: fruit and shells 10 whatever the row says, wicks per data, one-of-a-kind 1, default 99', () => {
    const row = (id) => ITEMS.find((i) => i.id === id);
    assert.equal(bag.stackLimit(row('pear')), 10);
    assert.equal(bag.stackLimit(row('shell')), 10);
    assert.equal(bag.stackLimit(row('tallow-wick')), 20);
    assert.equal(bag.stackLimit(row('john-dory')), 5);
    assert.equal(bag.stackLimit(row('isolde-lantern')), 1);
    assert.equal(bag.stackLimit({ id: 'x' }), 99);
    assert.equal(bag.stackLimit({ id: 'x' }, { tuning: { stackMax: 7 } }), 7);
    assert.equal(bag.stackLimit(row('pear'), { tuning: { stackByKind: { fruit: 12 } } }), 12);
  });

  it('pocketOf follows the row, else the default pocket', () => {
    assert.equal(bag.pocketOf(ITEMS[0]), 'wicks');
    assert.equal(bag.pocketOf({ id: 'x' }), 'finds');
    assert.equal(bag.pocketOf(null), 'finds');
    assert.equal(bag.walletCurrencyOf(ITEMS.find((i) => i.id === 'starsalt')), 'starsalt');
    assert.equal(bag.walletCurrencyOf({ wallet: 'purse' }), null, 'the purse is not a give target');
  });
});

describe('bag: give', () => {
  it('puts items in their pocket, tops up partial stacks, then opens new ones', () => {
    const w = freshWorld();
    const bus = recBus();
    assert.deepEqual(bag.give(w, 'pear', 7, ctx({ bus })), { ok: true, itemId: 'pear', pocket: 'finds', added: 7, overflow: 0, basketId: null });
    bag.give(w, 'pear', 5, ctx({ bus }));
    assert.deepEqual(w.bag.pockets.finds, [{ id: 'pear', n: 10 }, { id: 'pear', n: 2 }]);
    bag.give(w, 'tallow-wick', 25, ctx());
    assert.deepEqual(w.bag.pockets.wicks, [{ id: 'tallow-wick', n: 20 }, { id: 'tallow-wick', n: 5 }]);
    assert.deepEqual(bus.of('bag:changed')[1], { itemId: 'pear', pocket: 'finds', delta: 5, count: 12, overflow: 0, basketId: null, source: 'give' });
    assert.deepEqual(validateWorld(w, ITEM_CHECK), []);
  });

  it('20 shared slots across the slotted pockets; keepsakes and tools take none', () => {
    const w = freshWorld();
    assert.deepEqual(bag.slots(w), { total: 20, used: 0, free: 20, max: 40, extra: 0 });
    bag.give(w, 'pear', 30, ctx()); // 3 slots
    bag.give(w, 'salve', 1, ctx()); // 1
    bag.give(w, 'reading-glass', 1, ctx());
    bag.give(w, 'rod', 1, ctx());
    assert.equal(bag.slots(w, ctx()).used, 4);
  });

  it('overflow drops into a basket at the player\'s feet and never fails', () => {
    const w = freshWorld();
    fill(w, 19);
    const bus = recBus();
    const r = bag.give(w, 'pear', 25, ctx({ bus }));
    assert.deepEqual(r, { ok: true, itemId: 'pear', pocket: 'finds', added: 10, overflow: 15, basketId: 'b1' });
    assert.deepEqual(w.bag.baskets, [{ id: 'b1', mapId: 'harbor', x: 3, y: 4, day: 0, items: [{ id: 'pear', n: 15 }] }]);
    assert.equal(bus.of('bag:changed')[0].overflow, 15);
    // the same tile merges into the same basket; a full satchel puts everything there
    assert.equal(bag.give(w, 'pear', 3, ctx()).basketId, 'b1');
    assert.equal(bag.give(w, 'salve', 2, ctx()).overflow, 2);
    assert.deepEqual(w.bag.baskets[0].items, [{ id: 'pear', n: 18 }, { id: 'salve', n: 2 }]);
    // another tile (ctx.at) gets its own basket
    assert.equal(bag.give(w, 'salve', 1, ctx({ at: { mapId: 'quay', x: 1, y: 1 } })).basketId, 'b2');
    assert.equal(bag.count(w, 'pear', undefined, ctx()), 10);
    assert.equal(bag.count(w, 'pear', { baskets: true }, ctx()), 28);
    assert.deepEqual(validateWorld(w, ITEM_CHECK), []);
  });

  it('a one-of-a-kind item is given once (even if the first sits in a basket)', () => {
    const w = freshWorld();
    assert.equal(bag.give(w, 'isolde-lantern', 3, ctx()).added, 1);
    assert.deepEqual(bag.give(w, 'isolde-lantern', 1, ctx()), { ok: false, reason: 'already-held', itemId: 'isolde-lantern' });
    const w2 = freshWorld();
    w2.bag.baskets.push({ id: 'b9', mapId: 'harbor', x: 0, y: 0, day: 0, items: [{ id: 'heirloom-bell', n: 1 }] });
    assert.equal(bag.give(w2, 'heirloom-bell', 1, ctx()).reason, 'already-held');
  });

  it('keepsakes never spill even with a full satchel', () => {
    const w = freshWorld();
    fill(w, 20);
    assert.equal(bag.slots(w).free, 0);
    assert.equal(bag.give(w, 'heirloom-bell', 1, ctx()).overflow, 0);
    assert.equal(bag.give(w, 'rod', 1, ctx()).overflow, 0);
  });

  it('currency items go to the wallet', () => {
    const w = freshWorld();
    const r = bag.give(w, 'starsalt', 3, ctx());
    assert.deepEqual(r, { ok: true, itemId: 'starsalt', pocket: null, added: 3, overflow: 0, basketId: null, currency: 'starsalt' });
    assert.equal(w.wallet.starsalt, 3);
    assert.equal(bag.count(w, 'starsalt', undefined, ctx()), 3);
    assert.deepEqual(w.bag.pockets.keepsakes, []);
  });

  it('unknown ids are refused when there is an items table, generic without data', () => {
    const w = freshWorld();
    assert.deepEqual(bag.give(w, 'nope', 1, ctx()), { ok: false, reason: 'unknown-item', itemId: 'nope' });
    assert.equal(bag.give(w, 'rope', 2).pocket, 'finds');
    assert.deepEqual(w.bag.pockets.finds, [{ id: 'rope', n: 2 }]);
  });

  it('a per-pocket capacity limits stacks in that pocket', () => {
    const w = freshWorld();
    w.bag.capacity.wicks = 1;
    assert.deepEqual(bag.give(w, 'tallow-wick', 30, ctx()).overflow, 10);
  });

  it('throws on malformed ids and counts', () => {
    const w = freshWorld();
    assert.throws(() => bag.give(w, '', 1), TypeError);
    for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => bag.give(w, 'pear', bad, ctx()), RangeError);
  });

  it('works with the real registry and the placeholder data', () => {
    const w = freshWorld();
    w.player.mapId = '';
    const data = createRegistry(DATA);
    assert.equal(bag.give(w, 'ph-lantern', 1, { data }).pocket, 'tools');
    assert.deepEqual(validateWorld(w, data), []);
    assert.equal(bag.give(w, 'pear', 1, { data: REGISTRY }).pocket, 'finds');
  });
});

describe('bag: take, toss, count, has', () => {
  it('takes from the partial stack first and removes empty stacks', () => {
    const w = freshWorld();
    bag.give(w, 'pear', 23, ctx());
    const bus = recBus();
    assert.deepEqual(bag.take(w, 'pear', 4, ctx({ bus })), { ok: true, itemId: 'pear', taken: 4, left: 19 });
    assert.deepEqual(w.bag.pockets.finds, [{ id: 'pear', n: 10 }, { id: 'pear', n: 9 }]);
    bag.take(w, 'pear', 19, ctx());
    assert.deepEqual(w.bag.pockets.finds, []);
    assert.deepEqual(bus.of('bag:changed')[0], { itemId: 'pear', pocket: 'finds', delta: -4, count: 19, overflow: 0, basketId: null, source: 'take' });
  });

  it('is all or nothing and never spends from a basket', () => {
    const w = freshWorld();
    bag.give(w, 'salve', 2, ctx());
    w.bag.baskets.push({ id: 'b1', mapId: 'harbor', x: 3, y: 4, day: 0, items: [{ id: 'salve', n: 5 }] });
    assert.deepEqual(bag.take(w, 'salve', 3, ctx()), { ok: false, reason: 'not-enough', itemId: 'salve', have: 2 });
    assert.equal(bag.count(w, 'salve', undefined, ctx()), 2);
    assert.equal(bag.has(w, 'salve', 2, undefined, ctx()), true);
    assert.equal(bag.has(w, 'salve', 3, undefined, ctx()), false);
    assert.equal(bag.has(w, 'salve', 3, { baskets: true }, ctx()), true);
  });

  it('one-of-a-kind items return needsConfirm until confirmed', () => {
    const w = freshWorld();
    bag.give(w, 'isolde-lantern', 1, ctx());
    const bus = recBus();
    assert.deepEqual(bag.take(w, 'isolde-lantern', 1, ctx({ bus })), { ok: false, needsConfirm: true, itemId: 'isolde-lantern' });
    assert.equal(bus.events.length, 0);
    assert.equal(bag.count(w, 'isolde-lantern', undefined, ctx()), 1);
    assert.equal(bag.toss(w, 'isolde-lantern', 1, ctx()).needsConfirm, true);
    assert.equal(bag.take(w, 'isolde-lantern', 1, ctx({ confirm: true })).ok, true);
    assert.equal(bag.count(w, 'isolde-lantern', undefined, ctx()), 0);
  });

  it('currency items are spent from the wallet', () => {
    const w = freshWorld();
    w.wallet.anchors = 2;
    assert.deepEqual(bag.take(w, 'anchor-stone', 1, ctx()), { ok: true, itemId: 'anchor-stone', taken: 1, left: 1 });
    assert.deepEqual(bag.take(w, 'anchor-stone', 5, ctx()), { ok: false, reason: 'not-enough', itemId: 'anchor-stone', have: 1 });
  });

  it('toss carries its own source', () => {
    const w = freshWorld();
    bag.give(w, 'moth', 3, ctx());
    const bus = recBus();
    bag.toss(w, 'moth', 1, ctx({ bus }));
    assert.equal(bus.of('bag:changed')[0].source, 'toss');
  });

  it('pocketList copies', () => {
    const w = freshWorld();
    bag.give(w, 'salve', 2, ctx());
    const list = bag.pocketList(w, 'medicine');
    list[0].n = 99;
    assert.equal(w.bag.pockets.medicine[0].n, 2);
    assert.deepEqual(bag.pocketList(w, 'nope'), []);
  });
});

describe('bag: slots and expansion', () => {
  it('expands by builds up to 40 and never past it', () => {
    const w = freshWorld();
    const bus = recBus();
    assert.deepEqual(bag.expand(w, 10, { bus }), { added: 10, total: 30 });
    assert.deepEqual(bag.expand(w, 10), { added: 10, total: 40 });
    assert.deepEqual(bag.expand(w, 10), { added: 0, total: 40 });
    assert.equal(w.bag.extraSlots, 20);
    assert.equal(bus.of('bag:changed')[0].slots, 30);
    assert.throws(() => bag.expand(w, 0), RangeError);
    assert.deepEqual(validateWorld(w), []);
  });

  it('roomFor counts top-ups and free slots', () => {
    const w = freshWorld();
    assert.equal(bag.roomFor(w, 'pear', ctx()), 200);
    bag.give(w, 'pear', 3, ctx());
    assert.equal(bag.roomFor(w, 'pear', ctx()), 7 + 19 * 10);
    assert.equal(bag.roomFor(w, 'reading-glass', ctx()), 1);
    bag.give(w, 'reading-glass', 1, ctx());
    assert.equal(bag.roomFor(w, 'reading-glass', ctx()), 0);
    assert.equal(bag.roomFor(w, 'rod', ctx()), Infinity, 'unslotted');
    assert.equal(bag.roomFor(w, 'starsalt', ctx()), Infinity);
    assert.equal(bag.roomFor(w, 'nope', ctx()), 0);
  });
});

describe('bag: baskets', () => {
  it('takeBasket moves what fits back and leaves the rest, removing the basket once empty', () => {
    const w = freshWorld();
    fill(w, 18);
    bag.give(w, 'pear', 40, ctx()); // 20 in, 20 to b1
    assert.deepEqual(bag.baskets(w, 'harbor').map((b) => b.items), [[{ id: 'pear', n: 20 }]]);
    const r1 = bag.takeBasket(w, 'b1', ctx());
    assert.deepEqual(r1, { ok: true, moved: [], left: [{ id: 'pear', n: 20 }], removed: false });
    bag.take(w, 'still-knot', 10, ctx());
    const bus = recBus();
    const r2 = bag.takeBasket(w, 'b1', ctx({ bus }));
    assert.deepEqual(r2, { ok: true, moved: [{ id: 'pear', n: 20 }], left: [], removed: true });
    assert.equal(w.bag.baskets.length, 0);
    assert.equal(bus.of('bag:changed')[0].source, 'basket');
    assert.deepEqual(bag.takeBasket(w, 'b1', ctx()), { ok: false, reason: 'no-basket' });
    assert.deepEqual(validateWorld(w, ITEM_CHECK), []);
  });

  it('baskets() filters by map and returns copies', () => {
    const w = freshWorld();
    fill(w, 20);
    bag.give(w, 'salve', 1, ctx());
    bag.give(w, 'salve', 1, ctx({ at: { mapId: 'quay', x: 0, y: 0 } }));
    assert.equal(bag.baskets(w).length, 2);
    assert.equal(bag.baskets(w, 'quay').length, 1);
    bag.baskets(w)[0].items[0].n = 99;
    assert.equal(w.bag.baskets[0].items[0].n, 1);
  });

  it('a one-of-a-kind left in a basket comes back only if none is held', () => {
    const w = freshWorld();
    w.bag.baskets.push({ id: 'b1', mapId: 'harbor', x: 3, y: 4, day: 0, items: [{ id: 'heirloom-bell', n: 1 }] });
    assert.deepEqual(bag.takeBasket(w, 'b1', ctx()).moved, [{ id: 'heirloom-bell', n: 1 }]);
  });
});

describe('bag: normalize', () => {
  it('re-homes stacks to their row\'s pocket, merges and re-splits at the stack limit', () => {
    const w = freshWorld();
    w.bag.pockets.medicine.push({ id: 'pear', n: 7 }, { id: 'tallow-wick', n: 3 });
    w.bag.pockets.finds.push({ id: 'pear', n: 8 });
    w.bag.pockets.mystery = [{ id: 'unknown-thing', n: 2 }];
    const r = bag.normalize(w, ctx());
    assert.equal(r.spilled, 0);
    assert.deepEqual(w.bag.pockets.finds, [{ id: 'pear', n: 10 }, { id: 'pear', n: 5 }]);
    assert.deepEqual(w.bag.pockets.wicks, [{ id: 'tallow-wick', n: 3 }]);
    assert.deepEqual(w.bag.pockets.medicine, []);
    assert.deepEqual(w.bag.pockets.mystery, [{ id: 'unknown-thing', n: 2 }], 'unknown ids stay put');
  });

  it('spills what no longer fits into a basket', () => {
    const w = freshWorld();
    w.bag.pockets.finds.push({ id: 'pear', n: 250 });
    const r = bag.normalize(w, ctx());
    assert.equal(r.spilled, 50);
    assert.equal(bag.count(w, 'pear', { baskets: true }, ctx()), 250);
  });
});

describe('bag: use', () => {
  it('every handler key used by the fixture and the placeholder data exists', () => {
    for (const it of [...ITEMS, ...DATA.items]) if (it.use) assert.ok(bag.USE_HANDLERS[it.use], it.use);
    assert.ok(Object.isFrozen(bag.USE_HANDLERS));
  });

  it('returns the effect without spending when no apply is given', () => {
    const w = freshWorld();
    bag.give(w, 'salve', 2, ctx());
    assert.deepEqual(bag.use(w, 'salve', ctx()), { ok: true, effect: { kind: 'heal', amount: 20 }, target: 'creature', consumed: false, applied: null });
    assert.equal(bag.count(w, 'salve', undefined, ctx()), 2);
  });

  it('applies and spends one on success; a refused apply spends nothing', () => {
    const w = freshWorld();
    bag.give(w, 'poultice', 2, ctx());
    const seen = [];
    const r = bag.use(w, 'poultice', ctx({ apply: (effect, item) => { seen.push([effect, item.id]); return { ok: true }; } }));
    assert.equal(r.consumed, true);
    assert.deepEqual(seen, [[{ kind: 'cure', statuses: ['burn', 'poison'] }, 'poultice']]);
    assert.equal(bag.use(w, 'poultice', ctx({ apply: () => false })).reason, 'not-applied');
    assert.equal(bag.use(w, 'poultice', ctx({ apply: () => ({ ok: false }) })).reason, 'not-applied');
    assert.equal(bag.count(w, 'poultice', undefined, ctx()), 1);
  });

  it('discs teach and are never consumed; wicks only work in battle', () => {
    const w = freshWorld();
    bag.give(w, 'disc-ember', 1, ctx());
    bag.give(w, 'tallow-wick', 1, ctx());
    const r = bag.use(w, 'disc-ember', ctx({ apply: () => true }));
    assert.deepEqual([r.effect, r.consumed], [{ kind: 'teach', move: 'ember-bite' }, false]);
    assert.equal(bag.count(w, 'disc-ember', undefined, ctx()), 1);
    assert.equal(bag.use(w, 'tallow-wick', ctx()).reason, 'wrong-context');
    assert.deepEqual(bag.use(w, 'tallow-wick', ctx({ context: 'battle' })).effect, { kind: 'wick', grade: 'capture:1' });
  });

  it('a consumable keepsake asks first; key items do not', () => {
    const w = freshWorld();
    bag.give(w, 'isolde-lantern', 1, ctx());
    bag.give(w, 'reading-glass', 1, ctx());
    assert.deepEqual(bag.use(w, 'isolde-lantern', ctx({ context: 'battle', apply: () => true })), { ok: false, needsConfirm: true, itemId: 'isolde-lantern' });
    assert.equal(bag.use(w, 'isolde-lantern', ctx({ context: 'battle', apply: () => true, confirm: true })).consumed, true);
    assert.equal(bag.use(w, 'reading-glass', ctx({ apply: () => true })).consumed, false);
  });

  it('refuses unknown, unheld and use-less items', () => {
    const w = freshWorld();
    bag.give(w, 'pear', 1, ctx());
    assert.equal(bag.use(w, 'nope', ctx()).reason, 'unknown-item');
    assert.equal(bag.use(w, 'salve', ctx()).reason, 'not-held');
    assert.equal(bag.use(w, 'pear', ctx()).reason, 'no-use');
  });

  it('other handlers describe their effects from row fields', () => {
    const H = bag.USE_HANDLERS;
    assert.deepEqual(H.heal.effect({}), { kind: 'heal', amount: null });
    assert.deepEqual(H.revive.effect({}), { kind: 'revive', fraction: 0.5 });
    assert.deepEqual(H.pp.effect({ amount: 10 }), { kind: 'pp', amount: 10 });
    assert.deepEqual(H['ward-suppress'].effect({}), { kind: 'ward-suppress', turns: 3 });
    assert.deepEqual(H.hold.effect({ id: 'still-knot' }), { kind: 'hold', item: 'still-knot', type: null });
    assert.deepEqual(H['capture:3'].effect({}), { kind: 'wick', grade: 'capture:3' });
  });
});

describe('bag: script runner binding', () => {
  it('give / take match the runner\'s (world, item, n, {data}) signature', () => {
    const w = freshWorld();
    const ops = [{ op: 'give', item: 'salve', n: 3 }, { op: 'take', item: 'salve', n: 1 }, { op: 'end' }];
    const run = createRunner(ops, { world: w, data: REGISTRY, systems: { give: bag.give, take: bag.take } });
    let res = run.step();
    for (let i = 0; !res.done && i < 10; i++) res = run.step();
    assert.equal(res.done, true);
    assert.equal(bag.count(w, 'salve', undefined, { data: REGISTRY }), 2);
  });
});

describe('bag: tuning', () => {
  it('defaults match GDD-00 and every key is listed', () => {
    assert.deepEqual([bag.DEFAULTS.bagSlotsBase, bag.DEFAULTS.bagSlotsMax], [20, 40]);
    assert.deepEqual({ ...bag.DEFAULTS.stackByKind }, { fruit: 10, shell: 10 });
    assert.deepEqual([...bag.TUNING_KEYS].sort(), Object.keys(bag.DEFAULTS).sort());
    assert.throws(() => bag.tuningOf({ tuning: { bagSlotsBase: -1 } }), TypeError);
    assert.equal(bag.slots(freshWorld(), { tuning: { bagSlotsBase: 15 } }).total, 15);
  });
});
