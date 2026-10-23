// Unit tests for js/systems/clockSys.js. Run: node --test test/systems.clockSys.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as clockSys from '../js/systems/clockSys.js';
import { createClock, DEFAULT_MINUTES_PER_DAY, MINUTES_PER_DAY } from '../js/core/time.js';
import { createBus } from '../js/core/events.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';

const SEED = 'DRIFT-TEST-0000';
/** A fresh world and a clock bound to it the way main.js binds them. */
function bound(seedCode = SEED) {
  const world = createNewWorld({ seedCode });
  const clock = createClock(clockSys.optionsFrom(world));
  clockSys.restoreFrom(world, clock);
  return { world, clock };
}
/** Real ms for `minutes` in-game minutes at the default day length. */
const msFor = (minutes) => (minutes * DEFAULT_MINUTES_PER_DAY * 60_000) / MINUTES_PER_DAY;
/** Advances `minutes` in 200 ms ticks (core/time clamps one update to 250 ms). Returns every ClockEvents. */
function advance(world, clock, minutes, ctx) {
  const out = [];
  for (let left = msFor(minutes); left > 0; left -= 200) out.push(clockSys.tick(world, clock, Math.min(200, left), ctx));
  return out;
}

test('optionsFrom reads seed, day length and real-clock setting; falls back on bad values', () => {
  const { world } = bound();
  const o = clockSys.optionsFrom(world);
  assert.equal(o.seed, world.run.seed);
  assert.equal(o.minutesPerDay, world.settings.minutesPerDay);
  assert.equal(o.realClock, false);
  assert.equal(clockSys.optionsFrom({ settings: { minutesPerDay: -3 } }).minutesPerDay, DEFAULT_MINUTES_PER_DAY);
  assert.deepEqual(clockSys.optionsFrom({}), { seed: null, minutesPerDay: DEFAULT_MINUTES_PER_DAY, realClock: false });
});

test('restoreFrom adopts world.clock; a malformed state is rewritten from the live clock', () => {
  const { world, clock } = bound();
  assert.deepEqual(clock.serialize(), world.clock);
  const w2 = createNewWorld({ seedCode: SEED });
  w2.clock.total = 5000;
  assert.deepEqual(clockSys.restoreFrom(w2, clock), { ok: true });
  assert.equal(clock.total, 5000);
  const before = clock.serialize();
  const bad = { clock: { version: 99 } };
  const res = clockSys.restoreFrom(bad, clock);
  assert.equal(res.ok, false);
  assert.match(res.error, /\w/);
  assert.deepEqual(bad.clock, before, 'world.clock now mirrors the unchanged clock');
});

test('tick advances the clock, mirrors world.clock and reports boundaries without a bus', () => {
  const { world, clock } = bound();
  const start = clock.total;
  const ev = clockSys.tick(world, clock, 16);
  assert.ok(ev.minutes > 0 && ev.minutes < 1, `one 60 Hz step is under a minute (${ev.minutes})`);
  assert.equal(world.clock.total, clock.total);
  assert.ok(clock.total > start);
  const none = clockSys.tick(world, clock, 0);
  assert.deepEqual(none, { minutes: 0, minute: null, hour: null, phase: null, tide: null, day: null });
  assert.deepEqual(validateWorld(world), []);
});

test('tick emits clock:minute/hour, day:end then day:start across midnight', () => {
  const { world, clock } = bound();
  const bus = createBus();
  const seen = [];
  for (const evt of ['clock:minute', 'clock:hour', 'clock:phase', 'tide:change', 'day:end', 'day:start']) bus.on(evt, (p) => seen.push([evt, p]));
  clockSys.setTime(world, clock, 23 * 60 + 59, { silent: true });
  const day0 = clock.day;
  const evs = advance(world, clock, 2, { bus });
  const ev = evs.find((e) => e.day !== null);
  assert.ok(ev, 'one tick crossed midnight');
  assert.equal(ev.day, day0 + 1);
  assert.equal(ev.hour, 0);
  assert.equal(evs.filter((e) => e.day !== null).length, 1, 'midnight is reported once');
  const names = seen.map(([e]) => e);
  assert.ok(names.includes('clock:minute') && names.includes('clock:hour'));
  assert.ok(names.indexOf('day:end') < names.indexOf('day:start'), 'day:end precedes day:start');
  assert.equal(seen.find(([e]) => e === 'day:end')[1].day, day0);
  assert.equal(seen.find(([e]) => e === 'day:start')[1].day, day0 + 1);
});

test('tick reports a phase change and a tide change when they happen', () => {
  const { world, clock } = bound();
  const bus = createBus();
  const phases = [];
  const tides = [];
  bus.on('clock:phase', (p) => phases.push(p));
  bus.on('tide:change', (p) => tides.push(p));
  // Walk one full day in 5-minute ticks: every phase and several tide states occur.
  advance(world, clock, MINUTES_PER_DAY, { bus });
  assert.ok(phases.length >= 6, `phases seen: ${phases.length}`);
  assert.ok(tides.length >= 4, `tide changes seen: ${tides.length}`);
  assert.ok(phases.every((p) => p.phase !== p.previous));
  assert.ok(tides.every((t) => t.state !== t.previous && typeof t.tide === 'number'));
});

test('setTime wraps the minute, mirrors world.clock and rejects non-numbers', () => {
  const { world, clock } = bound();
  clockSys.setTime(world, clock, 6 * 60 + MINUTES_PER_DAY);
  assert.equal(clock.hour, 6);
  assert.equal(world.clock.total, clock.total);
  clockSys.setTime(world, clock, -60);
  assert.equal(clock.hour, 23);
  assert.throws(() => clockSys.setTime(world, clock, 'noon'), TypeError);
});

test('applySettingsEffects performs realClock and reports a day-length change core cannot apply yet', () => {
  const { world, clock } = bound();
  const res = clockSys.applySettingsEffects(world, clock, [
    { kind: 'audio.volume', volumes: {} },
    { kind: 'clock.realClock', realClock: true },
    { kind: 'clock.minutesPerDay', minutesPerDay: 48 },
  ]);
  assert.deepEqual(res.applied, ['clock.realClock'].concat(typeof clock.setMinutesPerDay === 'function' ? ['clock.minutesPerDay'] : []));
  assert.equal(clock.realClock, true);
  assert.equal(world.clock.realClock, true, 'world.clock mirrors the clock');
  if (typeof clock.setMinutesPerDay !== 'function') assert.deepEqual(res.pending, ['clock.minutesPerDay']);
  assert.deepEqual(clockSys.applySettingsEffects(world, clock, null), { applied: [], pending: [] });
});

test('works inside a strict store tx and through a snapshot hook (the main.js wiring)', () => {
  const world = createNewWorld({ seedCode: SEED });
  const store = createStore(world, { strict: true });
  const clock = createClock(clockSys.optionsFrom(store.world));
  clockSys.restoreFrom(store.world, clock);
  store.onSnapshot((w) => clockSys.serializeInto(w, clock));
  store.tx('clock:tick', (w) => advance(w, clock, 30));
  assert.equal(store.world.clock.total, clock.total);
  clock.update(200); // advanced outside a tx: the snapshot still carries it
  assert.equal(store.snapshot().clock.total, clock.total);
  assert.throws(() => clockSys.tick(store.world, clock, 16), /outside a transaction/);
});

test('same seed, same ticks -> identical clock state (deterministic)', () => {
  const a = bound();
  const b = bound();
  for (let i = 0; i < 500; i++) { clockSys.tick(a.world, a.clock, 16); clockSys.tick(b.world, b.clock, 16); }
  assert.deepEqual(a.world.clock, b.world.clock);
});
