// Unit tests for js/systems/econ.js and the RULES-ECON schema step (migrate 2 -> 3).
// Run: node --test test/systems.econ.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as econ from '../js/systems/econ.js';
import { MIGRATIONS, POCKET_RENAMES_V3, migrateWorld } from '../js/state/migrate.js';
import { validateWorld, worldDefaults, POCKET_IDS } from '../js/state/schema.js';
import { OWNERS } from '../tools/lint-owners.mjs';
import { TABLES, REGISTRY, at } from './fixtures/econ.fixture.mjs';

const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));

describe('econ: days', () => {
  it('the economy day turns over at 06:00 and the arrival evening is GDD day 1', () => {
    assert.equal(econ.econDay(at(0, 18, 40)), 0);
    assert.equal(econ.econDay(at(1, 5, 59)), 0);
    assert.equal(econ.econDay(at(1, 6)), 1);
    assert.equal(econ.econDay(at(0, 2)), 0, 'never negative');
    assert.equal(econ.econDay(at(3, 0), 0), 3, 'a midnight boundary');
    assert.equal(econ.gameDay(econ.econDay(at(0, 18, 40))), 1);
    assert.equal(econ.clockDay(at(4, 23, 59)), 4);
    assert.equal(econ.minuteOfDay(at(2, 13, 7)), 787);
    assert.equal(econ.minuteOfDay(-1), 1439);
  });

  it('nowOf and dayOf read ctx first, then the world clock', () => {
    const w = { clock: { total: at(2, 9) } };
    assert.equal(econ.nowOf(w), at(2, 9));
    assert.equal(econ.nowOf(w, { now: 5 }), 5);
    assert.equal(econ.nowOf({}), 0);
    assert.equal(econ.nowOf({ clock: { total: NaN } }), 0);
    assert.equal(econ.dayOf(w, undefined, econ.ECON_DEFAULTS), 2);
    assert.equal(econ.dayOf(w, { day: 9 }, econ.ECON_DEFAULTS), 9);
    assert.equal(econ.dayOf(w, { day: 1.5 }, econ.ECON_DEFAULTS), 2, 'a non-integer override is ignored');
  });
});

describe('econ: makeTuning', () => {
  const spec = { a: [econ.is.posInt, 'integer >= 1'], list: [econ.is.ids, 'id[]'] };
  const tuningOf = econ.makeTuning('test', Object.freeze({ a: 2, list: ['x'] }), spec);

  it('resolves ctx.tuning > data.tuning > registry tuning table > defaults, frozen and cached', () => {
    const base = tuningOf();
    assert.deepEqual({ ...base }, { econDayStartMinute: 360, a: 2, list: ['x'] });
    assert.ok(Object.isFrozen(base) && Object.isFrozen(base.list));
    const t = { a: 5 };
    assert.equal(tuningOf({ tuning: t }).a, 5);
    assert.equal(tuningOf({ tuning: t }), tuningOf({ tuning: t }), 'cached per source object');
    assert.equal(tuningOf({ data: { tuning: { a: 7 } } }).a, 7);
    assert.equal(tuningOf({ tuning: { a: 3 }, data: { tuning: { a: 7 } } }).a, 3);
    const reg = { tables: ['tuning'], has: () => false, get: () => null, raw: (n) => (n === 'tuning' ? { a: 9 } : null) };
    assert.equal(tuningOf({ data: reg }).a, 9);
    assert.equal(tuningOf({ data: REGISTRY }).a, 2, 'a registry without a tuning table');
    assert.equal(tuningOf({ data: { tuning: { econDayStartMinute: 0 } } }).econDayStartMinute, 0);
  });

  it('rejects malformed values and broken module definitions', () => {
    assert.throws(() => tuningOf({ tuning: { a: 0 } }), /test tuning a: expected integer >= 1/);
    assert.throws(() => tuningOf({ tuning: { econDayStartMinute: 1440 } }), TypeError);
    assert.throws(() => econ.makeTuning('bad', { b: 1 }, {}), /no spec/);
    assert.throws(() => econ.makeTuning('bad', { a: 0 }, spec), /fails its own spec/);
  });

  it('tuningSource finds the table or nothing', () => {
    assert.equal(econ.tuningSource(null), null);
    assert.equal(econ.tuningSource({ tuning: [] }), null);
    assert.equal(econ.tuningSource({ tables: ['tuning'], raw: () => { throw new Error('x'); } }), null);
  });
});

describe('econ: lookup', () => {
  it('reads plain tables (arrays and keyed objects) and registries alike', () => {
    const plain = econ.lookup(TABLES);
    const reg = econ.lookup(REGISTRY);
    for (const lk of [plain, reg]) {
      assert.equal(lk.row('items', 'salve').price, 80);
      assert.equal(lk.row('items', 'nope'), null);
      assert.equal(lk.row('items', 7), null);
      assert.equal(lk.list('shops').length, 4);
      assert.equal(lk.hasTable('items'), true);
      assert.equal(lk.hasTable('commons'), false);
      assert.deepEqual(lk.list('commons'), []);
    }
    const keyed = econ.lookup({ scripts: { a: [1], b: [2] } });
    assert.deepEqual(keyed.row('scripts', 'b'), [2]);
    assert.equal(econ.lookup(TABLES), plain, 'cached');
  });

  it('an absent source is an empty lookup', () => {
    for (const d of [null, undefined, 5, 'x']) {
      const lk = econ.lookup(d);
      assert.equal(lk.row('items', 'a'), null);
      assert.deepEqual(lk.list('items'), []);
      assert.equal(lk.hasTable('items'), false);
    }
  });
});

describe('econ: guards', () => {
  it('assertCount / assertAmount / assertId', () => {
    assert.equal(econ.assertCount(3, 'x'), 3);
    assert.throws(() => econ.assertCount(0, 'x'), RangeError);
    assert.equal(econ.assertAmount(0, 'x'), 0);
    assert.throws(() => econ.assertAmount(-1, 'x'), RangeError);
    assert.equal(econ.assertId('a', 'x'), 'a');
    assert.throws(() => econ.assertId('', 'x'), TypeError);
    assert.equal(econ.is.flagId('sp.relit'), true);
    assert.equal(econ.is.flagId('relit'), false);
    assert.equal(econ.is.flagId('sp.'), false);
  });

  it('emit is a no-op without a bus', () => {
    assert.doesNotThrow(() => econ.emit(undefined, 'x', {}));
    const seen = [];
    econ.emit({ bus: { emit: (e, p) => seen.push([e, p]) } }, 'x', { a: 1 });
    assert.deepEqual(seen, [['x', { a: 1 }]]);
  });
});

describe('schema v3 (RULES-ECON): pockets, wallet bookkeeping, loans log, shops', () => {
  it('defaults carry every econ key and lint-owners knows world.shops', () => {
    const d = worldDefaults();
    assert.deepEqual(Object.keys(d.bag).sort(), ['basketSeq', 'baskets', 'capacity', 'extraSlots', 'pockets']);
    assert.deepEqual(Object.keys(d.bag.pockets), [...POCKET_IDS]);
    assert.deepEqual(d.wallet, { main: 0, starsalt: 0, anchors: 0, purse: 0, purseGlints: 0, starsaltDay: -1, starsaltBought: 0, anchorGrants: [] });
    for (const k of ['errands', 'spireShares', 'tally', 'log']) assert.deepEqual(d.loans[k], []);
    assert.deepEqual(d.shops, { day: -1, sold: {}, wantedSold: {}, crate: [] });
    assert.deepEqual(OWNERS.shops, ['systems/shops.js']);
  });

  it('step 2 -> 3 folds the old pockets into the GDD pockets, merging same-id stacks', () => {
    const v2 = fixture('v2.json');
    v2.bag.pockets.items.push({ id: 'salve', n: 2 });
    v2.bag.pockets.catch.push({ id: 'tallow-wick', n: 5 });
    v2.bag.pockets.key.push({ id: 'reading-glass', n: 1 });
    v2.bag.pockets.keepsakes.push({ id: 'heirloom-bell', n: 1 });
    v2.bag.pockets.odd = [{ id: 'mystery', n: 1 }, { id: 'mystery', n: 2 }, { id: 'bad', n: 0 }];
    v2.bag.capacity.odd = 4;
    const out = MIGRATIONS[2](JSON.parse(JSON.stringify(v2)), 2);
    assert.equal(out.v, 3);
    assert.deepEqual(out.bag.pockets.medicine, [{ id: 'salve', n: 2 }]);
    assert.deepEqual(out.bag.pockets.wicks, [{ id: 'tallow-wick', n: 5 }]);
    assert.deepEqual(out.bag.pockets.keepsakes, [{ id: 'heirloom-bell', n: 1 }, { id: 'reading-glass', n: 1 }], 'old pocket order is kept');
    assert.deepEqual(out.bag.pockets.odd, [{ id: 'mystery', n: 3 }], 'unknown pockets keep their name; bad stacks drop');
    assert.equal(out.bag.capacity.odd, 4);
    assert.equal(out.bag.capacity.medicine, 0);
    assert.equal('items' in out.bag.pockets, false);
    assert.deepEqual(Object.keys(POCKET_RENAMES_V3).sort(), ['catch', 'items', 'keepsakes', 'key', 'tools']);
  });

  it('a v2 save migrates to a valid current world with the econ defaults', () => {
    const v2 = fixture('v2.json');
    v2.wallet.main = 777;
    v2.bag.pockets.items.push({ id: 'salve', n: 2 });
    const res = migrateWorld(v2);
    assert.equal(res.ok, true);
    assert.deepEqual(validateWorld(res.world), []);
    assert.equal(res.world.wallet.main, 777);
    assert.equal(res.world.wallet.starsaltDay, -1);
    assert.deepEqual(res.world.bag.pockets.medicine, [{ id: 'salve', n: 2 }]);
    assert.deepEqual(res.world.bag.pockets.wicks, []);
    assert.deepEqual(res.world.shops, { day: -1, sold: {}, wantedSold: {}, crate: [] });
    assert.equal(res.world.bag.extraSlots, 0);
  });

  it('step 2 -> 3 tolerates a missing or damaged bag', () => {
    assert.equal(MIGRATIONS[2]({ v: 2 }, 2).v, 3);
    assert.equal(MIGRATIONS[2]({ v: 2, bag: { pockets: null } }, 2).bag.pockets, null);
    assert.deepEqual(MIGRATIONS[2]({ v: 2, bag: { pockets: { items: 'x' } } }, 2).bag.pockets, { medicine: [] });
  });

  it('validateWorld checks the new shapes', () => {
    const w = worldDefaults();
    w.bag.baskets.push({ id: 'b1', mapId: 'm', x: 1, y: 1, day: 0, items: [{ id: 'salve', n: 0 }] });
    w.shops.crate.push({ id: 'pear', n: -1 });
    w.loans.log.push({ day: 0, amount: -5, source: 'pay' });
    w.wallet.starsaltDay = -2;
    const problems = validateWorld(w);
    for (const p of ['world.bag.baskets', 'world.shops.crate', 'world.loans.log', 'world.wallet.starsaltDay']) {
      assert.ok(problems.some((x) => x.startsWith(p)), `${p} flagged`);
    }
    const ok = worldDefaults();
    ok.bag.baskets.push({ id: 'b1', mapId: 'm', x: 1, y: 1, day: 0, items: [{ id: 'ghost', n: 1 }] });
    ok.shops.crate.push({ id: 'ghost', n: 1 });
    const refs = validateWorld(ok, { has: (t, id) => !(t === 'items' || t === 'collections') || id !== 'ghost' });
    assert.ok(refs.includes('world.bag.baskets[0].items[0].id: unknown items id "ghost"'));
    assert.ok(refs.includes('world.shops.crate[0].id: unknown items id "ghost"'));
  });
});
