// Unit tests for js/world/warps.js. Run: node --test test/world.warps.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWarp, arrivalFacing, firesOn, firesOnStep, firesOnConfirm, evalBuiltinCond, WARP_MESSAGES, WARP_REASONS } from '../js/world/warps.js';
import { loadMap } from '../js/world/tilemap.js';
import { createNewWorld } from '../js/state/schema.js';
import { tideState, tide as tideHeight } from '../js/state/selectors.js';
import { MINUTES_PER_DAY } from '../js/core/time.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';
import harborDef from './fixtures/world/harbor.fixture.js';

const map = loadMap(harborDef, TILES, { legend: DEFAULT_LEGEND });
const door = map.warpAt(3, 8);
const causewayEdge = map.warpAt(15, 4);
const cellar = map.warpAt(8, 3);
const cave = map.warpAt(0, 5);
const data = { has: (table, id) => table === 'maps' && ['harbor', 'cottage', 'flats', 'cellar', 'sea-cave'].includes(id) };

const world = (over = {}) => {
  const w = createNewWorld({ seedCode: 'WARP-TEST', lease: { mapId: 'harbor', x: 6, y: 5, facing: 'up' } });
  Object.assign(w.flags, over.flags || {});
  if (over.total !== undefined) w.clock.total = over.total;
  return w;
};

/** First total minute (searching from 0) whose tide state is `state` for this world's seed. */
const minuteWithTide = (w, state) => {
  for (let m = 0; m < 2000; m += 5) if (tideState(w, m) === state) return m;
  throw new Error('no such tide');
};

describe('resolveWarp: success', () => {
  it('resolves a door to its destination with facing and sfx', () => {
    const w = world();
    const r = resolveWarp(w, door, data, 'low');
    assert.deepEqual(r, { ok: true, mapId: 'cottage', x: 2, y: 3, facing: 'up', to: { mapId: 'cottage', x: 2, y: 3, facing: 'up' }, kind: 'door', sfx: 'doorOpen' });
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.to));
    assert.equal(w.player.mapId, 'harbor', 'never mutates the world');
  });

  it('works without a registry and with a registry that cannot answer', () => {
    assert.equal(resolveWarp(world(), door, null, 'low').ok, true);
    assert.equal(resolveWarp(world(), door, undefined, 'low').ok, true);
    assert.equal(resolveWarp(world(), door, { has() { throw new Error('unknown table'); } }, 'low').ok, true);
    assert.equal(resolveWarp(world(), door, { get() {} }, 'low').ok, true);
  });

  it('defaults the tide to the world clock when none is passed', () => {
    const w = world();
    const low = minuteWithTide(w, 'low');
    const high = minuteWithTide(w, 'high');
    w.clock.total = low;
    assert.equal(resolveWarp(w, causewayEdge, data).ok, true);
    w.clock.total = high;
    assert.equal(resolveWarp(w, causewayEdge, data).ok, false);
    assert.equal(resolveWarp(w, causewayEdge, data, tideHeight(w)).ok, false, 'a tide height works too');
    w.clock.total = low;
    assert.equal(resolveWarp(w, causewayEdge, data, tideHeight(w)).ok, true);
  });

  it('rejects a malformed warp', () => {
    assert.throws(() => resolveWarp(world(), null, data, 'low'), TypeError);
    assert.throws(() => resolveWarp(world(), { x: 0, y: 0, kind: 'door' }, data, 'low'), TypeError);
  });
});

describe('resolveWarp: refusals', () => {
  it('a causeway edge is blocked by the tide with reason tide', () => {
    for (const t of ['rising', 'high', 'falling', 0.5, 0.99]) {
      const r = resolveWarp(world(), causewayEdge, data, t);
      assert.equal(r.ok, false, `tide ${t}`);
      assert.equal(r.reason, 'tide');
      assert.equal(r.message, WARP_MESSAGES.tide);
      assert.equal(r.messageKey, 'warp.tide');
      assert.ok(Object.isFrozen(r));
    }
    assert.equal(resolveWarp(world(), causewayEdge, data, 'low').ok, true);
    assert.equal(resolveWarp(world(), causewayEdge, data, 0.1).ok, true);
  });

  it('a flag-gated door is locked, and opens once the flag is set', () => {
    const r = resolveWarp(world(), cellar, data, 'low');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'locked');
    assert.equal(r.message, "It's locked.");
    const open = resolveWarp(world({ flags: { 'sp.cellar-key': true } }), cellar, data, 'high');
    assert.equal(open.ok, true);
    assert.equal(open.mapId, 'cellar');
    assert.equal(open.facing, 'down', 'stairs default to facing down');
  });

  it('a compound cond names the part that failed: tide first, then lock, else cond', () => {
    // cave: all [lowTide, flag sp.cave-found]
    assert.equal(resolveWarp(world({ flags: { 'sp.cave-found': true } }), cave, data, 'high').reason, 'tide');
    assert.equal(resolveWarp(world(), cave, data, 'low').reason, 'locked');
    assert.equal(resolveWarp(world(), cave, data, 'high').reason, 'cond', 'both fail: neither alone explains it');
    assert.equal(resolveWarp(world({ flags: { 'sp.cave-found': true } }), cave, data, 'low').ok, true);
    const hourGate = { ...door, cond: { hour: [9, 17] } };
    const w = world({ total: 20 * 60 });
    assert.equal(resolveWarp(w, hourGate, data, 'low').reason, 'cond');
    w.clock.total = 12 * 60;
    assert.equal(resolveWarp(w, hourGate, data, 'low').ok, true);
    assert.equal(resolveWarp(world(), { ...door, cond: false }, data, 'low').reason, 'cond');
    assert.equal(resolveWarp(world(), { ...door, cond: true }, data, 'low').ok, true);
    assert.deepEqual(WARP_REASONS, ['tide', 'locked', 'cond', 'unknown-map']);
  });

  it('an unknown destination map is refused when the registry knows maps', () => {
    const r = resolveWarp(world(), { ...door, to: { mapId: 'nowhere', x: 0, y: 0 } }, data, 'low');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unknown-map');
    assert.equal(r.messageKey, 'warp.unknown-map');
  });

  it('uses an injected evaluator (script/cond) when given, and still classifies the reason', () => {
    const calls = [];
    const evalCond = (w, cond, ctx) => {
      calls.push({ cond, ctx });
      if (cond === true) return true;
      if ('thread' in cond) return Boolean(w.flags['th.test.done']);
      if ('lowTide' in cond) return ctx.tide === 'low';
      if ('all' in cond) return cond.all.every((c) => evalCond(w, c, ctx));
      return false;
    };
    const threadGate = { ...door, cond: { all: [{ lowTide: true }, { thread: { id: 'test', done: true } }] } };
    const r = resolveWarp(world(), threadGate, data, 'high', { evalCond, mapId: 'harbor' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'cond');
    assert.equal(calls[0].ctx.mapId, 'harbor');
    assert.equal(calls[0].ctx.x, 3);
    assert.equal(calls[0].ctx.data, data);
    const tideOnly = resolveWarp(world({ flags: { 'th.test.done': true } }), threadGate, data, 'high', { evalCond });
    assert.equal(tideOnly.reason, 'tide');
    assert.equal(resolveWarp(world({ flags: { 'th.test.done': true } }), threadGate, data, 'low', { evalCond }).ok, true);
  });

  it('the built-in evaluator refuses DSL keys it does not implement, loudly', () => {
    assert.throws(() => resolveWarp(world(), { ...door, cond: { thread: { id: 'x' } } }, data, 'low'), /cond key 'thread' is outside the built-in subset/);
    assert.throws(() => evalBuiltinCond(world(), 'yes', { tide: 'low' }), TypeError);
  });
});

describe('evalBuiltinCond', () => {
  const ctx = { tide: 'low', mapId: 'harbor' };
  it('covers the warp subset of the DSL', () => {
    const w = world({ flags: { 'sp.a': true, 'sp.n': 3, 'seen.intro': true } });
    w.badges.push('spire-1');
    assert.equal(evalBuiltinCond(w, undefined, ctx), true);
    assert.equal(evalBuiltinCond(w, null, ctx), true);
    assert.equal(evalBuiltinCond(w, { flag: 'sp.a' }, ctx), true);
    assert.equal(evalBuiltinCond(w, { flag: 'sp.b' }, ctx), false);
    assert.equal(evalBuiltinCond(w, { flag: 'sp.n', is: 3 }, ctx), true);
    assert.equal(evalBuiltinCond(w, { flag: 'sp.n', is: 4 }, ctx), false);
    assert.equal(evalBuiltinCond(w, { not: { flag: 'sp.b' } }, ctx), true);
    assert.equal(evalBuiltinCond(w, { all: [{ flag: 'sp.a' }, { lowTide: true }] }, ctx), true);
    assert.equal(evalBuiltinCond(w, { any: [{ flag: 'sp.b' }, { lowTide: false }] }, ctx), false);
    assert.equal(evalBuiltinCond(w, { tide: ['low', 'falling'] }, ctx), true);
    assert.equal(evalBuiltinCond(w, { tide: ['high'] }, ctx), false);
    assert.equal(evalBuiltinCond(w, { tide: ['rising'] }, { tide: 'rising' }), true);
    assert.equal(evalBuiltinCond(w, { tide: ['rising'] }, { tide: 0.5 }), true, 'a bare mid height matches rising or falling');
    assert.equal(evalBuiltinCond(w, { tide: ['rising'] }, { tide: 'falling' }), false);
    assert.equal(evalBuiltinCond(w, { tide: ['low'] }, { tide: 0.05 }), true);
    assert.equal(evalBuiltinCond(w, { tide: 'high' }, { tide: 0.95 }), true);
    assert.equal(evalBuiltinCond(w, { lowTide: true }, { tide: 0.5 }), false);
    assert.equal(evalBuiltinCond(w, { badge: 'spire-1' }, ctx), true);
    assert.equal(evalBuiltinCond(w, { badge: 1 }, ctx), true);
    assert.equal(evalBuiltinCond(w, { badge: 2 }, ctx), false);
    assert.equal(evalBuiltinCond(w, { seen: 'intro' }, ctx), true);
    assert.equal(evalBuiltinCond(w, { seen: 'outro' }, ctx), false);
    assert.equal(evalBuiltinCond(w, { map: 'harbor' }, ctx), true);
    assert.equal(evalBuiltinCond(w, { map: 'harbor' }, { tide: 'low' }), true, 'falls back to the player map');
    assert.equal(evalBuiltinCond(w, { map: 'cottage' }, ctx), false);
    w.clock.total = MINUTES_PER_DAY + 23 * 60;
    assert.equal(evalBuiltinCond(w, { hour: [22, 2] }, ctx), true, 'hour range wrapping midnight');
    assert.equal(evalBuiltinCond(w, { hour: [9, 17] }, ctx), false);
    w.clock.total = 9 * 60;
    assert.equal(evalBuiltinCond(w, { hour: [9, 17] }, ctx), true, 'start inclusive');
    w.clock.total = 17 * 60;
    assert.equal(evalBuiltinCond(w, { hour: [9, 17] }, ctx), false, 'end exclusive');
  });
});

describe('arrival facing and firing', () => {
  it('arrivalFacing: destination facing, then current facing on edges, then down', () => {
    assert.equal(arrivalFacing(door, 'left'), 'up');
    assert.equal(arrivalFacing(causewayEdge, 'right'), 'right');
    assert.equal(arrivalFacing(causewayEdge, undefined), 'down');
    assert.equal(arrivalFacing(cellar, 'left'), 'down');
    assert.equal(arrivalFacing({ ...door, to: { mapId: 'x', x: 0, y: 0 } }, 'left'), 'down');
    assert.equal(arrivalFacing({ ...door, kind: 'portal', to: { mapId: 'x', x: 0, y: 0 } }, 'left'), 'left');
    assert.equal(arrivalFacing({ ...door, to: { mapId: 'x', x: 0, y: 0, facing: 'sideways' } }, 'up'), 'down');
    const w = world();
    w.player.facing = 'right';
    assert.equal(resolveWarp(w, causewayEdge, data, 'low').facing, 'right', 'resolveWarp reads the player facing');
    assert.equal(resolveWarp(w, causewayEdge, data, 'low', { facing: 'up' }).facing, 'up', 'opts.facing wins');
  });

  it('firesOn: doors on confirm or step, edges and stairs on step, with a per-warp override', () => {
    assert.equal(firesOn(door), 'both');
    assert.equal(firesOnStep(door), true);
    assert.equal(firesOnConfirm(door), true);
    assert.equal(firesOn(causewayEdge), 'step');
    assert.equal(firesOnConfirm(causewayEdge), false);
    assert.equal(firesOn(cellar), 'step');
    assert.equal(firesOn({ ...door, fire: 'confirm' }), 'confirm');
    assert.equal(firesOnStep({ ...door, fire: 'confirm' }), false);
    assert.equal(firesOn({ ...door, kind: 'hatch' }), 'step');
  });
});
