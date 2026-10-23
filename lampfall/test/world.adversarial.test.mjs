// Adversarial tests for js/world/* (independent verification pass).
// Run: node --test test/world.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { loadMap } from '../js/world/tilemap.js';
import { tideVariant, flooded, dry, nearestDry, TIDE_MASK } from '../js/world/tide.js';
import { createCamera } from '../js/world/camera.js';
import { resolveWarp } from '../js/world/warps.js';
import { gradeFor, gradeSlot, lampsLit, dayPartAt, GRADES_PER_DAY } from '../js/world/lighting.js';
import { findPath, findPathCached, createPathCache, pathKey } from '../js/world/pathing.js';
import { createEntities, createEntity, STROLL_MS } from '../js/world/entities.js';
import { createPlayer } from '../js/world/player.js';
import { resolveFacing, underWater } from '../js/world/interact.js';
import { spawn, rollRow, createRoamerField } from '../js/world/roamer.js';
import { makeRng } from '../js/core/rng.js';
import { createNewWorld } from '../js/state/schema.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';
import harborDef from './fixtures/world/harbor.fixture.js';

const LEGEND = { legend: DEFAULT_LEGEND };
const harbor = loadMap(harborDef, TILES, LEGEND);

/** A w x h map def filled with one ground char, plus overrides. */
function flatDef(id, w, h, ch = 'G', extra = {}) {
  return { id, name: id, kind: 'exterior', region: 'test', w, h, ground: Array.from({ length: h }, () => ch.repeat(w)), entities: [], triggers: [], warps: [], spawns: [], entry: { x: 0, y: 0 }, ...extra };
}

const world = () => createNewWorld({ seedCode: 'ADV-WORLD', lease: { mapId: 'harbor', x: 6, y: 5, facing: 'up' } });

// ------------------------------------------------------------------------------------------------
describe('tilemap: 200x200 parse budget', () => {
  // A busy map: every layer, a collision layer, keyword and rect spawns, many triggers and warps.
  const W = 200, H = 200;
  const chars = 'GTPOASWEMDKC';
  const ground = [], detail = [], overlay = [], collision = [];
  for (let y = 0; y < H; y++) {
    let g = '', d = '', o = '', c = '';
    for (let x = 0; x < W; x++) {
      g += chars[(x * 7 + y * 13) % chars.length];
      d += (x + y) % 17 === 0 ? 'k' : (x * y) % 23 === 0 ? 'l' : '.';
      o += (x + 2 * y) % 19 === 0 ? 'c' : '.';
      c += (x ^ y) % 29 === 0 ? '#' : (x + y) % 31 === 0 ? 'L' : '-';
    }
    ground.push(g); detail.push(d); overlay.push(o); collision.push(c);
  }
  const triggers = [], warps = [];
  for (let k = 0; k < 300; k++) triggers.push({ x: (k * 37) % W, y: (k * 53) % H, kind: k % 2 ? 'use' : 'step', id: `t${k}` });
  for (let k = 0; k < 120; k++) warps.push({ x: (k * 41) % W, y: (k * 29) % H, to: { mapId: 'elsewhere', x: 1, y: 1 }, kind: 'door' });
  const big = {
    id: 'big', name: 'Big', kind: 'exterior', region: 'test', w: W, h: H, ground, detail, overlay, collision,
    props: [{ art: 'lamp', x: 5, y: 5 }], entities: [], triggers, warps,
    spawns: [{ area: 'grass', table: 'g', rate: 0.1 }, { area: 'water', table: 'w', rate: 0.1 }, { area: 'mud', table: 'm', rate: 0.1 }, { area: { x: 10, y: 10, w: 50, h: 50 }, table: 'r', rate: 0.1 }],
    regions: { all: { x: 0, y: 0, w: W, h: H } }, entry: { x: 1, y: 1 },
  };

  it('parses in under 50 ms (best of 5, after one warm-up)', () => {
    loadMap(big, TILES, LEGEND);
    let best = Infinity;
    let m;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      m = loadMap(big, TILES, LEGEND);
      best = Math.min(best, performance.now() - t0);
    }
    assert.ok(best < 50, `loadMap 200x200 took ${best.toFixed(1)} ms`);
    assert.equal(m.w * m.h, 40000);
    assert.equal(m.triggersAt(0, 0).length >= 1, true);
  });

  it('a full passable sweep over every tide variant stays cheap (< 30 ms for 120k calls)', () => {
    const m = loadMap(big, TILES, LEGEND);
    let open = 0;
    const t0 = performance.now();
    for (const v of ['low', 'mid', 'high']) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.passable(x, y, v, 'walk')) open++;
    const ms = performance.now() - t0;
    assert.ok(ms < 30, `sweep took ${ms.toFixed(1)} ms`);
    assert.ok(open > 0 && open < 120000);
  });
});

// ------------------------------------------------------------------------------------------------
describe('passability on every tide input for every fixture tile', () => {
  // Expected walker passability per tile, by variant, from the tile definition alone (§4.1).
  const expectWalk = (td, v) => {
    if (td.solid) return false;
    const mask = td.tide == null ? TIDE_MASK.NONE : ['', 'low', 'high', 'floods', 'glow'].indexOf(td.tide);
    if (mask === TIDE_MASK.LOW_ONLY || mask === TIDE_MASK.GLOW) return v === 'low';
    if (mask === TIDE_MASK.HIGH_ONLY) return v === 'high';
    if (mask === TIDE_MASK.FLOODS) return true;
    return td.water !== true;
  };
  const inputs = [['low', 'low'], ['rising', 'mid'], ['mid', 'mid'], ['high', 'high'], ['falling', 'mid'], [0, 'low'], [0.19, 'low'], [0.2, 'mid'], [0.8, 'mid'], [0.81, 'high'], [1, 'high']];

  for (const [id, td] of Object.entries(TILES)) {
    it(`tile '${id}'`, () => {
      // 3x1: the probe tile in the middle of sand, so neighbours never matter
      const m = loadMap({ ...flatDef(`probe-${id}`, 3, 1, 'A'), legend: { X: id }, ground: ['AXA'] }, TILES, LEGEND);
      for (const [tide, v] of inputs) {
        assert.equal(tideVariant(tide), v);
        const walk = m.passable(1, 0, tide, 'walk');
        assert.equal(walk, expectWalk(td, v), `${id} walk @ ${tide}`);
        // every walking mover shares one rule
        assert.equal(m.passable(1, 0, tide, 'npc'), walk, `${id} npc @ ${tide}`);
        assert.equal(m.passable(1, 0, tide, 'roamer'), walk, `${id} roamer @ ${tide}`);
        // a boat floats exactly where the tile is (or reads as) water, never on walls
        const boat = m.passable(1, 0, tide, 'boat');
        if (td.solid) assert.equal(boat, false, `${id} boat on a wall`);
        // flooded / dry agree with passable for walkers
        if (!td.solid) assert.equal(dry(m, 1, 0, tide), walk, `${id} dry @ ${tide}`);
        assert.equal(flooded(m, 1, 0, tide), !td.solid && !walk, `${id} flooded @ ${tide}`);
        // interact's TileInfo-only check mirrors tide.floodedAt on the real map
        assert.equal(underWater(m.tileAt(1, 0), tide), flooded(m, 1, 0, tide), `${id} underWater @ ${tide}`);
      }
    });
  }

  it('rejects fractional, NaN and out-of-bounds coordinates (never "open" by accident)', () => {
    for (const [x, y] of [[1.5, 5], [6, 5.5], [NaN, 5], [6, NaN], [-1, 5], [16, 5], [6, 10], [Infinity, 0]]) {
      assert.equal(harbor.passable(x, y, 'low', 'walk'), false, `${x},${y}`);
      assert.equal(harbor.warpAt(x, y), null);
      assert.equal(harbor.spawnAt(x, y), null);
      assert.equal(harbor.triggersAt(x, y).length, 0);
      assert.equal(harbor.tileAt(x, y), null);
    }
    assert.equal(harbor.warpAt(3.5, 8), null, 'a fractional probe next to a door finds no warp');
  });

  it('throws on a missing tide argument instead of guessing', () => {
    assert.throws(() => harbor.passable(6, 5, undefined, 'walk'), TypeError);
    assert.throws(() => harbor.passable(6, 5, NaN, 'walk'), TypeError);
  });

  it('nearestDry never returns a flooded or solid tile, from every cell, at every variant', () => {
    for (const v of ['low', 'mid', 'high']) {
      for (let y = 0; y < harbor.h; y++) {
        for (let x = 0; x < harbor.w; x++) {
          const r = nearestDry(harbor, x, y, v);
          if (r === null) continue;
          assert.ok(dry(harbor, r.x, r.y, v), `nearestDry(${x},${y},${v}) -> ${r.x},${r.y}`);
          assert.ok(r.dist >= Math.abs(r.x - x) + Math.abs(r.y - y));
        }
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
describe('warps at map edges', () => {
  const edgeDef = flatDef('edge-src', 6, 4, 'G', {
    warps: [
      { x: 5, y: 0, h: 4, to: { mapId: 'edge-dst', x: 0, y: 1 }, kind: 'edge' },       // east edge strip
      { x: 0, y: 3, to: { mapId: 'edge-dst', x: 3, y: 2 }, kind: 'edge' },             // south-west corner cell
      { x: 0, y: 0, to: { mapId: 'edge-dst', x: 9, y: 0 }, kind: 'edge' },             // lands off the destination map
      { x: 2, y: 3, to: { mapId: 'edge-dst', x: 2, y: 0 }, kind: 'edge' },             // lands on the causeway
    ],
  });
  const src = loadMap(edgeDef, TILES, LEGEND);
  // destination: 4x3, a causeway at (2,0), a wall at (3,2)
  const dst = loadMap({ ...flatDef('edge-dst', 4, 3, 'G'), ground: ['GGEG', 'GGGG', 'GGGH'] }, TILES, LEGEND);
  const w = world();

  it('an edge strip covers every cell of the boundary column', () => {
    for (let y = 0; y < 4; y++) assert.equal(src.warpAt(5, y), edgeDef.warps[0]);
    assert.equal(src.warpAt(6, 0), null, 'one past the edge is outside');
  });

  it('lands on the destination edge and keeps the walking facing', () => {
    const r = resolveWarp(w, src.warpAt(5, 2), null, 'low', { destMap: dst, facing: 'right' });
    assert.equal(r.ok, true);
    assert.deepEqual([r.mapId, r.x, r.y, r.facing], ['edge-dst', 0, 1, 'right']);
  });

  it("refuses 'blocked' for an off-map landing and for a wall, 'tide' for a flooded causeway", () => {
    assert.equal(resolveWarp(w, src.warpAt(0, 0), null, 'low', { destMap: dst }).reason, 'blocked');
    assert.equal(resolveWarp(w, src.warpAt(0, 3), null, 'low', { destMap: dst }).reason, 'blocked', 'lands on a wall');
    assert.equal(resolveWarp(w, src.warpAt(2, 3), null, 'high', { destMap: dst }).reason, 'tide');
    assert.equal(resolveWarp(w, src.warpAt(2, 3), null, 'rising', { destMap: dst }).reason, 'tide');
    assert.equal(resolveWarp(w, src.warpAt(2, 3), null, 'low', { destMap: dst }).ok, true);
  });

  it('loadMap rejects a warp rect that hangs over the map edge', () => {
    assert.throws(() => loadMap(flatDef('bad', 4, 4, 'G', { warps: [{ x: 3, y: 0, w: 2, to: { mapId: 'x', x: 0, y: 0 }, kind: 'edge' }] }), TILES, LEGEND), /outside 4x4/);
    assert.throws(() => loadMap(flatDef('bad2', 4, 4, 'G', { warps: [{ x: -1, y: 0, to: { mapId: 'x', x: 0, y: 0 }, kind: 'edge' }] }), TILES, LEGEND), /outside/);
  });

  it('a destMap that is not the warp target is a programmer error', () => {
    assert.throws(() => resolveWarp(w, src.warpAt(5, 0), null, 'low', { destMap: harbor }), /destMap/);
  });
});

// ------------------------------------------------------------------------------------------------
describe('camera on maps smaller than the view', () => {
  it('centres a 5x3 map and never moves, whatever it follows', () => {
    const cam = createCamera({ w: 480, h: 270 }); // §4.3 signature alias
    assert.equal(cam.viewW, 480);
    const tiny = { id: 'tiny', w: 5, h: 3, regions: {} };
    cam.bounds(tiny);
    const target = { px: 0, py: 0 };
    cam.follow(target, { snap: true });
    const x0 = cam.x, y0 = cam.y;
    assert.equal(x0, -Math.floor((480 - 80) / 2));
    assert.equal(y0, -Math.floor((270 - 48) / 2));
    for (const [px, py] of [[64, 32], [0, 0], [1000, -1000]]) {
      target.px = px; target.py = py;
      for (let i = 0; i < 30; i++) cam.update(1000 / 60);
      assert.equal(cam.x, x0); assert.equal(cam.y, y0);
    }
    const r = cam.visibleTiles();
    assert.deepEqual({ ...r }, { x: 0, y: 0, w: 5, h: 3 }, 'clamped to the map, never negative');
    assert.equal(cam.visibleTiles(), r, 'reused rect');
    // the map's top-left draws at the letterbox offset
    assert.deepEqual({ ...cam.toScreen(0, 0) }, { x: 200, y: 111 });
  });

  it('handles odd leftovers, one-axis-small maps and a 1x1 map', () => {
    const cam = createCamera();
    cam.bounds({ id: 'odd', w: 7, h: 40 });     // 112 px wide, 640 px tall
    cam.follow({ x: 3, y: 39 }, { snap: true });
    assert.equal(cam.x, -184);
    assert.equal(cam.y, 640 - 270, 'tall axis still clamps to the bottom');
    const r = cam.visibleTiles();
    assert.equal(r.x, 0); assert.equal(r.w, 7);
    assert.equal(r.y + r.h, 40);
    cam.bounds({ id: 'one', w: 1, h: 1 });
    cam.snap();
    assert.deepEqual({ ...cam.visibleTiles() }, { x: 0, y: 0, w: 1, h: 1 });
  });

  it('a map exactly the view size has zero offset; shake stays whole-pixel and decays to 0', () => {
    const cam = createCamera();
    cam.bounds({ id: 'exact', w: 30, h: 17 }); // 480 x 272
    cam.follow({ x: 15, y: 8 }, { snap: true });
    assert.equal(cam.x, 0);
    cam.shake(3, 200);
    for (let t = 0; t < 220; t += 1000 / 60) {
      cam.update(1000 / 60);
      assert.ok(Number.isInteger(cam.x) && Number.isInteger(cam.y));
      assert.ok(Math.abs(cam.shakeOffset().x) <= 3);
    }
    assert.deepEqual({ ...cam.shakeOffset() }, { x: 0, y: 0 });
  });
});

// ------------------------------------------------------------------------------------------------
describe('path cache under 10k queries', () => {
  // 48x48 with a deterministic maze of walls and a tide-gated causeway column
  const N = 48;
  const ground = [];
  for (let y = 0; y < N; y++) {
    let row = '';
    for (let x = 0; x < N; x++) row += x === 24 ? (y % 6 === 0 ? 'G' : 'E') : (x % 8 === 4 && y % 12 !== 6 ? 'H' : 'G');
    ground.push(row);
  }
  const m = loadMap({ ...flatDef('maze', N, N), ground }, TILES, LEGEND);
  const rng = makeRng(42);
  const pts = [];
  while (pts.length < 64) {
    const x = rng.int(0, N - 1), y = rng.int(0, N - 1);
    if (m.passable(x, y, 'low', 'npc')) pts.push({ x, y });
  }
  const tides = ['low', 'rising', 'high', 'falling'];

  it('serves 10k queries correctly within budget, bounded in size', () => {
    const cache = createPathCache({ max: 256 });
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      const a = pts[rng.int(0, 63)], b = pts[rng.int(0, 15)]; // skewed so there are hits
      const tide = tides[i & 3];
      const p = findPathCached(cache, m, a, b, { tideState: tide });
      if (i % 97 === 0) {
        const fresh = findPath(m, a, b, { tideState: tide });
        assert.deepEqual(p === null ? null : [...p], fresh, `query ${i}`);
      }
    }
    const ms = performance.now() - t0;
    assert.ok(ms < 3000, `10k cached queries took ${ms.toFixed(0)} ms`);
    assert.ok(cache.size() <= 256);
    assert.equal(cache.stats.hits + cache.stats.misses, 10000);
    assert.ok(cache.stats.hits > 500, `hits ${cache.stats.hits}`);
    assert.ok(cache.stats.evictions > 0);
  });

  it('every returned path is a legal 4-step walk on the tide it was asked for', () => {
    for (let i = 0; i < 200; i++) {
      const a = pts[i % 64], b = pts[(i * 7 + 3) % 64];
      const tide = tides[i & 3];
      const p = findPath(m, a, b, { tideState: tide });
      if (!p) continue;
      let x = a.x, y = a.y;
      for (let k = 0; k < p.length; k += 2) {
        assert.equal(Math.abs(p[k] - x) + Math.abs(p[k + 1] - y), 1);
        x = p[k]; y = p[k + 1];
        assert.ok(m.passable(x, y, tide, 'npc'));
      }
      assert.deepEqual([x, y], [b.x, b.y]);
    }
  });

  it('a short-limit search does not poison the full search (limits are part of the key)', () => {
    const cache = createPathCache();
    const a = { x: 0, y: 0 }, b = { x: 19, y: 19 };
    assert.equal(findPathCached(cache, m, a, b, { tideState: 'low', maxLen: 5 }), null);
    const full = findPathCached(cache, m, a, b, { tideState: 'low' });
    assert.ok(full && full.length / 2 >= 38, 'the default-limit search still finds the path');
    assert.equal(findPathCached(cache, m, a, b, { tideState: 'low', maxNodes: 3 }), null);
    assert.notEqual(pathKey('m', 0, 0, 1, 1, 'low', 'npc', false, 5), pathKey('m', 0, 0, 1, 1, 'low', 'npc'));
  });

  it('accepts a tide height and keys it by variant', () => {
    const cache = createPathCache();
    const a = pts[0], b = pts[1];
    const p1 = findPathCached(cache, m, a, b, { tideState: 0.05 });
    const p2 = findPathCached(cache, m, a, b, { tideState: 'low' });
    assert.equal(p1, p2, 'same cache entry');
    assert.throws(() => findPathCached(cache, m, a, b, { tideState: NaN }), TypeError);
    assert.throws(() => findPathCached(cache, m, a, b), TypeError);
  });

  it('an open 200x200 field finds the corner-to-corner path (heap never overflows)', () => {
    const open = loadMap(flatDef('open', 200, 200), TILES, LEGEND);
    const p = findPath(open, { x: 0, y: 0 }, { x: 199, y: 199 }, { tideState: 'low', maxLen: 1000 });
    assert.equal(p.length / 2, 398);
  });
});

// ------------------------------------------------------------------------------------------------
describe('entities moving into one tile at once', () => {
  const m = loadMap(flatDef('yard', 5, 5), TILES, LEGEND);
  const ctx = { map: m, tideState: 'low' };

  it('four solid entities converging on the centre: exactly the first gets it', () => {
    const ents = createEntities(m);
    const n = ents.add(createEntity({ id: 'n', kind: 'npc', x: 2, y: 1 }));
    const e = ents.add(createEntity({ id: 'e', kind: 'npc', x: 3, y: 2 }));
    const s = ents.add(createEntity({ id: 's', kind: 'npc', x: 2, y: 3 }));
    const wv = ents.add(createEntity({ id: 'w', kind: 'npc', x: 1, y: 2 }));
    const res = [ents.tryMove(n, 'down', ctx), ents.tryMove(e, 'left', ctx), ents.tryMove(s, 'up', ctx), ents.tryMove(wv, 'right', ctx)];
    assert.deepEqual(res, [true, false, false, false]);
    assert.equal(ents.at(2, 2), n);
    for (const x of [e, s, wv]) assert.equal(x.moving, false);
    assert.deepEqual([e.facing, s.facing, wv.facing], ['left', 'up', 'right'], 'losers still turn');
    ents.tickAll(STROLL_MS);
    assert.equal(ents.near(2, 2, 0).length, 1, 'one entity in the centre cell');
  });

  it('a swap (A->B while B->A) cannot happen: the second mover finds the first reserved', () => {
    const ents = createEntities(m);
    const a = ents.add(createEntity({ id: 'a', kind: 'npc', x: 0, y: 0 }));
    const b = ents.add(createEntity({ id: 'b', kind: 'npc', x: 1, y: 0 }));
    assert.equal(ents.tryMove(a, 'right', ctx), false, 'b is solid on the target');
    assert.equal(ents.tryMove(b, 'left', ctx), false);
  });

  it('a follower may enter the tile being vacated (freed at step start); never two on one tile', () => {
    const ents = createEntities(m);
    const lead = ents.add(createEntity({ id: 'lead', kind: 'npc', x: 1, y: 0 }));
    const tail = ents.add(createEntity({ id: 'tail', kind: 'npc', x: 0, y: 0 }));
    assert.ok(ents.tryMove(lead, 'right', ctx));
    assert.ok(ents.tryMove(tail, 'right', ctx));
    for (let i = 0; i < 20; i++) {
      ents.tickAll(16);
      const cells = new Set(ents.list.map((x) => `${x.x},${x.y}`));
      assert.equal(cells.size, ents.list.length);
    }
  });

  it('non-solid entities may share; a solid one may stand on a non-solid one', () => {
    const ents = createEntities(m);
    ents.add(createEntity({ id: 'shell', kind: 'item', x: 2, y: 2, solid: false }));
    const p = ents.add(createEntity({ id: 'p', kind: 'player', x: 2, y: 1 }));
    assert.ok(ents.tryMove(p, 'down', ctx));
    assert.equal(ents.at(2, 2), p, 'the solid entity wins at()');
  });

  it('rejects fractional placement (would corrupt the spatial grid)', () => {
    const ents = createEntities(m);
    const e = createEntity({ id: 'x', kind: 'npc', x: 1, y: 1 });
    e.x = 1.5;
    assert.throws(() => ents.add(e), TypeError);
    const ok = ents.add(createEntity({ id: 'y', kind: 'npc', x: 1, y: 1 }));
    assert.throws(() => ents.teleport(ok, 2.5, 1), TypeError);
    assert.equal(ents.at(1, 1), ok);
  });
});

// ------------------------------------------------------------------------------------------------
describe('roamer spawn tables with zero weight', () => {
  const m = loadMap(flatDef('meadow', 20, 20), TILES, LEGEND);

  it('an all-zero table spawns nothing and consumes no draws', () => {
    const rng = makeRng(7);
    const before = rng.state().join(',');
    const table = [{ species: 'a', levels: [1, 2], w: 0 }, { species: 'b', levels: [1, 2], w: 0 }];
    assert.equal(spawn(rng, table, m, 'low', { tableId: 'z' }), null);
    assert.equal(rollRow(rng, table), null);
    assert.equal(rng.state().join(','), before, 'determinism: a dead table does not shift the stream');
  });

  it('negative weights count as zero; zero-weight rows are never picked', () => {
    const rng = makeRng(8);
    const table = [{ species: 'never', levels: [1, 1], w: 0 }, { species: 'neg', levels: [1, 1], w: -5 }, { species: 'yes', levels: [3, 3], w: 1 }];
    for (let i = 0; i < 300; i++) {
      const r = spawn(rng, table, m, 'low', { tableId: 'z', seq: i });
      assert.equal(r.speciesId, 'yes');
      assert.equal(r.level, 3);
    }
  });

  it('an empty table, and a table whose only positive row fails its cond, give null', () => {
    const rng = makeRng(9);
    assert.equal(spawn(rng, [], m, 'low'), null);
    const table = [{ species: 'x', levels: [1, 1], w: 0 }, { species: 'night', levels: [1, 1], w: 5, cond: { phase: ['night'] } }];
    assert.equal(spawn(rng, table, m, 'low', { phase: 'day' }), null);
  });

  it('a non-finite weight is a data bug and throws (the validator rejects it first)', () => {
    assert.throws(() => rollRow(makeRng(1), [{ species: 'x', levels: [1, 1], w: NaN }]), TypeError);
  });

  it('the field respects its cap and keeps ids unique when zero-weight attempts fail', () => {
    const field = createRoamerField({ cap: 3 });
    const rng = makeRng(10);
    const dead = [{ species: 'x', levels: [1, 1], w: 0 }];
    const live = [{ species: 'y', levels: [1, 1], w: 1 }];
    assert.equal(field.spawn(rng, dead, m, 'low', { tableId: 't' }), null);
    for (let i = 0; i < 6; i++) field.spawn(rng, live, m, 'low', { tableId: 't' });
    assert.equal(field.list.length, 3);
    assert.equal(new Set(field.list.map((r) => r.id)).size, 3);
  });

  it('cond keys outside phase/tide/weather go through the DSL when a world is given', () => {
    const rng = makeRng(11);
    const w = world();
    const table = [{ species: 'flagged', levels: [1, 1], w: 1, cond: { flag: 'sp.roamers' } }];
    assert.equal(spawn(rng, table, m, 'low', { world: w }), null);
    w.flags['sp.roamers'] = true;
    assert.equal(spawn(rng, table, m, 'low', { world: w }).speciesId, 'flagged');
  });
});

// ------------------------------------------------------------------------------------------------
describe('lighting grades at minute boundaries', () => {
  const pairs = [[359, 360, 11, 12], [1079, 1080, 35, 36], [1439, 0, 47, 0]];
  for (const [a, b, sa, sb] of pairs) {
    it(`${a} / ${b} fall in slots ${sa} / ${sb}`, () => {
      assert.equal(gradeSlot(a), sa);
      assert.equal(gradeSlot(b), sb);
      const ga = gradeFor(a, 'clear'), gb = gradeFor(b, 'clear');
      assert.notEqual(ga, gb);
      assert.equal(ga.id, `${sa}|clear`);
      assert.equal(gb.id, `${sb}|clear`);
      // fractional minutes just under the boundary stay in the earlier slot
      assert.equal(gradeFor(a + 0.999, 'clear'), ga);
      // the grade is constant within a slot
      assert.equal(gradeFor(sb * 30 + 29, 'clear'), gb);
    });
  }

  it('wraps: 1440 is 0, -1 is 1439, multi-day totals reduce modulo a day', () => {
    assert.equal(gradeFor(1440), gradeFor(0));
    assert.equal(gradeFor(-1), gradeFor(1439));
    assert.equal(gradeFor(1440 * 9 + 360), gradeFor(360));
    assert.equal(gradeSlot(-0.0001), GRADES_PER_DAY - 1);
  });

  it('midnight is continuous: lamps lit either side, night weight full, the same day part', () => {
    assert.ok(lampsLit(gradeFor(1439)) && lampsLit(gradeFor(0)));
    assert.equal(dayPartAt(0), 'deep-night');
    assert.ok(gradeFor(0).night >= gradeFor(1439).night);
    // grade components change by a bounded step between neighbouring slots everywhere in the day
    for (let s = 0; s < GRADES_PER_DAY; s++) {
      const g1 = gradeFor(s * 30), g2 = gradeFor(((s + 1) % GRADES_PER_DAY) * 30);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(g1.mult[k] - g2.mult[k]) < 0.3, `slot ${s} -> ${s + 1} mult jump`);
    }
  });

  it('unknown or prototype-named weather grades as clear and never throws', () => {
    for (const wx of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'hail', '', null, undefined, 3]) {
      assert.equal(gradeFor(720, wx).weather, 'clear', String(wx));
    }
  });

  it('rejects non-finite minutes', () => {
    assert.throws(() => gradeFor(NaN), TypeError);
    assert.throws(() => gradeFor(Infinity), TypeError);
  });
});

// ------------------------------------------------------------------------------------------------
describe('interaction when facing off-map', () => {
  const m = loadMap(flatDef('box', 4, 3, 'G', { warps: [{ x: 3, y: 1, to: { mapId: 'east', x: 0, y: 1 }, kind: 'edge' }] }), TILES, LEGEND);
  const w = world();
  const cases = [[0, 0, 'up'], [0, 0, 'left'], [3, 2, 'right'], [3, 2, 'down'], [3, 1, 'right'], [0, 1, 'left']];

  for (const [x, y, facing] of cases) {
    it(`(${x},${y}) facing ${facing} resolves to nothing`, () => {
      const ents = createEntities(m);
      const p = ents.add(createEntity({ id: 'player', kind: 'player', x, y, facing }));
      assert.equal(resolveFacing(p, m, ents, w, null, { tideState: 'low' }), null);
    });
  }

  it('the player bumps (no step, no throw) walking off the map edge', () => {
    const ents = createEntities(m);
    const pl = createPlayer({ x: 3, y: 1, facing: 'right' });
    ents.add(pl.ent);
    pl.intend('right');
    const evs = pl.update(16, { ents, map: m, tideState: 'low' });
    assert.deepEqual(evs.map((e) => e.type), ['bump']);
    assert.deepEqual([pl.ent.x, pl.ent.y, pl.ent.moving], [3, 1, false]);
    const ft = pl.facingTile();
    assert.deepEqual([ft.x, ft.y], [4, 1], 'facing tile is reported even off-map');
  });

  it('a bogus facing is ignored, not thrown', () => {
    const ents = createEntities(m);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 1, y: 1 }));
    p.facing = 'north';
    assert.equal(resolveFacing(p, m, ents, w, null, { tideState: 'low' }), null);
  });
});

// ------------------------------------------------------------------------------------------------
describe('interaction prompts are not stale across reused roamer ids', () => {
  it('a new species behind a recycled id gets its own name', () => {
    const m = loadMap(flatDef('field', 4, 3), TILES, LEGEND);
    const w = world();
    const data = { species: { a: { id: 'a', name: 'Puddlepip' }, b: { id: 'b', name: 'Wirewhisk' } } };
    const ents = createEntities(m);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 0, y: 1, facing: 'right' }));
    ents.add(createEntity({ id: 'roamer:t:0', kind: 'roamer', x: 1, y: 1, speciesId: 'a' }));
    assert.equal(resolveFacing(p, m, ents, w, data, { tideState: 'low' }).prompt, 'Read Puddlepip');
    ents.remove('roamer:t:0');
    ents.add(createEntity({ id: 'roamer:t:0', kind: 'roamer', x: 1, y: 1, speciesId: 'b' }));
    assert.equal(resolveFacing(p, m, ents, w, data, { tideState: 'low' }).prompt, 'Read Wirewhisk');
  });
});
