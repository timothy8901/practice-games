// The id manifest (js/data/ids.manifest.js, design/GDD-ids.md): ids are well-formed, unique, frozen and
// at GDD-00's counts; the validator's manifest check warns on missing/extra ids only for authored tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as M from '../js/data/ids.manifest.js';
import { ID_RE } from '../js/data/ids.js';
import { checkManifest, validateData } from '../tools/validate-data.mjs';
import { DATA } from '../js/data/index.js';
import { TUNING } from '../js/data/tuning.js';

const ARRAYS = Object.entries(M).filter(([k, v]) => k.endsWith('_IDS') && Array.isArray(v));

test('every *_IDS export is a frozen array of unique ids', () => {
  assert.ok(ARRAYS.length >= 30);
  for (const [name, ids] of ARRAYS) {
    assert.ok(Object.isFrozen(ids), `${name} not frozen`);
    assert.equal(new Set(ids).size, ids.length, `${name} has duplicates`);
    if (name === 'FLAG_IDS') continue; // dotted namespaces, not table ids
    for (const id of ids) assert.match(id, ID_RE, `${name}: ${id}`);
  }
});

test('GDD-00 §16 counts', () => {
  const n = (a) => a.length;
  assert.equal(n(M.SPECIES_IDS), 42);
  assert.equal(n(M.TECHNIQUE_IDS), 64);
  assert.equal(n(M.MOVE_IDS), 65, '64 techniques + Scrap');
  assert.ok(M.MOVE_IDS.includes('scrap') && !M.TECHNIQUE_IDS.includes('scrap'));
  assert.equal(n(M.ABILITY_IDS), 25);
  assert.ok(!M.ABILITY_IDS.includes('prism-ward') && M.ABILITY_IDS.includes('glasshide'));
  assert.equal(n(M.ITEM_IDS), 26);
  assert.equal(n(M.DISC_IDS), 12);
  assert.equal(n(M.TRAINER_IDS), 65);
  assert.equal(n(M.LETTER_IDS), 58);
  assert.equal(n(M.MAP_IDS), 24);
  assert.equal(n(M.WAYSTONE_IDS), 7);
  assert.equal(n(M.THREAD_IDS), 10);
  assert.deepEqual([n(M.FISH_IDS), n(M.BUG_IDS), n(M.FIND_IDS)], [18, 10, 18]);
  assert.deepEqual([n(M.FURNITURE_IDS), n(M.CLOTHES_IDS), n(M.ROOF_COLOUR_IDS)], [24, 12, 8]);
  assert.equal(n(M.STAMP_IDS), 24);
  assert.equal(n(M.FESTIVAL_IDS), 4);
  assert.equal(n(M.COMMISSION_IDS), 6);
  assert.equal(n(M.COMMONS_PROJECT_IDS), 6);
  assert.equal(n(M.PORCH_IDS), 20);
  for (const f of ['lit.shiftTide', 'lit.steadied', 'lit.keepersAnchor', 'lit.fleetHome', 'lit.bar', 'lit.calls']) assert.ok(M.FLAG_IDS.includes(f), f);
});

test('cross-references inside the manifest resolve', () => {
  for (const [sp, fam] of Object.entries(M.SPECIES_FAMILY)) {
    assert.ok(M.SPECIES_IDS.includes(sp), sp);
    assert.ok(M.FAMILY_IDS.includes(fam), `${sp} -> ${fam}`);
  }
  assert.equal(Object.keys(M.SPECIES_FAMILY).length, M.SPECIES_IDS.length);
  for (const [mv, sp] of Object.entries(M.SIGNATURES)) { assert.ok(M.MOVE_IDS.includes(mv), mv); assert.ok(M.SPECIES_IDS.includes(sp), sp); }
  assert.equal(Object.keys(M.SIGNATURES).length, 15);
  for (const [disc, mv] of Object.entries(M.DISC_MOVES)) { assert.ok(M.DISC_IDS.includes(disc), disc); assert.ok(M.MOVE_IDS.includes(mv), mv); }
  for (const [table, spec] of Object.entries(M.MANIFEST)) assert.equal(new Set(spec.ids).size, spec.ids.length, `${table} union has duplicates`);
});

test('checkManifest: unauthored tables only note; authored tables warn on missing and extra ids', () => {
  const manifest = {
    species: { ids: ['a', 'b', 'c'] },
    challenges: { ids: ['x', 'y'], optional: ['y'] },
    scripts: { ids: ['s1'], extras: 'allow' },
    maps: { ids: ['m1'] },
    stamps: { ids: ['t1'] },
  };
  const data = {
    species: [{ id: 'a' }, { id: 'zz' }],
    challenges: [{ id: 'x' }],
    scripts: { s1: [], other: [] },
    maps: [{ id: 'ph-field' }],
  };
  const { warnings, notes } = checkManifest(data, manifest);
  assert.deepEqual(warnings.sort(), ['species:*: missing 2 manifest id(s): b, c', 'species:zz: id is not in js/data/ids.manifest.js'].sort());
  assert.ok(notes.some((n) => n.includes("'maps' not yet authored")));
  assert.ok(notes.some((n) => n.includes("no 'stamps' table")));
});

test('the shipped placeholder tables raise no manifest warnings', () => {
  const plain = validateData(DATA, { tuning: TUNING });
  const withManifest = validateData(DATA, { tuning: TUNING, manifest: M.MANIFEST });
  assert.deepEqual(withManifest.errors, []);
  assert.deepEqual(withManifest.warnings, plain.warnings);
  assert.ok(withManifest.notes.length > 0);
});
