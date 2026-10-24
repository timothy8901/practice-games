// Unit tests for js/world/npc.js. Run: node --test test/world.npc.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalPoint, createNpcDriver, ARRIVAL_WINDOW_MIN, NPC_DEFAULTS } from '../js/world/npc.js';
import { loadMap } from '../js/world/tilemap.js';
import { createEntities, createEntity, STROLL_MS } from '../js/world/entities.js';
import { createPathCache } from '../js/world/pathing.js';
import { makeRng } from '../js/core/rng.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';

// 10x6: a wall row with a gap, a causeway, a door warp on the west edge and an edge warp east
//    0123456789
//  0 GGGGGGGGGG
//  1 GGGGGGGGGG
//  2 HHHHGHHHHH   gap at (4,2)
//  3 GGGGGGGGGG
//  4 GGGGGGGEEG   causeway (7,4),(8,4)
//  5 GGGGGGGGGG
const def = {
  id: 'lane', name: 'Lane', kind: 'exterior', region: 't', w: 10, h: 6,
  ground: ['GGGGGGGGGG', 'GGGGGGGGGG', 'HHHHGHHHHH', 'GGGGGGGGGG', 'GGGGGGGEEG', 'GGGGGGGGGG'],
  entities: [], triggers: [], spawns: [],
  warps: [
    { x: 0, y: 3, to: { mapId: 'house', x: 1, y: 1 }, kind: 'door' },
    { x: 9, y: 0, h: 2, to: { mapId: 'east', x: 0, y: 0 }, kind: 'edge' },
  ],
  entry: { x: 1, y: 1 },
};
const map = loadMap(def, TILES, { legend: DEFAULT_LEGEND });

/** Runs the scene loop (tickAll then the driver) until `pred` or `maxTicks`. */
function run(drv, ents, ctx, maxTicks = 400, pred = (s) => s === 'arrived') {
  const seen = [];
  for (let i = 0; i < maxTicks; i++) {
    ents.tickAll(16);
    const s = drv.tick(16, ctx);
    seen.push(s);
    if (pred(s)) return seen;
  }
  return seen;
}

describe('arrivalPoint', () => {
  const pl = { mapId: 'lane', x: 2, y: 4, facing: 'left', pose: 'stand', since: 600 };

  it('spawns at the target once the arrival window has passed', () => {
    assert.deepEqual(arrivalPoint(pl, map, 600 + ARRIVAL_WINDOW_MIN), { x: 2, y: 4, facing: 'left', arriving: false });
  });

  it('spawns at the nearest door / edge cell within the window, facing the target', () => {
    assert.deepEqual(arrivalPoint(pl, map, 601), { x: 0, y: 3, facing: 'right', arriving: true }, 'door (0,3) is 3 away, the edge strip 10');
    const ne = { ...pl, x: 8, y: 0 };
    assert.deepEqual(arrivalPoint(ne, map, 600), { x: 9, y: 0, facing: 'left', arriving: true }, 'nearest cell of the edge strip');
  });

  it('handles the midnight wrap and placements on other maps', () => {
    const late = { ...pl, since: 1439 };
    assert.equal(arrivalPoint(late, map, 1).arriving, true);
    assert.equal(arrivalPoint(late, map, 3).arriving, false);
    assert.equal(arrivalPoint({ ...pl, mapId: 'elsewhere' }, map, 600), null);
    assert.equal(arrivalPoint({ ...pl, since: undefined }, map, 600).arriving, false, 'no since: at the target');
  });
});

describe('createNpcDriver: walking to a placement', () => {
  it('routes around a solid bench instead of permanently blocking a door approach', () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'odile', kind: 'npc', x: 2, y: 4 }));
    ents.add(createEntity({ id: 'bench', kind: 'prop', x: 3, y: 4 }));
    const drv = createNpcDriver(npc);
    drv.setPlacement({ mapId: 'lane', x: 5, y: 4, facing: 'left' });
    const seen = run(drv, ents, { map, ents, tideState: 'low', cache: createPathCache() });
    assert.equal(seen.at(-1), 'arrived');
    assert.deepEqual([npc.x, npc.y], [5, 4]);
  });
  it('walks through the wall gap to the target and reports arrived once, facing as placed', () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'wren', kind: 'npc', x: 1, y: 0 }));
    const drv = createNpcDriver(npc);
    drv.setPlacement({ mapId: 'lane', x: 6, y: 5, facing: 'up', pose: 'sit' });
    const ctx = { map, ents, tideState: 'low', cache: createPathCache() };
    const seen = run(drv, ents, ctx);
    assert.equal(seen.at(-1), 'arrived');
    assert.deepEqual([npc.x, npc.y, npc.facing, drv.pose], [6, 5, 'up', 'sit']);
    assert.equal(run(drv, ents, ctx, 20, () => false).every((s) => s === 'idle'), true, 'arrived is reported once');
  });

  it('is deterministic: two runs take the same tiles', () => {
    const trace = () => {
      const ents = createEntities(map);
      const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 0, y: 0 }));
      const drv = createNpcDriver(npc);
      drv.setPlacement({ mapId: 'lane', x: 9, y: 5 });
      const tiles = [];
      for (let i = 0; i < 300; i++) { ents.tickAll(16); drv.tick(16, { map, ents, tideState: 'low' }); tiles.push(`${npc.x},${npc.y}`); }
      return tiles.join(' ');
    };
    assert.equal(trace(), trace());
  });

  it('respects the tide: a causeway-only route is blocked at high water, re-planned when it falls', () => {
    // target (8,4) is itself causeway: unreachable at high tide
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 5, y: 4 }));
    const drv = createNpcDriver(npc);
    drv.setPlacement({ mapId: 'lane', x: 8, y: 4 });
    const high = { map, ents, tideState: 'high' };
    assert.deepEqual(run(drv, ents, high, 10, () => false).slice(0, 2), ['blocked', 'blocked']);
    assert.deepEqual([npc.x, npc.y], [5, 4]);
    const seen = run(drv, ents, { map, ents, tideState: 'low' }, 400);
    assert.equal(seen.at(-1), 'arrived');
    assert.deepEqual([npc.x, npc.y], [8, 4]);
  });

  it('caps catch-up: a long route jumps ahead and walks only the last catchUpTiles steps', () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 0, y: 0 }));
    const drv = createNpcDriver(npc, { tuning: { catchUpTiles: 3 } });
    drv.setPlacement({ mapId: 'lane', x: 9, y: 5 });
    let steps = 0;
    let lastX = npc.x, lastY = npc.y;
    for (let i = 0; i < 300; i++) {
      ents.tickAll(16);
      const s = drv.tick(16, { map, ents, tideState: 'low' });
      if (npc.moving && (npc.x !== lastX || npc.y !== lastY)) { steps++; lastX = npc.x; lastY = npc.y; }
      if (s === 'arrived') break;
    }
    assert.deepEqual([npc.x, npc.y], [9, 5]);
    assert.equal(steps, 3);
    assert.equal(NPC_DEFAULTS.catchUpTiles > 0, true);
  });

  it('waits for a player on its goal, then settles next to it facing the player', () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 3, y: 5 }));
    ents.add(createEntity({ id: 'player', kind: 'player', x: 5, y: 5 }));
    const drv = createNpcDriver(npc);
    drv.setPlacement({ mapId: 'lane', x: 5, y: 5, facing: 'down' });
    const seen = run(drv, ents, { map, ents, tideState: 'low' }, 400);
    assert.equal(seen.at(-1), 'arrived');
    assert.ok(seen.includes('blocked'));
    assert.deepEqual([npc.x, npc.y, npc.facing], [4, 5, 'right']);
  });

  it("reports 'offmap' for a placement elsewhere and 'idle' with none", () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 3, y: 5 }));
    const drv = createNpcDriver(npc);
    assert.equal(drv.tick(16, { map, ents, tideState: 'low' }), 'idle');
    drv.setPlacement({ mapId: 'house', x: 1, y: 1 });
    assert.equal(drv.tick(16, { map, ents, tideState: 'low' }), 'offmap');
    assert.equal(drv.goal().x, 1);
    drv.setPlacement(null);
    assert.equal(drv.goal(), null);
  });

  it('re-plans after being displaced mid-walk (cutscene teleport)', () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 0, y: 5 }));
    const drv = createNpcDriver(npc);
    drv.setPlacement({ mapId: 'lane', x: 9, y: 5 });
    const ctx = { map, ents, tideState: 'low' };
    for (let i = 0; i < 30; i++) { ents.tickAll(16); drv.tick(16, ctx); }
    ents.teleport(npc, 0, 0);
    const seen = run(drv, ents, ctx, 600);
    assert.equal(seen.at(-1), 'arrived');
    assert.deepEqual([npc.x, npc.y], [9, 5]);
  });
});

describe('createNpcDriver: poses', () => {
  it('wander stays within wanderR of the target and draws only from the given rng', () => {
    const go = (seed) => {
      const ents = createEntities(map);
      const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 5, y: 4 }));
      const drv = createNpcDriver(npc, { tuning: { pauseMin: 50, pauseMax: 100 } });
      drv.setPlacement({ mapId: 'lane', x: 5, y: 4, pose: 'wander', wanderR: 1 });
      const rng = makeRng(seed);
      const tiles = new Set();
      let arrived = 0;
      for (let i = 0; i < 2000; i++) {
        ents.tickAll(16);
        if (drv.tick(16, { map, ents, tideState: 'low', rng }) === 'arrived') arrived++;
        tiles.add(`${npc.x},${npc.y}`);
        assert.ok(Math.abs(npc.x - 5) + Math.abs(npc.y - 4) <= 1, `${npc.x},${npc.y}`);
      }
      return { tiles: [...tiles].sort().join(' '), arrived };
    };
    const a = go(3);
    assert.ok(a.tiles.split(' ').length > 1, 'it moves');
    assert.equal(a.arrived, 1, 'arrived reported once per placement');
    assert.deepEqual(go(3), a, 'same seed, same wander');
  });

  it('path pose loops the caller-resolved route', () => {
    const ents = createEntities(map);
    const npc = ents.add(createEntity({ id: 'n', kind: 'npc', x: 1, y: 4 }));
    const drv = createNpcDriver(npc);
    drv.setPlacement({ mapId: 'lane', x: 1, y: 4, pose: 'path', pathId: 'sweep' });
    const route = [{ x: 3, y: 4 }, { x: 3, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 4 }];
    const visited = [];
    for (let i = 0; i < 1500; i++) {
      ents.tickAll(16);
      drv.tick(16, { map, ents, tideState: 'low', route });
      const k = `${npc.x},${npc.y}`;
      if (!npc.moving && route.some((p) => `${p.x},${p.y}` === k) && visited.at(-1) !== k) visited.push(k);
    }
    assert.deepEqual(visited.slice(0, 5), ['1,4', '3,4', '3,5', '1,5', '1,4']);
    assert.equal(drv.pose, 'path');
    assert.ok(STROLL_MS > 0);
  });
});
