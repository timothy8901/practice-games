// Regression (audit MID-01): winning a Spire pushes its id into world.badges; the world must still
// validate against the real game data, or every later save is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { SPIRES } from '../js/data/spires.js';
import { encodeSeedCode } from '../js/core/rng.js';

test('a world holding every Spire badge validates against the shipped data', () => {
  const data = createRegistry(DATA_CONTENT); // the registry main.js builds
  const w = createNewWorld({ seedCode: encodeSeedCode({ dial: 'FLUX', seed: 12345, toggles: [] }) });
  const before = validateWorld(w, data);
  for (const s of SPIRES) w.badges.push(s.id);
  const after = validateWorld(w, data);
  assert.deepEqual(after.filter((p) => p.startsWith('world.badges')), []);
  assert.deepEqual(after, before);
});
