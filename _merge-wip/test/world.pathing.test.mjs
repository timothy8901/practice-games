// Unit tests for js/world/pathing.js. Run: node --test test/world.pathing.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findPath, findPathCached, createPathCache, pathKey, pathLength, DEFAULT_MAX_PATH, PATH_CACHE_MAX } from '../js/world/pathing.js';
import { buildRuntimeMap, MAP_DEF, TILES, LEGEND } from './fixtures/worldEnt.mjs';

const map = buildRuntimeMap();
const P = (x, y) => ({ x, y });
/** Walks a path from `from` checking every step is orthogonal, passable and ends at `to`. */
function assertValidPath(path, from, to, tideState, mover = 'npc') {
  assert.ok(Array.isArray(path), 'path is an array');
  let x = from.x, y = from.y;
  for (let i = 0; i < path.length; i += 2) {
    const nx = path[i], ny = path[i + 1];
    assert.equal(Math.abs(nx - x) + Math.abs(ny - y), 1, `step ${i / 2} is orthogonal`);
    assert.ok(map.passable(nx, ny, tideState, mover), `step ${i / 2} (${nx},${ny}) passable`);
    x = nx; y = ny;
  }
  assert.deepEqual({ x, y }, to);
}

describe('findPath', () => {
  it('finds a shortest path on open ground, excluding the start and including the goal', () => {
    const path = findPath(map, P(0, 4), P(3, 4), { tideState: 'high' });
    assertValidPath(path, P(0, 4), P(3, 4), 'high');
    assert.equal(pathLength(path), 3);
    assert.deepEqual(path, [1, 4, 2, 4, 3, 4]);
  });

  it('returns [] when already there and null for an impassable goal', () => {
    assert.deepEqual(findPath(map, P(1, 4), P(1, 4), { tideState: 'low' }), []);
    assert.equal(findPath(map, P(1, 4), P(0, 0), { tideState: 'low' }), null, 'wall');
    assert.equal(findPath(map, P(1, 4), P(5, 5), { tideState: 'low' }), null, 'deep water on foot');
    assert.equal(findPath(map, P(1, 4), P(99, 99), { tideState: 'low' }), null, 'off map');
  });

  it('crosses the causeway only at low tide', () => {
    const low = findPath(map, P(1, 4), P(9, 3), { tideState: 'low' });
    assertValidPath(low, P(1, 4), P(9, 3), 'low');
    assert.ok(low.some((_, i) => i % 2 === 0 && low[i] === 5 && low[i + 1] === 3), 'walks tile (5,3)');
    for (const t of ['rising', 'high', 'falling']) {
      assert.equal(findPath(map, P(1, 4), P(9, 3), { tideState: t }), null, `unreachable at ${t}`);
    }
  });

  it('routes around walls deterministically', () => {
    const a = findPath(map, P(0, 3), P(3, 1), { tideState: 'high' });
    const b = findPath(map, P(0, 3), P(3, 1), { tideState: 'high' });
    assertValidPath(a, P(0, 3), P(3, 1), 'high');
    assert.deepEqual(a, b);
    assert.equal(pathLength(a), 5);
  });

  it('honours maxLen, maxNodes and adjacent', () => {
    assert.equal(findPath(map, P(0, 4), P(11, 0), { tideState: 'low', maxLen: 5 }), null);
    assert.ok(findPath(map, P(0, 4), P(4, 4), { tideState: 'low', maxLen: 4 }));
    assert.equal(findPath(map, P(0, 4), P(4, 4), { tideState: 'low', maxLen: 3 }), null);
    assert.equal(findPath(map, P(0, 4), P(11, 0), { tideState: 'low', maxNodes: 3 }), null);
    // walking up to an NPC standing on a tile we cannot enter
    const adj = findPath(map, P(0, 4), P(3, 4), { tideState: 'low', adjacent: true, blocked: (x, y) => x === 3 && y === 4 });
    assert.deepEqual(adj, [1, 4, 2, 4]);
    assert.deepEqual(findPath(map, P(2, 4), P(3, 4), { tideState: 'low', adjacent: true }), []);
  });

  it('treats blocked() tiles as walls', () => {
    const blocked = (x, y) => y === 4 && x === 2;
    const path = findPath(map, P(0, 4), P(4, 4), { tideState: 'low', blocked });
    assertValidPath(path, P(0, 4), P(4, 4), 'low');
    assert.ok(!path.some((_, i) => i % 2 === 0 && path[i] === 2 && path[i + 1] === 4));
    assert.equal(findPath(map, P(0, 4), P(2, 4), { tideState: 'low', blocked }), null, 'blocked goal');
  });

  it('respects the mover class (boats stay on water)', () => {
    assert.equal(findPath(map, P(5, 4), P(5, 7), { tideState: 'high', mover: 'boat' }).length, 6);
    assert.equal(findPath(map, P(5, 4), P(4, 4), { tideState: 'high', mover: 'boat' }), null);
  });

  it('validates arguments', () => {
    assert.throws(() => findPath(map, P(0, 4), P(1, 4), {}), TypeError);
    assert.throws(() => findPath(map, P(0.5, 4), P(1, 4), { tideState: 'low' }), TypeError);
  });

  it('handles a large grid within the default limits and stays deterministic across searches', () => {
    const w = 64, h = 64;
    const big = { w, h, passable: (x, y) => !(x % 7 === 3 && y % 11 !== 5) };
    const a = findPath(big, P(0, 0), P(63, 63), { tideState: 'low', maxLen: 1000 });
    const b = findPath(big, P(0, 0), P(63, 63), { tideState: 'low', maxLen: 1000 });
    assert.ok(a && a.length >= 2 * 126);
    assert.deepEqual(a, b);
    assert.equal(findPath(big, P(0, 0), P(63, 63), { tideState: 'low' }), null, `longer than DEFAULT_MAX_PATH=${DEFAULT_MAX_PATH}`);
  });
});

describe('path cache', () => {
  it('returns the same frozen path on a hit and tracks stats', () => {
    const cache = createPathCache({ max: 4 });
    const a = findPathCached(cache, map, P(0, 4), P(3, 4), { tideState: 'low' });
    const b = findPathCached(cache, map, P(0, 4), P(3, 4), { tideState: 'low' });
    assert.equal(a, b);
    assert.ok(Object.isFrozen(a));
    assert.deepEqual(cache.stats, { hits: 1, misses: 1, evictions: 0 });
    assert.equal(cache.size(), 1);
  });

  it('misses and re-searches when the tide variant changes', () => {
    const cache = createPathCache();
    const low = findPathCached(cache, map, P(1, 4), P(9, 3), { tideState: 'low', variant: 'low' });
    assert.ok(low && low.length > 0);
    const high = findPathCached(cache, map, P(1, 4), P(9, 3), { tideState: 'high', variant: 'high' });
    assert.equal(high, null, 'cached unreachable at high tide');
    assert.equal(cache.size(), 2);
    assert.equal(findPathCached(cache, map, P(1, 4), P(9, 3), { tideState: 'low', variant: 'low' }), low, 'low entry survives');
    assert.equal(cache.stats.hits, 1);
    assert.equal(cache.stats.misses, 2);
  });

  it('caches "unreachable" as null distinct from a miss', () => {
    const cache = createPathCache();
    assert.equal(findPathCached(cache, map, P(1, 4), P(0, 0), { tideState: 'low' }), null);
    assert.equal(cache.get(pathKey(map.id, 1, 4, 0, 0, 'low', 'npc')), null);
    assert.equal(cache.get('nope'), undefined);
  });

  it('evicts least recently used and invalidates by map id or predicate', () => {
    const cache = createPathCache({ max: 2 });
    findPathCached(cache, map, P(0, 4), P(1, 4), { tideState: 'low' });
    findPathCached(cache, map, P(0, 4), P(2, 4), { tideState: 'low' });
    findPathCached(cache, map, P(0, 4), P(1, 4), { tideState: 'low' }); // refresh first
    findPathCached(cache, map, P(0, 4), P(3, 4), { tideState: 'low' }); // evicts (0,4)>(2,4)
    assert.equal(cache.stats.evictions, 1);
    assert.equal(cache.get(pathKey(map.id, 0, 4, 2, 4, 'low', 'npc')), undefined);
    assert.notEqual(cache.get(pathKey(map.id, 0, 4, 1, 4, 'low', 'npc')), undefined);
    assert.equal(cache.invalidate('other-map'), 0);
    assert.equal(cache.invalidate(map.id), 2);
    assert.equal(cache.size(), 0);
    findPathCached(cache, map, P(0, 4), P(1, 4), { tideState: 'low' });
    findPathCached(cache, map, P(0, 4), P(1, 4), { tideState: 'high' });
    assert.equal(cache.invalidate((k) => k.includes('|high|')), 1);
    assert.equal(cache.size(), 1);
    cache.invalidate();
    assert.equal(cache.size(), 0);
  });

  it('refuses dynamic obstacles (not cacheable) and bad sizes', () => {
    const cache = createPathCache();
    assert.throws(() => findPathCached(cache, map, P(0, 4), P(1, 4), { tideState: 'low', blocked: () => false }), TypeError);
    assert.throws(() => createPathCache({ max: 0 }), RangeError);
    assert.equal(createPathCache().max, PATH_CACHE_MAX);
  });

  it('keys differ by map, endpoints, variant, mover and adjacency', () => {
    const keys = new Set([
      pathKey('a', 0, 0, 1, 1, 'low', 'npc'), pathKey('b', 0, 0, 1, 1, 'low', 'npc'),
      pathKey('a', 0, 0, 1, 2, 'low', 'npc'), pathKey('a', 0, 0, 1, 1, 'high', 'npc'),
      pathKey('a', 0, 0, 1, 1, 'low', 'boat'), pathKey('a', 0, 0, 1, 1, 'low', 'npc', true),
    ]);
    assert.equal(keys.size, 6);
  });

  it('collision layer overrides in the fixture map builder are honoured by the search', () => {
    const def = { ...MAP_DEF, collision: MAP_DEF.ground.map((row, y) => (y === 4 ? '#'.repeat(12) : '-'.repeat(12))) };
    const walled = buildRuntimeMap(def, TILES, LEGEND);
    assert.equal(findPath(walled, P(1, 3), P(1, 5), { tideState: 'low' }), null);
  });
});
