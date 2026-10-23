// Unit tests for js/systems/encounter.js. Run: node --test test/encounter.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/systems/encounter.js';
import { makeRng } from '../js/core/rng.js';
import { createRegistry } from '../js/data/registry.js';
import { spawn as spawnRoamer } from '../js/world/roamer.js';
import { validateWorld } from '../js/state/schema.js';
import { DATA, TOWN, ISLE, ISLE2, POINT, HOUSE, makeWorld, at, recordingBus } from './fixtures/gatherLane.fixture.mjs';

const DAY = at(1, 12);
const NIGHT = at(1, 23);
const NOFLOOR = { encounterMinSteps: 0 };
const ctxAt = (x, y, extra = {}) => ({ data: DATA, x, y, total: DAY, tideState: 'rising', ...extra });

/** Rolls until an encounter (or gives up), with no step floor. */
function rollUntil(w, map, rng, ctx, max = 1000) {
  for (let i = 0; i < max; i++) {
    const r = E.rollStep(w, map, rng, { ...ctx, tuning: { ...NOFLOOR, ...(ctx.tuning ?? {}) } });
    if (r) return r;
  }
  return null;
}

describe('tuning and labels', () => {
  it('defaults carry the GDD-00 numbers', () => {
    const d = E.DEFAULTS;
    assert.equal(d.encounterNightLevelBonus, 2);
    assert.equal(d.errantRouteChance, 1 / 300);
    assert.equal(d.errantLitChance, 1 / 120);
    assert.equal(d.errantRoamMinutes, 60);
    assert.equal(d.errantReturnNextDay, true);
    assert.equal(d.errantReturnPlayMs, 7_200_000);
    assert.equal(d.encounterRateDefault, 0.08);
    assert.deepEqual(E.TUNING_KEYS, Object.keys(d));
    assert.equal(E.streamLabel('isle-map'), 'encounter:isle-map');
  });
  it('rejects malformed overrides', () => {
    assert.throws(() => E.tuningOf({ errantRouteChance: 2 }), /errantRouteChance/);
    assert.throws(() => E.tuningOf({ errantReturnNextDay: 'yes' }), /errantReturnNextDay/);
    assert.throws(() => E.tuningOf({ encounterMinSteps: -1 }), /encounterMinSteps/);
    assert.equal(E.tuningOf({ encounterNightLevelBonus: -1 }).encounterNightLevelBonus, -1);
  });
  it('levelFor adds the night bonus and clamps', () => {
    assert.equal(E.levelFor(5, false), 5);
    assert.equal(E.levelFor(5, true), 7);
    assert.equal(E.levelFor(99, true), 100);
    assert.equal(E.levelFor(0, false), 1);
    assert.equal(E.levelFor(5, true, { tuning: { encounterMaxLevel: 6 } }), 6);
  });
  it('isNight follows game night 18:00–06:00', () => {
    const w = makeWorld();
    assert.equal(E.isNight(w, { total: at(1, 18) }), true);
    assert.equal(E.isNight(w, { total: at(1, 5, 59) }), true);
    assert.equal(E.isNight(w, { total: at(1, 6) }), false);
    assert.equal(E.isNight(w, { total: at(1, 17, 59) }), false);
    assert.equal(E.isNight(w, { total: at(1, 3), tuning: { nightStartMinute: 600, nightEndMinute: 700 } }), false);
  });
});

describe('where wild encounters may happen', () => {
  it('spawnUnder: ctx.spawn, then map.spawnAt, then rect spawns', () => {
    assert.equal(E.spawnUnder(ISLE, { x: 1, y: 1 }).table, 'isle-grass');
    assert.equal(E.spawnUnder(ISLE, { x: 19, y: 19 }), null);
    assert.equal(E.spawnUnder(ISLE, { x: 1.5, y: 1 }), null);
    assert.equal(E.spawnUnder(ISLE, {}), null);
    const s = { table: 'x' };
    assert.equal(E.spawnUnder(ISLE, { spawn: s }), s);
    assert.equal(E.spawnUnder(ISLE, { spawn: null, x: 1, y: 1 }), null);
    assert.equal(E.spawnUnder({ spawnAt: (x, y) => (x === 2 ? s : null) }, { x: 2, y: 0 }), s);
  });
  it('only isles and the town\'s reed edges; never indoors', () => {
    assert.equal(E.isTownMap(TOWN, DATA), true, 'region says town');
    assert.equal(E.isTownMap({ town: true }, DATA), true);
    assert.equal(E.isTownMap(ISLE, DATA), false);
    assert.equal(E.wildAllowed(TOWN, TOWN.spawns[0], DATA), true, 'reeds');
    assert.equal(E.wildAllowed(TOWN, TOWN.spawns[1], DATA), false, 'town grass');
    assert.equal(E.wildAllowed({ ...TOWN, spawns: [] }, { area: 'reeds', table: 't' }, DATA), true, 'reeds area class');
    assert.equal(E.wildAllowed(ISLE, ISLE.spawns[0], DATA), true);
    assert.equal(E.wildAllowed(HOUSE, HOUSE.spawns[0], DATA), false);
    assert.equal(E.wildAllowed(ISLE, null, DATA), false);
    assert.equal(E.wildAllowed(ISLE, { area: {} }, DATA), false);
    const w = makeWorld();
    assert.equal(rollUntil(w, HOUSE, makeRng(1), ctxAt(1, 1), 200), null);
    assert.equal(rollUntil(w, TOWN, makeRng(1), ctxAt(11, 11), 200), null);
    assert.equal(rollUntil(w, TOWN, makeRng(1), ctxAt(1, 11)).speciesId, 'form-c');
  });
});

describe('rollStep', () => {
  it('counts every step and never chains: nothing within the floor, then an encounter, then the floor again', () => {
    const w = makeWorld();
    const rng = makeRng(2);
    const { bus, events } = recordingBus();
    for (let i = 1; i <= 8; i++) {
      assert.equal(E.rollStep(w, ISLE, rng, ctxAt(1, 1, { bus })), null, `step ${i}`);
      assert.equal(E.stepsSinceLast(w), i);
    }
    const r = E.rollStep(w, ISLE, rng, ctxAt(1, 1, { bus }));
    assert.ok(r && ['form-a', 'form-b'].includes(r.speciesId));
    assert.deepEqual(Object.keys(r).sort(), ['errant', 'level', 'mapId', 'night', 'speciesId', 'tableId']);
    assert.deepEqual([r.errant, r.tableId, r.mapId, r.night], [false, 'isle-grass', 'isle-map', false]);
    assert.equal(E.stepsSinceLast(w), 0);
    assert.deepEqual(events, [['encounter:start', r]]);
    assert.equal(E.rollStep(w, ISLE, rng, ctxAt(1, 1)), null, 'floor again');
    // steps off any spawn still count
    E.rollStep(w, ISLE, rng, ctxAt(19, 19));
    assert.equal(E.stepsSinceLast(w), 2);
    assert.throws(() => E.rollStep(w, {}, rng, ctxAt(1, 1)), /map/);
  });
  it('the spawn rate gates with one draw; a rate of 0 never hits', () => {
    const w = makeWorld();
    const zero = { ...ISLE, spawns: [{ area: { x: 0, y: 0, w: 5, h: 5 }, table: 'isle-grass', rate: 0 }] };
    assert.equal(rollUntil(w, zero, makeRng(3), ctxAt(1, 1), 300), null);
    const dflt = { ...ISLE, spawns: [{ area: { x: 0, y: 0, w: 5, h: 5 }, table: 'isle-grass' }] };
    let hits = 0;
    const rng = makeRng(4);
    for (let i = 0; i < 5000; i++) if (E.rollStep(w, dflt, rng, ctxAt(1, 1, { tuning: NOFLOOR }))) hits++;
    assert.ok(hits > 300 && hits < 520, `${hits} hits at the 0.08 default`);
    assert.equal(rollUntil(w, { ...ISLE, spawns: [{ area: { x: 0, y: 0, w: 5, h: 5 }, table: 'missing', rate: 1 }] }, makeRng(3), ctxAt(1, 1), 50), null);
  });
  it('spawn conds gate the spawn (a low-tide patch)', () => {
    const w = makeWorld();
    assert.equal(rollUntil(w, ISLE, makeRng(5), ctxAt(11, 1, { tideState: 'high' }), 100), null);
    assert.ok(rollUntil(w, ISLE, makeRng(5), ctxAt(11, 1, { tideState: 'low' })));
  });
  it('day / night: conds and mods shape the table; night levels are +2', () => {
    const w = makeWorld();
    const rng = makeRng(6);
    const day = new Map(), night = new Map();
    const levels = { day: new Set(), night: new Set() };
    for (let i = 0; i < 600; i++) {
      const d = rollUntil(w, ISLE, rng, ctxAt(1, 1, { total: DAY }));
      day.set(d.speciesId, (day.get(d.speciesId) ?? 0) + 1);
      if (d.speciesId === 'form-a') levels.day.add(d.level);
      const n = rollUntil(w, ISLE, rng, ctxAt(1, 1, { total: NIGHT }));
      night.set(n.speciesId, (night.get(n.speciesId) ?? 0) + 1);
      if (n.speciesId === 'form-a') levels.night.add(n.level);
      assert.equal(n.night, true);
    }
    assert.equal(day.has('form-night'), false, 'phase-gated row stays home by day');
    assert.equal(night.has('form-b'), false, 'mods night 0 removes a row at night');
    assert.ok(night.get('form-night') > 0);
    assert.ok(day.get('form-b') > 0);
    assert.deepEqual([...levels.day].sort(), [3, 4, 5]);
    assert.deepEqual([...levels.night].sort(), [5, 6, 7]);
    assert.equal(day.has('errant-1') && day.get('errant-1') > 20, false, 'Errants are not in the weighted pick');
  });
  it('is deterministic for the same stream and inputs', () => {
    const run = () => {
      const w = makeWorld({ seed: 'ENC-DET' });
      const rng = makeRng('encounter:isle-map');
      const out = [];
      for (let i = 0; i < 400; i++) out.push(E.rollStep(w, ISLE, rng, ctxAt(1 + (i % 3), 1, { total: DAY + i })));
      return JSON.stringify([out, w.encounter]);
    };
    assert.equal(run(), run());
  });
});

describe('Errants', () => {
  it('route tables and Skyroam: one table per game hour, per-seed offset', () => {
    assert.deepEqual(E.errantRoutes(DATA, 'errant-1'), ['isle-grass', 'isle-2-grass']);
    assert.deepEqual(E.errantRoutes(DATA, 'errant-2'), [], 'lit rows are not routes');
    assert.deepEqual(E.errantRoutes(createRegistry({ encounters: DATA.encounters }), 'errant-1'), ['isle-grass', 'isle-2-grass']);
    assert.deepEqual(E.errantSpecies(DATA), ['errant-1', 'errant-2']);
    const w = makeWorld();
    const seq = [0, 1, 2, 3].map((h) => E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY + h * 60 }));
    assert.equal(new Set(seq).size, 2);
    assert.notEqual(seq[0], seq[1]);
    assert.equal(seq[0], seq[2]);
    assert.equal(E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY + 59 }), seq[0], 'same hour, same place');
    assert.equal(E.errantRouteNow(w, 'nobody', { data: DATA, total: DAY }), null);
    const one = { encounters: { only: [{ species: 'e', levels: [1, 1], w: 1, errant: true }] } };
    assert.equal(E.errantRouteNow(w, 'e', { data: one, total: 12345 }), 'only', 'a single route never moves');
    assert.equal(E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY + 120, tuning: { errantRoamMinutes: 180 } }), E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY, tuning: { errantRoamMinutes: 180 } }));
  });
  it('on its current route an encounter is the Errant at errantRouteChance; elsewhere never', () => {
    const w = makeWorld();
    const here = E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY });
    const [onMap, offMap] = here === 'isle-grass' ? [ISLE, ISLE2] : [ISLE2, ISLE];
    const sure = { errantRouteChance: 1 };
    const r = rollUntil(w, onMap, makeRng(7), ctxAt(1, 1, { tuning: sure }));
    assert.deepEqual([r.speciesId, r.errant, r.level], ['errant-1', true, onMap === ISLE ? 20 : 21]);
    assert.equal(w.encounter.errants['errant-1'].seen, true);
    const n = rollUntil(w, onMap, makeRng(7), ctxAt(1, 1, { tuning: sure, total: NIGHT + (DAY % 60) }));
    if (n.errant) assert.equal(n.level, (onMap === ISLE ? 20 : 21) + 2, 'night +2 for Errants too');
    for (let i = 0; i < 100; i++) assert.equal(rollUntil(w, offMap, makeRng(i), ctxAt(1, 1, { tuning: sure })).errant, false);
  });
  it('about 1 in 300 encounters on the route is the Errant', () => {
    const w = makeWorld();
    const here = E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY });
    const map = here === 'isle-grass' ? ISLE : ISLE2;
    const rng = makeRng(8);
    let errants = 0;
    const N = 30000;
    for (let i = 0; i < N; i++) {
      const r = rollUntil(w, map, rng, ctxAt(1, 1));
      if (r.errant) { errants++; w.encounter.errants['errant-1'].downDay = null; }
    }
    assert.ok(errants > 60 && errants < 145, `${errants} Errants in ${N}`);
  });
  it('a downed Errant returns the next day, after a badge, or after two hours of play', () => {
    const w = makeWorld({ total: DAY });
    const { bus, events } = recordingBus();
    assert.equal(E.errantUp(w, 'errant-1'), true);
    w.stats.playMs = 1000;
    E.markErrantDown(w, 'errant-1', { bus });
    assert.deepEqual(w.encounter.errants['errant-1'], { seen: true, downDay: 1, downBadges: 0, downPlayMs: 1000 });
    assert.deepEqual(events, [['encounter:errant-down', { speciesId: 'errant-1' }]]);
    assert.equal(E.errantUp(w, 'errant-1'), false);
    assert.equal(E.errantUp(w, 'errant-1', { total: at(1, 23, 59) }), false);
    assert.equal(E.errantUp(w, 'errant-1', { total: at(2, 0) }), true, 'next day');
    w.badges.push('spire-1');
    assert.equal(E.errantUp(w, 'errant-1'), true, 'after a badge');
    w.badges.length = 0;
    assert.equal(E.errantUp(w, 'errant-1', { playMs: 1000 + 7_199_999 }), false);
    assert.equal(E.errantUp(w, 'errant-1', { playMs: 1000 + 7_200_000 }), true, 'after 2 h of play');
    const strict = { tuning: { errantReturnNextDay: false, errantReturnOnBadge: false, errantReturnPlayMs: 0 } };
    w.badges.push('spire-1');
    assert.equal(E.errantUp(w, 'errant-1', { ...strict, total: at(9, 0), playMs: 9e9 }), false);
    // while down it never appears, even at chance 1
    w.badges.length = 0;
    const here = E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY });
    const map = here === 'isle-grass' ? ISLE : ISLE2;
    for (let i = 0; i < 50; i++) assert.equal(rollUntil(w, map, makeRng(i), ctxAt(1, 1, { tuning: { errantRouteChance: 1 } })).errant, false);
    assert.throws(() => E.markErrantDown(w, ''), /species/);
  });
  it('after the Relighting, Errants visit the lit point at night (1 in 120)', () => {
    const w = makeWorld();
    const sure = { errantLitChance: 1 };
    for (let i = 0; i < 30; i++) assert.equal(rollUntil(w, POINT, makeRng(i), ctxAt(1, 1, { total: NIGHT, tuning: sure })).errant, false, 'not before the flag');
    w.flags['sp.lit.calls'] = true;
    for (let i = 0; i < 30; i++) assert.equal(rollUntil(w, POINT, makeRng(i), ctxAt(1, 1, { total: DAY, tuning: sure })).errant, false, 'not by day');
    const r = rollUntil(w, POINT, makeRng(1), ctxAt(1, 1, { total: NIGHT, tuning: sure }));
    assert.ok(['errant-1', 'errant-2'].includes(r.speciesId));
    assert.deepEqual([r.errant, r.level], [true, 46]);
    // both lit Errants turn up (one shared roll, then a pick among those that are up)
    const picked = new Set();
    for (let i = 0; i < 40; i++) picked.add(rollUntil(w, POINT, makeRng(100 + i), ctxAt(1, 1, { total: NIGHT, tuning: sure })).speciesId);
    assert.deepEqual([...picked].sort(), ['errant-1', 'errant-2']);
    E.markErrantDown(w, 'errant-1', { total: NIGHT });
    for (let i = 0; i < 10; i++) assert.equal(rollUntil(w, POINT, makeRng(i), ctxAt(1, 1, { total: NIGHT, tuning: sure })).speciesId, 'errant-2');
    let errants = 0;
    const rng = makeRng(9);
    w.encounter.errants = {};
    for (let i = 0; i < 12000; i++) {
      const e = rollUntil(w, POINT, rng, ctxAt(1, 1, { total: NIGHT }));
      if (e.errant) { errants++; w.encounter.errants = {}; }
    }
    // GDD-00 §2: 1 in 120 night encounters on the point, however many lit Errants are up
    assert.ok(errants > 65 && errants < 140, `${errants} of 12000`);
  });
  it('map markers: shown once seen (Skyroam) or revealed by the Weatherglass / telescope', () => {
    const w = makeWorld({ total: DAY });
    let m = E.errantMarkers(w, { data: DATA, total: DAY });
    assert.equal(m.length, 1, 'only route Errants roam the map');
    assert.deepEqual([m[0].speciesId, m[0].seen, m[0].visible, m[0].up], ['errant-1', false, false, true]);
    assert.equal(m[0].tableId, E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY }));
    assert.equal(E.errantMarkers(w, { data: DATA, reveal: true })[0].visible, true);
    assert.equal(E.markErrantSeen(w, 'errant-1'), true);
    assert.equal(E.markErrantSeen(w, 'errant-1'), false);
    m = E.errantMarkers(w, { data: DATA, total: DAY });
    assert.equal(m[0].visible, true);
    E.markErrantDown(w, 'errant-1', { total: DAY });
    assert.equal(E.errantMarkers(w, { data: DATA, total: DAY })[0].visible, false, 'a downed Errant leaves the map');
  });
});

describe('roamers share the rules', () => {
  it('effectiveRows: cond-filtered, mods-weighted, night-shifted; Errants only on request', () => {
    const w = makeWorld();
    const day = E.effectiveRows(w, ISLE, 'isle-grass', { data: DATA, total: DAY });
    assert.deepEqual(day.map((r) => [r.species, r.w, r.levels]), [['form-a', 60, [3, 5]], ['form-b', 40, [4, 4]]]);
    const night = E.effectiveRows(w, ISLE, 'isle-grass', { data: DATA, total: NIGHT });
    assert.deepEqual(night.map((r) => [r.species, r.w, r.levels]), [['form-a', 60, [5, 7]], ['form-night', 10, [8, 8]]]);
    assert.deepEqual(E.effectiveRows(w, ISLE, 'missing', { data: DATA }), []);
    const here = E.errantRouteNow(w, 'errant-1', { data: DATA, total: DAY });
    const withE = E.effectiveRows(w, ISLE, here, { data: DATA, total: DAY }, { includeErrants: true });
    const er = withE.find((r) => r.errant);
    assert.ok(er && er.species === 'errant-1' && er.w > 0 && er.w < 1);
    // world/roamer.spawn takes the rows as they are, so a night roamer carries the +2
    const map = { id: 'isle-map', w: 10, h: 10, passable: () => true };
    const r = spawnRoamer(makeRng(3), night, map, 'rising', { tableId: 'isle-grass', phase: 'night' });
    assert.ok(r && r.level >= 5);
  });
  it('noteEncounter resets the floor and marks an Errant seen', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    E.rollStep(w, ISLE, makeRng(1), ctxAt(19, 19));
    E.rollStep(w, ISLE, makeRng(1), ctxAt(19, 19));
    const r = E.noteEncounter(w, { speciesId: 'errant-1', level: 20, errant: true, tableId: 'isle-grass', mapId: 'isle-map' }, { bus });
    assert.deepEqual(r, { speciesId: 'errant-1', level: 20, errant: true, tableId: 'isle-grass', mapId: 'isle-map', night: false });
    assert.equal(E.stepsSinceLast(w), 0);
    assert.equal(w.encounter.errants['errant-1'].seen, true);
    assert.deepEqual(events, [['encounter:start', r]]);
    assert.equal(E.noteEncounter(w, { speciesId: 'form-a', level: 3, tableId: 't' }).mapId, w.player.mapId);
    assert.throws(() => E.noteEncounter(w, {}), /speciesId/);
  });
  it('a damaged encounter record is repaired; the world stays valid', () => {
    const w = makeWorld();
    w.encounter = null;
    E.rollStep(w, ISLE, makeRng(1), ctxAt(19, 19));
    assert.deepEqual(w.encounter, { steps: 1, errants: {} });
    w.encounter.steps = -4;
    w.encounter.errants = 'x';
    E.rollStep(w, ISLE, makeRng(1), ctxAt(19, 19));
    assert.deepEqual(w.encounter, { steps: 1, errants: {} });
    assert.equal(E.stepsSinceLast({}), 0);
    rollUntil(w, ISLE, makeRng(2), ctxAt(1, 1, { tuning: { errantRouteChance: 1 } }));
    E.markErrantDown(w, 'errant-1');
    assert.deepEqual(validateWorld(w), []);
  });
});
