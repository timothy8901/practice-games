// Unit tests for js/systems/townCommon.js (SYS-TOWN). Run: node --test test/systems.townCommon.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/systems/townCommon.js';
import { forkFor } from '../js/state/rngs.js';
import { createRegistry } from '../js/data/registry.js';
import { makeWorld, makeData, recBus, MIN } from './fixtures/town.fixture.mjs';

describe('tuning', () => {
  const D = Object.freeze({ a: 1, b: 'x' });
  const SPEC = { a: [(v) => Number.isInteger(v), 'integer'], b: [(v) => typeof v === 'string', 'string'] };
  it('merges known keys, validates, caches, ignores unknown keys', () => {
    const cache = new WeakMap();
    assert.equal(C.resolveTuning(D, SPEC, null, cache, 'm'), D);
    const src = { a: 5, zzz: 1 };
    const t = C.resolveTuning(D, SPEC, src, cache, 'm');
    assert.deepEqual(t, { a: 5, b: 'x' });
    assert.ok(Object.isFrozen(t));
    assert.equal(C.resolveTuning(D, SPEC, src, cache, 'm'), t, 'cached');
    assert.throws(() => C.resolveTuning(D, SPEC, { a: 'no' }, cache, 'm'), /m tuning a: expected integer, got "no"/);
    assert.throws(() => C.resolveTuning(D, SPEC, 4, cache, 'm'), /m: tuning must be an object/);
  });
  it('tuningSource: opts.tuning, then data.tuning, else null', () => {
    assert.equal(C.tuningSource({ tuning: { a: 1 } }, { tuning: { a: 2 } }).a, 2);
    assert.equal(C.tuningSource({ tuning: { a: 1 } }).a, 1);
    assert.equal(C.tuningSource({ tuning: 5 }), null);
    assert.equal(C.tuningSource(null, null), null);
  });
});

describe('content adapter and conditions', () => {
  const data = makeData();
  it('rows / row / condData over plain tables and registries', () => {
    assert.equal(C.rows(data, 'npcs').length, data.npcs.length);
    assert.deepEqual(C.rows(data, 'missing'), []);
    assert.deepEqual(C.rows({ t: { a: { x: 1 }, b: 2 } }, 't'), [{ id: 'a', x: 1 }, 2], 'object tables gain ids');
    assert.equal(C.row(data, 'shops', 'ludo').hours[0], 22 * MIN);
    assert.equal(C.row({ t: { a: { x: 1 } } }, 't', 'a').x, 1);
    assert.equal(C.row(data, 'shops', 7), null);
    const reg = createRegistry({ shops: data.shops });
    assert.equal(C.row(reg, 'shops', 'ludo').id, 'ludo');
    assert.equal(C.row(reg, 'nope', 'ludo'), null, 'unknown table never throws');
    assert.equal(C.condData(reg), reg);
    assert.equal(C.condData(data).get('shops', 'pells').id, 'pells');
    assert.equal(C.condData(null), null);
  });
  it('holds: absent conds hold, DSL conds evaluate', () => {
    const w = makeWorld();
    assert.equal(C.holds(w, undefined, data), true);
    assert.equal(C.holds(w, null, data), true);
    assert.equal(C.holds(w, { flag: 'sp.x' }, data), false);
    w.flags['sp.x'] = true;
    assert.equal(C.holds(w, { flag: 'sp.x' }, data), true);
    assert.throws(() => C.holds(w, { bogus: 1 }, data), /malformed/);
  });
  it('emit tolerates a missing bus', () => {
    const bus = recBus();
    C.emit(bus, 'a', { x: 1 });
    C.emit(null, 'a', {});
    C.emit({}, 'a', {});
    assert.deepEqual(bus.events, [['a', { x: 1 }]]);
  });
});

describe('time helpers', () => {
  it('coreDay / minuteNow / game days / minutesSince', () => {
    const w = makeWorld({ day: 5, minute: 7 * MIN + 30.7 });
    assert.equal(C.coreDay(w), 5);
    assert.equal(C.coreDay(w, { day: 9 }), 9);
    assert.equal(C.coreDay(w, { day: 1.5 }), 5, 'non-integer override ignored');
    assert.equal(C.minuteNow(w), 7 * MIN + 30);
    assert.equal(C.minuteNow(w, { minute: -30 }), 1410);
    assert.equal(C.coreDayOfGame(7, C.CALENDAR_DEFAULTS), 6);
    assert.equal(C.minutesSince(1430, 10), 20);
    assert.equal(C.mod(-1, 7), 6);
  });
});

describe('porches', () => {
  it('collects porch rows from a porches table and npc.porch, first one wins', () => {
    const data = makeData({ porches: [{ id: 'wren', mapId: 'elsewhere', x: 1, y: 1 }, { id: 'porch-keepers-cottage', mapId: 'point', x: 3, y: 3 }, { nope: 1 }] });
    const porches = C.porchesOf(data);
    assert.deepEqual(porches.find((p) => p.id === 'wren'), { id: 'wren', npcId: null, mapId: 'elsewhere', x: 1, y: 1, facing: 'down', litAtStart: false });
    assert.equal(porches.find((p) => p.id === 'juniper').npcId, 'juniper', 'id defaults to the npc id');
    assert.equal(porches.find((p) => p.id === 'porch-keepers-cottage').litAtStart, false);
    assert.equal(C.porchFlag('odile'), 'sys.porch.odile');
    const w = makeWorld();
    assert.equal(C.isPorchLit(w, data, 'porch-keepers-cottage', { tuning: { homePorchLitTier: 1 } }), true);
  });
});

describe('rng, creatures, weather, clone', () => {
  it('rngFor accepts every source and is deterministic without one', () => {
    const w = makeWorld();
    const n = (r) => r.nextUint32();
    assert.equal(n(C.rngFor(null, w, 'glint:3')), n(forkFor(w.run.seed, 'glint:3')));
    assert.equal(n(C.rngFor({ fresh: (l) => forkFor(9, l) }, w, 'x')), n(forkFor(9, 'x')));
    assert.equal(n(C.rngFor((l) => forkFor(8, l), w, 'x')), n(forkFor(8, 'x')));
    assert.equal(n(C.rngFor({ fork: (l) => forkFor(7, l) }, w, 'x')), n(forkFor(7, 'x')));
    assert.equal(n(C.rngFor(null, { run: { seed: -3 } }, 'x')), n(forkFor(0, 'x')), 'bad seed -> 0');
  });
  it('leadCreature, weatherNow, clone', () => {
    const w = makeWorld();
    assert.equal(C.leadCreature(w), null);
    w.party.push({ uid: 'a', hp: 0 }, { uid: 'b', hp: 3 });
    assert.equal(C.leadCreature(w).uid, 'b', 'first conscious');
    w.party[1].hp = 0;
    assert.equal(C.leadCreature(w).uid, 'a', 'else first');
    assert.equal(C.weatherNow(w), 'clear');
    w.weather.current = 'fog';
    assert.equal(C.weatherNow(w), 'fog');
    assert.equal(C.weatherNow({ weather: { today: 'rain' } }), 'rain');
    assert.equal(C.weatherNow({}), null);
    const o = { a: [1, { b: 2 }] };
    const c = C.clone(o);
    assert.deepEqual(c, o);
    assert.notEqual(c.a, o.a);
    assert.equal(C.clone(undefined), undefined);
  });
});
