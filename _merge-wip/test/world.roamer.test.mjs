// Unit tests for js/world/roamer.js. Run: node --test test/world.roamer.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  spawn, tickRoamer, shouldDespawn, applyStep, despawn, toEntity, toEncounter, createRoamerField, touching,
  rowCondHolds, eligibleRows, rollRow, rollLevel, tuningValue, ROAMER_DEFAULTS,
} from '../js/world/roamer.js';
import { createEntities, DIRS } from '../js/world/entities.js';
import { makeRng } from '../js/core/rng.js';
import { buildRuntimeMap, ENCOUNTERS, MAP_DEF } from './fixtures/worldEnt.mjs';

const map = buildRuntimeMap();
const grass = ENCOUNTERS['test-grass'];
const grassSpawn = MAP_DEF.spawns[0];
const flatsSpawn = MAP_DEF.spawns[1];
const base = { tableId: 'test-grass', spawnDef: grassSpawn, phase: 'midday', weather: 'clear', player: { x: 0, y: 0 } };

describe('rows', () => {
  it('rowCondHolds evaluates phase / tide / weather / lowTide locally and defers the rest', () => {
    assert.ok(rowCondHolds(undefined, {}));
    assert.ok(rowCondHolds({ phase: ['night'] }, { phase: 'night' }));
    assert.ok(!rowCondHolds({ phase: ['night'] }, { phase: 'midday' }));
    assert.ok(rowCondHolds({ tide: ['low'], weather: ['storm'] }, { tideState: 'low', weather: 'storm' }));
    assert.ok(!rowCondHolds({ tide: ['low'], weather: ['storm'] }, { tideState: 'low', weather: 'clear' }));
    assert.ok(rowCondHolds({ lowTide: false }, { tideState: 'high' }));
    assert.ok(!rowCondHolds({ flag: 'sp.x' }, {}), 'unknown key with no evaluator fails closed');
    assert.ok(rowCondHolds({ flag: 'sp.x', phase: ['dawn'] }, { phase: 'dawn', evalCond: () => true }));
    assert.ok(!rowCondHolds({ flag: 'sp.x', phase: ['dawn'] }, { phase: 'dusk', evalCond: () => true }));
  });

  it('eligibleRows, rollRow and rollLevel', () => {
    assert.deepEqual(eligibleRows(grass, { phase: 'midday', weather: 'clear' }).map((r) => r.species), ['puddlepip', 'wirewhisk']);
    assert.deepEqual(eligibleRows(grass, { phase: 'night', weather: 'storm' }).map((r) => r.species), ['puddlepip', 'wirewhisk', 'chillnub', 'squallcoil']);
    assert.equal(rollRow(makeRng(1), []), null);
    assert.equal(rollRow(makeRng(1), [{ species: 'z', levels: [1, 1], w: 0 }]), null);
    const counts = { puddlepip: 0, wirewhisk: 0 };
    const rng = makeRng('rows');
    const rows = eligibleRows(grass, { phase: 'midday', weather: 'clear' });
    for (let i = 0; i < 2000; i++) counts[rollRow(rng, rows).species]++;
    assert.ok(counts.puddlepip > counts.wirewhisk * 1.3, `weights respected: ${JSON.stringify(counts)}`);
    assert.equal(rollLevel(makeRng(1), { levels: [30, 30] }), 30);
    const l = rollLevel(makeRng(2), { levels: [2, 4] });
    assert.ok(l >= 2 && l <= 4);
    assert.equal(tuningValue(undefined, 'cap'), 8);
    assert.equal(tuningValue({ cap: 3 }, 'cap'), 3);
    assert.equal(tuningValue({ cap: 3 }, 'leash'), ROAMER_DEFAULTS.leash);
  });
});

describe('spawn', () => {
  it('is deterministic for a seeded rng and differs across seeds', () => {
    const a = spawn(makeRng('seed-a'), grass, map, 'low', base);
    const b = spawn(makeRng('seed-a'), grass, map, 'low', base);
    assert.ok(a);
    assert.deepEqual(a, b);
    const traces = new Set();
    for (const s of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      const r = spawn(makeRng(s), grass, map, 'low', base);
      traces.add(`${r.speciesId}:${r.level}:${r.x},${r.y}:${r.facing}:${r.waitMs}`);
    }
    assert.ok(traces.size >= 3, 'different seeds give different roamers');
  });

  it('places roamers on passable tiles of the spawn area, away from the player and off occupied tiles', () => {
    const rng = makeRng('place');
    for (let i = 0; i < 40; i++) {
      const r = spawn(rng, grass, map, 'low', { ...base, player: { x: 6, y: 5 }, seq: i });
      if (!r) continue;
      assert.equal(map.spawnAt(r.x, r.y), grassSpawn, `(${r.x},${r.y}) is a grass spawn tile`);
      assert.ok(map.passable(r.x, r.y, 'low', 'roamer'));
      assert.ok(Math.abs(r.x - 6) + Math.abs(r.y - 5) >= ROAMER_DEFAULTS.minPlayerDist);
      assert.equal(r.id, `roamer:test-grass:${i}`);
      assert.deepEqual([r.homeX, r.homeY, r.state, r.ageMs, r.despawnReason], [r.x, r.y, 'idle', 0, null]);
    }
    const occupied = () => true;
    assert.equal(spawn(makeRng('x'), grass, map, 'low', { ...base, occupied }), null);
  });

  it('respects rect areas and tide-conditioned rows; returns null when no row qualifies', () => {
    const flats = ENCOUNTERS['test-flats'];
    const o = { tableId: 'test-flats', spawnDef: flatsSpawn, phase: 'midday', weather: 'clear', player: null };
    assert.equal(spawn(makeRng(1), flats, map, 'high', o), null, 'mudlurk needs low tide');
    const r = spawn(makeRng(1), flats, map, 'low', o);
    assert.ok(r);
    assert.ok(r.x >= 9 && r.x <= 11 && r.y >= 6 && r.y <= 7, 'inside the rect');
    assert.equal(r.speciesId, 'mudlurk');
    assert.equal(r.behaviour, 'flee');
    const w = spawn(makeRng(7), [{ species: 'wirewhisk', levels: [3, 5], w: 1, behaviour: 'approach', catchable: true, fleeR: 9, ttlMs: 5 }], map, 'low', base);
    assert.deepEqual([w.behaviour, w.catchable, w.fleeR, w.ttlMs, w.approachR], ['approach', true, 9, 5, ROAMER_DEFAULTS.approachR]);
  });

  it('works with the bare (rng, table, map, tideState) signature', () => {
    const a = spawn(makeRng(42), ENCOUNTERS['test-flats'], map, 'low');
    const b = spawn(makeRng(42), ENCOUNTERS['test-flats'], map, 'low');
    assert.ok(a);
    assert.deepEqual(a, b, 'same seed, same roamer');
    assert.equal(a.id, 'roamer:roamer:0');
    assert.equal(a.tableId, 'roamer');
    assert.ok(map.passable(a.x, a.y, 'low', 'roamer'));
  });

  it('a seeded field spawns the same sequence of roamers every run', () => {
    const run = () => {
      const field = createRoamerField({ cap: 8 });
      const rng = makeRng('field-seq');
      const out = [];
      for (let i = 0; i < 8; i++) {
        const r = field.spawn(rng, grass, map, 'low', base);
        out.push(r && `${r.id}:${r.speciesId}:${r.level}:${r.x},${r.y}:${r.facing}:${r.waitMs}`);
      }
      return out;
    };
    const a = run();
    assert.deepEqual(run(), a);
    assert.ok(a.filter(Boolean).length >= 6, 'most attempts place a roamer');
  });

  it('toEntity and toEncounter expose the shapes other lanes read', () => {
    const r = spawn(makeRng('e'), grass, map, 'low', base);
    const e = toEntity(r);
    assert.deepEqual([e.id, e.kind, e.x, e.y, e.facing, e.speciesId, e.artId, e.def.catchable], [r.id, 'roamer', r.x, r.y, r.facing, r.speciesId, r.speciesId, false]);
    assert.deepEqual(toEncounter(r), { speciesId: r.speciesId, level: r.level, errant: false, tableId: 'test-grass' });
  });
});

describe('tick', () => {
  const ctxFor = (player, extra = {}) => ({ player, passable: map.passable, tideState: 'low', ...extra });

  it('wanders inside its leash, deterministically, and never asks for an impassable step', () => {
    const r = spawn(makeRng('w'), grass, map, 'low', { ...base, player: null });
    const rng = makeRng('wander');
    const ctx = ctxFor(null);
    const trace = [];
    for (let i = 0; i < 3000; i++) {
      const d = tickRoamer(r, rng, 16, ctx);
      if (d) {
        const di = DIRS.indexOf(d);
        assert.ok(map.passable(r.x + [0, 1, 0, -1][di], r.y + [-1, 0, 1, 0][di], 'low', 'roamer'));
        applyStep(r, d);
        assert.ok(Math.abs(r.x - r.homeX) + Math.abs(r.y - r.homeY) <= r.leash, 'within leash');
        trace.push(`${d}@${i}`);
      }
    }
    assert.ok(trace.length > 5, `wandered ${trace.length} times`);
    const r2 = spawn(makeRng('w'), grass, map, 'low', { ...base, player: null });
    const rng2 = makeRng('wander');
    const trace2 = [];
    for (let i = 0; i < 3000; i++) { const d = tickRoamer(r2, rng2, 16, ctx); if (d) { applyStep(r2, d); trace2.push(`${d}@${i}`); } }
    assert.deepEqual(trace2, trace);
  });

  it('flees from a player inside fleeR and approaches when told to', () => {
    const r = { ...spawn(makeRng('f'), grass, map, 'low', { ...base, player: null }), x: 8, y: 4, homeX: 8, homeY: 4, waitMs: 0, behaviour: 'flee', fleeR: 3 };
    const d = tickRoamer(r, makeRng(0), 16, ctxFor({ x: 7, y: 4 }));
    assert.equal(d, 'right', 'away from the player');
    assert.equal(r.state, 'flee');
    applyStep(r, d);
    assert.deepEqual([r.x, r.y, r.facing], [9, 4, 'right']);
    r.waitMs = 0;
    assert.equal(tickRoamer(r, makeRng(0), 16, ctxFor({ x: 0, y: 0 })), null, 'out of range: back to wander/pause (no draw-forced step)');
    const a = { ...r, x: 8, y: 4, behaviour: 'approach', approachR: 4, waitMs: 0 };
    assert.equal(tickRoamer(a, makeRng(0), 16, ctxFor({ x: 10, y: 4 })), 'right');
    applyStep(a, 'right'); a.waitMs = 0;
    assert.equal(tickRoamer(a, makeRng(0), 16, ctxFor({ x: 10, y: 4 })), null, 'adjacent: stops and faces');
    assert.equal(a.facing, 'right');
    const still = { ...r, behaviour: 'still', waitMs: 0 };
    assert.equal(tickRoamer(still, makeRng(0), 16, ctxFor({ x: 9, y: 4 })), null);
  });

  it('cornered roamers stay put and avoid occupied tiles', () => {
    const r = { ...spawn(makeRng('c'), grass, map, 'low', { ...base, player: null }), x: 11, y: 0, waitMs: 0, behaviour: 'flee', fleeR: 5 };
    assert.equal(tickRoamer(r, makeRng(0), 16, ctxFor({ x: 10, y: 0 }, { occupied: (x, y) => x === 11 && y === 1 })), null);
    assert.equal(r.facing, 'left', 'faces the player when it cannot run');
  });

  it('shouldDespawn: ttl, far, flooded', () => {
    const r = spawn(makeRng('d'), ENCOUNTERS['test-flats'], map, 'low', { tableId: 'test-flats', spawnDef: flatsSpawn, phase: 'midday', weather: 'clear', player: null });
    assert.equal(shouldDespawn(r, ctxFor({ x: r.x, y: r.y })), null);
    assert.equal(shouldDespawn(r, ctxFor({ x: r.x, y: r.y }, { tideState: 'high' })), 'flooded');
    assert.equal(shouldDespawn(r, ctxFor({ x: r.x - 30, y: r.y })), 'far');
    assert.equal(shouldDespawn(r, ctxFor({ x: r.x - 30, y: r.y }, { tuning: { despawnR: 99 } })), null);
    r.ageMs = r.ttlMs;
    assert.equal(shouldDespawn(r, ctxFor(null)), 'ttl');
    despawn(r, 'caught');
    assert.deepEqual([r.state, r.despawnReason], ['gone', 'caught']);
    assert.equal(tickRoamer(r, makeRng(0), 16, ctxFor(null)), null);
  });
});

describe('touching', () => {
  it('a roamer touches its own tile and the four orthogonal neighbours, never once gone', () => {
    const r = { ...spawn(makeRng('t'), grass, map, 'low', { ...base, player: null }), x: 8, y: 4 };
    assert.ok(touching(r, 8, 4) && touching(r, 9, 4) && touching(r, 8, 3));
    assert.ok(!touching(r, 9, 5), 'diagonal does not touch');
    assert.ok(!touching(r, 10, 4));
    const field = createRoamerField();
    const f = field.spawn(makeRng('t2'), grass, map, 'low', { ...base, player: null });
    assert.equal(field.touchingAt(f.x + 1, f.y), f);
    assert.equal(field.touchingAt(f.x + 3, f.y), null);
    despawn(r, 'caught');
    assert.ok(!touching(r, 8, 4));
  });
});

describe('field', () => {
  it('caps spawns, numbers them, ticks through tryStep and removes despawned roamers', () => {
    const field = createRoamerField({ cap: 3, spawnEveryMs: 1000 });
    const rng = makeRng('field');
    const ents = createEntities(map);
    const o = { ...base, player: { x: 0, y: 7 }, occupied: (x, y) => ents.solidAt(x, y) };
    for (let i = 0; i < 6; i++) {
      const r = field.spawn(rng, grass, map, 'low', o);
      if (r) ents.add(toEntity(r));
    }
    assert.equal(field.list.length, 3);
    assert.deepEqual(field.list.map((r) => r.id), ['roamer:test-grass:0', 'roamer:test-grass:1', 'roamer:test-grass:2']);
    assert.ok(!field.spawnDue(999)); assert.ok(field.spawnDue(1)); assert.ok(!field.spawnDue(0));

    const moveCtx = { map, tideState: 'low' };
    const ctx = {
      player: { x: 0, y: 7 }, passable: map.passable, tideState: 'low',
      occupied: (x, y) => ents.solidAt(x, y),
      tryStep: (r, d) => { const e = ents.find(r.id); const ok = ents.tryMove(e, d, moveCtx); if (ok) ents.tickMovement(e, 1000); return ok; },
    };
    let steps = 0;
    const first = field.tick(rng, 16, ctx);
    for (let i = 0; i < 2000; i++) {
      const res = field.tick(rng, 16, ctx);
      assert.equal(res, first, 'reused result record');
      steps += res.stepped.length;
      for (const r of res.stepped) { const e = ents.find(r.id); assert.deepEqual([e.x, e.y], [r.x, r.y], 'roamer mirrors its entity'); }
      for (const r of res.despawned) ents.remove(r.id);
    }
    assert.ok(steps > 0);
    const tiles = new Set(field.list.map((r) => `${r.x},${r.y}`));
    assert.equal(tiles.size, field.list.length, 'no two roamers share a tile');
    assert.equal(field.find(field.list[0].id), field.list[0]);
    const gone = field.remove(field.list[0].id);
    assert.deepEqual([gone.state, gone.despawnReason, field.list.length], ['gone', 'manual', 2]);
    assert.equal(field.remove('nope'), null);
    field.list[0].ageMs = 1e9;
    const res = field.tick(rng, 16, ctx);
    assert.equal(res.despawned.length, 1); assert.equal(res.despawned[0].despawnReason, 'ttl');
    assert.equal(field.list.length, 1);
    field.clear();
    assert.equal(field.list.length, 0);
  });
});
