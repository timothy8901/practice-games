// Unit tests for the day-1 js/audio/director.js. Run: node --test test/audio.director.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMusicDirector, DIRECTOR_EVENTS } from '../js/audio/director.js';
import { createBus } from '../js/core/events.js';

test('director: records scene changes and the bus events it listens to; destroy unsubscribes', () => {
  const bus = createBus();
  const music = createMusicDirector({ bus });
  assert.deepEqual(music.status(), { scene: null, lastEvent: null });
  music.onSceneChange({ type: 'push', scene: { name: 'menu' }, top: { name: 'menu' } });
  bus.emit('map:enter', { mapId: 'x' });
  assert.deepEqual(music.status(), { scene: 'menu', lastEvent: 'map:enter' });
  assert.ok(DIRECTOR_EVENTS.includes('battle:start'));
  music.destroy();
  bus.emit('battle:start', {});
  assert.equal(music.status().lastEvent, 'map:enter', 'no listener after destroy');
  music.onSceneChange(null);
  assert.equal(music.status().scene, null);
});

test('director: tolerates a context without a bus', () => {
  const music = createMusicDirector({});
  assert.doesNotThrow(() => music.onSceneChange({ type: 'pop', top: null }));
  assert.doesNotThrow(() => music.destroy());
  assert.ok(Object.isFrozen(music));
});
