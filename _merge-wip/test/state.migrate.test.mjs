// Unit tests for js/state/migrate.js. Run: node --test test/state.migrate.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS, migrateWorld, fillDefaults } from '../js/state/migrate.js';
import { SCHEMA_VERSION, createNewWorld, validateWorld, worldDefaults } from '../js/state/schema.js';
import { createSaveSystem } from '../js/core/save.js';

const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));

describe('MIGRATIONS', () => {
  it('has a step for every version below SCHEMA_VERSION and is frozen', () => {
    for (let v = 0; v < SCHEMA_VERSION; v++) assert.equal(typeof MIGRATIONS[v], 'function', `missing step ${v} -> ${v + 1}`);
    assert.ok(Object.isFrozen(MIGRATIONS));
  });
});

describe('migrateWorld', () => {
  it('upgrades the v0 fixture to a valid current world, keeping its values', () => {
    const legacy = fixture('v0.json');
    const before = JSON.stringify(legacy);
    const res = migrateWorld(legacy);
    assert.equal(res.ok, true);
    assert.equal(res.from, 0);
    assert.equal(res.to, SCHEMA_VERSION);
    assert.equal(res.migrated, true);
    assert.equal(JSON.stringify(legacy), before, 'input untouched');
    const w = res.world;
    assert.deepEqual(validateWorld(w), []);
    assert.equal(w.v, SCHEMA_VERSION);
    assert.equal(w.player.name, 'Pell');
    assert.equal(w.player.mapId, 'harbor');
    assert.equal(w.player.facing, 'left');
    assert.equal(w.player.pronouns, 'they', 'filled default');
    assert.equal(w.wallet.main, 120);
    assert.equal(w.wallet.purse, 0);
    assert.equal(w.party.length, 1);
    assert.equal(w.party[0].nickname, 'Slosh');
    assert.equal(w.party[0].level, 5);
    assert.deepEqual(w.party[0].moves, [{ id: 'splash', pp: 10, maxPp: 10 }]);
    assert.equal(w.party[0].bond, 0, 'creature default filled');
    assert.equal(w.party[0].status, null);
    assert.deepEqual(w.party[0].mark, { x: 0, y: 0 });
    assert.deepEqual(w.npcs.wren.favours, []);
    assert.equal(w.npcs.wren.talks, 2);
    assert.equal(w.maps.harbor.visited, true);
    assert.deepEqual(w.maps.harbor.opened, []);
    assert.equal(w.threads['wren-roof'].done, false);
    assert.deepEqual(w.fieldLog.forms.sloshkin, { seen: true, read: false, held: true, ability: null });
    assert.deepEqual(w.letters, { delivered: 2, read: [1], today: null });
    assert.equal(w.stats.steps, 40);
    assert.equal(w.stats.battles, 0);
    assert.deepEqual(w.flags, { 'sp.arrived': true });
  });

  it('passes the v1 fixture through unchanged', () => {
    const current = fixture('v1.json');
    const res = migrateWorld(current);
    assert.equal(res.ok, true);
    assert.equal(res.migrated, false);
    assert.equal(res.from, SCHEMA_VERSION);
    assert.deepEqual(res.world, current);
    assert.deepEqual(validateWorld(res.world), []);
  });

  it('round-trips a freshly created world', () => {
    const w = createNewWorld({ seedCode: 'MIG-TEST' });
    const res = migrateWorld(JSON.parse(JSON.stringify(w)));
    assert.deepEqual(res.world, w);
  });

  it('rejects newer versions, bad input and unknown source versions', () => {
    const w = createNewWorld({ seedCode: 'MIG-TEST' });
    const newer = migrateWorld({ ...w, v: SCHEMA_VERSION + 1 });
    assert.equal(newer.ok, false);
    assert.equal(newer.error.code, 'version');
    assert.match(newer.error.message, /newer version/);
    assert.equal(migrateWorld(null).error.code, 'invalid-data');
    assert.equal(migrateWorld([]).error.code, 'invalid-data');
    assert.equal(migrateWorld(w, -1).error.code, 'version');
    assert.equal(migrateWorld(w, 1.5).error.code, 'version');
    assert.equal(migrateWorld({ v: 'x' }).from, 0, 'non-integer v counts as legacy');
  });

  it('agrees with core/save running the same table', () => {
    const sys = createSaveSystem({ storage: new Map(), prefix: 't.', version: SCHEMA_VERSION, migrations: MIGRATIONS });
    const legacy = fixture('v0.json');
    const res = sys.migrate(JSON.parse(JSON.stringify(legacy)), 0);
    assert.equal(res.ok, true);
    assert.equal(res.data.v, SCHEMA_VERSION);
    const filled = fillDefaults(res.data);
    assert.deepEqual(filled, migrateWorld(legacy).world);
  });
});

describe('fillDefaults', () => {
  it('adds missing keys, keeps present values, and never mutates its input', () => {
    const input = { player: { name: 'A' }, wallet: { main: 5 }, log: ['x'] };
    const frozen = JSON.stringify(input);
    const out = fillDefaults(input);
    assert.equal(JSON.stringify(input), frozen);
    assert.equal(out.player.name, 'A');
    assert.equal(out.player.x, 0);
    assert.equal(out.wallet.main, 5);
    assert.deepEqual(out.log, ['x']);
    assert.deepEqual(Object.keys(out).sort(), Object.keys(worldDefaults()).sort());
    out.log.push('y');
    assert.deepEqual(input.log, ['x'], 'arrays are copied, not shared');
  });

  it('replaces a wrong-typed sub-tree with its default and keeps unknown keys for the validator', () => {
    const out = fillDefaults({ wallet: 'lots', party: 'none', bag: { pockets: null }, mystery: 1 });
    assert.deepEqual(out.wallet, worldDefaults().wallet);
    assert.deepEqual(out.party, []);
    assert.deepEqual(out.bag.pockets, worldDefaults().bag.pockets);
    assert.equal(out.mystery, 1);
    assert.ok(validateWorld(out).includes('world.mystery: unexpected key'));
  });

  it('fills per-entry defaults in records and creatures', () => {
    const out = fillDefaults({ party: [{ uid: 'c9' }, 'junk'], npcs: { a: { met: true }, b: 3 }, maps: { m: {} }, threads: { t: { beat: 2 } }, fieldLog: { forms: { f: { seen: true } } } });
    assert.equal(out.party[0].uid, 'c9');
    assert.equal(out.party[0].level, 1);
    assert.equal(out.party[1], 'junk', 'non-objects are left for the validator');
    assert.equal(out.npcs.a.met, true);
    assert.equal(out.npcs.a.affinity, 0);
    assert.equal(out.npcs.b, 3);
    assert.deepEqual(out.maps.m.opened, []);
    assert.equal(out.threads.t.beat, 2);
    assert.equal(out.threads.t.done, false);
    assert.deepEqual(out.fieldLog.forms.f, { seen: true, read: false, held: false, ability: null });
  });

  it('tolerates garbage', () => {
    assert.deepEqual(fillDefaults(null), worldDefaults());
    assert.deepEqual(fillDefaults(undefined), worldDefaults());
    assert.deepEqual(fillDefaults(42), worldDefaults());
  });
});
