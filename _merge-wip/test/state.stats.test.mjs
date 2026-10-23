// Unit tests for js/systems/stats.js. Run: node --test test/state.stats.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as stats from '../js/systems/stats.js';
import { createNewWorld, validateWorld, STAT_COUNTERS } from '../js/state/schema.js';
import { createBus } from '../js/core/events.js';

const world = () => createNewWorld({ seedCode: 'STATS-TEST' });

describe('stats', () => {
  it('exposes the fixed key list and rejects unknown keys', () => {
    assert.equal(stats.KEYS, STAT_COUNTERS);
    assert.equal(stats.assertKey('battles'), 'battles');
    assert.throws(() => stats.assertKey('kills'), TypeError);
    assert.throws(() => stats.get(world(), 'kills'), TypeError);
    assert.throws(() => stats.inc(world(), 'nope'), TypeError);
    assert.throws(() => stats.set(world(), 'nope', 1), TypeError);
  });

  it('inc / get / set with events', () => {
    const w = world();
    const bus = createBus();
    const events = [];
    bus.on('stat:inc', (p) => events.push(p));
    const ctx = { bus };
    assert.equal(stats.get(w, 'battles'), 0);
    assert.equal(stats.inc(w, 'battles', 1, ctx), 1);
    assert.equal(stats.inc(w, 'battles', undefined, ctx), 2);
    assert.equal(stats.inc(w, 'catches', 3), 3);
    assert.equal(stats.get(w, 'battles'), 2);
    assert.deepEqual(events, [
      { key: 'battles', value: 1, prev: 0, by: 1 },
      { key: 'battles', value: 2, prev: 1, by: 1 },
    ]);
    assert.equal(stats.set(w, 'battles', 9, ctx), 9);
    assert.equal(stats.set(w, 'battles', 9, ctx), 9);
    assert.equal(events.length, 3);
    assert.deepEqual(events[2], { key: 'battles', value: 9, prev: 2, by: 7 });
    assert.throws(() => stats.set(w, 'battles', -1), TypeError);
    assert.throws(() => stats.inc(w, 'battles', NaN), TypeError);
    assert.deepEqual(validateWorld(w), []);
  });

  it('addPlayMs accumulates and all() copies', () => {
    const w = world();
    assert.equal(stats.addPlayMs(w, 16.6), 16.6);
    assert.equal(stats.addPlayMs(w, 100), 116.6);
    assert.throws(() => stats.addPlayMs(w, -1), TypeError);
    const all = stats.all(w);
    assert.equal(all.playMs, 116.6);
    assert.deepEqual(Object.keys(all), [...STAT_COUNTERS]);
    all.playMs = 0;
    assert.equal(w.stats.playMs, 116.6);
  });

  it('get tolerates a damaged stats record', () => {
    assert.equal(stats.get({ stats: { battles: 'x' } }, 'battles'), 0);
    assert.equal(stats.get({}, 'battles'), 0);
  });

  it('formatPlayTime renders H:MM', () => {
    assert.equal(stats.formatPlayTime(0), '0:00');
    assert.equal(stats.formatPlayTime(59_999), '0:00');
    assert.equal(stats.formatPlayTime(61_000), '0:01');
    assert.equal(stats.formatPlayTime(3_600_000 * 27 + 5 * 60_000), '27:05');
    assert.equal(stats.formatPlayTime(NaN), '0:00');
  });
});
