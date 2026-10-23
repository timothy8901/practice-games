// Unit tests for js/world/entities.js. Run: node --test test/world.entities.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEntities, createEntity, entityFromDef, updatePixels, dirTo,
  DIRS, DIR_INDEX, DX, DY, OPPOSITE, WALK_MS, RUN_MS, STROLL_MS, MOVER_OF_KIND, ENTITY_CAPACITY,
} from '../js/world/entities.js';
import { TILE } from '../js/config.js';
import { buildRuntimeMap, createWorldStub, createDataStub, MAP_DEF } from './fixtures/worldEnt.mjs';

const map = buildRuntimeMap();
const ctx = (tideState = 'low', run = false) => ({ map, tideState, run });
const data = createDataStub();

describe('constants and helpers', () => {
  it('direction tables agree', () => {
    for (let i = 0; i < 4; i++) {
      assert.equal(DIR_INDEX[DIRS[i]], i);
      const o = DIR_INDEX[OPPOSITE[DIRS[i]]];
      assert.equal(DX[i] + DX[o], 0); assert.equal(DY[i] + DY[o], 0);
    }
    assert.equal(dirTo(0, 0), null);
    assert.equal(dirTo(2, -1), 'right'); assert.equal(dirTo(1, 1), 'down'); assert.equal(dirTo(-3, 0), 'left'); assert.equal(dirTo(0, -5), 'up');
    assert.ok(RUN_MS < WALK_MS && WALK_MS < STROLL_MS);
    assert.equal(MOVER_OF_KIND.boat, 'boat');
  });

  it('createEntity fills every field and validates', () => {
    const e = createEntity({ id: 'a', kind: 'npc', x: 2, y: 3 });
    assert.deepEqual(Object.keys(e).sort(), ['artId', 'def', 'emote', 'facing', 'frame', 'fromX', 'fromY', 'id', 'itemId', 'kind', 'moving', 'npcId', 'path', 'px', 'py', 'slot', 'solid', 'speciesId', 'speedMs', 'spill', 't', 'x', 'y', 'z'].sort());
    assert.equal(e.px, 2 * TILE); assert.equal(e.py, 3 * TILE);
    assert.equal(e.speedMs, STROLL_MS);
    assert.equal(createEntity({ id: 'p', kind: 'player', x: 0, y: 0 }).speedMs, WALK_MS);
    for (const v of Object.values(e)) assert.notEqual(v, undefined);
    assert.throws(() => createEntity({ id: '', kind: 'npc', x: 0, y: 0 }), TypeError);
    assert.throws(() => createEntity({ id: 'x', kind: 'dragon', x: 0, y: 0 }), TypeError);
    assert.throws(() => createEntity({ id: 'x', kind: 'npc', x: 0.5, y: 0 }), TypeError);
    assert.throws(() => createEntity({ id: 'x', kind: 'npc', x: 0, y: 0, facing: 'north' }), TypeError);
  });

  it('entityFromDef maps def fields', () => {
    const e = entityFromDef({ kind: 'item', id: 'i1', item: 'potion', x: 1, y: 1, art: 'potion-sprite' });
    assert.equal(e.itemId, 'potion'); assert.equal(e.artId, 'potion-sprite'); assert.equal(e.def.id, 'i1');
    const n = entityFromDef({ kind: 'npc', id: 'wren', x: 1, y: 1 });
    assert.equal(n.npcId, 'wren'); assert.equal(n.artId, 'npc:wren');
  });
});

describe('spatial index', () => {
  it('add / find / at / near / remove keep the grid consistent', () => {
    const ents = createEntities(map);
    const a = ents.add(createEntity({ id: 'a', kind: 'npc', x: 1, y: 4 }));
    const b = ents.add(createEntity({ id: 'b', kind: 'sign', x: 3, y: 4 }));
    const c = ents.add(createEntity({ id: 'c', kind: 'prop', x: 1, y: 4, solid: false }));
    assert.equal(ents.find('a'), a); assert.equal(ents.find('zz'), null);
    assert.equal(ents.at(1, 4), a, 'solid wins the tile');
    assert.equal(ents.at(3, 4), b);
    assert.equal(ents.at(9, 9), null); assert.equal(ents.at(-1, 0), null);
    assert.ok(ents.solidAt(1, 4)); assert.ok(!ents.solidAt(2, 4));
    const n = ents.near(2, 4, 1);
    assert.deepEqual(n.map((e) => e.id).sort(), ['a', 'b', 'c']);
    assert.equal(ents.near(2, 4, 1), n, 'near() reuses its buffer');
    assert.equal(ents.near(10, 0, 1).length, 0);
    assert.ok(ents.remove('a'));
    assert.ok(!ents.remove('a'));
    assert.equal(ents.at(1, 4), c, 'non-solid left behind');
    assert.ok(!ents.solidAt(1, 4));
    assert.equal(ents.list.length, 2);
    ents.clear();
    assert.equal(ents.list.length, 0);
    assert.equal(ents.at(3, 4), null);
  });

  it('rejects duplicates, out-of-bounds and a full table; reuses slots', () => {
    const ents = createEntities(map, { capacity: 2 });
    ents.add(createEntity({ id: 'a', kind: 'npc', x: 1, y: 4 }));
    assert.throws(() => ents.add(createEntity({ id: 'a', kind: 'npc', x: 2, y: 4 })), /duplicate/);
    assert.throws(() => ents.add(createEntity({ id: 'o', kind: 'npc', x: 50, y: 4 })), RangeError);
    ents.add(createEntity({ id: 'b', kind: 'npc', x: 2, y: 4 }));
    assert.throws(() => ents.add(createEntity({ id: 'c', kind: 'npc', x: 3, y: 4 })), /full/);
    ents.remove('a');
    ents.add(createEntity({ id: 'c', kind: 'npc', x: 3, y: 4 }));
    assert.equal(ents.at(3, 4).id, 'c');
    assert.throws(() => createEntities({ w: 0, h: 1 }), RangeError);
    assert.equal(ENTITY_CAPACITY, 256);
  });
});

describe('movement', () => {
  it('tryMove faces, checks passability and starts a step', () => {
    const ents = createEntities(map);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 1, y: 1 }));
    assert.ok(!ents.tryMove(p, 'up', ctx()), 'wall at (1,0)');
    assert.equal(p.facing, 'up'); assert.ok(!p.moving);
    assert.ok(ents.tryMove(p, 'down', ctx()));
    assert.deepEqual([p.x, p.y, p.fromX, p.fromY, p.t, p.moving, p.facing], [1, 2, 1, 1, 0, true, 'down']);
    assert.equal(ents.at(1, 2), p, 'target tile reserved at step start');
    assert.equal(ents.at(1, 1), null);
  });

  it('two entities cannot share a tile', () => {
    const ents = createEntities(map);
    const a = ents.add(createEntity({ id: 'a', kind: 'npc', x: 1, y: 4 }));
    const b = ents.add(createEntity({ id: 'b', kind: 'npc', x: 3, y: 4 }));
    assert.ok(ents.tryMove(a, 'right', ctx()));           // a reserves (2,4)
    assert.equal(a.x, 2); assert.ok(a.moving); assert.equal(a.fromX, 1);
    assert.ok(!ents.tryMove(b, 'left', ctx()), 'b cannot enter the tile a is moving into');
    assert.equal(b.facing, 'left', 'blocked moves still turn');
    assert.equal(b.x, 3);
    assert.ok(ents.at(1, 4) === null, 'the tile a left is free at once');
    assert.ok(!ents.tryMove(a, 'right', ctx()), 'no second step while moving');
    // finish a's step, then b may not enter (2,4) but a third entity may enter (1,4)
    assert.equal(ents.tickMovement(a, STROLL_MS), 'arrived');
    assert.ok(!ents.tryMove(b, 'left', ctx()));
    const c = ents.add(createEntity({ id: 'c', kind: 'npc', x: 0, y: 4 }));
    assert.ok(ents.tryMove(c, 'right', ctx()));
    assert.ok(!ents.solidAt(0, 4) && ents.solidAt(1, 4) && ents.solidAt(2, 4) && ents.solidAt(3, 4));
  });

  it('interpolates sub-tile progress in whole pixels and reports spill', () => {
    const ents = createEntities(map);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 1, y: 4 }));
    assert.ok(ents.tryMove(p, 'right', ctx('low', true)));
    assert.equal(p.speedMs, RUN_MS);
    assert.equal(ents.tickMovement(p, 25), 'moving');
    assert.equal(p.t, 0.25);
    assert.equal(p.px, Math.round(1.25 * TILE)); assert.equal(p.py, 4 * TILE);
    assert.ok(Number.isInteger(p.px));
    assert.equal(ents.tickMovement(p, 80), 'arrived');
    assert.equal(p.t, 1); assert.ok(!p.moving); assert.equal(p.fromX, 2);
    assert.ok(Math.abs(p.spill - 5) < 1e-9);
    assert.equal(p.px, 2 * TILE);
    assert.equal(ents.tickMovement(p, 16), 'idle');
    assert.ok(ents.tryMove(p, 'right', ctx('low', false)));
    assert.equal(p.speedMs, WALK_MS);
    assert.ok(ents.tryMove(ents.add(createEntity({ id: 'n', kind: 'npc', x: 1, y: 5 })), 'right', { map, tideState: 'low', speedMs: 50 }));
    assert.equal(ents.find('n').speedMs, 50);
  });

  it('tide gates the causeway and boats stay on water', () => {
    const ents = createEntities(map);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 4, y: 3 }));
    assert.ok(!ents.tryMove(p, 'right', ctx('high')));
    assert.ok(ents.tryMove(p, 'right', ctx('low')));
    const boat = ents.add(createEntity({ id: 'boat', kind: 'boat', x: 5, y: 5 }));
    assert.ok(!ents.tryMove(boat, 'left', ctx('high')));
    assert.ok(ents.tryMove(boat, 'down', ctx('high')));
    const e = ents.add(createEntity({ id: 'e', kind: 'npc', x: 0, y: 4 }));
    assert.ok(!ents.tryMove(e, 'down', { passable: () => false, tideState: 'low' }), 'passable override');
    assert.throws(() => ents.tryMove(e, 'north', ctx()), TypeError);
    assert.throws(() => ents.tryMove(e, 'up', { tideState: 'low' }), TypeError);
    assert.throws(() => ents.tryMove(createEntity({ id: 'x', kind: 'npc', x: 0, y: 4 }), 'up', ctx()), /not managed/);
    assert.ok(!ents.tryMove(e, 'left', ctx()), 'map edge');
  });

  it('teleport moves instantly and keeps the grid right', () => {
    const ents = createEntities(map);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 1, y: 4 }));
    ents.tryMove(p, 'right', ctx());
    ents.teleport(p, 10, 2, 'left');
    assert.equal(ents.at(2, 4), null); assert.equal(ents.at(10, 2), p);
    assert.ok(!p.moving); assert.equal(p.facing, 'left'); assert.equal(p.px, 10 * TILE);
    assert.throws(() => ents.teleport(p, 99, 0), RangeError);
  });

  it('updatePixels rounds', () => {
    const e = createEntity({ id: 'e', kind: 'npc', x: 1, y: 0 });
    e.fromX = 0; e.t = 1 / 3; updatePixels(e);
    assert.equal(e.px, Math.round(TILE / 3));
  });
});

describe('tickAll', () => {
  it('advances every moving entity and returns the arrivals in a reused array', () => {
    const ents = createEntities(map);
    const a = ents.add(createEntity({ id: 'a', kind: 'npc', x: 1, y: 4, speedMs: 100 }));
    const b = ents.add(createEntity({ id: 'b', kind: 'npc', x: 1, y: 6, speedMs: 200 }));
    ents.add(createEntity({ id: 'c', kind: 'sign', x: 3, y: 6 }));
    ents.tryMove(a, 'right', { map, tideState: 'low', speedMs: 100 });
    ents.tryMove(b, 'right', { map, tideState: 'low', speedMs: 200 });
    const first = ents.tickAll(100);
    assert.deepEqual(first.map((e) => e.id), ['a']);
    assert.equal(b.t, 0.5);
    const second = ents.tickAll(100);
    assert.equal(second, first, 'reused');
    assert.deepEqual(second.map((e) => e.id), ['b']);
    assert.equal(ents.tickAll(100).length, 0);
  });
});

describe('ySorted', () => {
  it('orders by py + z, stable by slot, and reuses the buffer', () => {
    const ents = createEntities(map);
    const a = ents.add(createEntity({ id: 'a', kind: 'npc', x: 1, y: 6 }));
    const b = ents.add(createEntity({ id: 'b', kind: 'npc', x: 2, y: 4 }));
    const c = ents.add(createEntity({ id: 'c', kind: 'prop', x: 3, y: 4, z: 1 }));
    const d = ents.add(createEntity({ id: 'd', kind: 'sign', x: 4, y: 4 }));
    const s1 = ents.ySorted();
    assert.deepEqual(s1.map((e) => e.id), ['b', 'd', 'c', 'a']);
    ents.tryMove(b, 'down', ctx()); ents.tickMovement(b, STROLL_MS);
    const s2 = ents.ySorted();
    assert.equal(s2, s1, 'reused array');
    assert.deepEqual(s2.map((e) => e.id), ['d', 'c', 'b', 'a']);
    ents.remove('a');
    ents.add(createEntity({ id: 'e', kind: 'npc', x: 1, y: 0 }));
    assert.deepEqual(ents.ySorted().map((e) => e.id), ['e', 'd', 'c', 'b']);
  });

  it('refreshes membership when an entity is removed and re-added between frames', () => {
    const ents = createEntities(map);
    const a = ents.add(createEntity({ id: 'a', kind: 'npc', x: 1, y: 6 }));
    ents.add(createEntity({ id: 'b', kind: 'npc', x: 2, y: 4 }));
    ents.ySorted();
    ents.remove('a');
    const a2 = createEntity({ id: 'a', kind: 'npc', x: 3, y: 1 });
    ents.add(a2);
    const s = ents.ySorted();
    assert.ok(s.includes(a2) && !s.includes(a), 'the stale record is gone');
    assert.deepEqual(s.map((e) => e.id), ['a', 'b']);
  });
});

describe('rebuildFromDefs', () => {
  it('spawns eligible defs, skips picked items / opened cracks / failed conds, keeps dynamic entities', () => {
    const ents = createEntities(map);
    const player = ents.add(createEntity({ id: 'player', kind: 'player', x: 2, y: 4 }));
    const world = createWorldStub();
    const evalCond = (w, cond) => Boolean(w.flags[cond.flag]);
    let r = ents.rebuildFromDefs(world, data, 'low', { evalCond });
    assert.deepEqual(r.added.sort(), ['crack-1', 'isle-sign', 'pear-1', 'quay-potion', 'wren']);
    assert.deepEqual(r.removed, []); assert.deepEqual(r.skipped, []);
    assert.equal(ents.find('ghost'), null, 'cond false');
    assert.equal(ents.find('player'), player);

    world.maps[MAP_DEF.id].picked['quay-potion'] = 3;
    world.maps[MAP_DEF.id].cracks['crack-1'] = true;
    world.flags['sp.ghost'] = true;
    const wren = ents.find('wren');
    ents.tryMove(wren, 'down', ctx()); ents.tickMovement(wren, STROLL_MS);
    r = ents.rebuildFromDefs(world, data, 'low', { evalCond });
    assert.deepEqual(r.added, ['ghost']);
    assert.deepEqual(r.removed.sort(), ['crack-1', 'quay-potion']);
    assert.equal(ents.find('wren'), wren, 'existing entity kept');
    assert.equal(wren.y, 6, 'and not reset to its def tile');
    assert.equal(ents.list.length, 5);
  });

  it('places NPCs through placeNpc and skips occupied or off-map placements', () => {
    const ents = createEntities(map);
    ents.add(createEntity({ id: 'player', kind: 'player', x: 3, y: 6 }));
    const world = createWorldStub();
    const r = ents.rebuildFromDefs(world, data, 'low', {
      evalCond: () => true,
      placeNpc: (id) => (id === 'wren' ? { x: 7, y: 2, facing: 'left' } : null),
    });
    assert.ok(r.added.includes('wren') && !r.added.includes('ghost'));
    assert.deepEqual(r.skipped, ['isle-sign'], 'sign tile is under the player');
    const wren = ents.find('wren');
    assert.deepEqual([wren.x, wren.y, wren.facing], [7, 2, 'left']);
    assert.equal(ents.rebuildFromDefs(world, data, 'low', { placeNpc: () => null }).removed.includes('wren'), true);
  });

  it('never removes dynamic entities: the player, roamers (def.dynamic) and ids not in the map defs', () => {
    const ents = createEntities(map);
    ents.add(createEntity({ id: 'player', kind: 'player', x: 2, y: 4 }));
    ents.add(createEntity({ id: 'roamer:test-grass:0', kind: 'roamer', x: 8, y: 2, def: { kind: 'roamer', id: 'roamer:test-grass:0', dynamic: true } }));
    ents.add(createEntity({ id: 'cutscene-gull', kind: 'prop', x: 7, y: 5, def: { kind: 'prop', id: 'cutscene-gull' } }));
    const world = createWorldStub();
    ents.rebuildFromDefs(world, data, 'low', { evalCond: () => true });
    const r = ents.rebuildFromDefs(world, data, 'low', { evalCond: () => false });
    assert.deepEqual(r.removed, ['ghost']);
    for (const id of ['player', 'roamer:test-grass:0', 'cutscene-gull']) assert.ok(ents.find(id), `${id} kept`);
  });

  it('defaults: conds go through the condition DSL (script/cond) when no evaluator is given', () => {
    const ents = createEntities(map);
    const world = createWorldStub();
    let r = ents.rebuildFromDefs(world, data, 'low');
    assert.ok(!r.added.includes('ghost'), 'sp.ghost unset: the ghost stays away');
    world.flags['sp.ghost'] = true;
    r = ents.rebuildFromDefs(world, data, 'low');
    assert.deepEqual(r.added, ['ghost']);
  });
});
