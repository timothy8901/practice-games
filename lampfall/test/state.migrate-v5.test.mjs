// The v4 -> v5 migration step (SYS-GATHER / SYS-WORLD keys). Run: node --test test/state.migrate-v5.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS, migrateWorld } from '../js/state/migrate.js';
import { SCHEMA_VERSION, validateWorld, worldDefaults, mapStateDefaults } from '../js/state/schema.js';

const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));

describe('migrate 4 -> 5', () => {
  it('the schema is at least v5 and has the step', () => {
    assert.ok(SCHEMA_VERSION >= 5);
    assert.equal(typeof MIGRATIONS[4], 'function');
  });
  it('new worlds carry the v5 keys', () => {
    const d = worldDefaults();
    assert.deepEqual(d.encounter, { steps: 0, errants: {} });
    assert.deepEqual(d.collections.patientBest, {});
    assert.equal(d.collections.cleanedDay, -1);
    assert.deepEqual(mapStateDefaults().reachAt, {});
  });
  it('the v4 fixture gains the keys and validates; nothing else changes', () => {
    const v4 = fixture('v4.json');
    const res = migrateWorld(v4);
    assert.equal(res.ok, true);
    assert.equal(res.from, 4);
    assert.deepEqual(validateWorld(res.world), []);
    const stepped = MIGRATIONS[4](JSON.parse(JSON.stringify(v4)), 4);
    assert.equal(stepped.v, 5);
    assert.deepEqual(stepped.encounter, { steps: 0, errants: {} });
    const { encounter: _e, collections: c5, maps: m5, v: _v, ...rest5 } = stepped;
    const { collections: c4, maps: m4, v: _v4, ...rest4 } = v4;
    assert.deepEqual(rest5, rest4, 'no other key changes');
    assert.deepEqual(c5, { ...c4, patientBest: {}, cleanedDay: -1 });
    assert.deepEqual(Object.keys(m5), Object.keys(m4));
  });
  it('stored reach health is stamped with the save\'s clock so it recovers from loading', () => {
    const v4 = fixture('v4.json');
    v4.clock.total = 5000;
    v4.maps = {
      harbor: { visited: true, picked: {}, trees: {}, cracks: {}, reach: { r1: 0.5, r2: 0.9 }, opened: [] },
      isle: { visited: true, picked: {}, trees: {}, cracks: {}, reach: { r3: 0.4 }, reachAt: { r3: 4000 }, opened: [] },
      empty: { visited: false, picked: {}, trees: {}, cracks: {}, reach: {}, opened: [] },
    };
    v4.collections.patientBest = { f: 3 };
    v4.collections.cleanedDay = 7;
    v4.encounter = { steps: 3, errants: {} };
    const res = migrateWorld(v4);
    assert.equal(res.ok, true);
    assert.deepEqual(res.world.maps.harbor.reachAt, { r1: 5000, r2: 5000 });
    assert.deepEqual(res.world.maps.isle.reachAt, { r3: 4000 }, 'an existing stamp is kept');
    assert.deepEqual(res.world.maps.empty.reachAt, {});
    assert.deepEqual(res.world.collections.patientBest, { f: 3 }, 'present values kept');
    assert.equal(res.world.collections.cleanedDay, 7);
    assert.deepEqual(res.world.encounter, { steps: 3, errants: {} });
    assert.deepEqual(validateWorld(res.world), []);
  });
  it('tolerates damaged sub-trees', () => {
    const v4 = fixture('v4.json');
    const res = migrateWorld({ ...v4, clock: null, maps: { a: 'junk', b: { reach: { r: 1 }, reachAt: 'x' } }, collections: { fish: {}, bugs: {}, relics: {}, donated: [], patientBest: 'x', cleanedDay: 1.5 }, encounter: 4 });
    assert.equal(res.ok, true);
    assert.deepEqual(res.world.maps.b.reachAt, { r: 0 });
    assert.deepEqual(res.world.collections.patientBest, {});
    assert.equal(res.world.collections.cleanedDay, -1);
    assert.deepEqual(res.world.encounter, { steps: 0, errants: {} });
  });
});
