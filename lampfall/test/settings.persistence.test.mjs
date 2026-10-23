import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as settings from '../js/systems/settings.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createPersist } from '../js/state/persist.js';
import { createStore } from '../js/state/store.js';
import { createMemoryStorage } from '../js/core/save.js';

test('accessibility and play preferences survive both save reload and title mirror', () => {
  const world = createNewWorld({ seedCode: 'PREFS' });
  const values = { highContrast: true, largeText: true, captions: false, fishingMode: 'patient', battleSpeed: 4, ambience: 0.2, touchLayout: 'one', wakePoint: 'waystone', clearVisuals: true, pathView: 'toggle', autoAdvance: true };
  settings.update(world, values);
  assert.deepEqual(validateWorld(world), []);
  const storage = createMemoryStorage();
  const persist = createPersist({ storage, prefix: 'lampfall.' });
  const store = createStore(world);
  assert.equal(persist.saveManual({ store }, 1).ok, true);
  const loaded = persist.load(1);
  assert.equal(loaded.ok, true);
  settings.writeMirror(storage, world.settings);
  const mirrored = settings.readMirror(storage);
  for (const [key, value] of Object.entries(values)) {
    assert.equal(loaded.world.settings[key], value, `save ${key}`);
    assert.equal(mirrored[key], value, `device ${key}`);
  }
});

test('invalid accessibility choices and volume do not corrupt a save', () => {
  const value = settings.normalize({ battleSpeed: 500, fishingMode: 'warp', highContrast: 'yes', ambience: 5 });
  assert.equal(value.battleSpeed, 2);
  assert.equal(value.fishingMode, 'standard');
  assert.equal(value.highContrast, false);
  assert.equal(value.ambience, 1);
});
