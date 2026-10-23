import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldLogRows, availability, createFieldLogScene } from '../js/scenes/fieldLog.js';
import { DATA } from '../js/data/index.js';
import { SPECIES, FAMILIES } from '../js/data/species/index.js';
import { COLLECTIONS } from '../js/data/collections.js';
import { ABILITIES } from '../js/data/abilities.js';
import { createRegistry } from '../js/data/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import * as fieldLog from '../js/systems/fieldLog.js';

const data = createRegistry({ ...DATA, species: SPECIES, families: FAMILIES, collections: COLLECTIONS, abilities: ABILITIES });

test('the Field Log has 42 plates and preserves the Seen / Read / Held distinction', () => {
  const world = createNewWorld({ seedCode: 'FLUX-LOG-TEST' });
  fieldLog.markSeen(world, 'sloshkin');
  fieldLog.markRead(world, 'scrapling', null, { data });
  fieldLog.markHeld(world, 'reedkit');
  const rows = fieldLogRows(world, data);
  assert.equal(rows.length, 42);
  assert.equal(rows.find((r) => r.id === 'puddlepip').name, '???');
  assert.equal(rows.find((r) => r.id === 'sloshkin').status, 'Seen');
  assert.equal(rows.find((r) => r.id === 'scrapling').status, 'Read');
  assert.equal(rows.find((r) => r.id === 'reedkit').status, 'Held');
});

test('fish plates show catch records and donations from the real collection state', () => {
  const world = createNewWorld({ seedCode: 'FLUX-LOG-TEST' });
  fieldLog.recordFish(world, 'perch', 23, {}, { data });
  world.collections.donated.push('perch');
  const rows = fieldLogRows(world, data, 'fish');
  assert.equal(rows.length, 18);
  const perch = rows.find((r) => r.id === 'perch');
  assert.equal(perch.entry.best, 23);
  assert.equal(perch.status, 'Caught 1');
  assert.equal(perch.donated, true);
  assert.equal(availability({ hours: [[18, 6]], tide: ['low'] }), '18:00–06:00 / Low tide');
});

test('the Field Log opens plates, navigates collection tabs and returns without changing records', () => {
  const world = createNewWorld({ seedCode: 'FLUX-LOG-TEST' });
  const before = JSON.stringify(world);
  const G = { world, data, flags: { noanim: true }, bus: { emit() {} }, scenes: { pop() {} } };
  const scene = createFieldLogScene(G);
  scene.enter();
  const press = (action) => scene.handleInput({ pressed: (name) => name === action, repeat: (name) => name === action, pointer: null });
  press('confirm');
  assert.match(scene.debugText(), /forms detail/);
  press('cancel');
  press('r');
  assert.match(scene.debugText(), /fish list/);
  press('down');
  assert.match(scene.debugText(), /grey-mullet/);
  press('right');
  assert.doesNotMatch(scene.debugText(), /grey-mullet/);
  press('r');
  assert.match(scene.debugText(), /bugs list/);
  press('r');
  assert.match(scene.debugText(), /finds list/);
  assert.equal(JSON.stringify(world), before);
});
