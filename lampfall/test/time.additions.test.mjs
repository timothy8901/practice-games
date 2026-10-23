// Tests for the two sanctioned core/time additions (ARCHITECTURE-DRAFT §13.6):
// clock.setMinutesPerDay(n) and clock.freezeTide(x|null). Run: node --test test/time.additions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, tideAt, scheduleForSeed, MINUTES_PER_DAY, TIDE_PERIOD_MINUTES } from '../js/core/time.js';

/** Real ms one in-game minute takes at a given day length. */
const msPerMinute = (minutesPerDay) => (minutesPerDay * 60_000) / MINUTES_PER_DAY;

test('setMinutesPerDay changes the rate of future updates without moving the clock', () => {
  const clock = createClock({ startMinute: 600, maxDt: Infinity });
  const t0 = clock.total;
  clock.setMinutesPerDay(48);
  assert.equal(clock.total, t0, 'no jump');
  assert.ok(Math.abs(clock.minutesPerSecond - 0.5) < 1e-12, '48-minute day: half a game minute per real second');
  clock.update(msPerMinute(48) * 10);
  assert.ok(Math.abs(clock.total - (t0 + 10)) < 1e-9);
  clock.setMinutesPerDay(12);
  assert.ok(Math.abs(clock.minutesPerSecond - 2) < 1e-12);
  clock.update(msPerMinute(12) * 30);
  assert.ok(Math.abs(clock.total - (t0 + 40)) < 1e-9);
  clock.setMinutesPerDay(24);
  assert.ok(Math.abs(clock.minutesPerSecond - 1) < 1e-12);
});

test('setMinutesPerDay composes with speed and pause, and is not serialized', () => {
  const clock = createClock({ startMinute: 0, maxDt: Infinity });
  const before = clock.serialize();
  clock.setMinutesPerDay(12);
  assert.deepEqual(clock.serialize(), before, 'ClockState shape and values unchanged');
  clock.setSpeed(6);
  assert.ok(Math.abs(clock.minutesPerSecond - 12) < 1e-12);
  clock.pause();
  assert.equal(clock.minutesPerSecond, 0);
  clock.update(10_000);
  assert.equal(clock.total, 0);
  // restore() keeps the day length (it lives in settings, not in the state)
  clock.resume();
  clock.restore(before);
  assert.ok(Math.abs(clock.minutesPerSecond - 2) < 1e-12);
});

test('setMinutesPerDay validates like the minutesPerDay option', () => {
  const clock = createClock();
  for (const bad of [0, -1, NaN, Infinity, '24', null, undefined]) {
    assert.throws(() => clock.setMinutesPerDay(bad), /setMinutesPerDay/);
  }
  assert.throws(() => clock.setMinutesPerDay(Number.MIN_VALUE), RangeError);
  assert.ok(Math.abs(clock.minutesPerSecond - 1) < 1e-12, 'a rejected value leaves the rate unchanged');
});

test('setMinutesPerDay works in real-clock mode without effect on the wall-clock rate', () => {
  let now = Date.UTC(2026, 9, 23, 12);
  const clock = createClock({ realClock: true, now: () => now });
  clock.setMinutesPerDay(12);
  assert.equal(clock.minutesPerSecond, 1 / 60);
  now += 60_000;
  const t = clock.total;
  clock.update();
  assert.ok(Math.abs(clock.total - t - 1) < 1e-6);
});

test('freezeTide pins the height and the derived state; null releases it', () => {
  const clock = createClock({ startMinute: 0, seed: 'freeze' });
  const { tideOffset } = scheduleForSeed('freeze');
  clock.freezeTide(1);
  assert.equal(clock.tide, 1);
  assert.equal(clock.tideState, 'high');
  assert.equal(clock.isHighTide, true);
  assert.equal(clock.isLowTide, false);
  clock.freezeTide(0);
  assert.equal(clock.tide, 0);
  assert.equal(clock.tideState, 'low');
  assert.equal(clock.isLowTide, true);
  clock.freezeTide(0.5);
  assert.equal(clock.tideState, 'rising', 'a mid height reads rising');
  assert.equal(clock.snapshot().tide, 0.5);
  assert.equal(clock.snapshot().tideState, 'rising');
  clock.freezeTide(null);
  assert.ok(Math.abs(clock.tide - tideAt(clock.total, tideOffset)) < 1e-12, 'back on the schedule');
});

test('freezeTide holds while time passes and leaves the schedule getters on the real tide', () => {
  const clock = createClock({ startMinute: 0, seed: 7, maxDt: Infinity });
  const realNextLow = clock.nextLowTide;
  const today = clock.tidesToday;
  clock.freezeTide(0.9);
  assert.equal(clock.nextLowTide, realNextLow);
  assert.deepEqual(clock.tidesToday, today);
  for (let i = 0; i < 20; i++) clock.update(msPerMinute(24) * 37);
  assert.equal(clock.tide, 0.9);
  assert.equal(clock.tideState, 'high');
});

test('freezeTide reports state changes through onTideChange at the next advance only', () => {
  const clock = createClock({ startMinute: 0, maxDt: Infinity });
  clock.freezeTide(0.5); // rising
  clock.update(msPerMinute(24));
  const seen = [];
  clock.onTideChange((e) => seen.push(e));
  clock.freezeTide(1);
  assert.equal(seen.length, 0, 'no synchronous event');
  clock.update(msPerMinute(24));
  assert.deepEqual(seen.map((e) => [e.previous, e.state, e.tide]), [['rising', 'high', 1]]);
  for (let i = 0; i < 100; i++) clock.update(msPerMinute(24) * 10);
  assert.equal(seen.length, 1, 'nothing fires while pinned');
  clock.freezeTide(null);
  clock.update(msPerMinute(24) * 0.5);
  if (clock.tideState !== 'high') assert.equal(seen.length, 2, 'release reported at the next advance');
});

test('freezeTide is never serialized and survives restore()', () => {
  const clock = createClock({ startMinute: 300, seed: 's' });
  const plain = clock.serialize();
  clock.freezeTide(0.05);
  assert.deepEqual(clock.serialize(), plain);
  assert.equal(JSON.stringify(clock.serialize()).includes('0.05'), false);
  clock.restore({ ...plain, total: plain.total + TIDE_PERIOD_MINUTES / 2 });
  assert.equal(clock.tide, 0.05, 'the pin outlives a load (debug state of the live clock)');
  const other = createClock();
  other.restore(clock.serialize());
  assert.notEqual(other.tide, 0.05);
});

test('freezeTide validates its argument and refuses re-entry from a listener', () => {
  const clock = createClock({ startMinute: 0, maxDt: Infinity });
  for (const bad of [-0.01, 1.01, NaN, Infinity, '1', undefined, {}]) {
    assert.throws(() => clock.freezeTide(bad), /freezeTide/);
  }
  clock.freezeTide(0.3);
  assert.throws(() => clock.freezeTide(2));
  assert.equal(clock.tide, 0.3, 'a rejected value keeps the old pin');
  let err = null;
  clock.onMinute(() => { try { clock.freezeTide(1); } catch (e) { err = e; } });
  clock.update(msPerMinute(24));
  assert.match(String(err), /inside one of its own listeners/);
});
