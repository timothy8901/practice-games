// Unit tests for js/systems/clockSys.js. Run: node --test test/systems.clockSys.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as clockSys from '../js/systems/clockSys.js';
import { createClock, scheduleForSeed, DEFAULT_MINUTES_PER_DAY, MINUTES_PER_DAY, TIDE_PERIOD_MINUTES } from '../js/core/time.js';
import { createBus } from '../js/core/events.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import * as selectors from '../js/state/selectors.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { TUNING } from '../js/data/tuning.js';

const SEED = 'DRIFT-TEST-0000';
const HM = (h, m = 0) => h * 60 + m;
/** A fresh world and a clock bound to it the way main.js binds them. */
function bound(seedCode = SEED, data) {
  const world = createNewWorld({ seedCode });
  const clock = createClock(clockSys.optionsFrom(world, data));
  clockSys.restoreFrom(world, clock, data);
  return { world, clock };
}
/** Puts the clock at game day `day` (1-based), minute `m`, silently, and mirrors world.clock. */
function at(world, clock, day, m) {
  clock.restore({ ...clock.serialize(), total: (day - 1) * MINUTES_PER_DAY + m });
  clockSys.serializeInto(world, clock);
}
/** Real ms for `minutes` in-game minutes at the default day length. */
const msFor = (minutes, mpd = DEFAULT_MINUTES_PER_DAY) => (minutes * mpd * 60_000) / MINUTES_PER_DAY;
/** Advances `minutes` in 200 ms ticks (core/time clamps one update to 250 ms). Returns every ClockEvents. */
function advance(world, clock, minutes, ctx) {
  const out = [];
  for (let left = msFor(minutes); left > 1e-9; left -= 200) out.push(clockSys.tick(world, clock, Math.min(200, left), ctx));
  return out;
}
/** A bus that records [event, payload] pairs. */
function recorder(events) {
  const bus = createBus();
  const seen = [];
  for (const evt of events) bus.on(evt, (p) => seen.push([evt, p]));
  return { bus, seen };
}
const ALL_EVENTS = ['clock:minute', 'clock:hour', 'clock:phase', 'clock:dayPart', 'tide:change', 'day:end', 'day:start', 'clock:anchor'];

// ---------------------------------------------------------------------------------------------

describe('tuning', () => {
  test('DEFAULTS carry the GDD-00 values and TUNING_KEYS lists them all', () => {
    const d = clockSys.DEFAULTS;
    assert.equal(d.CLOCK_DEFAULT_MINUTES_PER_DAY, 24);
    assert.deepEqual(d.CLOCK_DAY_LENGTHS, [12, 24, 48]);
    assert.equal(d.CLOCK_NIGHT_START, HM(18));
    assert.equal(d.CLOCK_NIGHT_END, HM(6));
    assert.equal(d.TIDE_DAY1_LOW, HM(16, 40));
    assert.deepEqual(d.TIDE_WINDOWS, { causeway: 150, stones: 120, flats: 90, bar: 90, spur: 90, mainland: 60 });
    assert.equal(d.TIDE_SPRING_EVERY_DAYS, 7);
    assert.equal(d.TIDE_SPRING_FIRST_DAY, 7);
    assert.equal(d.CLOCK_DAY1_WEEKDAY, 6, 'day 1 is a Sunday');
    assert.equal(d.REST_LIE_MINUTES, 10);
    assert.equal(d.REST_NAP_FROM, HM(12));
    assert.equal(d.REST_NAP_WAKE, HM(18));
    assert.equal(d.REST_SLEEP_FROM, HM(21));
    assert.equal(d.REST_SLEEP_WAKE, HM(6));
    assert.equal(d.REST_SIT_SPEED, 6);
    assert.deepEqual(d.CLOCK_ANCHORS, [{ id: 'builds', minute: HM(5, 40) }, { id: 'morning', minute: HM(6) }]);
    assert.deepEqual([...clockSys.TUNING_KEYS].sort(), Object.keys(d).sort());
    assert.ok(Object.isFrozen(d) && Object.isFrozen(d.CLOCK_DAY_PARTS[0]) && Object.isFrozen(d.TIDE_WINDOWS));
  });

  test('tuningOf reads Registry, DATA, {tuning} and flat tables; validates; caches', () => {
    assert.equal(clockSys.tuningOf(), clockSys.DEFAULTS);
    assert.equal(clockSys.tuningOf(null), clockSys.DEFAULTS);
    const reg = createRegistry(DATA);
    assert.deepEqual(clockSys.tuningOf(reg), clockSys.DEFAULTS, 'a registry without a tuning table gives the defaults');
    assert.deepEqual(clockSys.tuningOf(TUNING), clockSys.DEFAULTS, 'the placeholder tuning table names no SYS-TIME key yet');
    const flat = { REST_SIT_SPEED: 4, unrelated: 1 };
    const t = clockSys.tuningOf(flat);
    assert.equal(t.REST_SIT_SPEED, 4);
    assert.equal(t.REST_LIE_MINUTES, 10);
    assert.equal(clockSys.tuningOf(flat), t, 'cached per table');
    assert.equal(clockSys.tuningOf(t), t, 'a resolved tuning passes through');
    assert.equal(clockSys.tuningOf({ tuning: flat }), t, '{tuning} wraps the same table');
    const regWithTuning = createRegistry({ tuning: { REST_SIT_SPEED: 3 } });
    // a registry indexes object tables by key; tuningOf reads the raw table
    assert.equal(clockSys.tuningOf(regWithTuning).REST_SIT_SPEED, 3);
    assert.ok(Object.isFrozen(t));
  });

  test('tuningOf rejects malformed values with the key in the message', () => {
    const bad = [
      { CLOCK_DAY_LENGTHS: [] }, { CLOCK_DAY_LENGTHS: [12, 12] }, { CLOCK_NIGHT_START: 1440 }, { CLOCK_NIGHT_END: 1.5 },
      { CLOCK_DAY_PARTS: [{ id: 'a', start: 60, track: 't', name: 'n', tideWord: 'w' }] },
      { CLOCK_DAY_PARTS: [{ id: 'a', start: 0, track: 't', name: 'n', tideWord: 'w' }, { id: 'a', start: 60, track: 't', name: 'n', tideWord: 'w' }] },
      { CLOCK_ANCHORS: [{ id: 'X', minute: 1 }] }, { CLOCK_DAY1_WEEKDAY: 7 }, { TIDE_DAY1_LOW: -1 },
      { TIDE_SPRING_EVERY_DAYS: 0 }, { TIDE_WINDOWS: { causeway: 400 } }, { TIDE_WINDOWS: {} }, { TIDE_BAR_LIT_FLAG: '' },
      { REST_LIE_HEAL: 2 }, { REST_SIT_SPEED: 0.5 }, { CLOCK_DEFAULT_MINUTES_PER_DAY: 0 },
    ];
    for (const b of bad) {
      const key = Object.keys(b)[0];
      assert.throws(() => clockSys.tuningOf(b), new RegExp(key), key);
    }
    assert.throws(() => clockSys.tuningOf(5), TypeError);
  });
});

describe('tide seed', () => {
  test('tideSeedFor lands day 1’s low on 16:40 for every run seed', () => {
    const seed = clockSys.tideSeedFor();
    assert.match(seed, /^lampfall:tide:\d+$/);
    assert.equal(scheduleForSeed(seed).tideOffset, HM(16, 40) % TIDE_PERIOD_MINUTES);
    assert.equal(clockSys.tideSeedFor(), seed, 'memoized and stable');
    assert.equal(clockSys.tideOffsetFor(HM(16, 40)), 255);
    for (const m of [0, 100, 744, 745, 1439]) assert.equal(scheduleForSeed(clockSys.tideSeedFor(m)).tideOffset, m % TIDE_PERIOD_MINUTES);
    assert.throws(() => clockSys.tideSeedFor(1440), TypeError);
    assert.throws(() => clockSys.tideSeedFor(1.5), TypeError);
  });

  test('optionsFrom uses the tide seed, the day length and the real-clock setting', () => {
    const { world } = bound();
    const o = clockSys.optionsFrom(world);
    assert.equal(o.seed, clockSys.tideSeedFor());
    assert.equal(o.minutesPerDay, world.settings.minutesPerDay);
    assert.equal(o.realClock, false);
    assert.equal(clockSys.optionsFrom({ settings: { minutesPerDay: -3 } }).minutesPerDay, DEFAULT_MINUTES_PER_DAY);
    assert.deepEqual(clockSys.optionsFrom({}), { seed: clockSys.tideSeedFor(), minutesPerDay: DEFAULT_MINUTES_PER_DAY, realClock: false, realRelative: true });
    assert.equal(clockSys.optionsFrom({}, { CLOCK_DEFAULT_MINUTES_PER_DAY: 48 }).minutesPerDay, 48);
    assert.equal(clockSys.optionsFrom({ settings: { realClock: true, minutesPerDay: 12 } }).realClock, true);
  });

  test('two different run seeds share the GDD tide schedule (live clock, selectors, helpers agree)', () => {
    for (const code of ['DRIFT-AAAA-0000', 'FLUX-ZZZZ-9999', 'whatever']) {
      const { world, clock } = bound(code);
      at(world, clock, 1, HM(16, 40));
      assert.equal(clock.tideState, 'low');
      assert.ok(clock.tide < 1e-9, `${code}: low water at 16:40 on day 1`);
      assert.equal(world.clock.seed, clockSys.tideSeedFor(), 'world.clock carries the tide seed once mirrored');
      assert.ok(Math.abs(selectors.tide(world) - clock.tide) < 1e-12, 'selectors read the same tide');
      assert.ok(Math.abs(clockSys.tideHeight(world) - clock.tide) < 1e-12);
    }
  });
});

describe('binding', () => {
  test('restoreFrom adopts world.clock with the tide seed and does not write on success', () => {
    const world = createNewWorld({ seedCode: SEED });
    const clock = createClock(clockSys.optionsFrom(world));
    world.clock.total = 5000;
    const before = JSON.stringify(world.clock);
    assert.deepEqual(clockSys.restoreFrom(world, clock), { ok: true });
    assert.equal(clock.total, 5000);
    assert.equal(clock.serialize().seed, clockSys.tideSeedFor(), 'the run seed in world.clock is replaced on the live clock');
    assert.equal(JSON.stringify(world.clock), before, 'read-only on success');
  });

  test('restoreFrom rewrites a malformed or missing state from the live clock', () => {
    const { clock } = bound();
    const live = clock.serialize();
    for (const bad of [{ clock: { version: 99 } }, { clock: null }, { clock: 'x' }, {}]) {
      const res = clockSys.restoreFrom(bad, clock);
      assert.equal(res.ok, false);
      assert.match(res.error, /\w/);
      assert.deepEqual(bad.clock, live, 'world.clock now mirrors the unchanged clock');
    }
  });

  test('tick advances the clock, mirrors world.clock and reports boundaries without a bus', () => {
    const { world, clock } = bound();
    const start = clock.total;
    const ev = clockSys.tick(world, clock, 16);
    assert.ok(ev.minutes > 0 && ev.minutes < 1, `one 60 Hz step is under a minute (${ev.minutes})`);
    assert.equal(world.clock.total, clock.total);
    assert.ok(clock.total > start);
    const none = clockSys.tick(world, clock, 0);
    assert.deepEqual(none, { minutes: 0, minute: null, hour: null, phase: null, dayPart: null, tide: null, day: null, anchors: null });
    assert.deepEqual(validateWorld(world), []);
  });

  test('a paused clock does not move and reports nothing', () => {
    const { world, clock } = bound();
    clock.pause();
    const t = clock.total;
    const ev = clockSys.tick(world, clock, 200);
    assert.equal(ev.minutes, 0);
    assert.equal(clock.total, t);
  });

  test('tick emits clock:minute/hour then day:end, day:start across midnight', () => {
    const { world, clock } = bound();
    const { bus, seen } = recorder(ALL_EVENTS);
    at(world, clock, 3, HM(23, 59));
    const evs = advance(world, clock, 2, { bus });
    const ev = evs.find((e) => e.day !== null);
    assert.ok(ev, 'one tick crossed midnight');
    assert.equal(ev.day, 3, 'core day 3 = game day 4');
    assert.equal(ev.hour, 0);
    assert.equal(ev.dayPart, 'deep-night');
    assert.equal(evs.filter((e) => e.day !== null).length, 1, 'midnight is reported once');
    const names = seen.map(([e]) => e);
    assert.ok(names.includes('clock:minute') && names.includes('clock:hour'));
    assert.ok(names.indexOf('clock:hour') < names.indexOf('day:end'), 'summary first, then the crossings');
    assert.ok(names.indexOf('day:end') < names.indexOf('day:start'));
    assert.deepEqual(seen.find(([e]) => e === 'day:end')[1], { day: 2, gameDay: 3 });
    assert.deepEqual(seen.find(([e]) => e === 'day:start')[1], { day: 3, gameDay: 4, dayOfWeek: 2, dayName: 'Wed', spring: false });
  });

  test('day:start on day 7 is a Saturday spring tide', () => {
    const { world, clock } = bound();
    const { bus, seen } = recorder(['day:start']);
    at(world, clock, 6, HM(23, 59, 30) + 0.9);
    advance(world, clock, 1, { bus });
    assert.deepEqual(seen[0][1], { day: 6, gameDay: 7, dayOfWeek: 5, dayName: 'Sat', spring: true });
  });

  test('tick emits clock:anchor for the 05:40 builds and 06:00 morning, and day-part changes', () => {
    const { world, clock } = bound();
    const { bus, seen } = recorder(['clock:anchor', 'clock:dayPart']);
    at(world, clock, 2, HM(5, 38));
    const evs = advance(world, clock, 25, { bus });
    const anchors = seen.filter(([e]) => e === 'clock:anchor').map(([, p]) => p);
    assert.deepEqual(anchors, [{ id: 'builds', minute: HM(5, 40), day: 1, gameDay: 2 }, { id: 'morning', minute: HM(6), day: 1, gameDay: 2 }]);
    assert.deepEqual(evs.flatMap((e) => e.anchors ?? []), ['builds', 'morning']);
    const parts = seen.filter(([e]) => e === 'clock:dayPart').map(([, p]) => p);
    assert.deepEqual(parts, [{ dayPart: 'morning', previous: 'pre-dawn', track: 'h_morning', night: false }]);
  });

  test('a full day in ticks: 8 day-parts, every phase, tide changes, 2 anchors, 1 midnight', () => {
    const { world, clock } = bound();
    const { bus, seen } = recorder(ALL_EVENTS);
    at(world, clock, 5, HM(0, 30));
    advance(world, clock, MINUTES_PER_DAY, { bus });
    const count = (n) => seen.filter(([e]) => e === n).length;
    assert.equal(count('clock:dayPart'), 8);
    assert.ok(count('clock:phase') >= 6);
    assert.ok(count('tide:change') >= 4);
    assert.equal(count('clock:anchor'), 2);
    assert.equal(count('day:start'), 1);
    assert.equal(count('day:end'), 1);
    assert.equal(count('clock:hour'), 24);
    assert.ok(seen.filter(([e]) => e === 'clock:phase').every(([, p]) => p.phase !== p.previous));
    assert.ok(seen.filter(([e]) => e === 'tide:change').every(([, p]) => p.state !== p.previous && typeof p.tide === 'number'));
  });

  test('works at 12 and 48 minute days and at ×6 speed (one tick stays under a minute)', () => {
    for (const mpd of [12, 48]) {
      const world = createNewWorld({ seedCode: SEED, settings: { minutesPerDay: mpd } });
      const clock = createClock(clockSys.optionsFrom(world));
      clockSys.restoreFrom(world, clock);
      clock.setSpeed(6);
      const ev = clockSys.tick(world, clock, 1000 / 60);
      assert.ok(Math.abs(ev.minutes - (1440 / (mpd * 60)) * 6 / 60) < 1e-9, `${mpd}: ${ev.minutes}`);
      assert.ok(ev.minutes < 1);
    }
  });

  test('a long real-clock resync reports only its last day', () => {
    let now = Date.UTC(2026, 9, 1, 12);
    const world = createNewWorld({ seedCode: SEED, settings: { realClock: true } });
    const clock = createClock({ ...clockSys.optionsFrom(world), now: () => now, maxCatchUpMinutes: Infinity });
    const { bus, seen } = recorder(['day:start', 'day:end', 'clock:anchor']);
    clockSys.tick(world, clock, 16, { bus });
    now += 20 * 86_400_000; // 20 days away
    clockSys.tick(world, clock, 16, { bus });
    assert.equal(seen.filter(([e]) => e === 'day:start').length, 1);
    assert.ok(seen.filter(([e]) => e === 'clock:anchor').length <= 2);
  });

  test('setTime wraps the minute, mirrors world.clock and rejects non-numbers', () => {
    const { world, clock } = bound();
    clockSys.setTime(world, clock, 6 * 60 + MINUTES_PER_DAY);
    assert.equal(clock.hour, 6);
    assert.equal(world.clock.total, clock.total);
    clockSys.setTime(world, clock, -60);
    assert.equal(clock.hour, 23);
    assert.throws(() => clockSys.setTime(world, clock, 'noon'), TypeError);
    assert.throws(() => clockSys.setTime(world, clock, NaN), TypeError);
  });

  test('applySettingsEffects performs realClock and the day length on the live clock', () => {
    const { world, clock } = bound();
    const res = clockSys.applySettingsEffects(world, clock, [
      { kind: 'audio.volume', volumes: {} },
      { kind: 'clock.minutesPerDay', minutesPerDay: 48 },
    ]);
    assert.deepEqual(res, { applied: ['clock.minutesPerDay'], pending: [] });
    assert.ok(Math.abs(clock.minutesPerSecond - 0.5) < 1e-12);
    const res2 = clockSys.applySettingsEffects(world, clock, [{ kind: 'clock.realClock', realClock: true }]);
    assert.deepEqual(res2.applied, ['clock.realClock']);
    assert.equal(clock.realClock, true);
    assert.equal(world.clock.realClock, true, 'world.clock mirrors the clock');
    assert.deepEqual(clockSys.applySettingsEffects(world, clock, null), { applied: [], pending: [] });
    // a test double without setMinutesPerDay reports the change as pending
    const fake = { setRealClock() {}, serialize: () => world.clock };
    assert.deepEqual(clockSys.applySettingsEffects(world, fake, [{ kind: 'clock.minutesPerDay', minutesPerDay: 12 }]), { applied: [], pending: ['clock.minutesPerDay'] });
  });

  test('works inside a strict store tx and through a snapshot hook (the main.js wiring)', () => {
    const world = createNewWorld({ seedCode: SEED });
    const store = createStore(world, { strict: true });
    const clock = createClock(clockSys.optionsFrom(store.world));
    assert.deepEqual(clockSys.restoreFrom(store.world, clock), { ok: true }, 'boot restore runs outside a tx in strict mode');
    store.onSnapshot((w) => clockSys.serializeInto(w, clock));
    store.tx('clock:tick', (w) => advance(w, clock, 30));
    assert.equal(store.world.clock.total, clock.total);
    assert.equal(store.world.clock.seed, clockSys.tideSeedFor());
    clock.update(200);
    assert.equal(store.snapshot().clock.total, clock.total);
    assert.throws(() => clockSys.tick(store.world, clock, 16), /outside a transaction/);
    store.tx('rest', (w) => clockSys.rest(w, clock, 'lie'));
    assert.deepEqual(validateWorld(store.snapshot()), []);
  });

  test('same seed, same ticks -> identical clock state (deterministic)', () => {
    const a = bound();
    const b = bound('OTHER-SEED');
    for (let i = 0; i < 500; i++) { clockSys.tick(a.world, a.clock, 16); clockSys.tick(b.world, b.clock, 16); }
    assert.deepEqual(a.world.clock, b.world.clock, 'the clock does not depend on the run seed at all');
  });

  test('dayLengthOptions / dayLengthOf describe the Settings choices', () => {
    assert.deepEqual(clockSys.dayLengthOptions().map((o) => o.id), ['12', '24', '48', 'real']);
    assert.deepEqual(clockSys.dayLengthOptions()[3], { id: 'real', minutesPerDay: null, realClock: true });
    assert.equal(clockSys.dayLengthOf({ settings: { minutesPerDay: 48, realClock: false } }).id, '48');
    assert.equal(clockSys.dayLengthOf({ settings: { minutesPerDay: 30, realClock: false } }).id, 'custom');
    assert.equal(clockSys.dayLengthOf({ settings: { minutesPerDay: 30, realClock: true } }).id, 'real');
    assert.deepEqual(clockSys.dayLengthOf({}), { id: '24', minutesPerDay: 24, realClock: false });
  });
});

describe('calendar and day-parts', () => {
  test('gameDay is 1-based, minuteOfDay wraps', () => {
    const { world, clock } = bound();
    at(world, clock, 1, 0);
    assert.equal(clockSys.gameDay(world), 1);
    at(world, clock, 14, HM(13, 7));
    assert.equal(clockSys.gameDay(world), 14);
    assert.equal(clockSys.minuteOfDay(world), HM(13, 7));
    assert.equal(clockSys.gameDay({}), 1);
    assert.equal(clockSys.minuteOfDay({ clock: { total: NaN } }), 0);
  });

  test('night is 18:00–06:00 exactly half the day', () => {
    let night = 0;
    for (let m = 0; m < MINUTES_PER_DAY; m++) if (clockSys.isNightAt(m)) night++;
    assert.equal(night, MINUTES_PER_DAY / 2);
    assert.equal(clockSys.isNightAt(HM(18)), true);
    assert.equal(clockSys.isNightAt(HM(17, 59)), false);
    assert.equal(clockSys.isNightAt(HM(5, 59)), true);
    assert.equal(clockSys.isNightAt(HM(6)), false);
    assert.equal(clockSys.isNightAt(HM(6) + MINUTES_PER_DAY), false, 'wraps');
    assert.equal(clockSys.isNightAt(100, { CLOCK_NIGHT_START: 60, CLOCK_NIGHT_END: 120 }), true, 'a non-wrapping window');
    assert.equal(clockSys.isNightAt(100, { CLOCK_NIGHT_START: 60, CLOCK_NIGHT_END: 60 }), false);
    assert.throws(() => clockSys.isNightAt(NaN), TypeError);
    const { world, clock } = bound();
    at(world, clock, 2, HM(22));
    assert.equal(clockSys.isNight(world), true);
  });

  test('the 8 three-hour day-parts match the music table', () => {
    const parts = clockSys.dayParts();
    assert.equal(parts.length, 8);
    assert.deepEqual(parts.map((p) => p.track), ['h_night_deep', 'h_predawn', 'h_morning', 'h_late_morning', 'h_midday', 'h_afternoon', 'h_dusk', 'h_night']);
    parts.forEach((p, i) => assert.equal(p.start, i * 180));
    // night rules exactly on deep night, pre-dawn, dusk and night
    assert.deepEqual(parts.filter((p) => clockSys.isNightAt(p.start)).map((p) => p.id), ['deep-night', 'pre-dawn', 'dusk', 'night']);
    assert.equal(clockSys.dayPartAt(HM(14, 59)).id, 'midday');
    assert.equal(clockSys.dayPartAt(HM(15)).id, 'afternoon');
    assert.equal(clockSys.dayPartAt(-1).id, 'night', 'wraps');
    assert.equal(clockSys.dayPartAt(HM(23, 59, 59)).id, 'night');
    assert.throws(() => clockSys.dayPartAt('x'), TypeError);
    assert.equal(clockSys.DAY_PARTS, clockSys.DEFAULTS.CLOCK_DAY_PARTS);
    const { world, clock } = bound();
    at(world, clock, 1, HM(19));
    assert.equal(clockSys.dayPart(world).id, 'dusk');
  });

  test('day 1 is a Sunday; Saturdays and spring tides fall on days 7, 14, 21', () => {
    const { world, clock } = bound();
    const names = [];
    const springs = [];
    for (let d = 1; d <= 22; d++) {
      at(world, clock, d, HM(12));
      names.push(clockSys.weekday(world).name);
      if (clockSys.isSpringTide(world)) springs.push(d);
      assert.equal(clockSys.isSpringTideDay(d), clockSys.isSpringTide(world));
      assert.equal(clockSys.weekday(world).isSaturday, d % 7 === 0);
    }
    assert.equal(names[0], 'Sun');
    assert.equal(names[6], 'Sat');
    assert.deepEqual(springs, [7, 14, 21]);
    assert.equal(clockSys.isSpringTideDay(7, { TIDE_SPRING_EVERY_DAYS: 14, TIDE_SPRING_FIRST_DAY: 7 }), true);
    assert.equal(clockSys.isSpringTideDay(14, { TIDE_SPRING_EVERY_DAYS: 14, TIDE_SPRING_FIRST_DAY: 7 }), false);
    assert.throws(() => clockSys.isSpringTideDay(1.5), TypeError);
  });

  test('under Real Clock the weekday and spring tide keep the run calendar (LG-RN70: the total is run-relative)', () => {
    // GDD day 7 (core day 6) is the first Saturday and spring low, under every clock setting
    const world = { clock: { total: 6 * MINUTES_PER_DAY + 600, realClock: true } };
    assert.equal(clockSys.gameDay(world), 7);
    assert.equal(clockSys.weekday(world).name, 'Sat');
    assert.equal(clockSys.isSpringTide(world), true);
    world.clock.total += MINUTES_PER_DAY;
    assert.equal(clockSys.weekday(world).name, 'Sun');
    assert.equal(clockSys.isSpringTide(world), false);
    assert.equal(clockSys.weekday(world).index, selectors.dayOfWeek(world));
  });

  test('LG-RN70: Real Clock keeps the run day (enabling it on day 1 stays day 1; a legacy epoch save is rebased)', () => {
    const { world, clock } = bound();
    const t0 = world.clock.total;
    assert.equal(clockSys.gameDay(world), 1);
    // the device says 2026-10-28 10:00; the run is on day 1, 17:40ish
    const ms = new Date(2026, 9, 28, 10, 0).getTime();
    const real = createClock({ ...clockSys.optionsFrom(world), now: () => ms });
    clockSys.restoreFrom(world, real);
    clockSys.applySettingsEffects(world, real, [{ kind: 'clock.realClock', realClock: true }]);
    assert.equal(world.clock.realClock, true);
    assert.equal(world.clock.total, t0, 'switching on never jumps to the epoch day');
    assert.equal(clockSys.gameDay(world), 1);
    const events = [];
    const bus = { emit: (e, p) => events.push([e, p]) };
    clockSys.tick(world, real, 16, { bus });
    // 10:00 is behind the run's 17:40, so the run walks forward to day 2, 10:00 (a real night passed)
    assert.equal(clockSys.gameDay(world), 2);
    assert.equal(Math.floor(clockSys.minuteOfDay(world)), 600);
    assert.ok(events.some(([e, p]) => e === 'day:start' && p.gameDay === 2), 'the midnight is reported, not skipped');
    assert.ok(events.some(([e, p]) => e === 'clock:anchor' && p.id === 'morning'), 'the 06:00 morning still lands');
    assert.ok(world.clock.total < 10 * MINUTES_PER_DAY, 'the save holds the run-relative total');
    // a Real Clock save from before the fix stored the epoch day: it loads as it is (its day stamps
    // were written on that count; a clock-only rebase would put them all in the future)
    const legacyDay = Math.floor(Date.UTC(2026, 9, 28) / 86_400_000) + 3;
    const legacy = { ...world.clock, total: legacyDay * MINUTES_PER_DAY + 615 };
    assert.equal(clockSys.isLegacyRealTotal(legacy), true);
    assert.equal(clockSys.isLegacyRealTotal(world.clock), false);
    const w2 = { clock: legacy };
    const c2 = createClock({ ...clockSys.optionsFrom(w2), now: () => ms });
    assert.equal(clockSys.restoreFrom(w2, c2).ok, true);
    assert.equal(c2.day, legacyDay, 'the legacy day count is kept, never rebased to day 0');
  });

  test('LG-RN70 verify: a legacy Real Clock save keeps working (letters, builds and threads still advance)', () => {
    // the save was written with stamps on the epoch-day count: a clock rebased to day 0 would leave
    // letters.keeperDay ahead of today ('already' for ~20,000 days) and builds never landing
    const legacyDay = 20_757;
    const world = createNewWorld({ seedCode: SEED, settings: { realClock: true } });
    world.clock.realClock = true;
    world.clock.total = legacyDay * MINUTES_PER_DAY + 12 * 60;
    world.letters.keeperDay = legacyDay;
    const ms = new Date(2026, 9, 28, 13, 0).getTime();
    const clock = createClock({ ...clockSys.optionsFrom(world), now: () => ms });
    assert.equal(clockSys.restoreFrom(world, clock).ok, true);
    const events = [];
    clockSys.tick(world, clock, 16, { bus: { emit: (e, p) => events.push([e, p]) } });
    assert.equal(Math.floor(world.clock.total / MINUTES_PER_DAY), legacyDay, 'same day: 12:00 -> 13:00');
    assert.ok(world.letters.keeperDay <= Math.floor(world.clock.total / MINUTES_PER_DAY), 'no stamp is left in the future');
    assert.equal(Math.floor(clockSys.minuteOfDay(world)), 13 * 60);
  });

  test('snapshot gathers the HUD facts', () => {
    const { world, clock } = bound();
    at(world, clock, 7, HM(16, 40));
    const s = clockSys.snapshot(world);
    assert.equal(s.gameDay, 7);
    assert.equal(s.time, '16:40');
    assert.equal(s.hour, 16);
    assert.equal(s.dayPart.id, 'afternoon');
    assert.equal(s.night, false);
    assert.equal(s.weekday.name, 'Sat');
    assert.equal(s.spring, true);
    assert.ok(Math.abs(s.tide - clock.tide) < 1e-12);
    assert.equal(s.tideState, clock.tideState);
    assert.deepEqual(s.tides, clockSys.tidesForDay(7));
  });
});

describe('tide schedule', () => {
  test('the seeded lows: day 1 16:40; day 2 05:05 & 17:30; day 3 05:55 & 18:20; +50 min a day', () => {
    const lows = (d) => clockSys.tidesForDay(d).filter((x) => x.kind === 'low').map((x) => x.time);
    assert.deepEqual(lows(1), ['04:15', '16:40']);
    assert.deepEqual(lows(2), ['05:05', '17:30']);
    assert.deepEqual(lows(3), ['05:55', '18:20']);
    for (let n = 2; n <= 9; n++) {
      const morning = HM(5, 5) + 50 * (n - 2);
      assert.equal(clockSys.tidesForDay(n).find((x) => x.kind === 'low').minute, morning, `day ${n} morning low`);
    }
    const all = clockSys.tidesForDay(1);
    assert.deepEqual(all.map((x) => x.kind), ['low', 'high', 'low', 'high']);
    assert.ok(all.every((x, i) => i === 0 || x.total > all[i - 1].total));
    assert.ok(all.every((x) => x.day === 1));
  });

  test('two lows 12h25m apart; any 12.5 h holds a low; a day occasionally holds one', () => {
    let single = 0;
    let prev = null;
    for (let d = 1; d <= 60; d++) {
      const lows = clockSys.tidesForDay(d).filter((x) => x.kind === 'low');
      assert.ok(lows.length === 1 || lows.length === 2, `day ${d}: ${lows.length}`);
      if (lows.length === 1) single++;
      for (const l of lows) {
        if (prev) assert.equal(l.total - prev.total, TIDE_PERIOD_MINUTES);
        prev = l;
      }
    }
    assert.ok(single >= 1 && single <= 4, `single-low days in 60: ${single}`);
  });

  test('the day-1 16:40 low is the lower low; lower lows come every other low, at most one per day', () => {
    assert.equal(clockSys.tidesForDay(1).find((x) => x.time === '16:40').lower, true);
    assert.equal(clockSys.tidesForDay(1).find((x) => x.time === '04:15').lower, false);
    for (let d = 1; d <= 90; d++) {
      const lows = clockSys.tidesForDay(d).filter((x) => x.kind === 'low');
      const lower = lows.filter((x) => x.lower);
      assert.equal(lower.length, 1, `day ${d} has exactly one lower low`);
      assert.ok(clockSys.tidesForDay(d).filter((x) => x.kind === 'high').every((x) => !x.lower));
    }
  });

  test('nextLows lists strictly later lows; tidesForDay validates', () => {
    const { world, clock } = bound();
    at(world, clock, 1, HM(16, 40));
    const n = clockSys.nextLows(world, 3);
    assert.deepEqual(n.map((x) => [x.day, x.time]), [[2, '05:05'], [2, '17:30'], [3, '05:55']]);
    assert.deepEqual(clockSys.nextLows(world, 0), []);
    at(world, clock, 1, HM(16, 39));
    assert.equal(clockSys.nextLows(world, 1)[0].time, '16:40');
    assert.throws(() => clockSys.nextLows(world, -1), TypeError);
    assert.throws(() => clockSys.tidesForDay(0), TypeError);
    assert.throws(() => clockSys.tidesForDay(2.5), TypeError);
  });

  test('minutesFromLow: 0 at low water, 372.5 at high water; frozen heights map back', () => {
    const { world, clock } = bound();
    at(world, clock, 1, HM(16, 40));
    assert.equal(clockSys.minutesFromLow(world), 0);
    at(world, clock, 1, HM(17, 10));
    assert.equal(clockSys.minutesFromLow(world), 30);
    assert.equal(clockSys.minutesFromLow(world, { total: HM(16, 40) - 45 }), 45);
    assert.ok(Math.abs(clockSys.minutesFromLow(world, { tide: 1 }) - TIDE_PERIOD_MINUTES / 2) < 1e-9);
    assert.equal(clockSys.minutesFromLow(world, { tide: 0 }), 0);
    assert.throws(() => clockSys.minutesFromLow(world, { tide: 2 }), TypeError);
  });
});

describe('tide windows', () => {
  const W = (total, kind, extra = {}) => clockSys.tideWindow({ clock: { total }, flags: extra.flags ?? {} }, kind, extra);

  test('the arrival: the mainland causeway (±1 h) closes at 17:40 on day 1', () => {
    const before = W(HM(17, 39), 'mainland');
    assert.equal(before.open, true);
    assert.equal(before.minutesUntilChange, 1);
    assert.equal(before.low.time, '16:40');
    const after = W(HM(17, 40), 'mainland');
    assert.equal(after.open, false);
    assert.equal(after.low.time, '05:05', 'it next opens for day 2’s 05:05 low');
    assert.equal(after.low.day, 2);
    assert.equal(after.minutesUntilChange, MINUTES_PER_DAY + HM(5, 5) - 60 - HM(17, 40));
  });

  test('each kind opens and closes at its half-width around every low', () => {
    const low = HM(16, 40);
    for (const [kind, h] of Object.entries({ causeway: 150, stones: 120, flats: 90, spur: 90, mainland: 60 })) {
      assert.equal(W(low - h, kind).open, true, `${kind} opens at low − ${h}`);
      assert.equal(W(low - h - 0.01, kind).open, false, `${kind} closed just before`);
      assert.equal(W(low + h - 0.01, kind).open, true);
      assert.equal(W(low + h, kind).open, false, `${kind} closes at low + ${h}`);
      assert.ok(Math.abs(W(low, kind).minutesUntilChange - h) < 1e-9);
      // closed: minutes until the next low's window opens
      const nextOpen = low + TIDE_PERIOD_MINUTES - h;
      assert.ok(Math.abs(W(low + h, kind).minutesUntilChange - (nextOpen - (low + h))) < 1e-9);
    }
  });

  test('the causeway is open 5 game hours, twice a day', () => {
    let open = 0;
    for (let m = 0; m < MINUTES_PER_DAY * 10; m++) if (W(MINUTES_PER_DAY + m, 'causeway').open) open++;
    const perDay = open / 10;
    assert.ok(Math.abs(perDay - 300 * (MINUTES_PER_DAY / TIDE_PERIOD_MINUTES)) < 6, `open minutes per day ${perDay}`);
  });

  test('minutesUntilChange is consistent: stepping by it flips the state', () => {
    for (const kind of ['causeway', 'stones', 'flats', 'bar', 'spur', 'mainland']) {
      let t = HM(3);
      for (let i = 0; i < 12; i++) {
        const w = W(t, kind);
        assert.ok(w.minutesUntilChange > 0);
        const next = W(t + w.minutesUntilChange, kind);
        assert.equal(next.open, !w.open, `${kind} flips at +${w.minutesUntilChange}`);
        assert.equal(W(t + w.minutesUntilChange - 0.001, kind).open, w.open);
        t += w.minutesUntilChange;
      }
    }
  });

  test('the Bar opens only at the day’s lower low until it is lit', () => {
    const lowerLow = HM(16, 40); // day 1
    assert.equal(W(lowerLow, 'bar').open, true);
    assert.equal(W(HM(4, 15), 'bar').open, false, 'the morning low on day 1 is the higher low');
    assert.equal(W(HM(4, 15), 'spur').open, true, 'the Lantern Stack spur opens at every low');
    const closed = W(HM(4, 15), 'bar');
    assert.equal(closed.low.time, '16:40');
    assert.equal(closed.low.lower, true);
    assert.equal(closed.minutesUntilChange, lowerLow - 90 - HM(4, 15));
    // once a day: count opening windows over 30 days
    let openings = 0;
    let was = false;
    for (let m = 0; m < MINUTES_PER_DAY * 30; m += 5) {
      const o = W(m, 'bar').open;
      if (o && !was) openings++;
      was = o;
    }
    assert.ok(openings >= 29 && openings <= 31, `bar openings in 30 days: ${openings}`);
    const lit = W(HM(10), 'bar', { flags: { 'lit.bar': true } });
    assert.deepEqual(lit, { kind: 'bar', open: true, minutesUntilChange: null, low: null, always: true });
    assert.equal(W(HM(10), 'bar', { barLit: true }).always, true);
    assert.equal(W(HM(16, 40), 'bar', { flags: { 'lit.bar': true }, barLit: false }).always, false, 'barLit overrides the flag');
    assert.equal(W(HM(10), 'bar', { flags: { 'x.bar': true }, data: { TIDE_BAR_LIT_FLAG: 'x.bar' } }).always, true, 'the flag id is tunable');
  });

  test('a frozen debug tide (opts.tide or a pinned live clock) decides by height', () => {
    assert.equal(W(HM(10), 'causeway', { tide: 0 }).open, true);
    assert.equal(W(HM(16, 40), 'causeway', { tide: 1 }).open, false);
    assert.equal(W(HM(16, 40), 'causeway', { tide: 1 }).minutesUntilChange, null);
    const { world, clock } = bound();
    at(world, clock, 1, HM(16, 40));
    clock.freezeTide(1);
    assert.equal(clockSys.tideWindow(world, 'causeway', { clock }).open, false, 'setTide(1) bumps the causeway');
    assert.equal(clockSys.gateTide(world, 'causeway', { clock }), 'high');
    clock.freezeTide(0);
    at(world, clock, 1, HM(10));
    assert.equal(clockSys.tideWindow(world, 'causeway', { clock }).open, true, 'setTide(0) opens it');
    clock.freezeTide(null);
    assert.equal(clockSys.tideWindow(world, 'causeway', { clock }).open, false);
    assert.throws(() => W(0, 'causeway', { tide: -1 }), TypeError);
  });

  test('tideWindows covers every kind; unknown kinds throw; tuned kinds work', () => {
    const all = clockSys.tideWindows({ clock: { total: HM(16, 40) }, flags: {} });
    assert.deepEqual(Object.keys(all), clockSys.TIDE_WINDOW_KINDS);
    assert.ok(Object.values(all).every((w) => w.open));
    assert.throws(() => W(0, 'ferry'), RangeError);
    const custom = W(HM(16, 40) + 200, 'ford', { data: { TIDE_WINDOWS: { ford: 210 } } });
    assert.equal(custom.open, true);
  });

  test('gateTide hands world/warps a tide state that matches the window', () => {
    const { world, clock } = bound();
    at(world, clock, 1, HM(16, 40) + 70); // mainland closed, core still reads low water
    assert.equal(clock.tideState, 'low');
    assert.equal(clockSys.gateTide(world, 'mainland'), 'rising');
    assert.equal(clockSys.gateTide(world, 'causeway'), 'low');
    at(world, clock, 1, HM(16, 40) - 70);
    assert.equal(clockSys.gateTide(world, 'mainland'), 'falling');
    at(world, clock, 1, HM(16, 40) + 372);
    assert.equal(clockSys.gateTide(world, 'causeway'), 'high');
    assert.equal(clockSys.gateTide(world, 'causeway', { tide: 0.5 }), 'rising');
  });
});

describe('rest', () => {
  test('restOptions: lie any time, nap from 12:00, sleep from 21:00, with reasons', () => {
    const { world, clock } = bound();
    const opts = (m) => { at(world, clock, 2, m); return Object.fromEntries(clockSys.restOptions(world).options.map((o) => [o.kind, o])); };
    let o = opts(HM(10));
    assert.equal(o.lie.available, true);
    assert.equal(o.lie.minutes, 10);
    assert.equal(o.lie.wakeMinute, HM(10, 10));
    assert.equal(o.nap.available, false);
    assert.equal(o.nap.reason, 'too-early');
    assert.equal(o.sleep.available, false);
    assert.equal(o.sleep.reason, 'too-early');
    o = opts(HM(12));
    assert.equal(o.nap.available, true);
    assert.equal(o.nap.minutes, 360);
    assert.equal(o.nap.wakeMinute, HM(18));
    o = opts(HM(18));
    assert.equal(o.nap.reason, 'too-late');
    assert.equal(o.sleep.reason, 'too-early');
    o = opts(HM(20, 59));
    assert.equal(o.sleep.available, false, '21:00 keeps the first Porchlight hour unskippable');
    o = opts(HM(21));
    assert.equal(o.sleep.available, true);
    assert.equal(o.sleep.minutes, 540);
    o = opts(HM(2));
    assert.equal(o.sleep.available, true, 'after midnight still counts');
    assert.equal(o.sleep.minutes, 240);
    o = opts(HM(5, 59));
    assert.equal(o.sleep.minutes, 1);
    o = opts(HM(6));
    assert.equal(o.sleep.available, false);
    const r = clockSys.restOptions(world);
    assert.equal(r.nextLows.length, 2);
    assert.equal(r.realClock, false);
  });

  test('Sleep till dawn rolls through midnight, the 05:40 builds and the 06:00 morning, in order', () => {
    const { world, clock } = bound();
    at(world, clock, 3, HM(22, 15));
    const { bus, seen } = recorder(ALL_EVENTS);
    const res = clockSys.rest(world, clock, 'sleep', { bus });
    assert.equal(res.ok, true);
    assert.equal(res.skipped, true);
    assert.equal(res.save, true);
    assert.equal(res.dayPage, true);
    assert.equal(res.heal, 1);
    assert.equal(res.wakeMinute, HM(6));
    assert.equal(res.minutes, HM(7, 45));
    assert.equal(res.day, 3);
    assert.deepEqual(res.anchors, ['builds', 'morning']);
    assert.equal(res.dayPart, 'morning');
    assert.equal(clockSys.gameDay(world), 4);
    assert.equal(clockSys.minuteOfDay(world), HM(6));
    assert.equal(world.clock.total, clock.total);
    const order = seen.map(([e, p]) => (e === 'clock:anchor' ? `anchor:${p.id}` : e)).filter((e) => !e.startsWith('clock:') || e.startsWith('anchor'));
    assert.deepEqual(order.slice(-4), ['day:end', 'day:start', 'anchor:builds', 'anchor:morning']);
    assert.equal(seen.filter(([e]) => e === 'clock:hour').length, 1, 'the skip reports its arrival hour once, not every hour');
  });

  test('Sleep after midnight does not cross a midnight', () => {
    const { world, clock } = bound();
    at(world, clock, 3, HM(1, 30));
    const res = clockSys.rest(world, clock, 'sleep');
    assert.equal(res.ok, true);
    assert.equal(res.day, null);
    assert.equal(clockSys.gameDay(world), 3);
    assert.deepEqual(res.anchors, ['builds', 'morning']);
  });

  test('Sleep before 21:00 is refused and changes nothing', () => {
    const { world, clock } = bound();
    at(world, clock, 3, HM(20));
    const before = JSON.stringify(world.clock);
    const { bus, seen } = recorder(ALL_EVENTS);
    const res = clockSys.rest(world, clock, 'sleep', { bus });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'too-early');
    assert.equal(res.skipped, false);
    assert.equal(res.save, false);
    assert.equal(res.heal, 0);
    assert.equal(res.minutes, 0);
    assert.equal(JSON.stringify(world.clock), before);
    assert.equal(seen.length, 0);
  });

  test('Nap till dusk wakes at 18:00 and enters dusk / night rules', () => {
    const { world, clock } = bound();
    at(world, clock, 2, HM(13));
    const { bus, seen } = recorder(['clock:dayPart', 'day:start', 'clock:anchor']);
    const res = clockSys.rest(world, clock, 'nap', { bus });
    assert.equal(res.ok, true);
    assert.equal(res.dayPage, false);
    assert.equal(clockSys.minuteOfDay(world), HM(18));
    assert.equal(res.dayPart, 'dusk');
    assert.deepEqual(seen.map(([, p]) => p), [{ dayPart: 'dusk', previous: 'midday', track: 'h_dusk', night: true }]);
    assert.equal(clockSys.isNight(world), true);
  });

  test('Lie down takes 10 minutes any time, across midnight too', () => {
    const { world, clock } = bound();
    at(world, clock, 2, HM(23, 55));
    const res = clockSys.rest(world, clock, 'lie');
    assert.equal(res.ok, true);
    assert.ok(Math.abs(res.minutes - 10) < 1e-9);
    assert.equal(res.day, 2);
    assert.equal(res.heal, 1);
    assert.equal(res.dayPage, false);
    assert.equal(clockSys.gameDay(world), 3);
    assert.ok(Math.abs(clockSys.minuteOfDay(world) - 5) < 1e-9);
  });

  test('Real Clock: rest saves and heals but never skips', () => {
    let now = Date.UTC(2026, 9, 23, 22);
    const world = createNewWorld({ seedCode: SEED, settings: { realClock: true } });
    const clock = createClock({ ...clockSys.optionsFrom(world), now: () => now });
    clockSys.restoreFrom(world, clock);
    clock.setRealClock(true);
    const t = clock.total;
    const res = clockSys.rest(world, clock, 'lie');
    assert.equal(res.ok, true);
    assert.equal(res.skipped, false);
    assert.equal(res.minutes, 0);
    assert.equal(res.save, true);
    assert.equal(clock.total, t);
    const opts = clockSys.restOptions({ clock: { ...world.clock, total: 2 * MINUTES_PER_DAY + HM(22) } });
    assert.equal(opts.realClock, true);
    assert.ok(opts.options.filter((o) => o.available).every((o) => o.minutes === 0));
  });

  test('unknown rest kinds are refused', () => {
    const { world, clock } = bound();
    const res = clockSys.rest(world, clock, 'hibernate');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unknown-kind');
  });

  test('tuned rest hours are honoured', () => {
    const { world, clock } = bound();
    at(world, clock, 2, HM(20));
    const data = { REST_SLEEP_FROM: HM(20), REST_SLEEP_WAKE: HM(7), REST_LIE_MINUTES: 60, REST_LIE_HEAL: 0.25 };
    assert.equal(clockSys.rest(world, clock, 'lie', { data }).heal, 0.25);
    assert.equal(clockSys.minuteOfDay(world), HM(21));
    const res = clockSys.rest(world, clock, 'sleep', { data });
    assert.equal(res.ok, true);
    assert.equal(clockSys.minuteOfDay(world), HM(7));
  });

  test('porch Sit runs the clock ×6 until stand; Real Clock stays at ×1', () => {
    const { world, clock } = bound();
    const r = clockSys.sit(world, clock);
    assert.deepEqual(r, { ok: true, speed: 6, realClock: false, dayPage: true, save: true });
    assert.equal(world.clock.speed, 6);
    const ev = clockSys.tick(world, clock, 100);
    assert.ok(Math.abs(ev.minutes - (100 / 1000) * 6) < 1e-9, 'six game minutes per real second');
    assert.deepEqual(clockSys.stand(world, clock), { ok: true, speed: 1 });
    assert.equal(world.clock.speed, 1);
    const real = createClock({ realClock: true, now: () => Date.UTC(2026, 0, 1) });
    const w2 = { clock: real.serialize() };
    assert.equal(clockSys.sit(w2, real).speed, 1);
    assert.equal(real.speed, 1);
  });
});
