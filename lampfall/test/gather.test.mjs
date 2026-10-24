// Unit tests for js/systems/gather.js. Run: node --test test/gather.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/systems/gather.js';
import { makeRng } from '../js/core/rng.js';
import { scheduleForSeed } from '../js/core/time.js';
import { validateWorld } from '../js/state/schema.js';
import { DATA, TOWN, ISLE, makeWorld, at, LOW, recordingBus, master } from './fixtures/gatherLane.fixture.mjs';

const T0 = { tideOffset: 0 };
const NIGHT_LOW = 2 * LOW;          // day 1 00:50
const DAY_LOW = 3 * LOW;            // day 1 13:15
const base = (extra = {}) => ({ data: DATA, lead: null, ...T0, ...extra });
const tree = (id) => TOWN.entities.find((e) => e.id === id);

describe('tuning', () => {
  it('defaults carry the GDD-00 numbers', () => {
    const d = G.DEFAULTS;
    assert.equal(d.regrowDaysDefault, 2);
    assert.equal(d.fruitRipeDays, 3);
    assert.equal(d.fruitPerTree, 3);
    assert.deepEqual(d.purseRange, [200, 600]);
    assert.equal(d.hiveHumMs, 1000);
    assert.equal(d.cracksPerDay, 4);
    assert.equal(d.glintBase, 500);
    assert.equal(d.glintPerDay, 60);
    assert.equal(d.sparklesPerLow, 3);
    assert.equal(d.skyglassPerNightLow[1], 3);
    assert.equal(d.flatsWindowMinutes, 90);
    assert.equal(d.nightStartMinute, 1080);
    assert.equal(d.nightEndMinute, 360);
    assert.equal(d.bugSpookRadius.walk, 2);
    assert.ok(d.bugSpookRadius.run > d.bugSpookRadius.walk);
    assert.deepEqual(G.TUNING_KEYS, Object.keys(d));
  });
  it('rejects malformed overrides', () => {
    assert.throws(() => G.tuningOf({ purseRange: [600, 200] }), /purseRange/);
    assert.throws(() => G.tuningOf({ flatsWindowMinutes: 1000 }), /flatsWindowMinutes/);
    assert.throws(() => G.tuningOf({ nightStartMinute: 1440 }), /nightStartMinute/);
    assert.throws(() => G.tuningOf({ bugSpookRadius: { walk: 2 } }), /bugSpookRadius/);
    assert.equal(G.tuningOf({ cracksPerDay: 6 }).cracksPerDay, 6);
  });
});

describe('clock, tide and night helpers', () => {
  it('isNightMinute is 18:00 to 06:00 (wrapping) and honours a non-wrapping override', () => {
    for (const [m, n] of [[1080, true], [1439, true], [0, true], [359, true], [360, false], [720, false], [1079, false], [-60, true], [1440 + 30, true]]) {
      assert.equal(G.isNightMinute(m), n, String(m));
    }
    const ctx = { tuning: { nightStartMinute: 60, nightEndMinute: 120 } };
    assert.equal(G.isNightMinute(90, ctx), true);
    assert.equal(G.isNightMinute(30, ctx), false);
  });
  it('nowTotal / dayOf read ctx first, then the clock', () => {
    const w = makeWorld({ total: at(3, 7) });
    assert.equal(G.nowTotal(w), at(3, 7));
    assert.equal(G.nowTotal(w, { total: 5 }), 5);
    assert.equal(G.nowTotal(w, { total: -1 }), at(3, 7));
    assert.equal(G.dayOf(w), 3);
    assert.equal(G.dayOf(w, { day: 9 }), 9);
    assert.equal(G.isNightNow(w), false);
    assert.equal(G.isNightNow(w, { total: at(3, 22) }), true);
  });
  it('lowInfo finds the nearest low, the ±90 min window and night lows', () => {
    const w = makeWorld();
    let li = G.lowInfo(w, { ...T0, total: LOW });
    assert.deepEqual([li.lowIndex, li.lowTotal, li.minutesFromLow, li.inWindow], [1, LOW, 0, true]);
    li = G.lowInfo(w, { ...T0, total: LOW - 90 });
    assert.deepEqual([li.lowIndex, li.minutesFromLow, li.inWindow], [1, -90, true]);
    li = G.lowInfo(w, { ...T0, total: LOW + 91 });
    assert.equal(li.inWindow, false);
    li = G.lowInfo(w, { ...T0, total: 372 });
    assert.equal(li.lowIndex, 0, 'just before mid-period belongs to the earlier low');
    li = G.lowInfo(w, { ...T0, total: 373 });
    assert.equal(li.lowIndex, 1);
    li = G.lowInfo(w, { ...T0, total: NIGHT_LOW + 30 });
    assert.deepEqual([li.night, li.nightLow], [true, true]);
    li = G.lowInfo(w, { ...T0, total: DAY_LOW });
    assert.deepEqual([li.night, li.nightLow, li.inWindow], [false, false, true]);
    // without an override the seed's offset is used, matching core/time
    const off = scheduleForSeed(w.clock.seed).tideOffset;
    li = G.lowInfo(w, { total: off + 2 * LOW });
    assert.deepEqual([li.lowIndex, li.minutesFromLow], [2, 0]);
    li = G.lowInfo(w, { total: 0 });
    assert.equal(li.lowTotal <= LOW, true);
  });
  it('envFor takes ctx overrides and falls back to the world weather', () => {
    const w = makeWorld({ total: at(1, 23) });
    const e = G.envFor(w, TOWN, {});
    assert.equal(e.night, true);
    assert.equal(e.mapId, 'town-map');
    assert.equal(e.region, 'town');
    assert.equal(e.weather, w.weather.current ?? w.weather.today);
    const o = G.envFor(w, null, { phase: 'midday', tideState: 'low', weather: 'fog', total: at(1, 12) });
    assert.deepEqual([o.phase, o.tideState, o.weather, o.night, o.mapId], ['midday', 'low', 'fog', false, null]);
  });
  it('rowActive checks where, night/day, tide, weather and conds', () => {
    const w = makeWorld();
    const env = { phase: 'midday', tideState: 'low', weather: 'clear', night: false, world: w, data: DATA, mapId: 'town-map', region: 'town' };
    assert.equal(G.rowActive({ where: ['river'] }, env), false);
    assert.equal(G.rowActive({ where: ['river'] }, env, ['river']), true);
    assert.equal(G.rowActive({ where: ['town'] }, env), true);
    assert.equal(G.rowActive({ where: [] }, env), true);
    assert.equal(G.rowActive({ night: true }, env), false);
    assert.equal(G.rowActive({ day: true }, env), true);
    assert.equal(G.rowActive({ day: true }, { ...env, night: true }), false);
    assert.equal(G.rowActive({ tide: 'any' }, env), true);
    assert.equal(G.rowActive({ tide: 'high' }, env), false);
    assert.equal(G.rowActive({ tide: ['low', 'rising'] }, env), true);
    assert.equal(G.rowActive({ weather: ['rain'] }, env), false);
    assert.equal(G.rowActive({ when: { phase: ['midday'] } }, env), true);
    assert.equal(G.rowActive({ when: { phase: ['dusk'] } }, env), false);
    assert.equal(G.rowActive({ cond: { flag: 'sp.x' } }, env), false);
    w.flags['sp.x'] = true;
    assert.equal(G.rowActive({ cond: { flag: 'sp.x' } }, env), true);
    assert.equal(G.rowActive(null, env), false);
  });
  it('modsFor multiplies every matching key', () => {
    const env = { night: true, tideState: 'high', weather: 'fog' };
    assert.equal(G.modsFor({ mods: { night: 2, high: 3, fog: 0.5, day: 9 } }, env), 3);
    assert.equal(G.modsFor({ mods: { day: 0 } }, env), 1);
    assert.equal(G.modsFor({ mods: { night: -1 } }, env), 1, 'negative ignored');
    assert.equal(G.modsFor({}, env), 1);
    assert.equal(G.modsFor({ mods: { night: 0 } }, env), 0);
  });
  it('spotsOf normalizes pairs, points and rects, dropping junk and duplicates', () => {
    assert.deepEqual(G.spotsOf([[1, 2], { x: 3, y: 4 }, { x: 0, y: 0, w: 2, h: 1 }, [1, 2], [1.5, 2], null, 'x']), [
      { x: 1, y: 2 }, { x: 3, y: 4 }, { x: 0, y: 0 }, { x: 1, y: 0 },
    ]);
    assert.deepEqual(G.spotsOf(undefined), []);
  });
  it('tileDist is Chebyshev; planRng is the master; ensureMap makes defaults', () => {
    assert.equal(G.tileDist({ x: 0, y: 0 }, { x: 3, y: -1 }), 3);
    const w = makeWorld();
    assert.equal(G.planRng(w).seed, makeRng(w.run.seed).seed);
    const m = G.ensureMap(w, 'town-map');
    assert.deepEqual(m, { visited: false, picked: {}, trees: {}, cracks: {}, reach: {}, reachAt: {}, opened: [] });
    assert.equal(G.ensureMap(w, 'town-map'), m);
    assert.throws(() => G.ensureMap(w, ''), /map id/);
  });
});

describe('trees', () => {
  it('an untouched tree holds 3 unripe fruit on day 0 and ripens on day 1', () => {
    const w = makeWorld({ total: at(0, 19) });
    assert.deepEqual(G.treeState(w, TOWN, 't-pear', base()), { fruitLeft: 3, ripe: false, regrowDay: 0, ripeDay: 1, purseReady: false, hiveReady: false });
    assert.equal(G.treeState(w, TOWN, 't-pear', base({ day: 1 })).ripe, true);
    assert.equal(G.treeState(w, TOWN, 't-purse', base()).purseReady, true);
    assert.equal(G.treeState(w, TOWN, 't-bees', base()).hiveReady, true);
    assert.equal(G.treeState(w, TOWN, 't-bees', base()).fruitLeft, 0);
    assert.throws(() => G.treeState(w, TOWN, 'not-a-tree', base()), /unknown tree/);
  });
  it('one fruit per press, three a tree; stripped trees regrow in 2 days and ripen a day later', () => {
    const w = makeWorld({ total: at(0, 19) });
    const given = [];
    const ctx = base({ give: (id, n) => given.push([id, n]) });
    const rng = makeRng(1);
    const s1 = G.shakeTree(w, TOWN, 't-pear', rng, ctx);
    assert.deepEqual(s1.fruit, { id: 'pear', n: 1, ripe: false, value: 120 });
    assert.deepEqual(s1.events.map((e) => e.type), ['shake', 'fruit']);
    G.shakeTree(w, TOWN, 't-pear', rng, ctx);
    assert.equal(G.treeState(w, TOWN, 't-pear', ctx).fruitLeft, 1);
    G.shakeTree(w, TOWN, 't-pear', rng, ctx);
    assert.deepEqual(given, [['pear', 1], ['pear', 1], ['pear', 1]]);
    assert.equal(w.maps['town-map'].trees['t-pear'], 2);
    assert.deepEqual(Object.keys(w.maps['town-map'].picked).filter((k) => k.startsWith('t-pear#')), [], 'slot keys cleared on strip');
    const bare = G.shakeTree(w, TOWN, 't-pear', rng, ctx);
    assert.deepEqual(bare.events.map((e) => e.type), ['shake', 'bare']);
    assert.equal(bare.fruit, null);
    assert.deepEqual(G.treeState(w, TOWN, 't-pear', base({ day: 1 })).fruitLeft, 0);
    const d2 = G.treeState(w, TOWN, 't-pear', base({ day: 2 }));
    assert.deepEqual([d2.fruitLeft, d2.ripe, d2.regrowDay, d2.ripeDay], [3, false, 2, 3]);
    assert.equal(G.treeState(w, TOWN, 't-pear', base({ day: 3 })).ripe, true);
    assert.equal(G.shakeTree(w, TOWN, 't-pear', rng, base({ day: 3 })).fruit.value, 150, 'ripe = 1.25 x');
    assert.equal(w.stats.treesShaken, 5);
  });
  it('a Gust lead drops every fruit in one shake; ripePrice wins over the multiplier', () => {
    const w = makeWorld({ total: at(1, 8) });
    const s = G.shakeTree(w, TOWN, 't-peach', makeRng(2), base({ lead: { types: ['Gust'] } }));
    assert.deepEqual(s.fruit, { id: 'peach', n: 3, ripe: true, value: 600 });
    assert.equal(w.maps['town-map'].trees['t-peach'], 3);
    // a partly shaken tree under Gust drops only what is left
    G.shakeTree(w, TOWN, 't-pear', makeRng(2), base());
    assert.equal(G.shakeTree(w, TOWN, 't-pear', makeRng(2), base({ lead: { types: ['Gust'] } })).fruit.n, 2);
  });
  it('a purse tree drops one purse a day to the wallet, in 50-button steps within 200–600', () => {
    const w = makeWorld({ total: at(1, 8) });
    const earned = [];
    const ctx = base({ earn: (a, s) => earned.push([a, s]) });
    const s = G.shakeTree(w, TOWN, 't-purse', makeRng(3), ctx);
    assert.ok(s.purse >= 200 && s.purse <= 600 && s.purse % 50 === 0, String(s.purse));
    assert.deepEqual(earned, [[s.purse, 'purse']]);
    assert.deepEqual(s.events.map((e) => e.type), ['shake', 'fruit', 'purse']);
    assert.equal(G.shakeTree(w, TOWN, 't-purse', makeRng(3), ctx).purse, 0, 'one a day');
    assert.equal(G.treeState(w, TOWN, 't-purse', ctx).purseReady, false);
    assert.ok(G.shakeTree(w, TOWN, 't-purse', makeRng(3), base({ day: 2, earn: () => {} })).purse > 0, 'back tomorrow');
    // same rng, same amount; the tree's own range wins
    const w2 = makeWorld({ total: at(1, 8) });
    assert.equal(G.shakeTree(w2, TOWN, 't-purse', makeRng(3), base()).purse, s.purse);
    assert.equal(G.shakeTree(w2, TOWN, 't-own-purse', makeRng(3), base()).purse, 1000);
    // the amounts cover the whole range
    const amounts = new Set();
    const r = makeRng(9);
    for (let i = 0; i < 300; i++) amounts.add(G.shakeTree(makeWorld(), TOWN, 't-purse', r, base()).purse);
    assert.deepEqual([...amounts].sort((a, b) => a - b), [200, 250, 300, 350, 400, 450, 500, 550, 600]);
  });
  it('a bee nest hums first (1 s) and then: netted, blown clear by a Gust lead, or stung; once a day', () => {
    const w = makeWorld({ total: at(1, 8) });
    const { bus, events } = recordingBus();
    const given = [];
    const netted = G.shakeTree(w, TOWN, 't-bees', makeRng(4), base({ net: true, bus, give: (i, n) => given.push([i, n]) }));
    assert.deepEqual(netted.events.map((e) => e.type), ['shake', 'hum', 'honey']);
    assert.equal(netted.events[1].delayMs, 1000);
    assert.deepEqual(netted.hive, { outcome: 'netted', item: 'honeycomb' });
    assert.deepEqual(given, [['honeycomb', 1]]);
    assert.deepEqual(events.map((e) => e[0]), ['stat:inc', 'gather:shake', 'gather:hum', 'gather:honey']);
    const again = G.shakeTree(w, TOWN, 't-bees', makeRng(4), base({ net: true }));
    assert.equal(again.hive, null);
    assert.deepEqual(again.events.map((e) => e.type), ['shake', 'bare']);
    const stung = G.shakeTree(w, TOWN, 't-bees', makeRng(4), base({ day: 2, give: () => assert.fail('no honey') }));
    assert.deepEqual(stung.events.map((e) => e.type), ['shake', 'hum', 'stung']);
    assert.equal(stung.hive.outcome, 'stung');
    const gust = G.shakeTree(w, TOWN, 't-bees', makeRng(4), base({ day: 3, lead: { types: ['Gust'] } }));
    assert.equal(gust.hive.outcome, 'blown-clear');
    assert.equal(G.shakeTree(w, TOWN, { id: 'loose', hive: true }, makeRng(4), base({ day: 3, net: true })).hive.item, null);
    assert.equal(G.shakeTree(w, TOWN, 't-bees', makeRng(4), base({ day: 5, tuning: { hiveHumMs: 250 }, net: true })).events[1].delayMs, 250);
  });
  it('shells come loose by chance and are logged as finds', () => {
    const w = makeWorld();
    const yes = G.shakeTree(w, TOWN, 't-shells', makeRng(5), base({ tuning: { shellChance: 1 } }));
    assert.deepEqual(yes.shells, ['shore-a']);
    assert.equal(w.collections.relics['shore-a'].n, 1);
    const no = G.shakeTree(w, TOWN, 't-shells', makeRng(5), base({ tuning: { shellChance: 0 } }));
    assert.deepEqual(no.shells, []);
    assert.deepEqual(no.events.map((e) => e.type), ['shake', 'bare']);
    assert.throws(() => G.shakeTree(w, TOWN, 'nope', makeRng(5), base()), /unknown tree/);
    assert.throws(() => G.shakeTree(w, TOWN, 7, makeRng(5), base()), /unknown tree/);
  });
});

describe('cracks', () => {
  it('four a day, stable across calls and rng positions, different tomorrow', () => {
    const w = makeWorld({ total: at(2, 9) });
    const r = master(w);
    const a = G.cracksFor(w, TOWN, r, base());
    assert.equal(a.length, 4);
    r.next(); r.next();
    assert.deepEqual(G.cracksFor(w, TOWN, r, base()), a, 'forks are position-independent');
    assert.deepEqual(G.cracksFor(w, TOWN, master(w), base()), a);
    assert.ok(a.every((c) => c.key === `c2@${c.x},${c.y}` && !c.opened && !c.extra && !c.marked));
    assert.ok(a.every((c) => ['fossil-a', 'relic-a'].includes(c.findId)), 'map pool: crack finds for this map only');
    const b = G.cracksFor(w, TOWN, r, base({ day: 3 }));
    assert.notDeepEqual(b.map((c) => c.key), a.map((c) => c.key));
    assert.equal(new Set(a.map((c) => c.key)).size, 4, 'distinct spots');
  });
  it('a Grit/Stone lead opens a fifth crack and marks them without moving the four', () => {
    const w = makeWorld({ total: at(2, 9) });
    const a = G.cracksFor(w, TOWN, master(w), base());
    const g = G.cracksFor(w, TOWN, master(w), base({ lead: { types: ['Grit'] } }));
    assert.equal(g.length, 5);
    assert.deepEqual(g.slice(0, 4).map(({ key, findId }) => [key, findId]), a.map(({ key, findId }) => [key, findId]));
    assert.equal(g[4].extra, true);
    assert.ok(g.every((c) => c.marked));
  });
  it('map overrides, empty maps and a tiny site', () => {
    const w = makeWorld();
    assert.equal(G.cracksFor(w, ISLE, master(w), base()).length, 1);
    assert.deepEqual(G.cracksFor(w, { id: 'x' }, master(w), base()), []);
    assert.equal(G.cracksFor(w, ISLE, master(w), base({ lead: { types: ['Stone'] } })).length, 2);
    assert.equal(G.cracksFor(w, ISLE, master(w), base({ data: {} }))[0].findId, null);
    assert.equal(G.cracksFor(w, TOWN, master(w), base({ tuning: { cracksPerDay: 99 } })).length, 9, 'capped by spots');
    const custom = { ...ISLE, dig: { spots: [[1, 1]], finds: ['elsewhere'] } };
    assert.equal(G.cracksFor(w, custom, master(w), base())[0].findId, 'elsewhere');
  });
  it('dig opens a crack once, logs the find, prunes yesterday\'s cracks', () => {
    const w = makeWorld({ total: at(2, 9) });
    const given = [];
    const ctx = base({ total: at(2, 9), give: (i, n) => given.push([i, n]) });
    const [c] = G.cracksFor(w, TOWN, master(w), ctx);
    const r = G.dig(w, TOWN, c.x, c.y, master(w), ctx);
    assert.deepEqual([r.ok, r.kind, r.findId], [true, 'crack', c.findId]);
    assert.deepEqual(given, [[c.findId, 1]]);
    assert.equal(w.collections.relics[c.findId].n, 1);
    assert.equal(w.maps['town-map'].cracks[c.key], true);
    assert.deepEqual(G.dig(w, TOWN, c.x, c.y, master(w), ctx), { ok: false, kind: null, findId: null, amount: 0, events: [], reason: 'nothing' });
    const [d] = G.cracksFor(w, TOWN, master(w), base({ day: 3, total: at(3, 9) }));
    G.dig(w, TOWN, d.x, d.y, master(w), base({ day: 3, total: at(3, 9) }));
    assert.deepEqual(Object.keys(w.maps['town-map'].cracks), [d.key], 'yesterday pruned');
    assert.throws(() => G.dig(w, {}, 0, 0, master(w), ctx), /map/);
  });
});

describe('the Glint, sparkles and skyglass', () => {
  it('exactly one Glint a day, on the GDD-00 stream, worth 500 + 60 × day', () => {
    const w = makeWorld({ total: DAY_LOW });
    const g = G.glintFor(w, TOWN, master(w), base());
    const spots = G.spotsOf(TOWN.flats.spots);
    assert.deepEqual({ x: g.x, y: g.y }, makeRng(w.run.seed).fork('glint:1').pick(spots));
    assert.equal(g.amount, 500 + 60 * 2);
    assert.equal(g.dug, false);
    assert.equal(G.glintFor(w, ISLE, master(w), base()), null);
    assert.equal(G.glintFor(w, { id: 'f', flats: { glint: true, spots: [] } }, master(w), base()), null);
  });
  it('the Glint digs at any low: earn + the Keeper\'s Purse, or the wallet\'s collectGlint; once a day', () => {
    const w = makeWorld({ total: DAY_LOW });
    const g = G.glintFor(w, TOWN, master(w), base());
    const earned = [];
    const out = G.dig(w, TOWN, g.x, g.y, master(w), base({ total: DAY_LOW + 120, earn: (a, s) => earned.push([a, s]) }));
    assert.equal(out.reason, 'nothing', 'outside the window');
    const r = G.dig(w, TOWN, g.x, g.y, master(w), base({ total: DAY_LOW, earn: (a, s) => earned.push([a, s]), takePurse: () => 100 }));
    assert.deepEqual([r.ok, r.kind, r.amount], [true, 'glint', 720]);
    assert.deepEqual(earned, [[720, 'glint']]);
    assert.equal(G.glintFor(w, TOWN, master(w), base()).dug, true);
    assert.equal(G.dig(w, TOWN, g.x, g.y, master(w), base({ total: DAY_LOW, earn: () => assert.fail('twice') })).kind === 'glint', false);
    // next day at a night low, through the wallet
    const w2 = makeWorld({ total: NIGHT_LOW });
    const g2 = G.glintFor(w2, TOWN, master(w2), base());
    const calls = [];
    const r2 = G.dig(w2, TOWN, g2.x, g2.y, master(w2), base({ collectGlint: (o) => { calls.push(o); return { total: 999, refund: 59, value: 940 }; }, earn: () => assert.fail('no direct earn') }));
    assert.deepEqual([r2.kind, r2.amount], ['glint', 999]);
    assert.deepEqual(calls, [{ gameDay: 2 }]);
    assert.equal(r2.events[1].refund, 59);
  });
  it('three sparkles per low, dug only in the window, each once', () => {
    const w = makeWorld({ total: DAY_LOW });
    const li = G.lowInfo(w, base());
    const sp = G.sparklesFor(w, TOWN, master(w), li.lowIndex, base());
    assert.equal(sp.length, 3);
    assert.ok(sp.every((s) => s.findId === 'shore-a' && !s.taken));
    const g = G.glintFor(w, TOWN, master(w), base());
    const s = sp.find((x) => x.x !== g.x || x.y !== g.y);
    assert.equal(G.dig(w, TOWN, s.x, s.y, master(w), base({ total: DAY_LOW + 200 })).ok, false);
    const r = G.dig(w, TOWN, s.x, s.y, master(w), base());
    assert.deepEqual([r.kind, r.findId], ['sparkle', 'shore-a']);
    assert.equal(G.sparklesFor(w, TOWN, master(w), li.lowIndex, base()).find((x) => x.key === s.key).taken, true);
    assert.equal(G.dig(w, TOWN, s.x, s.y, master(w), base()).ok, false);
    assert.equal(G.sparklesFor(w, { id: 'x', flats: { spots: [[0, 0]], sparkles: 0 } }, master(w), 1, base()).length, 0);
    assert.deepEqual(G.sparklesFor(w, ISLE, master(w), 1, base()), []);
    const next = G.sparklesFor(w, TOWN, master(w), li.lowIndex + 1, base());
    assert.notDeepEqual(next.map((x) => x.key + x.x + x.y), sp.map((x) => x.key + x.x + x.y));
  });
  it('skyglass: 1–3 relics per low, dug only at a NIGHT low', () => {
    const w = makeWorld({ total: NIGHT_LOW });
    const li = G.lowInfo(w, base());
    assert.equal(li.nightLow, true);
    const counts = new Set();
    for (let low = 0; low < 60; low++) counts.add(G.skyglassFor(w, TOWN, master(w), low, base()).length);
    assert.deepEqual([...counts].sort(), [1, 2, 3]);
    const relics = G.skyglassFor(w, TOWN, master(w), li.lowIndex, base());
    const g = G.glintFor(w, TOWN, master(w), base());
    const sp = G.sparklesFor(w, TOWN, master(w), li.lowIndex, base());
    const k = relics.find((r) => !(r.x === g.x && r.y === g.y));
    const r = G.dig(w, TOWN, k.x, k.y, master(w), base());
    assert.deepEqual([r.kind, r.findId], ['skyglass', 'sky-a']);
    assert.equal(w.collections.relics['sky-a'].n, 1);
    // a day low never gives up skyglass (the tile may still hold a sparkle)
    const wd = makeWorld({ total: DAY_LOW });
    const lid = G.lowInfo(wd, base());
    for (const s of G.skyglassFor(wd, TOWN, master(wd), lid.lowIndex, base())) {
      const res = G.dig(wd, TOWN, s.x, s.y, master(wd), base());
      assert.notEqual(res.kind, 'skyglass');
    }
    assert.deepEqual(G.skyglassFor(w, { id: 'x', flats: { spots: [[0, 0]] } }, master(w), 1, base()), []);
    assert.ok(sp.length === 3);
  });
  it('old low keys are pruned so picked stays bounded', () => {
    const w = makeWorld({ total: NIGHT_LOW });
    const m = G.ensureMap(w, 'town-map');
    m.picked['s0#1'] = 0;
    m.picked['k-5#0'] = 0;
    m.picked['t-pear#f0'] = 1;
    const li = G.lowInfo(w, base());
    const s = G.sparklesFor(w, TOWN, master(w), li.lowIndex, base()).find((x) => {
      const g = G.glintFor(w, TOWN, master(w), base());
      return !(x.x === g.x && x.y === g.y) && !G.skyglassFor(w, TOWN, master(w), li.lowIndex, base()).some((k) => k.x === x.x && k.y === x.y);
    });
    if (s) {
      G.dig(w, TOWN, s.x, s.y, master(w), base());
      assert.equal('s0#1' in m.picked, false);
      assert.equal('k-5#0' in m.picked, false);
      assert.equal(m.picked['t-pear#f0'], 1, 'tree keys untouched');
    }
  });
});

describe('cockles', () => {
  it('rakes each flats spot once a low, up to the per-low cap, in range', () => {
    const w = makeWorld({ total: DAY_LOW });
    const given = [];
    const ctx = base({ give: (i, n) => given.push([i, n]) });
    const rng = makeRng(6);
    assert.equal(G.rakeCockles(w, ISLE, 0, 20, rng, ctx).reason, 'no-cockles');
    assert.equal(G.rakeCockles(w, TOWN, 30, 30, rng, ctx).reason, 'not-flats');
    assert.equal(G.rakeCockles(w, TOWN, 0, 20, rng, base({ total: DAY_LOW + 200 })).reason, 'tide');
    const a = G.rakeCockles(w, TOWN, 0, 20, rng, ctx);
    assert.ok(a.ok && a.item === 'cockle' && a.n >= 1 && a.n <= 3);
    assert.equal(G.rakeCockles(w, TOWN, 0, 20, rng, ctx).reason, 'raked');
    for (let x = 1; x <= 3; x++) assert.equal(G.rakeCockles(w, TOWN, x, 20, rng, ctx).ok, true);
    assert.equal(G.rakeCockles(w, TOWN, 4, 20, rng, ctx).reason, 'spent');
    assert.equal(given.length, 4);
    assert.equal(w.collections.relics.cockle.n, 4, 'logged but excluded from completion');
    assert.equal(G.rakeCockles(w, TOWN, 4, 20, rng, base({ total: DAY_LOW + LOW })).ok, true, 'next low');
  });
});

describe('senses', () => {
  it('the exposed Glint shows from 1 tile, or 3 with a Grit/Stone lead; cracks are marked', () => {
    const w = makeWorld({ total: DAY_LOW });
    const g = G.glintFor(w, TOWN, master(w), base());
    const far = { x: g.x + 3, y: g.y };
    assert.equal(G.senses(w, TOWN, far, master(w), base()).glint, null);
    assert.deepEqual(G.senses(w, TOWN, { x: g.x + 1, y: g.y }, master(w), base()).glint, { x: g.x, y: g.y, dist: 1 });
    const grit = G.senses(w, TOWN, far, master(w), base({ lead: { types: ['Grit'] } }));
    assert.deepEqual(grit.glint, { x: g.x, y: g.y, dist: 3 });
    assert.equal(grit.cracks.length, 5);
    assert.equal(G.senses(w, TOWN, { x: g.x, y: g.y }, master(w), base({ total: DAY_LOW + 300 })).glint, null, 'covered by the tide');
    assert.deepEqual(G.senses(w, TOWN, far, master(w), base()).cracks, []);
  });
  it('skyglass: base radius at a night low, 5 tiles with Glass/Hollow, dimly by day', () => {
    const w = makeWorld({ total: NIGHT_LOW });
    const li = G.lowInfo(w, base());
    const [k] = G.skyglassFor(w, TOWN, master(w), li.lowIndex, base());
    const near = { x: k.x + 2, y: k.y }, mid = { x: k.x + 5, y: k.y };
    assert.ok(G.senses(w, TOWN, near, master(w), base()).skyglass.some((s) => s.x === k.x && s.y === k.y && !s.dim));
    assert.ok(!G.senses(w, TOWN, mid, master(w), base()).skyglass.some((s) => s.x === k.x && s.y === k.y));
    assert.ok(G.senses(w, TOWN, mid, master(w), base({ lead: { types: ['Glass'] } })).skyglass.some((s) => s.x === k.x && s.y === k.y));
    const wd = makeWorld({ total: DAY_LOW });
    const lid = G.lowInfo(wd, base());
    const [kd] = G.skyglassFor(wd, TOWN, master(wd), lid.lowIndex, base());
    const p = { x: kd.x, y: kd.y };
    assert.deepEqual(G.senses(wd, TOWN, p, master(wd), base()).skyglass, []);
    const dim = G.senses(wd, TOWN, p, master(wd), base({ lead: { types: ['Hollow'] } })).skyglass;
    assert.ok(dim.length > 0 && dim.every((s) => s.dim));
    assert.deepEqual(G.senses(wd, ISLE, p, master(wd), base({ lead: { types: ['Hollow'] } })).skyglass, []);
  });
  it('a Bolt lead hums within 4 tiles of a ready purse, the undug Glint or a night headliner', () => {
    const w = makeWorld({ total: at(1, 8) });
    const purse = tree('t-purse');
    const bolt = base({ lead: { types: ['Bolt'] }, total: at(1, 8) });
    let s = G.senses(w, TOWN, { x: purse.x + 4, y: purse.y }, master(w), bolt);
    assert.equal(s.hum, true);
    assert.ok(s.humTargets.some((t) => t.kind === 'purse'));
    assert.equal(G.senses(w, TOWN, { x: purse.x + 4, y: purse.y }, master(w), base()).hum, false, 'no Bolt, no hum');
    G.shakeTree(w, TOWN, 't-purse', makeRng(1), bolt);
    s = G.senses(w, TOWN, { x: purse.x + 4, y: purse.y + 10 }, master(w), bolt);
    assert.equal(s.humTargets.some((t) => t.kind === 'purse'), false);
    const g = G.glintFor(w, TOWN, master(w), bolt);
    assert.ok(G.senses(w, TOWN, { x: g.x, y: g.y - 4 }, master(w), bolt).humTargets.some((t) => t.kind === 'glint'));
    const h = G.senses(w, TOWN, { x: 30, y: 30 }, master(w), { ...bolt, headliners: [{ x: 33, y: 34 }, { x: 40, y: 40 }, null] });
    assert.deepEqual(h.humTargets.filter((t) => t.kind === 'headliner'), [{ kind: 'headliner', x: 33, y: 34 }]);
  });
});

describe('bugs', () => {
  const spots = [{ x: 1, y: 1 }, { x: 2, y: 1, lit: true }, { x: 3, y: 1 }, { x: 4, y: 1, lit: true }, { x: 1.5, y: 1 }, null];
  it('rollBugs is deterministic, skips junk spots and respects day / night rows', () => {
    const w = makeWorld({ total: at(1, 12) });
    const a = G.rollBugs(w, TOWN, spots, makeRng(7), base({ tuning: { bugSpawnChance: 1 } }));
    assert.deepEqual(a, G.rollBugs(w, TOWN, spots, makeRng(7), base({ tuning: { bugSpawnChance: 1 } })));
    assert.equal(a.length, 4);
    assert.ok(a.every((b) => b.id !== 'bug-moth'), 'the moth is night-only');
    assert.deepEqual(G.rollBugs(w, TOWN, spots, makeRng(7), base({ tuning: { bugSpawnChance: 0 } })), []);
    assert.deepEqual(G.rollBugs(w, TOWN, spots, makeRng(7), base({ data: {} })), []);
    assert.deepEqual(G.rollBugs(w, TOWN, 'junk', makeRng(7), base()), []);
  });
  it('lit spots and rain bring more bugs; a Bolt lead draws moths to lights', () => {
    const w = makeWorld({ total: at(1, 22) });
    const many = Array.from({ length: 400 }, (_, i) => ({ x: i, y: 0, lit: i % 2 === 0 }));
    const r = G.rollBugs(w, TOWN, many, makeRng(8), base({ weather: 'clear' }));
    const lit = r.filter((b) => b.lit).length, dark = r.length - lit;
    assert.ok(lit > dark * 1.4, `${lit} lit vs ${dark} dark`);
    const rain = G.rollBugs(w, TOWN, many, makeRng(8), base({ weather: 'rain' }));
    assert.ok(rain.length > r.length, `${rain.length} in rain vs ${r.length}`);
    const allLit = many.map((s) => ({ ...s, lit: true }));
    const plainMoths = G.rollBugs(w, TOWN, allLit, makeRng(9), base({ tuning: { bugSpawnChance: 0.5 } })).filter((b) => b.id === 'bug-moth').length;
    const boltMoths = G.rollBugs(w, TOWN, allLit, makeRng(9), base({ tuning: { bugSpawnChance: 0.5 }, lead: { types: ['Bolt'] } })).filter((b) => b.id === 'bug-moth').length;
    assert.ok(boltMoths > plainMoths, `${boltMoths} vs ${plainMoths}`);
  });
  it('movement signatures: walking spooks at 2 tiles, running from farther, creeping and standing never', () => {
    const ctx = base();
    const row = DATA.collections.find((r) => r.id === 'bug-a');
    assert.equal(G.spookRadius(row, 'walk', ctx), 2);
    assert.equal(G.spookRadius(row, 'run', ctx), 4);
    assert.equal(G.spookRadius(row, 'creep', ctx), 0);
    assert.equal(G.spookRadius(row, 'still', ctx), 0);
    assert.equal(G.spookRadius(row, 'hop', ctx), 2, 'unknown gait = walking');
    assert.equal(G.spookRadius(DATA.collections.find((r) => r.id === 'bug-wary'), 'walk', ctx), 4, 'row multiplier');
    const bug = { id: 'bug-a', x: 5, y: 5, lit: false };
    assert.equal(G.isSpooked(bug, { x: 7, y: 5, gait: 'walk' }, ctx), true);
    assert.equal(G.isSpooked(bug, { x: 8, y: 5, gait: 'walk' }, ctx), false);
    assert.equal(G.isSpooked(bug, { x: 9, y: 5, gait: 'run' }, ctx), true);
    assert.equal(G.isSpooked(bug, { x: 6, y: 5, gait: 'creep' }, ctx), false);
  });
  it('netBug: reach, spooking, wary escapes, success', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    const given = [];
    const ctx = base({ bus, give: (i, n) => given.push([i, n]) });
    const bug = { id: 'bug-a', x: 5, y: 5, lit: false };
    assert.equal(G.netBug(w, bug, { x: 7, y: 5, gait: 'creep' }, makeRng(1), ctx).reason, 'out-of-reach');
    assert.equal(G.netBug(w, bug, { x: 6, y: 5, gait: 'walk' }, makeRng(1), ctx).reason, 'spooked');
    assert.equal(G.netBug(w, { id: 'bug-wary', x: 5, y: 5 }, { x: 6, y: 5, gait: 'creep' }, makeRng(1), ctx).reason, 'escaped');
    assert.deepEqual(G.netBug(w, bug, { x: 6, y: 6, gait: 'creep' }, makeRng(1), ctx), { ok: true, id: 'bug-a', first: true });
    assert.deepEqual(G.netBug(w, bug, { x: 5, y: 5, gait: 'still' }, makeRng(1), ctx), { ok: true, id: 'bug-a', first: false });
    assert.equal(w.collections.bugs['bug-a'].n, 2);
    assert.deepEqual(given, [['bug-a', 1], ['bug-a', 1]]);
    assert.ok(events.some((e) => e[0] === 'gather:bug-escaped' && e[1].reason === 'spooked'));
    assert.ok(events.some((e) => e[0] === 'gather:bug'));
    assert.throws(() => G.netBug(w, {}, { x: 0, y: 0, gait: 'still' }, makeRng(1), ctx), /bug/);
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('determinism and validity', () => {
  it('two runs of the same actions give deep-equal worlds; the world stays valid', () => {
    const run = () => {
      const w = makeWorld({ seed: 'DET-1', total: DAY_LOW });
      const loot = makeRng('loot');
      const ctx = base({ net: true });
      for (const e of TOWN.entities.filter((x) => x.kind === 'tree')) G.shakeTree(w, TOWN, e.id, loot, ctx);
      const g = G.glintFor(w, TOWN, master(w), ctx);
      G.dig(w, TOWN, g.x, g.y, master(w), ctx);
      for (const c of G.cracksFor(w, TOWN, master(w), ctx)) G.dig(w, TOWN, c.x, c.y, master(w), ctx);
      G.rakeCockles(w, TOWN, 5, 21, loot, ctx);
      return w;
    };
    const a = run(), b = run();
    assert.deepEqual(a, b);
    assert.deepEqual(validateWorld(a), []);
    assert.equal(Object.values(a.collections.relics).reduce((s, r) => s + r.n, 0) >= 4, true);
  });
});


describe('authored Pellwick orchard', () => {
  it('resolves native-fruit map trees consistently, yields three fruit, then regrows', async () => {
    const { DATA_CONTENT } = await import('../js/data/content.js');
    const map = DATA_CONTENT.maps.find(row => row.id === 'pellwick');
    const world = makeWorld();
    const ctx = { data: DATA_CONTENT, day: 1, lead: null };
    const rng = makeRng(42);
    const tree = map.entities.find(row => row.id === 'tree-turnstone');
    assert.equal(G.treeState(world, map, tree, ctx).fruitLeft, 3);
    const drops = [0, 1, 2].map(() => G.shakeTree(world, map, tree, rng, ctx).fruit);
    assert.ok(drops.every(drop => drop?.n === 1));
    assert.ok(drops.every(drop => drop.id === drops[0].id));
    assert.ok(DATA_CONTENT.collections.some(row => row.id === drops[0].id && row.origin === 'native'));
    assert.equal(G.shakeTree(world, map, tree, rng, ctx).fruit, null);
    assert.equal(G.treeState(world, map, tree, { ...ctx, day: 3 }).fruitLeft, 3);
    const other = map.entities.find(row => row.id === 'tree-curlew');
    assert.equal(G.shakeTree(world, map, other, rng, ctx).fruit.id, drops[0].id);
  });
});
