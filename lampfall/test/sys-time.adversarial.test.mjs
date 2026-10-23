// Adversarial tests for lane SYS-TIME (js/systems/clockSys.js, js/systems/weather.js, the two
// core/time additions, the clock/weather parts of state/schema). Written by the lane verifier.
// Run: node --test test/sys-time.adversarial.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as clockSys from '../js/systems/clockSys.js';
import * as weather from '../js/systems/weather.js';
import * as flags from '../js/systems/flags.js';
import * as selectors from '../js/state/selectors.js';
import { createClock, MINUTES_PER_DAY, TIDE_PERIOD_MINUTES, DEFAULT_MINUTES_PER_DAY, MAX_TOTAL_MINUTES } from '../js/core/time.js';
import { createBus } from '../js/core/events.js';
import { makeRng } from '../js/core/rng.js';
import { createNewWorld, validateWorld, NEW_GAME_START_MINUTE, DAY1_LOW_MINUTE, tideSeedFor } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createPersist } from '../js/state/persist.js';
import { migrateWorld } from '../js/state/migrate.js';

const SEED = 'ADVERSARY-TIME-01';
const HM = (h, m = 0) => h * 60 + m;
const DAY = MINUTES_PER_DAY;

/** A fresh world with a clock bound the way main.js binds it. */
function bound(seedCode = SEED) {
  const world = createNewWorld({ seedCode });
  const clock = createClock(clockSys.optionsFrom(world));
  clockSys.restoreFrom(world, clock);
  return { world, clock };
}
/** Silently puts the clock at game day `day`, minute `m` and mirrors world.clock. */
function at(world, clock, day, m) {
  clock.restore({ ...clock.serialize(), total: (day - 1) * DAY + m });
  clockSys.serializeInto(world, clock);
}
/** A bus recording [event, payload]. */
function recorder(names) {
  const bus = createBus();
  const seen = [];
  for (const n of names) bus.on(n, (p) => seen.push([n, p]));
  return { bus, seen };
}
const msFor = (minutes, mpd = DEFAULT_MINUTES_PER_DAY) => (minutes * mpd * 60_000) / DAY;

// -------------------------------------------------------------------------------------------------
describe('new world: the arrival and the seeded tide agree everywhere before the first tick', () => {
  test('createNewWorld starts on day 1 at 17:40 with the GDD tide seed', () => {
    const w = createNewWorld({ seedCode: SEED });
    assert.equal(w.clock.total, NEW_GAME_START_MINUTE);
    assert.equal(NEW_GAME_START_MINUTE, HM(17, 40));
    assert.equal(DAY1_LOW_MINUTE, HM(16, 40));
    assert.equal(clockSys.gameDay(w), 1);
    assert.equal(w.clock.seed, tideSeedFor());
    assert.equal(clockSys.tideSeedFor(), tideSeedFor(), 'clockSys re-exports the state search');
    assert.deepEqual(validateWorld(w), []);
  });

  test('selectors and clockSys read the same tide on a never-ticked world (every 7 min for 5 days)', () => {
    for (const code of [SEED, 'OTHER-SEED-XYZ', 'ZZZZ-9999']) {
      const w = createNewWorld({ seedCode: code });
      for (let t = 0; t < 5 * DAY; t += 7) {
        w.clock.total = t;
        assert.equal(selectors.tideState(w), clockSys.snapshot(w).tideState, `${code} @${t}`);
        assert.ok(Math.abs(selectors.tide(w) - clockSys.tideHeight(w)) < 1e-12);
      }
    }
  });

  test('the mainland causeway closes behind the player exactly at the arrival minute', () => {
    const w = createNewWorld({ seedCode: SEED });
    const win = clockSys.tideWindow(w, 'mainland');
    assert.equal(win.open, false, 'closed at 17:40');
    assert.equal(clockSys.gateTide(w, 'mainland'), 'rising', 'a rising tide behind you');
    assert.equal(clockSys.tideWindow(w, 'mainland', { total: NEW_GAME_START_MINUTE - 1e-6 }).open, true, 'open a hair before');
    assert.equal(clockSys.isNight(w), false, '17:40 is still afternoon');
    assert.equal(clockSys.dayPart(w).id, 'afternoon');
  });

  test('day n morning low = 05:05 + 50 min × (n − 2) until it wraps; evening lows 12 h 25 m later', () => {
    for (let n = 2; n <= 20; n++) {
      const expected = HM(5, 5) + 50 * (n - 2);
      if (expected >= DAY) break;
      const lows = clockSys.tidesForDay(n).filter((e) => e.kind === 'low');
      const i = lows.findIndex((e) => e.minute === expected);
      assert.ok(i >= 0, `day ${n}: a low at ${expected}, got ${lows.map((e) => e.time)}`);
      if (lows[i + 1]) assert.equal(lows[i + 1].minute - expected, TIDE_PERIOD_MINUTES);
    }
  });

  test('any 12.5-hour window holds a low (scan of 90 days)', () => {
    const w = createNewWorld({ seedCode: SEED });
    for (let t = 0; t < 90 * DAY; t += 13) {
      w.clock.total = t;
      const [next] = clockSys.nextLows(w, 1);
      assert.ok(next.total - t <= 750, `@${t}`);
    }
  });
});

// -------------------------------------------------------------------------------------------------
describe('tide windows: exact edges and minutesUntilChange', () => {
  const kinds = Object.keys(clockSys.DEFAULTS.TIDE_WINDOWS);

  test('every kind is open at low − h, closed at low + h, closed just before low − h', () => {
    const w = createNewWorld({ seedCode: SEED });
    for (const kind of kinds) {
      const h = clockSys.DEFAULTS.TIDE_WINDOWS[kind];
      // a lower low so the Bar qualifies too: day 2 17:30
      const low = DAY + HM(17, 30);
      assert.equal(clockSys.tideWindow(w, kind, { total: low - h }).open, true, `${kind} at low-h`);
      assert.equal(clockSys.tideWindow(w, kind, { total: low + h - 1e-7 }).open, true, `${kind} just before low+h`);
      assert.equal(clockSys.tideWindow(w, kind, { total: low + h }).open, false, `${kind} at low+h`);
      assert.equal(clockSys.tideWindow(w, kind, { total: low - h - 1e-7 }).open, false, `${kind} just before low-h`);
    }
  });

  test('stepping by minutesUntilChange always lands exactly on the flip (300 random instants per kind)', () => {
    const w = createNewWorld({ seedCode: SEED });
    const r = makeRng(7);
    for (const kind of kinds) {
      for (let i = 0; i < 300; i++) {
        const t = r.int(0, 60 * DAY) + r.next();
        const a = clockSys.tideWindow(w, kind, { total: t });
        assert.ok(Number.isFinite(a.minutesUntilChange) && a.minutesUntilChange > 0, `${kind}@${t}`);
        const b = clockSys.tideWindow(w, kind, { total: t + a.minutesUntilChange });
        assert.notEqual(b.open, a.open, `${kind}@${t} flips after ${a.minutesUntilChange}`);
        const c = clockSys.tideWindow(w, kind, { total: t + a.minutesUntilChange * 0.999 });
        assert.equal(c.open, a.open, `${kind}@${t} holds until the flip`);
      }
    }
  });

  test('the Bar follows exactly one lower low per calendar day for 400 days, 24 h 50 m apart except at the wrap', () => {
    let prev = null;
    for (let d = 1; d <= 400; d++) {
      const lower = clockSys.tidesForDay(d).filter((e) => e.lower);
      assert.equal(lower.length, 1, `day ${d}`);
      if (prev !== null) {
        const gap = lower[0].total - prev;
        assert.ok(gap === 2 * TIDE_PERIOD_MINUTES || gap === TIDE_PERIOD_MINUTES || gap === 3 * TIDE_PERIOD_MINUTES, `day ${d} gap ${gap}`);
      }
      prev = lower[0].total;
    }
  });

  test('the Bar is shut at a higher low and open at the lower one; lit.bar opens it at any tide', () => {
    const w = createNewWorld({ seedCode: SEED });
    assert.equal(clockSys.tideWindow(w, 'bar', { total: HM(4, 15) }).open, false, 'day 1 04:15 is the higher low');
    assert.equal(clockSys.tideWindow(w, 'spur', { total: HM(4, 15) }).open, true, 'the spur opens at every low');
    assert.equal(clockSys.tideWindow(w, 'bar', { total: HM(16, 40) }).open, true);
    flags.setFlag(w, 'lit.bar', true);
    assert.deepEqual(validateWorld(w), [], 'lit.bar is a valid flag id');
    const lit = clockSys.tideWindow(w, 'bar', { total: HM(10) });
    assert.equal(lit.open, true);
    assert.equal(lit.always, true);
    assert.equal(lit.minutesUntilChange, null);
  });

  test('huge totals near core MAX_TOTAL_MINUTES stay finite', () => {
    const w = createNewWorld({ seedCode: SEED });
    w.clock.total = MAX_TOTAL_MINUTES - 10;
    for (const kind of kinds) {
      const win = clockSys.tideWindow(w, kind);
      assert.ok(win.minutesUntilChange === null || Number.isFinite(win.minutesUntilChange));
    }
    const snap = clockSys.snapshot(w);
    assert.ok(Number.isFinite(snap.tide) && Number.isInteger(snap.gameDay));
    assert.ok(snap.tides.length >= 3);
  });

  test('unknown kinds throw; a malformed tide override throws', () => {
    const w = createNewWorld({ seedCode: SEED });
    assert.throws(() => clockSys.tideWindow(w, 'ferry'), RangeError);
    assert.throws(() => clockSys.tideWindow(w, 'causeway', { tide: 1.5 }), TypeError);
    assert.throws(() => clockSys.tideWindow(w, 'causeway', { tide: Number.NaN }), TypeError);
  });

  test('a clock built from different options is not mistaken for a frozen tide', () => {
    const w = createNewWorld({ seedCode: SEED });
    const odd = createClock({ seed: 'not-the-tide-seed' });
    odd.restore({ ...odd.serialize(), total: DAY + HM(17, 30) });
    const win = clockSys.tideWindow(w, 'causeway', { clock: odd });
    assert.notEqual(win.minutesUntilChange, null, 'schedule-based, not frozen');
  });

  test('freezeTide through {clock}: every window open at 0, closed at 1, nothing serialized', () => {
    const { world, clock } = bound();
    at(world, clock, 3, HM(12));
    clock.freezeTide(0);
    for (const kind of kinds) assert.equal(clockSys.tideWindow(world, kind, { clock }).open, true, kind);
    assert.equal(clockSys.gateTide(world, 'mainland', { clock }), 'low');
    clock.freezeTide(1);
    for (const kind of kinds) assert.equal(clockSys.tideWindow(world, kind, { clock }).open, false, kind);
    assert.equal(clockSys.gateTide(world, 'causeway', { clock }), 'high');
    assert.ok(!('frozenTide' in clock.serialize()) && !('tide' in clock.serialize()));
    clock.freezeTide(null);
    assert.equal(clockSys.tideWindow(world, 'causeway', { clock }).minutesUntilChange !== null, true);
  });
});

// -------------------------------------------------------------------------------------------------
describe('midnight wrap, day rollover, day-parts and night edges', () => {
  test('day-part and night boundaries', () => {
    assert.equal(clockSys.dayPartAt(0).id, 'deep-night');
    assert.equal(clockSys.dayPartAt(1439.999).id, 'night');
    assert.equal(clockSys.dayPartAt(-0.001).id, 'night', 'wraps negative minutes');
    assert.equal(clockSys.dayPartAt(DAY * 5 + HM(6)).id, 'morning', 'wraps large minutes');
    assert.equal(clockSys.isNightAt(HM(18)), true);
    assert.equal(clockSys.isNightAt(HM(18) - 1e-9), false);
    assert.equal(clockSys.isNightAt(HM(6)), false);
    assert.equal(clockSys.isNightAt(HM(6) - 1e-9), true);
    assert.throws(() => clockSys.dayPartAt(Number.NaN), TypeError);
    assert.throws(() => clockSys.isNightAt(Infinity), TypeError);
    const parts = clockSys.DAY_PARTS;
    assert.equal(parts.length, 8);
    for (let i = 0; i < 8; i++) assert.equal(parts[i].start, i * 180);
    assert.equal(parts.filter((p) => clockSys.isNightAt(p.start)).length, 4, 'night is exactly half');
  });

  test('ticking across midnight emits day:end then day:start once, Sunday → Monday, in order', () => {
    const { world, clock } = bound();
    at(world, clock, 1, DAY - 0.3);
    const { bus, seen } = recorder(['day:end', 'day:start', 'clock:hour', 'clock:dayPart', 'clock:anchor']);
    for (let i = 0; i < 10; i++) clockSys.tick(world, clock, 200, { bus });
    const days = seen.filter(([n]) => n.startsWith('day:'));
    assert.deepEqual(days.map(([n]) => n), ['day:end', 'day:start']);
    assert.deepEqual(days[1][1], { day: 1, gameDay: 2, dayOfWeek: 0, dayName: 'Mon', spring: false });
    assert.equal(days[0][1].gameDay, 1);
    assert.equal(seen.filter(([n]) => n === 'clock:dayPart').length, 1);
    assert.equal(seen.filter(([n]) => n === 'clock:anchor').length, 0);
    assert.equal(clockSys.gameDay(world), 2);
  });

  test('game days 7, 14, 21 are Saturday spring tides; day 1 is Sunday', () => {
    const { world, clock } = bound();
    const springs = [];
    for (let d = 1; d <= 28; d++) {
      at(world, clock, d, HM(12));
      const wd = clockSys.weekday(world);
      if (d === 1) assert.equal(wd.name, 'Sun');
      assert.equal(wd.isSaturday, d % 7 === 0, `day ${d}`);
      if (clockSys.isSpringTide(world)) springs.push(d);
    }
    assert.deepEqual(springs, [7, 14, 21, 28]);
    assert.throws(() => clockSys.isSpringTideDay(1.5), TypeError);
    assert.equal(clockSys.isSpringTideDay(0), false);
    assert.equal(clockSys.isSpringTideDay(-7), false);
  });

  test('tick rejects a negative or NaN ms without corrupting world.clock', () => {
    const { world, clock } = bound();
    const before = structuredClone(world.clock);
    assert.throws(() => clockSys.tick(world, clock, -1));
    assert.throws(() => clockSys.tick(world, clock, Number.NaN));
    assert.deepEqual(world.clock, before);
    const ev = clockSys.tick(world, clock, 0);
    assert.equal(ev.minutes, 0);
    assert.equal(ev.minute, null);
  });

  test('a single tick is clamped by core (250 ms) even for a huge ms', () => {
    const { world, clock } = bound();
    const t0 = clock.total;
    clockSys.tick(world, clock, 1e12);
    assert.ok(clock.total - t0 <= 250 * (DAY / (DEFAULT_MINUTES_PER_DAY * 60_000)) + 1e-9, 'at most 250 ms of game time');
  });
});

// -------------------------------------------------------------------------------------------------
describe('rest edges', () => {
  test('Sleep: 21:00 exactly is allowed, a hair earlier is not; after midnight it is', () => {
    const { world, clock } = bound();
    at(world, clock, 2, HM(21) - 1e-6);
    const no = clockSys.rest(world, clock, 'sleep');
    assert.equal(no.ok, false);
    assert.equal(no.reason, 'too-early');
    assert.equal(no.heal, 0);
    assert.equal(no.save, false);
    at(world, clock, 2, HM(21));
    const yes = clockSys.rest(world, clock, 'sleep');
    assert.equal(yes.ok, true);
    assert.equal(clockSys.minuteOfDay(world), HM(6));
    assert.equal(clockSys.gameDay(world), 3);
    at(world, clock, 4, HM(0));
    assert.equal(clockSys.rest(world, clock, 'sleep').ok, true, 'at 00:00');
    assert.equal(clockSys.gameDay(world), 4, 'same day, no midnight crossed');
  });

  test('Sleep at 05:50 wakes at 06:00 crossing only the morning anchor; at 06:00 it is refused', () => {
    const { world, clock } = bound();
    at(world, clock, 5, HM(5, 50));
    const { bus, seen } = recorder(['clock:anchor', 'day:start']);
    const r = clockSys.rest(world, clock, 'sleep', { bus });
    assert.equal(r.ok, true);
    assert.deepEqual(r.anchors, ['morning']);
    assert.deepEqual(seen.map(([n, p]) => p.id ?? n), ['morning']);
    const again = clockSys.rest(world, clock, 'sleep');
    assert.equal(again.ok, false);
    assert.equal(again.reason, 'too-early');
  });

  test('Nap: 12:00 ok, 11:59 too early, 18:00 too late; Lie down across midnight rolls the day', () => {
    const { world, clock } = bound();
    at(world, clock, 2, HM(12));
    assert.equal(clockSys.restOptions(world).options.find((o) => o.kind === 'nap').available, true);
    at(world, clock, 2, HM(11, 59));
    assert.equal(clockSys.restOptions(world).options.find((o) => o.kind === 'nap').reason, 'too-early');
    at(world, clock, 2, HM(18));
    assert.equal(clockSys.restOptions(world).options.find((o) => o.kind === 'nap').reason, 'too-late');
    at(world, clock, 2, HM(23, 55));
    const { bus, seen } = recorder(['day:end', 'day:start']);
    const lie = clockSys.rest(world, clock, 'lie', { bus });
    assert.equal(lie.ok, true);
    assert.equal(lie.minutes, 10);
    assert.equal(clockSys.minuteOfDay(world), 5);
    assert.deepEqual(seen.map(([n]) => n), ['day:end', 'day:start']);
  });

  test('Real Clock: the windows apply by device time, nothing skips, rest still heals and saves; Sit stays ×1', () => {
    const now = new Date(2026, 9, 23, 22, 0).getTime(); // 22:00 local
    const world = createNewWorld({ seedCode: SEED, settings: { realClock: true } });
    const clock = createClock({ ...clockSys.optionsFrom(world), now: () => now });
    clockSys.restoreFrom(world, clock);
    clockSys.tick(world, clock, 0); // syncs a real clock to the device time
    assert.ok(Math.abs(clock.minute - HM(22)) < 1e-6);
    const t0 = clock.total;
    const nap = clockSys.rest(world, clock, 'nap');
    assert.equal(nap.ok, false, 'nap is over by 22:00');
    assert.equal(nap.reason, 'too-late');
    for (const kind of ['lie', 'sleep']) {
      const r = clockSys.rest(world, clock, kind);
      assert.equal(r.ok, true, kind);
      assert.equal(r.skipped, false);
      assert.equal(r.minutes, 0);
      assert.equal(r.save, true);
      assert.ok(r.heal > 0);
      assert.equal(r.wakeMinute, clock.minute);
    }
    assert.equal(clock.total, t0, 'no skip');
    assert.equal(clockSys.sit(world, clock).speed, 1, 'Real Clock cannot be sped up');
    assert.equal(clock.speed, 1);
  });

  test('unknown rest kinds change nothing', () => {
    const { world, clock } = bound();
    const before = structuredClone(world.clock);
    for (const k of ['', 'SLEEP', null, undefined, 'sleep ']) {
      const r = clockSys.rest(world, clock, /** @type {any} */ (k));
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'unknown-kind');
    }
    assert.deepEqual(world.clock, before);
  });
});

// -------------------------------------------------------------------------------------------------
describe('save round trips through state/persist', () => {
  function game(seedCode = SEED) {
    const store = createStore(createNewWorld({ seedCode, lease: { name: 'Sorrel', mapId: 'harbor' } }));
    const rngs = createRngs(store);
    const clock = createClock(clockSys.optionsFrom(store.world));
    clockSys.restoreFrom(store.world, clock);
    store.onSnapshot((w) => clockSys.serializeInto(w, clock));
    const scenes = { top: () => ({ name: 'overworld' }), has: () => false, isTransitioning: () => false };
    return { store, rngs, clock, bus: store.bus, scenes };
  }

  test('a save taken mid porch-Sit (×6) loads at speed 1 and the same minute', () => {
    const G = game();
    G.store.tx('sit', (w) => clockSys.sit(w, G.clock));
    G.store.tx('tick', (w) => clockSys.tick(w, G.clock, 200));
    assert.equal(G.store.world.clock.speed, 6);
    const p = createPersist({ storage: new Map(), prefix: 'T.', now: () => 1 });
    const res = p.saveManual(G, 1);
    assert.equal(res.ok, true, JSON.stringify(res.error));
    const loaded = p.load('manual:1');
    assert.equal(loaded.ok, true, JSON.stringify(loaded.error));
    const clock2 = createClock(clockSys.optionsFrom(loaded.world));
    assert.deepEqual(clockSys.restoreFrom(loaded.world, clock2), { ok: true });
    assert.equal(clock2.speed, 1, 'a Sit never survives a load');
    assert.equal(clock2.paused, false);
    assert.equal(clock2.total, G.clock.total);
    assert.equal(clock2.serialize().seed, tideSeedFor());
  });

  test('weather and clock survive save → load → restore; the reloaded day does not re-roll or re-emit', () => {
    const G = game();
    G.store.tx('w', (w) => weather.update(w, null, G.rngs, { bus: G.bus }));
    for (let i = 0; i < 300; i++) G.store.tx('t', (w) => { clockSys.tick(w, G.clock, 200, { bus: G.bus }); weather.update(w, null, G.rngs, { bus: G.bus }); });
    const p = createPersist({ storage: new Map(), prefix: 'T.', now: () => 1 });
    assert.equal(p.saveManual(G, 2).ok, true);
    const loaded = p.load('manual:2');
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.world.weather, G.store.world.weather);
    const G2 = game();
    G2.store.replace(loaded.world);
    clockSys.restoreFrom(G2.store.world, G2.clock);
    const { bus, seen } = recorder(['weather:change']);
    const r = G2.store.tx('w', (w) => weather.update(w, null, G2.rngs, { bus }));
    assert.equal(r.rolled, false);
    assert.equal(seen.length, 0);
    assert.deepEqual(validateWorld(G2.store.world), []);
  });

  test('an older save (run seed in world.clock, speed 6, paused) migrates and binds to the GDD tide', () => {
    const w = createNewWorld({ seedCode: SEED });
    const legacy = structuredClone(w);
    legacy.clock = { ...legacy.clock, seed: w.run.seed, speed: 6, paused: true, total: DAY * 3 + HM(9) };
    const res = migrateWorld(JSON.parse(JSON.stringify(legacy)));
    assert.equal(res.ok, true, JSON.stringify(res.error));
    const migrated = res.world;
    const clock = createClock(clockSys.optionsFrom(migrated));
    assert.deepEqual(clockSys.restoreFrom(migrated, clock), { ok: true });
    assert.equal(clock.speed, 1);
    assert.equal(clock.paused, false);
    assert.equal(clock.total, DAY * 3 + HM(9));
    // after the next tick the world mirrors the tide seed and selectors agree with the live clock
    clockSys.tick(migrated, clock, 100);
    assert.equal(migrated.clock.seed, tideSeedFor());
    assert.equal(selectors.tideState(migrated), clock.tideState);
  });

  test('malformed world.clock states are refused and rewritten from the live clock', () => {
    for (const bad of [null, 'x', 42, [], { total: -5 }, { total: Number.NaN }, { version: 999, total: 10 }]) {
      const { world, clock } = bound();
      const t0 = clock.total;
      world.clock = /** @type {any} */ (bad);
      const r = clockSys.restoreFrom(world, clock);
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.equal(clock.total, t0);
      assert.deepEqual(world.clock, clock.serialize());
    }
  });
});

// -------------------------------------------------------------------------------------------------
describe('long simulation: 60 game days of clock + weather', () => {
  test('no drift, no NaN, every midnight and anchor once, weather rolls once a day and stays valid', () => {
    const store = createStore(createNewWorld({ seedCode: SEED }));
    const rngs = createRngs(store);
    const clock = createClock({ ...clockSys.optionsFrom(store.world), minutesPerDay: 12 });
    clockSys.restoreFrom(store.world, clock);
    const { bus, seen } = recorder(['day:start', 'day:end', 'clock:anchor', 'weather:change', 'tide:change', 'clock:dayPart']);
    store.tx('sit', (w) => clockSys.sit(w, clock));
    const startTotal = clock.total;
    let rolls = 0;
    let sum = 0;
    let lastTotal = startTotal;
    const DAYS = 60;
    while (clock.total < startTotal + DAYS * DAY) {
      const ev = store.tx('tick', (w) => clockSys.tick(w, clock, 200, { bus }));
      const u = store.tx('w', (w) => weather.update(w, null, rngs, { bus }));
      if (u.rolled) rolls++;
      sum += ev.minutes;
      assert.ok(Number.isFinite(clock.total) && clock.total > lastTotal);
      lastTotal = clock.total;
    }
    assert.ok(Math.abs(clock.total - startTotal - sum) < 1e-6, 'reported minutes add up to elapsed time');
    const starts = seen.filter(([n]) => n === 'day:start').map(([, p]) => p.gameDay);
    assert.deepEqual(starts, Array.from({ length: DAYS }, (_, i) => i + 2));
    assert.equal(seen.filter(([n]) => n === 'day:end').length, DAYS);
    const anchors = seen.filter(([n]) => n === 'clock:anchor').map(([, p]) => `${p.gameDay}:${p.id}`);
    assert.equal(anchors.length, 2 * DAYS);
    for (let i = 0; i < DAYS; i++) assert.deepEqual(anchors.slice(2 * i, 2 * i + 2), [`${i + 2}:builds`, `${i + 2}:morning`]);
    // order: every day:start precedes that day's builds anchor
    const order = seen.filter(([n]) => n === 'day:start' || n === 'clock:anchor').map(([n, p]) => (n === 'day:start' ? `S${p.gameDay}` : `${p.id[0]}${p.gameDay}`));
    for (let d = 2; d <= DAYS + 1; d++) assert.ok(order.indexOf(`S${d}`) < order.indexOf(`b${d}`), `day ${d}`);
    const springs = seen.filter(([n, p]) => n === 'day:start' && p.spring).map(([, p]) => p.gameDay);
    assert.deepEqual(springs, [7, 14, 21, 28, 35, 42, 49, 56]);
    assert.equal(rolls, DAYS + 1, 'one roll on day 1 and one per day after');
    assert.equal(seen.filter(([n]) => n === 'clock:dayPart').length, 8 * DAYS);
    // ~4 tide changes per tide cycle (low→rising→high→falling) ~ 1.93 cycles a day
    const tides = seen.filter(([n]) => n === 'tide:change').length;
    assert.ok(tides > 3.5 * 1.9 * DAYS && tides < 4.5 * 1.95 * DAYS, `tide changes ${tides}`);
    assert.deepEqual(validateWorld(store.world), []);
    for (const [n, p] of seen) if (n === 'weather:change') assert.ok(typeof p.kind === 'string' && p.kind !== p.previous);
  });
});

// -------------------------------------------------------------------------------------------------
describe('weather adversarial', () => {
  test('yesterday’s posted outlook is today’s forecast, for 300 days', () => {
    const w = createNewWorld({ seedCode: SEED });
    const rng = makeRng(w.run.seed);
    let posted = null;
    for (let d = 1; d <= 300; d++) {
      w.clock.total = (d - 1) * DAY + HM(7);
      weather.update(w, null, rng);
      if (posted) assert.deepEqual(w.weather.forecast, posted, `day ${d}`);
      posted = w.weather.outlook;
      assert.equal(w.weather.tomorrow, posted.kind);
    }
  });

  test('weather:change fires exactly when the clock crosses the onset minute', () => {
    const w = createNewWorld({ seedCode: SEED });
    const rng = makeRng(w.run.seed);
    let checked = 0;
    for (let d = 2; d <= 80 && checked < 10; d++) {
      w.clock.total = (d - 1) * DAY;
      weather.update(w, null, rng);
      if (w.weather.lead === w.weather.today || w.weather.onset === 0) continue;
      const { bus, seen } = recorder(['weather:change']);
      w.clock.total = (d - 1) * DAY + w.weather.onset - 0.01;
      assert.equal(weather.update(w, null, rng, { bus }).changed, false);
      w.clock.total = (d - 1) * DAY + w.weather.onset;
      assert.equal(weather.update(w, null, rng, { bus }).changed, true);
      assert.equal(seen.length, 1);
      assert.equal(seen[0][1].kind, w.weather.today);
      checked++;
    }
    assert.ok(checked >= 5, `found ${checked} days with a lead`);
  });

  test('a pin is honoured, posted at 10 in 10, and cleared after its day', () => {
    const w = createNewWorld({ seedCode: SEED });
    const rng = makeRng(w.run.seed);
    weather.update(w, null, rng);
    weather.pinDay(w, null, 'storm');
    assert.equal(w.weather.outlook.odds, 10);
    w.clock.total = DAY + HM(8);
    weather.update(w, null, rng);
    assert.equal(w.weather.today, 'storm');
    assert.equal(w.weather.forecast.kind, 'storm');
    w.clock.total = 2 * DAY + HM(8);
    weather.update(w, null, rng);
    assert.equal(w.weather.pinned, null);
    assert.throws(() => weather.pinDay(w, null, 'hail'), RangeError);
    assert.throws(() => weather.pinDay(w, null, 'rain', { day: 1 }), RangeError);
    assert.throws(() => weather.pinDay(w, null, 'rain', { day: 3.5 }), RangeError);
  });

  test('malformed tuning and kind rows are rejected with TypeError', () => {
    const rng = makeRng(1);
    for (const bad of [
      { WEATHER_WEIGHTS: { clear: 0 } }, { WEATHER_WEIGHTS: { Clear: 3 } }, { WEATHER_ODDS_WEIGHTS: [[11, 1]] },
      { WEATHER_ODDS_WEIGHTS: [] }, { WEATHER_ONSET_LEAD: [5, 1] }, { WEATHER_INTENSITY: { rain: [0, 2] } },
      { WEATHER_EFFECTS: { rain: [{ target: 'moon', tag: '*', mult: 1 }] } }, { WEATHER_OVERLAY_CAP: 2 }, { WEATHER_FIXED: { 0: 'clear' } },
    ]) assert.throws(() => weather.planDay(2, { tuning: bad }, rng), TypeError, JSON.stringify(bad));
    assert.throws(() => weather.kinds({ weather: [{ id: 'Bad Id' }] }), TypeError);
    assert.throws(() => weather.kinds({ weather: [{ id: 'mizzle', lead: 'nope' }] }), TypeError);
    assert.throws(() => weather.planDay(0, null, rng), TypeError);
    assert.throws(() => weather.planDay(2, null, {}), TypeError);
    assert.throws(() => weather.planDay(2, { tuning: { WEATHER_FIXED: { 2: 'hail' } } }, rng), RangeError);
  });

  test('a climate with a single kind posts certainty and is always right', () => {
    const data = { tuning: { WEATHER_WEIGHTS: { fog: 1 }, WEATHER_FIXED: {} } };
    const rng = makeRng(5);
    for (let d = 1; d <= 50; d++) {
      const p = weather.planDay(d, data, rng);
      assert.equal(p.kind, 'fog');
      assert.equal(p.forecast.odds, 10);
      assert.equal(p.cameTrue, true);
    }
  });

  test('effect multipliers: fog draws silver fish, rain bugs, storms Errant lightning; clear does nothing', () => {
    const w = createNewWorld({ seedCode: SEED });
    const set = (kind) => { w.weather = { ...w.weather, day: 1, today: kind, lead: kind, current: kind, onset: 0, intensity: 0.5 }; };
    set('fog');
    assert.equal(weather.multiplierFor(w, null, 'fish', 'silver'), 2);
    assert.equal(weather.multiplierFor(w, null, 'fish', 'gold'), 1);
    set('rain');
    assert.ok(weather.multiplierFor(w, null, 'bug', 'any') > 1);
    set('storm');
    assert.ok(weather.multiplierFor(w, null, 'errant', 'lightning') > 1);
    assert.equal(weather.hasBranch(w, null, 'errant-lightning'), true);
    set('clear');
    for (const t of weather.EFFECT_TARGETS) assert.equal(weather.multiplierFor(w, null, t, 'x'), 1);
    assert.throws(() => weather.multiplierFor(w, null, 'moon'), RangeError);
    assert.ok(weather.current(w).overlay <= 0.35);
  });
});

// -------------------------------------------------------------------------------------------------
describe('determinism across processes', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const script = `
    import * as weather from '${here}../js/systems/weather.js';
    import * as clockSys from '${here}../js/systems/clockSys.js';
    import { makeRng } from '${here}../js/core/rng.js';
    import { createNewWorld } from '${here}../js/state/schema.js';
    const w = createNewWorld({ seedCode: '${SEED}' });
    const rng = makeRng(w.run.seed);
    const out = { seed: clockSys.tideSeedFor(), plans: [], tides: [] };
    for (let d = 1; d <= 40; d++) { out.plans.push(weather.planDay(d, null, rng)); out.tides.push(clockSys.tidesForDay(d)); }
    process.stdout.write(JSON.stringify(out));
  `;
  test('a fresh Node process computes the same tide seed, tide tables and weather plans', () => {
    const child = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }));
    const w = createNewWorld({ seedCode: SEED });
    const rng = makeRng(w.run.seed);
    assert.equal(child.seed, clockSys.tideSeedFor());
    for (let d = 1; d <= 40; d++) {
      assert.deepEqual(child.plans[d - 1], JSON.parse(JSON.stringify(weather.planDay(d, null, rng))), `plan ${d}`);
      assert.deepEqual(child.tides[d - 1], JSON.parse(JSON.stringify(clockSys.tidesForDay(d))), `tides ${d}`);
    }
  });

  test('the same plan comes from the master Rng, a state/rngs registry and a label function', () => {
    const store = createStore(createNewWorld({ seedCode: SEED }));
    const rngs = createRngs(store);
    const master = makeRng(store.world.run.seed);
    for (let d = 1; d <= 20; d++) {
      const a = weather.planDay(d, null, master);
      assert.deepEqual(weather.planDay(d, null, rngs), a);
      assert.deepEqual(weather.planDay(d, null, (label) => master.fork(label)), a);
    }
  });
});

// -------------------------------------------------------------------------------------------------
describe('core/time additions under stress', () => {
  test('setMinutesPerDay mid-run: total does not move; the rate changes from the next update', () => {
    const { world, clock } = bound();
    const t0 = clock.total;
    const r = clockSys.applySettingsEffects(world, clock, [{ kind: 'clock.minutesPerDay', minutesPerDay: 12 }]);
    assert.deepEqual(r, { applied: ['clock.minutesPerDay'], pending: [] });
    assert.equal(clock.total, t0);
    clockSys.tick(world, clock, 200);
    assert.ok(Math.abs(clock.total - t0 - (200 * DAY) / (12 * 60_000)) < 1e-9, '200 ms at 12 min/day = 0.4 game minutes');
    for (const bad of [0, -1, Number.NaN, Infinity, '24']) assert.throws(() => clock.setMinutesPerDay(/** @type {any} */ (bad)), String(bad));
    assert.throws(() => clock.setMinutesPerDay(Number.MIN_VALUE), RangeError, 'outside the measurable range');
  });

  test('freezeTide rejects out-of-range heights and keeps the pin across restore', () => {
    const clock = createClock({ seed: tideSeedFor() });
    for (const bad of [-0.01, 1.01, Number.NaN, '0.5', undefined]) assert.throws(() => clock.freezeTide(/** @type {any} */ (bad)), String(bad));
    clock.freezeTide(0.05);
    clock.restore({ ...clock.serialize(), total: 9999 });
    assert.equal(clock.tide, 0.05);
    assert.equal(clock.tideState, 'low');
    clock.freezeTide(0.5);
    assert.equal(clock.tideState, 'rising', 'between thresholds a pinned tide reads rising');
  });
});
