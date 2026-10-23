// Adversarial tests for js/core/time.js: malformed input, boundaries, determinism,
// state round-trips, huge and tiny inputs, listener edge cases, unicode seeds and
// real-clock mode. Run: node --test test/time.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as mod from '../js/core/time.js';

const {
  MINUTES_PER_DAY,
  TIDE_PERIOD_MINUTES,
  LUNAR_MONTH_DAYS,
  PHASES,
  TIDE_STATES,
  MAX_TOTAL_MINUTES,
  MAX_DAY,
  DEFAULT_MAX_CATCH_UP_MINUTES,
  phaseOfMinute,
  daylightOfMinute,
  formatMinute,
  tidePhaseAt,
  tideAt,
  tideStateAt,
  scheduleForSeed,
  gameCalendar,
  realTimeToTotal,
  realCalendar,
  createClock,
} = mod;

const HALF = TIDE_PERIOD_MINUTES / 2;
const MODULE_URL = new URL('../js/core/time.js', import.meta.url).href;
const localMs = (y, mo, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, mo, d, h, mi, s, ms).getTime();

/** A game-mode clock at an arbitrary total with the dt clamp off (1000 ms = 1 minute). */
function clockAt(total, extra = {}) {
  const day = Math.floor(total / MINUTES_PER_DAY);
  return createClock({ startDay: day, startMinute: total - day * MINUTES_PER_DAY, maxDt: Infinity, ...extra });
}

/** Runs an ES-module snippet in a fresh Node process with the module imported as `m`. */
function inChildProcess(body) {
  const src = `const m = await import(${JSON.stringify(MODULE_URL)});\nconst out = await (async () => { ${body} })();\nprocess.stdout.write(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8' }));
}

/** Reads every getter once and checks the documented invariants; returns the snapshot. */
function checkInvariants(clock, where) {
  const s = clock.snapshot();
  assert.ok(Number.isFinite(s.total), `${where}: total ${s.total}`);
  assert.ok(s.minute >= 0 && s.minute < MINUTES_PER_DAY, `${where}: minute ${s.minute}`);
  assert.ok(Number.isInteger(s.day), `${where}: day ${s.day}`);
  assert.ok(Math.abs(s.day * MINUTES_PER_DAY + s.minute - s.total) <= 1e-6 * Math.max(1, s.total), `${where}: day/minute vs total`);
  assert.ok(Number.isInteger(s.hour) && s.hour >= 0 && s.hour <= 23, `${where}: hour ${s.hour}`);
  assert.ok(Number.isInteger(s.minuteOfHour) && s.minuteOfHour >= 0 && s.minuteOfHour <= 59, `${where}: minuteOfHour`);
  assert.ok(s.dayOfWeek >= 0 && s.dayOfWeek <= 6, `${where}: dayOfWeek`);
  assert.ok(PHASES.includes(s.phase), `${where}: phase ${s.phase}`);
  assert.ok(s.daylight >= 0 && s.daylight <= 1, `${where}: daylight`);
  assert.equal(s.isNight, s.phase === 'night' || s.phase === 'evening', `${where}: isNight`);
  assert.ok(s.tide >= 0 && s.tide <= 1, `${where}: tide ${s.tide}`);
  assert.ok(TIDE_STATES.includes(s.tideState), `${where}: tideState`);
  assert.equal(s.isLowTide, s.tide < 0.2, `${where}: isLowTide`);
  assert.equal(s.isHighTide, s.tide > 0.8, `${where}: isHighTide`);
  assert.ok(s.nextLowTide >= 0 && s.nextLowTide < TIDE_PERIOD_MINUTES, `${where}: nextLowTide ${s.nextLowTide}`);
  assert.ok(s.nextHighTide >= 0 && s.nextHighTide < TIDE_PERIOD_MINUTES, `${where}: nextHighTide ${s.nextHighTide}`);
  assert.ok(s.moonPhase >= 0 && s.moonPhase < 1, `${where}: moonPhase`);
  assert.ok(s.tideRange >= 0.6 - 1e-12 && s.tideRange <= 1 + 1e-12, `${where}: tideRange`);
  assert.match(s.time, /^\d\d:\d\d$/, `${where}: time`);
  assert.equal(typeof s.date, 'string');
  const tides = clock.tidesToday;
  assert.ok(tides.length >= 3 && tides.length <= 4, `${where}: ${tides.length} tides today`);
  return s;
}

// ---------------------------------------------------------------------------

describe('import hygiene', () => {
  it('imports without touching document or window and exports only functions and frozen data', () => {
    const out = inChildProcess(`
      globalThis.document = new Proxy({}, { get() { throw new Error('document touched'); } });
      globalThis.window = new Proxy({}, { get() { throw new Error('window touched'); } });
      const fresh = await import(${JSON.stringify(`${MODULE_URL}?fresh`)});
      return Object.entries(fresh).map(([k, v]) => [k, typeof v, typeof v === 'object' ? Object.isFrozen(v) : null]);
    `);
    for (const [name, type, frozen] of out) {
      assert.ok(['function', 'number', 'object'].includes(type), `${name} is ${type}`);
      if (type === 'object') assert.equal(frozen, true, `${name} must be frozen`);
    }
  });

  it('is deterministic across processes', () => {
    const run = () => inChildProcess(`
      const c = m.createClock({ seed: 'cross-process', maxDt: Infinity });
      const trace = [];
      c.onTideChange((e) => trace.push([e.previous, e.state, c.total]));
      for (let i = 0; i < 2000; i++) { if (i % 7 === 0) c.setSpeed(1 + (i % 5)); c.update(333.3); }
      return { snap: c.snapshot(), trace, tides: c.tidesToday, schedule: m.scheduleForSeed('cross-process') };
    `);
    assert.deepEqual(run(), run());
  });
});

// ---------------------------------------------------------------------------

describe('pure helpers: malformed and edge input', () => {
  it('reject bigint, boxed numbers, arrays, symbols and objects with valueOf', () => {
    const bad = [1n, new Number(5), [5], Symbol('m'), { valueOf: () => 5 }, '5', true, () => 5];
    for (const v of bad) {
      assert.throws(() => phaseOfMinute(v), TypeError, `phaseOfMinute(${String(v)})`);
      assert.throws(() => daylightOfMinute(v), TypeError);
      assert.throws(() => formatMinute(v), TypeError);
      assert.throws(() => tidePhaseAt(v), TypeError);
      assert.throws(() => tideAt(5, v), TypeError);
      assert.throws(() => gameCalendar(v), TypeError);
      assert.throws(() => realTimeToTotal(v), TypeError);
      assert.throws(() => realCalendar(v), TypeError);
    }
  });

  it('accept -0 and the minute just below midnight', () => {
    assert.equal(phaseOfMinute(-0), 'night');
    assert.equal(formatMinute(-0), '00:00');
    assert.equal(formatMinute(-0, { hour12: true }), '12:00 AM');
    assert.equal(daylightOfMinute(-0), 0);
    const last = 1439.9999999999998;
    assert.ok(last < MINUTES_PER_DAY);
    assert.equal(formatMinute(last), '23:59');
    assert.equal(phaseOfMinute(last), 'night');
    assert.equal(gameCalendar(-0).dayName, 'Mon');
  });

  it('formatMinute ignores unknown options and tolerates a null options bag', () => {
    assert.equal(formatMinute(65, { hour12: false, bogus: 1 }), '01:05');
    assert.throws(() => formatMinute(65, null), TypeError);
    assert.equal(formatMinute(65, undefined), '01:05');
  });

  it('tide helpers stay exact at huge totals and with fractional offsets', () => {
    for (const total of [MAX_TOTAL_MINUTES, 2 ** 52 + 0.5, 1e15 + 0.25]) {
      const p = tidePhaseAt(total, 123.456);
      assert.ok(p >= 0 && p < 1, `phase ${p} at ${total}`);
      const t = tideAt(total, 123.456);
      assert.ok(t >= 0 && t <= 1);
      assert.ok(TIDE_STATES.includes(tideStateAt(total, 123.456)));
    }
    assert.equal(tidePhaseAt(10.25, 10.25), 0);
    assert.equal(tideStateAt(10.25 + HALF, 10.25), 'high');
    assert.equal(tideStateAt(-5, 0), 'low');
    assert.equal(tideStateAt(0, 0, { lowTide: 0.5, highTide: 0.51 }), 'low');
  });

  it('tideStateAt is cyclic in the canonical order for every seed offset and threshold pair', () => {
    for (const offset of [0, 1, 372, 373, 744, 744.9]) {
      for (const thresholds of [{}, { lowTide: 0.01, highTide: 0.99 }, { lowTide: 0.49, highTide: 0.51 }]) {
        const seen = [];
        for (let t = offset; t < offset + 2 * TIDE_PERIOD_MINUTES; t += 0.5) {
          const s = tideStateAt(t, offset, thresholds);
          if (seen.at(-1) !== s) seen.push(s);
        }
        assert.deepEqual(seen, ['low', 'rising', 'high', 'falling', 'low', 'rising', 'high', 'falling', 'low'], `offset ${offset} ${JSON.stringify(thresholds)}`);
      }
    }
  });

  it('gameCalendar handles enormous and negative days and unusual season lengths', () => {
    const big = gameCalendar(2 ** 40);
    assert.ok(big.year > 0 && big.dayOfSeason >= 1 && big.dayOfSeason <= 28);
    assert.equal(gameCalendar(2 ** 40).dayOfWeek, (2 ** 40) % 7);
    const neg = gameCalendar(-113); // -113 = -2 * 112 + 111: the last day of year -1
    assert.equal(neg.year, -1);
    assert.equal(neg.season, 'winter');
    assert.equal(neg.dayOfSeason, 28);
    assert.equal(gameCalendar(-112).dateText, 'Spring 1');
    const one = gameCalendar(3, 1);
    assert.equal(one.season, 'winter');
    assert.equal(gameCalendar(4, 1).year, 2);
    assert.throws(() => gameCalendar(1, -1), RangeError);
    assert.throws(() => gameCalendar(1, Infinity), TypeError);
    assert.throws(() => gameCalendar(Number.MAX_VALUE * 2), TypeError);
  });

  it('scheduleForSeed treats unicode seeds by UTF-16 code units, deterministically', () => {
    const seeds = ['', ' ', 'é', 'e\u0301', 'ß∆', '日本語の潮', '🌊🌙', '\uD83C', '\u0000', 'a'.repeat(10_000), '42', ' 42', '42 '];
    const results = seeds.map((s) => scheduleForSeed(s));
    for (const [i, r] of results.entries()) {
      assert.ok(Number.isInteger(r.tideOffset) && r.tideOffset >= 0 && r.tideOffset < TIDE_PERIOD_MINUTES, seeds[i]);
      assert.ok(r.moonOffset >= 0 && r.moonOffset < LUNAR_MONTH_DAYS, seeds[i]);
      assert.deepEqual(scheduleForSeed(seeds[i]), r, `stable: ${JSON.stringify(seeds[i])}`);
    }
    assert.notDeepEqual(scheduleForSeed('é'), scheduleForSeed('e\u0301'), 'NFC and NFD are different seeds');
    assert.notDeepEqual(scheduleForSeed(''), scheduleForSeed(null), 'the empty string is a real seed, not "no seed"');
    assert.deepEqual(scheduleForSeed(-0), scheduleForSeed(0));
    assert.deepEqual(scheduleForSeed(1e21), scheduleForSeed('1e+21'));
    assert.throws(() => scheduleForSeed(1n), TypeError);
    assert.throws(() => scheduleForSeed(new String('x')), TypeError);
  });

  it('realTimeToTotal and realCalendar refuse instants and days Date cannot represent', () => {
    assert.throws(() => realTimeToTotal(1e20), RangeError);
    assert.throws(() => realTimeToTotal(-1e20), RangeError);
    assert.throws(() => realTimeToTotal(8.64e15), RangeError);
    assert.throws(() => realCalendar(1e13), RangeError);
    assert.throws(() => realCalendar(-1e13), RangeError);
    assert.throws(() => realCalendar(Number.MAX_SAFE_INTEGER), RangeError);
    // Near the edges everything still computes to finite, named values.
    for (const ms of [8.64e15 - 2 * 86_400_000, -8.64e15 + 2 * 86_400_000, 0, -1]) {
      const total = realTimeToTotal(ms);
      assert.ok(Number.isFinite(total));
      const cal = realCalendar(Math.floor(total / MINUTES_PER_DAY));
      assert.ok(Number.isInteger(cal.year), `year ${cal.year}`);
      assert.ok(cal.season && cal.dayName && !/NaN|undefined/.test(cal.dateText), cal.dateText);
    }
    // Day numbering is offset so weekdays line up: 1969-12-29 (a Monday) is day 0, so negatives start before it.
    assert.equal(Math.floor(realTimeToTotal(localMs(1969, 11, 29, 12)) / MINUTES_PER_DAY), 0);
    assert.equal(realCalendar(0).dayName, 'Mon');
    assert.equal(Math.floor(realTimeToTotal(localMs(1969, 11, 28, 12)) / MINUTES_PER_DAY), -1);
    const before = realTimeToTotal(localMs(1969, 5, 1, 23, 59));
    assert.ok(before < 0, 'pre-1970 instants map to negative totals');
    assert.equal(realCalendar(Math.floor(before / MINUTES_PER_DAY)).dateText, 'Jun 1');
  });
});

// ---------------------------------------------------------------------------

describe('createClock: malformed options', () => {
  it('rejects every non-number, bigint, boxed and out-of-range option', () => {
    const cases = [
      [{ minutesPerDay: 1n }, TypeError],
      [{ minutesPerDay: new Number(24) }, TypeError],
      [{ minutesPerDay: Number.MIN_VALUE }, RangeError],
      [{ minutesPerDay: Number.MAX_VALUE }, RangeError],
      [{ startDay: MAX_DAY + 1 }, RangeError],
      [{ startDay: Number.MAX_SAFE_INTEGER }, RangeError],
      [{ startDay: -0.5 }, RangeError],
      [{ startMinute: 1439.99999 }, null],
      [{ startMinute: Infinity }, TypeError],
      [{ startMinute: -0 }, null],
      [{ seed: Symbol('s') }, TypeError],
      [{ seed: 1n }, TypeError],
      [{ seed: [] }, TypeError],
      [{ seed: () => 'x' }, TypeError],
      [{ seed: '' }, null],
      [{ realClock: 'true' }, TypeError],
      [{ realClock: null }, null],
      [{ now: null }, null],
      [{ now: {} }, TypeError],
      [{ now: async () => 0 }, null],
      [{ lowTide: 1 }, RangeError],
      [{ lowTide: NaN }, TypeError],
      [{ highTide: 0 }, RangeError],
      [{ highTide: 0.2 }, RangeError],
      [{ lowTide: 0.199, highTide: 0.2 }, null],
      [{ maxDt: -Infinity }, TypeError],
      [{ maxDt: '250' }, TypeError],
      [{ maxCatchUpMinutes: 0 }, RangeError],
      [{ maxCatchUpMinutes: NaN }, TypeError],
      [{ daysPerSeason: Infinity }, TypeError],
      [{ daysPerSeason: 1 }, null],
    ];
    for (const [opts, type] of cases) {
      if (type) assert.throws(() => createClock(opts), type, JSON.stringify(opts, (k, v) => (typeof v === 'bigint' ? `${v}n` : v)));
      else assert.doesNotThrow(() => createClock(opts), JSON.stringify(opts));
    }
  });

  it('accepts a null-prototype or frozen options bag and ignores unknown keys', () => {
    const bare = Object.create(null);
    bare.startMinute = 5;
    assert.equal(createClock(bare).minute, 5);
    assert.equal(createClock(Object.freeze({ startMinute: 6, bogus: 'x' })).minute, 6);
  });

  it('does not keep a reference to the options object', () => {
    const opts = { startMinute: 100, seed: 'ref' };
    const clock = createClock(opts);
    opts.startMinute = 200;
    opts.seed = 'other';
    assert.equal(clock.minute, 100);
    assert.equal(clock.serialize().seed, 'ref');
  });

  it('does not call now() in game mode, even when it would throw', () => {
    let calls = 0;
    const clock = createClock({ now: () => { calls++; throw new Error('never'); } });
    clock.update(16);
    clock.skipTo(0);
    clock.serialize();
    clock.snapshot();
    assert.equal(calls, 0);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: update() edge values', () => {
  it('treats -0, subnormal and epsilon dts as tiny forward steps that never cross a boundary', () => {
    const clock = clockAt(100);
    let hits = 0;
    clock.onMinute(() => hits++);
    clock.update(-0);
    assert.equal(clock.total, 100);
    clock.update(Number.MIN_VALUE);
    clock.update(Number.EPSILON);
    assert.ok(clock.total >= 100 && clock.total < 100.000001);
    assert.equal(hits, 0);
  });

  it('rejects bigint, boxed, array and object dts', () => {
    const clock = createClock();
    for (const bad of [1n, new Number(16), [16], { valueOf: () => 16 }, null, true]) {
      assert.throws(() => clock.update(bad), TypeError, String(bad));
    }
    assert.equal(clock.total, 1120);
  });

  it('clamps a Number.MAX_VALUE dt to maxDt, or to the end of time without a clamp', () => {
    const clamped = createClock();
    clamped.update(Number.MAX_VALUE);
    assert.equal(clamped.total, 1120.25);
    const open = createClock({ maxDt: Infinity, maxCatchUpMinutes: 100 });
    open.update(Number.MAX_VALUE);
    assert.equal(open.total, MAX_TOTAL_MINUTES);
    checkInvariants(open, 'end of time');
    open.update(1000);
    assert.equal(open.total, MAX_TOTAL_MINUTES, 'stays put at the end of time');
    assert.doesNotThrow(() => open.skipTo(0));
    assert.equal(open.total, MAX_TOTAL_MINUTES);
  });

  it('survives an absurd speed and a hairline minutesPerDay with every getter still finite', () => {
    const fast = createClock({ maxDt: Infinity, maxCatchUpMinutes: 10 });
    fast.setSpeed(Number.MAX_VALUE);
    fast.update(1);
    assert.equal(fast.total, MAX_TOTAL_MINUTES);
    checkInvariants(fast, 'max speed');
    const hair = createClock({ minutesPerDay: 1e-300, maxDt: Infinity, maxCatchUpMinutes: 10 });
    hair.update(1);
    assert.equal(hair.total, MAX_TOTAL_MINUTES);
    checkInvariants(hair, 'hairline minutesPerDay');
    const slow = createClock({ minutesPerDay: 1e300, maxDt: Infinity });
    slow.update(1e6); // a 2.4e-293-minute step: below double resolution at 1120, so time simply holds
    assert.equal(slow.total, 1120);
    checkInvariants(slow, 'glacial minutesPerDay');
  });

  it('keeps every getter inside its documented range across a long jittery run with sub-minute steps', () => {
    const clock = createClock({ seed: 'jitter', startMinute: 0, maxDt: Infinity });
    const dts = [16.67, 33.33, 7.1, 0, 250, 1234.5, 0.001, 99.9];
    let last = 0;
    for (let i = 0; i < 60_000; i++) {
      if (i % 1000 === 0) clock.setSpeed(0.25 + (i % 7000) / 1000);
      clock.update(dts[i % dts.length]);
      assert.ok(clock.total >= last, 'monotonic');
      last = clock.total;
      if (i % 97 === 0) checkInvariants(clock, `step ${i}`);
    }
    assert.ok(clock.day >= 3, `reached day ${clock.day}`);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: boundary event accounting', () => {
  it('counts exactly the whole minutes, hours and days crossed by a huge single catch-up', () => {
    const clock = clockAt(3 * MINUTES_PER_DAY - 0.5, { seed: 'count' });
    const counts = { minute: 0, hour: 0, day: 0 };
    const totals = [];
    clock.onMinute((e) => { counts.minute++; totals.push(e.total); });
    clock.onHour(() => counts.hour++);
    clock.onDayStart(() => counts.day++);
    clock.update(DEFAULT_MAX_CATCH_UP_MINUTES * 1000); // exactly the replay limit: 7 days of minutes
    assert.deepEqual(counts, { minute: 10_080, hour: 168, day: 7 });
    assert.equal(totals[0], 3 * MINUTES_PER_DAY);
    for (let i = 1; i < totals.length; i++) assert.equal(totals[i], totals[i - 1] + 1);
    assert.equal(clock.total, 3 * MINUTES_PER_DAY - 0.5 + DEFAULT_MAX_CATCH_UP_MINUTES);
  });

  it('a jump a hair over maxCatchUpMinutes is silent, exactly at the limit it replays', () => {
    const atLimit = clockAt(0, { maxCatchUpMinutes: 60 });
    let n = 0;
    atLimit.onMinute(() => n++);
    atLimit.update(60_000);
    assert.equal(n, 60);
    const over = clockAt(0, { maxCatchUpMinutes: 60 });
    let m = 0;
    over.onMinute(() => m++);
    over.update(60_000.5);
    assert.equal(m, 0);
    assert.ok(over.total > 60 && over.total < 60.001);
    over.update(1000);
    assert.equal(m, 1, 'minute 61 after the silent resync');
  });

  it('maxCatchUpMinutes: Infinity replays a month of minutes with tide changes in canonical order', () => {
    const clock = clockAt(0, { maxCatchUpMinutes: Infinity, seed: 'month' });
    const startState = tideStateAt(0, scheduleForSeed('month').tideOffset);
    assert.equal(clock.tideState, startState);
    const states = [];
    let minutes = 0;
    clock.onMinute(() => minutes++);
    clock.onTideChange((e) => {
      assert.equal(e.previous, states.at(-1) ?? startState, 'previous chains from the last reported state');
      states.push(e.state);
    });
    clock.update(30 * MINUTES_PER_DAY * 1000);
    assert.equal(minutes, 30 * MINUTES_PER_DAY);
    assert.equal(clock.day, 30);
    const cycles = (30 * MINUTES_PER_DAY) / TIDE_PERIOD_MINUTES;
    assert.ok(states.length >= Math.floor(cycles) * 4 - 1 && states.length <= Math.ceil(cycles) * 4 + 1, `${states.length} changes`);
    for (let i = 1; i < states.length; i++) {
      assert.equal(states[i], TIDE_STATES[(TIDE_STATES.indexOf(states[i - 1]) + 1) % 4], `change ${i}`);
    }
  });

  it('tide changes are reported once each whether a crossing lands on, between or across whole minutes', () => {
    const run = (dtMs) => {
      const clock = clockAt(0, { seed: 'step' });
      const trace = [];
      clock.onTideChange((e) => trace.push(e.state));
      const end = 4 * TIDE_PERIOD_MINUTES;
      while (clock.total < end) clock.update(dtMs);
      return trace;
    };
    const perMinute = run(1000);
    assert.deepEqual(run(37.3), perMinute);
    assert.deepEqual(run(7_300), perMinute);
    assert.deepEqual(run(250), perMinute);
    assert.equal(perMinute.length, 16);
  });

  it('a listener added during dispatch first fires at the next boundary; clearListeners() mid-dispatch stops the rest', () => {
    const clock = clockAt(0);
    const trace = [];
    clock.onMinute((e) => {
      trace.push(`a${e.minute}`);
      if (e.minute === 1) clock.onMinute((x) => trace.push(`late${x.minute}`));
    });
    clock.update(2000);
    assert.deepEqual(trace, ['a1', 'a2', 'late2']);
    trace.length = 0;
    const other = clockAt(0);
    other.onHour(() => trace.push('h1'));
    other.onHour(() => { trace.push('h2'); other.clearListeners(); });
    other.onHour(() => trace.push('h3'));
    other.onMinute(() => trace.push('m'));
    other.update(60_000);
    assert.deepEqual(trace.filter((t) => t !== 'm'), ['h1', 'h2']);
    assert.equal(trace.filter((t) => t === 'm').length, 59, 'minutes 1..59 fired before the hour listener cleared everything');
  });

  it('a throwing tide listener keeps the change committed and the clock at that instant', () => {
    const clock = clockAt(109.5);
    const seen = [];
    let explode = true;
    clock.onTideChange((e) => {
      seen.push(e.state);
      if (explode) throw new Error('tide boom');
    });
    assert.throws(() => clock.update(1000), /tide boom/);
    assert.equal(clock.total, 110);
    assert.equal(clock.tideState, 'rising');
    explode = false;
    clock.update(1000);
    assert.deepEqual(seen, ['rising'], 'not reported twice');
    assert.equal(clock.total, 111);
  });

  it('listener payloads are frozen and independent per boundary', () => {
    const clock = clockAt(59);
    const payloads = [];
    clock.onMinute((e) => payloads.push(e));
    clock.onHour((e) => payloads.push(e));
    clock.update(2000);
    assert.equal(payloads.length, 3);
    for (const p of payloads) {
      assert.ok(Object.isFrozen(p));
      assert.throws(() => { 'use strict'; p.minute = 0; }, TypeError);
    }
    assert.notEqual(payloads[1], payloads[2]);
  });

  it('serialize(), snapshot() and the tide tables are readable from inside a listener', () => {
    const clock = clockAt(1439.5, { seed: 'inside' });
    let inside;
    clock.onDayStart(() => {
      inside = { state: clock.serialize(), snap: clock.snapshot(), tides: clock.tidesToday, label: clock.dateLabel() };
      clock.setSpeed(2); // allowed: only affects later updates
      clock.pause();
      clock.resume();
    });
    clock.update(1000);
    assert.equal(inside.state.total, MINUTES_PER_DAY);
    assert.equal(inside.snap.day, 1);
    assert.equal(inside.label, 'Tue, Spring 2');
    assert.equal(clock.speed, 2);
    assert.equal(clock.total, 1440.5);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: tide tables', () => {
  it('are continuous, alternating and exact across day boundaries for offsets near 0, half and the period', () => {
    const seeds = { 0: null };
    for (let i = 0; seeds.near1 === undefined || seeds.nearHalf === undefined || seeds.nearEnd === undefined; i++) {
      const { tideOffset } = scheduleForSeed(`s${i}`);
      if (tideOffset <= 2 && seeds.near1 === undefined) seeds.near1 = `s${i}`;
      if (Math.abs(tideOffset - HALF) < 2 && seeds.nearHalf === undefined) seeds.nearHalf = `s${i}`;
      if (tideOffset >= TIDE_PERIOD_MINUTES - 2 && seeds.nearEnd === undefined) seeds.nearEnd = `s${i}`;
      assert.ok(i < 100_000, 'could not find edge seeds');
    }
    for (const seed of Object.values(seeds)) {
      const clock = createClock({ seed });
      const { tideOffset } = scheduleForSeed(seed);
      let previous = null;
      for (const day of [-3, -2, -1, 0, 1, 2, 3, 20_000, 20_001, MAX_DAY - 1, MAX_DAY]) {
        const tides = clock.tidesForDay(day);
        assert.ok(tides.length === 3 || tides.length === 4);
        for (const e of tides) {
          assert.ok(e.minute >= 0 && e.minute < MINUTES_PER_DAY, `seed ${seed} day ${day} minute ${e.minute}`);
          assert.equal(e.time, formatMinute(e.minute));
          const absolute = day * MINUTES_PER_DAY + e.minute;
          const phase = tidePhaseAt(absolute, tideOffset);
          // Beyond 2^52 a half-minute is not representable, so allow the rounding of `absolute` itself.
          const tolerance = Math.max(1e-9, (Math.abs(absolute) * Number.EPSILON * 2) / TIDE_PERIOD_MINUTES);
          assert.ok(Math.abs(phase - (e.kind === 'low' ? 0 : 0.5)) < tolerance || Math.abs(phase - 1) < tolerance, `seed ${seed} day ${day}: ${e.kind} at phase ${phase}`);
          if (previous && previous.day === day - 1) {
            // Computed from the day delta and minutes of day, which stays exact where `absolute` itself cannot.
            assert.equal((day - previous.day) * MINUTES_PER_DAY + e.minute - previous.minute, HALF, 'spacing across midnight');
            assert.notEqual(e.kind, previous.kind);
          }
          previous = { absolute, minute: e.minute, kind: e.kind, day };
        }
      }
    }
  });

  it('rejects days outside the safe range', () => {
    const clock = createClock();
    assert.throws(() => clock.tidesForDay(MAX_DAY + 1), RangeError);
    assert.throws(() => clock.tidesForDay(-MAX_DAY - 1), RangeError);
    assert.throws(() => clock.tidesForDay(1e300), RangeError);
    assert.throws(() => clock.tidesForDay(NaN), TypeError);
    assert.doesNotThrow(() => clock.tidesForDay(-0));
  });

  it('nextLowTide always points at a real low water and never exceeds 12.5 hours', () => {
    for (const seed of ['a', 'b', 'c', 7]) {
      const clock = createClock({ seed, startMinute: 0, maxDt: Infinity });
      const { tideOffset } = scheduleForSeed(seed);
      for (let i = 0; i < 2000; i++) {
        clock.update(1234.5);
        const low = clock.nextLowTide;
        const high = clock.nextHighTide;
        assert.ok(low >= 0 && low < 750, `low wait ${low}`);
        assert.ok(high >= 0 && high < 750, `high wait ${high}`);
        assert.ok(Math.abs(low - high) >= HALF - 1e-6 || Math.abs(Math.abs(low - high) - HALF) < 1e-6, 'extremes are half a period apart');
        assert.ok(tideAt(clock.total + low, tideOffset) < 1e-9);
        assert.ok(tideAt(clock.total + high, tideOffset) > 1 - 1e-9);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('createClock: serialize()/restore() under attack', () => {
  it('rejects every malformed field and leaves the clock and its listeners untouched', () => {
    const clock = clockAt(500, { seed: 'keep' });
    let hits = 0;
    clock.onMinute(() => hits++);
    const good = clock.serialize();
    const bad = [
      [undefined, TypeError],
      [42, TypeError],
      ['{"version":1}', TypeError],
      [() => good, TypeError],
      [{ ...good, version: '1' }, RangeError],
      [{ ...good, version: 1.0000001 }, RangeError],
      [{ ...good, version: null }, RangeError],
      [{ ...good, total: Infinity }, TypeError],
      [{ ...good, total: MAX_TOTAL_MINUTES + 2 }, RangeError],
      [{ ...good, total: -0.0001 }, RangeError],
      [{ ...good, total: 1n }, TypeError],
      [{ ...good, total: null }, TypeError],
      [{ ...good, total: undefined }, TypeError],
      [{ ...good, speed: Infinity }, TypeError],
      [{ ...good, speed: '1' }, TypeError],
      [{ ...good, paused: 0 }, TypeError],
      [{ ...good, paused: null }, TypeError],
      [{ ...good, realClock: 'false' }, TypeError],
      [{ ...good, realClock: true, total: 1e17 }, RangeError],
      [{ ...good, realClock: true, total: -1e17 }, RangeError],
      [{ ...good, seed: Symbol('s') }, TypeError],
      [{ ...good, seed: NaN }, TypeError],
      [{ ...good, seed: [] }, TypeError],
      [{ ...good, seed: 1n }, TypeError],
    ];
    for (const [state, type] of bad) {
      assert.throws(() => clock.restore(state), type, typeof state === 'object' ? JSON.stringify(state, (k, v) => (typeof v === 'bigint' ? `${v}n` : v)) : String(state));
      assert.deepEqual(clock.serialize(), good);
    }
    clock.update(1000);
    assert.equal(hits, 1, 'listeners survive rejected restores');
  });

  it('ignores extra keys and prototype pollution attempts in the state', () => {
    const clock = createClock();
    const state = JSON.parse('{"version":1,"total":90,"speed":1,"paused":false,"realClock":false,"seed":"x","__proto__":{"evil":1},"extra":"ignored"}');
    clock.restore(state);
    assert.equal(clock.total, 90);
    assert.equal({}.evil, undefined);
    assert.deepEqual(Object.keys(clock.serialize()).sort(), ['paused', 'realClock', 'seed', 'speed', 'total', 'version']);
  });

  it('accepts -0, the empty-string seed, unicode seeds and the largest safe total', () => {
    const clock = createClock();
    clock.restore({ version: 1, total: -0, speed: 0, paused: true, realClock: false, seed: '' });
    assert.equal(clock.total, 0);
    assert.equal(clock.serialize().seed, '');
    assert.deepEqual(clock.tidesToday[0].minute, scheduleForSeed('').tideOffset % HALF);
    clock.restore({ version: 1, total: 12.5, speed: 1, paused: false, realClock: false, seed: '🌊 潮 é' });
    assert.equal(JSON.parse(JSON.stringify(clock.serialize())).seed, '🌊 潮 é');
    assert.equal(clock.tidesToday[0].kind, scheduleForSeed('🌊 潮 é').tideOffset < HALF ? 'low' : 'high');
    clock.restore({ version: 1, total: MAX_TOTAL_MINUTES, speed: 1, paused: false, realClock: false, seed: null });
    const s = checkInvariants(clock, 'max total');
    assert.equal(s.total, MAX_TOTAL_MINUTES);
    assert.equal(s.day * MINUTES_PER_DAY + s.minute, MAX_TOTAL_MINUTES);
    assert.equal(clock.formatTime(), formatMinute(MAX_TOTAL_MINUTES % MINUTES_PER_DAY));
  });

  it('a restored clock replays identically to the original from the same point', () => {
    const drive = (c, n) => {
      const events = [];
      const offs = [c.onMinute((e) => events.push(['m', e.total])), c.onHour((e) => events.push(['h', e.hour])), c.onDayStart((e) => events.push(['d', e.day])), c.onTideChange((e) => events.push(['t', e.state]))];
      for (let i = 0; i < n; i++) c.update(777.7 + (i % 3));
      for (const off of offs) off();
      return events;
    };
    const original = createClock({ seed: 'replay', maxDt: Infinity, lowTide: 0.1, highTide: 0.9, daysPerSeason: 5 });
    drive(original, 500);
    const state = JSON.parse(JSON.stringify(original.serialize()));
    const copy = createClock({ seed: 'wrong-seed-overridden', maxDt: Infinity, lowTide: 0.1, highTide: 0.9, daysPerSeason: 5 });
    copy.restore(state);
    assert.deepEqual(copy.snapshot(), original.snapshot());
    assert.deepEqual(drive(copy, 3000), drive(original, 3000));
    assert.deepEqual(copy.snapshot(), original.snapshot());
    assert.deepEqual(copy.tidesForDay(copy.day + 1), original.tidesForDay(original.day + 1));
  });

  it('restore() does not resurrect a listener removed earlier and keeps the mutable options of the receiving clock', () => {
    const receiver = createClock({ minutesPerDay: 12, maxDt: Infinity, maxCatchUpMinutes: 5 });
    const donor = createClock({ minutesPerDay: 48, maxDt: Infinity });
    donor.update(60_000);
    receiver.restore(donor.serialize());
    receiver.update(1000);
    assert.equal(receiver.total, donor.total + 2, 'minutesPerDay stays that of the receiver');
    let n = 0;
    const off = receiver.onMinute(() => n++);
    off();
    receiver.restore(donor.serialize());
    receiver.update(1000);
    assert.equal(n, 0);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: real-clock mode under attack', () => {
  it('rejects a now() outside the Date range at creation, on update and on setRealClock', () => {
    assert.throws(() => createClock({ realClock: true, now: () => 1e20 }), RangeError);
    assert.throws(() => createClock({ realClock: true, now: () => -Infinity }), TypeError);
    let ms = localMs(2026, 9, 23, 12);
    const clock = createClock({ realClock: true, now: () => ms });
    ms = 1e20;
    assert.throws(() => clock.update(), RangeError);
    assert.equal(clock.hour, 12, 'unchanged after the rejected read');
    const game = createClock({ now: () => 1e20 });
    assert.throws(() => game.setRealClock(true), RangeError);
    assert.equal(game.realClock, false);
    assert.equal(game.total, 1120);
  });

  it('a now() that stalls, jitters by microseconds or returns the same instant fires nothing', () => {
    let ms = localMs(2026, 9, 23, 12, 0, 30);
    const clock = createClock({ realClock: true, now: () => ms });
    let hits = 0;
    clock.onMinute(() => hits++);
    clock.onTideChange(() => hits++);
    for (let i = 0; i < 100; i++) {
      ms += (i % 2 ? 0.001 : -0.0005);
      clock.update();
    }
    assert.equal(hits, 0);
    assert.ok(Math.abs(clock.minute - 720.5) < 1e-3);
  });

  it('a wall clock leaping forward past the catch-up limit resyncs silently but still reports the tide', () => {
    let ms = localMs(2026, 0, 5, 0, 0, 0);
    const clock = createClock({ realClock: true, now: () => ms, maxCatchUpMinutes: 60 });
    const start = clock.tideState;
    let minutes = 0;
    const tides = [];
    clock.onMinute(() => minutes++);
    clock.onTideChange((e) => tides.push([e.previous, e.state]));
    ms += 3 * 3_600_000 + 1000;
    clock.update();
    assert.equal(minutes, 0);
    assert.equal(clock.hour, 3);
    const now = clock.tideState;
    if (now !== start) assert.deepEqual(tides, [[start, now]]);
    else assert.deepEqual(tides, []);
  });

  it('DST-style jumps: an hour forward replays 60 minutes, an hour back is silent and the next minute still fires', () => {
    let ms = localMs(2026, 2, 8, 1, 30, 0);
    const clock = createClock({ realClock: true, now: () => ms });
    const seen = [];
    clock.onMinute((e) => seen.push(e.minute));
    ms += 3_600_000;
    clock.update();
    assert.equal(seen.length, 60);
    seen.length = 0;
    ms -= 3_600_000;
    clock.update();
    assert.deepEqual(seen, []);
    ms += 60_000;
    clock.update();
    assert.equal(seen.length, 1);
  });

  it('pre-1970 instants work: negative totals, a valid calendar and forward motion', () => {
    let ms = localMs(1969, 6, 20, 20, 17, 0);
    const clock = createClock({ realClock: true, now: () => ms });
    assert.ok(clock.total < 0);
    assert.equal(clock.formatTime(), '20:17');
    assert.equal(clock.dateLabel({ year: true }), 'Sun, Jul 20, 1969');
    assert.equal(clock.season, 'summer');
    checkInvariants(clock, '1969');
    const state = clock.serialize();
    const copy = createClock({ now: () => ms });
    copy.restore(state);
    assert.equal(copy.total, state.total);
    ms += 2 * 60_000;
    let n = 0;
    clock.onMinute(() => n++);
    clock.update();
    assert.equal(n, 2);
    assert.equal(clock.formatTime(), '20:19');
  });

  it('switching modes repeatedly never loses the day number and never fires on the switch', () => {
    const ms = localMs(2026, 9, 23, 18, 40, 30);
    const clock = createClock({ maxDt: Infinity, now: () => ms });
    let hits = 0;
    clock.onMinute(() => hits++);
    clock.onDayStart(() => hits++);
    clock.onTideChange(() => hits++);
    for (let i = 0; i < 10; i++) {
      clock.setRealClock(true);
      clock.setRealClock(false);
    }
    assert.equal(hits, 0);
    assert.equal(clock.total, realTimeToTotal(ms));
    assert.equal(clock.day, Math.floor(realTimeToTotal(ms) / MINUTES_PER_DAY));
    assert.throws(() => clock.setRealClock(), TypeError);
    assert.throws(() => clock.setRealClock(1), TypeError);
    assert.equal(clock.realClock, false);
  });

  it('snapshot() in real-clock mode names a real date and the tide tables use the real day', () => {
    const ms = localMs(2026, 9, 23, 6, 12, 0);
    const clock = createClock({ realClock: true, now: () => ms, seed: 'real' });
    const s = clock.snapshot();
    assert.equal(s.date, 'Fri, Oct 23');
    assert.equal(s.time, '06:12');
    assert.equal(s.realClock, true);
    assert.deepEqual(clock.tidesToday, clock.tidesForDay(clock.day));
    checkInvariants(clock, 'real snapshot');
  });
});

// ---------------------------------------------------------------------------

describe('createClock: API freeze', () => {
  it('snapshot() exposes a stable, sorted key set', () => {
    const keys = Object.keys(createClock().snapshot()).sort();
    assert.deepEqual(keys, [
      'date', 'day', 'dayName', 'dayOfSeason', 'dayOfWeek', 'dayOfYear', 'daylight', 'hour', 'isHighTide', 'isLowTide',
      'isNight', 'isSpringTide', 'minute', 'minuteOfHour', 'moonPhase', 'nextHighTide', 'nextLowTide', 'paused', 'phase',
      'realClock', 'season', 'seasonIndex', 'speed', 'tide', 'tideRange', 'tideState', 'time', 'total', 'year',
    ]);
  });

  it('getters cannot be assigned, deleted or redefined', () => {
    const clock = createClock();
    assert.throws(() => { 'use strict'; clock.minute = 5; }, TypeError);
    assert.throws(() => { 'use strict'; delete clock.update; }, TypeError);
    assert.throws(() => Object.defineProperty(clock, 'tide', { value: 1 }), TypeError);
    assert.equal(clock.minute, 1120);
  });

  it('two clocks never share state', () => {
    const a = createClock({ seed: 'a', maxDt: Infinity });
    const b = createClock({ seed: 'b', maxDt: Infinity });
    let hitsA = 0;
    a.onMinute(() => hitsA++);
    b.update(5000);
    b.pause();
    b.setSpeed(9);
    assert.equal(a.total, 1120);
    assert.equal(a.paused, false);
    assert.equal(a.speed, 1);
    assert.equal(hitsA, 0);
    b.clearListeners();
    a.update(1000);
    assert.equal(hitsA, 1);
  });
});
