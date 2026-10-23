import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../js/config.js';

test('config: frame facts', () => {
  assert.equal(config.NATIVE_W, 480);
  assert.equal(config.NATIVE_H, 270);
  assert.equal(config.TILE, 16);
  assert.ok(Math.abs(config.TICK_MS - 1000 / 60) < 1e-9);
  assert.ok(config.MAX_FRAME_DT_MS >= config.TICK_MS * config.MAX_STEPS_PER_FRAME);
});

test('config: feature switches are frozen booleans', () => {
  assert.ok(Object.isFrozen(config.FEATURES));
  for (const [k, v] of Object.entries(config.FEATURES)) assert.equal(typeof v, 'boolean', k);
});

test('config: title and save prefix are placeholders tagged for the GDD', () => {
  assert.equal(typeof config.TITLE, 'string');
  assert.ok(config.SAVE_PREFIX.endsWith('.'));
  assert.ok(config.SLOW_FRAMES_TO_LOW_POWER > 0 && config.SLOW_FRAME_MS > config.TICK_MS);
});
