import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  DAYS_PER_WEEK,
  DEFAULT_MINUTES_PER_DAY,
  DEFAULT_START_MINUTE,
  DEFAULT_MAX_DT_MS,
  DEFAULT_MAX_CATCH_UP_MINUTES,
  DEFAULT_DAYS_PER_SEASON,
  SEASONS,
  DAY_NAMES,
  PHASES,
  PHASE_TABLE,
  TIDE_PERIOD_MINUTES,
  DEFAULT_LOW_TIDE,
  DEFAULT_HIGH_TIDE,
  TIDE_STATES,
  LUNAR_MONTH_DAYS,
  SPRING_TIDE_HALF_WINDOW_DAYS,
  CLOCK_STATE_VERSION,
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
} from '../js/core/time.js';

const EPS = 1e-9;
const HALF_PERIOD = TIDE_PERIOD_MINUTES / 2;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Asserts two numbers are within `eps` of each other.
 * @param {number} actual
 * @param {number} expected
 * @param {number} [eps]
 * @param {string} [msg]
 */
function assertClose(actual, expected, eps = EPS, msg) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    msg ?? `expected ${actual} to be within ${eps} of ${expected}`,
  );
}

/**
 * A game-mode clock positioned at an arbitrary total minute with the dt clamp
 * disabled, so tests can drive it with `update(ms)` freely (1000 ms = 1 minute).
 * @param {number} total
 * @param {object} [extra] further createClock options
 */
function clockAt(total, extra = {}) {
  const day = Math.floor(total / MINUTES_PER_DAY);
  return createClock({ startDay: day, startMinute: total - day * MINUTES_PER_DAY, maxDt: Infinity, ...extra });
}

/**
 * Real milliseconds that advance a default-speed clock by `n` in-game minutes.
 * @param {number} n
 */
const minutes = (n) => n * 1000;

/**
 * Local-time wall clock instant for real-clock tests (time zone independent
 * because the clock maps *local* components).
 * @param {number} y
 * @param {number} mo 0-based month
 * @param {number} d
 * @param {number} [h]
 * @param {number} [mi]
 * @param {number} [s]
 * @param {number} [ms]
 */
const localMs = (y, mo, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, mo, d, h, mi, s, ms).getTime();

/** Day number realTimeToTotal assigns to a local calendar date. */
const realDayOf = (y, mo, d) => Math.floor(realTimeToTotal(localMs(y, mo, d, 12)) / MINUTES_PER_DAY);

// ---------------------------------------------------------------------------

describe('constants', () => {
  it('describe the 24-hour day and the default pacing', () => {
    assert.equal(MINUTES_PER_DAY, 1440);
    assert.equal(MINUTES_PER_HOUR, 60);
    assert.equal(DAYS_PER_WEEK, 7);
    assert.equal(DEFAULT_MINUTES_PER_DAY, 24);
    assert.equal(DEFAULT_START_MINUTE, 18 * 60 + 40);
    assert.equal(DEFAULT_MAX_DT_MS, 250);
    assert.equal(DEFAULT_MAX_CATCH_UP_MINUTES, 7 * 1440);
    assert.equal(DEFAULT_DAYS_PER_SEASON, 28);
    assert.equal(CLOCK_STATE_VERSION, 1);
  });

  it('describe the tide and moon model', () => {
    assert.equal(TIDE_PERIOD_MINUTES, 12 * 60 + 25);
    assert.equal(DEFAULT_LOW_TIDE, 0.2);
    assert.equal(DEFAULT_HIGH_TIDE, 0.8);
    assert.ok(DEFAULT_LOW_TIDE < DEFAULT_HIGH_TIDE);
    assert.equal(LUNAR_MONTH_DAYS, 29.5);
    assert.equal(SPRING_TIDE_HALF_WINDOW_DAYS, 1.5);
    assert.deepEqual([...TIDE_STATES], ['low', 'rising', 'high', 'falling']);
  });

  it('ship frozen name tables', () => {
    assert.deepEqual([...SEASONS], ['spring', 'summer', 'autumn', 'winter']);
    assert.deepEqual([...DAY_NAMES], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    assert.deepEqual([...PHASES], ['night', 'dawn', 'morning', 'midday', 'afternoon', 'dusk', 'evening']);
    for (const table of [SEASONS, DAY_NAMES, PHASES, TIDE_STATES, PHASE_TABLE]) {
      assert.ok(Object.isFrozen(table));
    }
  });

  it('PHASE_TABLE is ascending, starts and ends with night, and names every phase', () => {
    assert.equal(PHASE_TABLE[0].phase, 'night');
    assert.equal(PHASE_TABLE[0].start, 0);
    assert.equal(PHASE_TABLE.at(-1).phase, 'night');
    for (let i = 1; i < PHASE_TABLE.length; i++) {
      assert.ok(PHASE_TABLE[i].start > PHASE_TABLE[i - 1].start);
      assert.ok(PHASE_TABLE[i].start < MINUTES_PER_DAY);
    }
    const named = new Set(PHASE_TABLE.map((e) => e.phase));
    for (const phase of PHASES) assert.ok(named.has(phase), `${phase} missing from PHASE_TABLE`);
    for (const entry of PHASE_TABLE) assert.ok(Object.isFrozen(entry));
  });
});

// ---------------------------------------------------------------------------

describe('phaseOfMinute', () => {
  it('maps every boundary minute to the documented phase', () => {
    const cases = [
      [0, 'night'], [299, 'night'], [300, 'dawn'], [419, 'dawn'], [420, 'morning'], [659, 'morning'],
      [660, 'midday'], [839, 'midday'], [840, 'afternoon'], [1049, 'afternoon'], [1050, 'dusk'],
      [1169, 'dusk'], [1170, 'evening'], [1319, 'evening'], [1320, 'night'], [1439, 'night'],
      [1439.999, 'night'], [1120, 'dusk'], [719.5, 'midday'],
    ];
    for (const [minute, phase] of cases) assert.equal(phaseOfMinute(minute), phase, `minute ${minute}`);
  });

  it('only ever returns a known phase across the whole day', () => {
    for (let m = 0; m < MINUTES_PER_DAY; m += 0.5) assert.ok(PHASES.includes(phaseOfMinute(m)));
  });

  it('rejects out-of-range and non-numeric minutes', () => {
    assert.throws(() => phaseOfMinute(-0.001), RangeError);
    assert.throws(() => phaseOfMinute(1440), RangeError);
    assert.throws(() => phaseOfMinute(NaN), TypeError);
    assert.throws(() => phaseOfMinute(Infinity), TypeError);
    assert.throws(() => phaseOfMinute('600'), TypeError);
    assert.throws(() => phaseOfMinute(), TypeError);
  });
});

describe('daylightOfMinute', () => {
  it('is dark at night and evening, full during the day, half way through dawn and dusk', () => {
    for (const m of [0, 150, 299, 1170, 1300, 1439.9]) assert.equal(daylightOfMinute(m), 0, `minute ${m}`);
    for (const m of [420, 700, 1000, 1049]) assert.equal(daylightOfMinute(m), 1, `minute ${m}`);
    assertClose(daylightOfMinute(360), 0.5);
    assertClose(daylightOfMinute(1110), 0.5);
    assert.equal(daylightOfMinute(300), 0);
    assert.equal(daylightOfMinute(1050), 1);
  });

  it('ramps monotonically and stays within [0, 1]', () => {
    for (let m = 301; m <= 420; m++) assert.ok(daylightOfMinute(m) > daylightOfMinute(m - 1), `dawn ${m}`);
    for (let m = 1051; m <= 1170; m++) assert.ok(daylightOfMinute(m) < daylightOfMinute(m - 1), `dusk ${m}`);
    for (let m = 0; m < MINUTES_PER_DAY; m += 0.25) {
      const d = daylightOfMinute(m);
      assert.ok(d >= 0 && d <= 1);
    }
  });

  it('rejects out-of-range and non-numeric minutes', () => {
    assert.throws(() => daylightOfMinute(-1), RangeError);
    assert.throws(() => daylightOfMinute(1440), RangeError);
    assert.throws(() => daylightOfMinute(null), TypeError);
  });
});

describe('formatMinute', () => {
  it('formats 24-hour clock faces with zero padding and truncation', () => {
    assert.equal(formatMinute(0), '00:00');
    assert.equal(formatMinute(59), '00:59');
    assert.equal(formatMinute(65.9), '01:05');
    assert.equal(formatMinute(1120), '18:40');
    assert.equal(formatMinute(1439.999), '23:59');
  });

  it('formats 12-hour clock faces with AM/PM and 12 for midnight and noon', () => {
    assert.equal(formatMinute(0, { hour12: true }), '12:00 AM');
    assert.equal(formatMinute(59, { hour12: true }), '12:59 AM');
    assert.equal(formatMinute(65, { hour12: true }), '1:05 AM');
    assert.equal(formatMinute(719, { hour12: true }), '11:59 AM');
    assert.equal(formatMinute(720, { hour12: true }), '12:00 PM');
    assert.equal(formatMinute(779, { hour12: true }), '12:59 PM');
    assert.equal(formatMinute(780, { hour12: true }), '1:00 PM');
    assert.equal(formatMinute(1120, { hour12: true }), '6:40 PM');
    assert.equal(formatMinute(1439, { hour12: true }), '11:59 PM');
    assert.equal(formatMinute(1120, { hour12: false }), '18:40');
    assert.equal(formatMinute(1120, {}), '18:40');
  });

  it('rejects out-of-range and non-numeric minutes', () => {
    assert.throws(() => formatMinute(1440), RangeError);
    assert.throws(() => formatMinute(-1), RangeError);
    assert.throws(() => formatMinute('12:00'), TypeError);
    assert.throws(() => formatMinute(NaN), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('tide helpers', () => {
  it('tidePhaseAt is 0 at low water, 0.5 at high water and periodic', () => {
    assert.equal(tidePhaseAt(0), 0);
    assert.equal(tidePhaseAt(HALF_PERIOD), 0.5);
    assert.equal(tidePhaseAt(TIDE_PERIOD_MINUTES), 0);
    assert.equal(tidePhaseAt(10, 10), 0);
    assertClose(tidePhaseAt(0, 10), (TIDE_PERIOD_MINUTES - 10) / TIDE_PERIOD_MINUTES);
    for (const t of [1, 123.4, 744.9, 5000.25]) assertClose(tidePhaseAt(t), tidePhaseAt(t + 3 * TIDE_PERIOD_MINUTES));
  });

  it('tidePhaseAt handles negative totals and a rounding hair below zero', () => {
    assertClose(tidePhaseAt(-HALF_PERIOD), 0.5);
    assertClose(tidePhaseAt(-TIDE_PERIOD_MINUTES), 0);
    const hair = tidePhaseAt(100 - 1e-13, 100);
    assert.ok(hair >= 0 && hair < 1, `phase ${hair} must stay in [0, 1)`);
    for (let t = -3000; t < 3000; t += 37.3) {
      const p = tidePhaseAt(t, 321);
      assert.ok(p >= 0 && p < 1);
    }
  });

  it('tideAt is a raised cosine in [0, 1] with 0 at low and 1 at high water', () => {
    assertClose(tideAt(0), 0);
    assertClose(tideAt(HALF_PERIOD), 1);
    assertClose(tideAt(HALF_PERIOD / 2), 0.5);
    assertClose(tideAt(TIDE_PERIOD_MINUTES * 1.5 + 33, 33), 1);
    for (let t = 0; t < 4000; t += 11.1) {
      const v = tideAt(t, 100);
      assert.ok(v >= 0 && v <= 1);
    }
  });

  it('tideStateAt walks low -> rising -> high -> falling over one cycle', () => {
    assert.equal(tideStateAt(0), 'low');
    assert.equal(tideStateAt(HALF_PERIOD / 2), 'rising');
    assert.equal(tideStateAt(HALF_PERIOD), 'high');
    assert.equal(tideStateAt(HALF_PERIOD * 1.5), 'falling');
    assert.equal(tideStateAt(TIDE_PERIOD_MINUTES - 1), 'low');
    assert.equal(tideStateAt(HALF_PERIOD + 50, 50), 'high');
    const order = [];
    for (let t = 0; t < TIDE_PERIOD_MINUTES; t++) {
      const s = tideStateAt(t);
      if (order.at(-1) !== s) order.push(s);
    }
    assert.deepEqual(order, ['low', 'rising', 'high', 'falling', 'low']);
  });

  it('tideStateAt honours custom thresholds', () => {
    const tight = { lowTide: 0.01, highTide: 0.99 };
    assert.equal(tideStateAt(100), 'low');
    assert.equal(tideStateAt(100, 0, tight), 'rising');
    assert.equal(tideStateAt(HALF_PERIOD - 60), 'high');
    assert.equal(tideStateAt(HALF_PERIOD - 60, 0, tight), 'rising');
    assert.equal(tideStateAt(HALF_PERIOD + 60, 0, tight), 'falling');
  });

  it('reject non-finite input', () => {
    assert.throws(() => tidePhaseAt(NaN), TypeError);
    assert.throws(() => tidePhaseAt(0, '1'), TypeError);
    assert.throws(() => tideAt(Infinity), TypeError);
    assert.throws(() => tideStateAt(undefined), TypeError);
  });
});

describe('scheduleForSeed', () => {
  it('gives the canonical schedule for no seed', () => {
    assert.deepEqual(scheduleForSeed(), { tideOffset: 0, moonOffset: 0 });
    assert.deepEqual(scheduleForSeed(null), { tideOffset: 0, moonOffset: 0 });
    assert.ok(Object.isFrozen(scheduleForSeed()));
  });

  it('is deterministic, in range, and stable across runs', () => {
    assert.deepEqual(scheduleForSeed('foo'), { tideOffset: 10, moonOffset: 22.14 });
    assert.deepEqual(scheduleForSeed('foo'), scheduleForSeed('foo'));
    assert.deepEqual(scheduleForSeed(42), scheduleForSeed('42'));
    assert.notDeepEqual(scheduleForSeed('foo'), scheduleForSeed('bar'));
    assert.ok(Object.isFrozen(scheduleForSeed('foo')));
    for (const seed of ['', 'a', 'tidepool', 'Wildshift', 12345, -7, 0.5, 'ß∆']) {
      const { tideOffset, moonOffset } = scheduleForSeed(seed);
      assert.ok(Number.isInteger(tideOffset) && tideOffset >= 0 && tideOffset < TIDE_PERIOD_MINUTES, `tide ${seed}`);
      assert.ok(moonOffset >= 0 && moonOffset < LUNAR_MONTH_DAYS, `moon ${seed}`);
      assertClose(moonOffset * 100, Math.round(moonOffset * 100));
    }
  });

  it('spreads seeds across the period', () => {
    const offsets = new Set();
    for (let i = 0; i < 200; i++) offsets.add(scheduleForSeed(`world-${i}`).tideOffset);
    assert.ok(offsets.size > 150, `only ${offsets.size} distinct offsets from 200 seeds`);
  });

  it('rejects unsupported seed types', () => {
    for (const bad of [{}, [], true, NaN, Infinity, Symbol('s'), () => {}]) {
      assert.throws(() => scheduleForSeed(bad), TypeError);
    }
  });
});

// ---------------------------------------------------------------------------

describe('gameCalendar', () => {
  it('starts on Monday, Spring 1 of Year 1 and runs four 28-day seasons', () => {
    assert.deepEqual(gameCalendar(0), {
      dayOfWeek: 0, dayName: 'Mon', seasonIndex: 0, season: 'spring', dayOfSeason: 1, dayOfYear: 1, year: 1,
      dateText: 'Spring 1', yearText: 'Year 1',
    });
    const d27 = gameCalendar(27);
    assert.equal(d27.dayName, 'Sun');
    assert.equal(d27.season, 'spring');
    assert.equal(d27.dayOfSeason, 28);
    assert.equal(d27.dayOfYear, 28);
    const d28 = gameCalendar(28);
    assert.equal(d28.dayName, 'Mon');
    assert.equal(d28.season, 'summer');
    assert.equal(d28.dayOfSeason, 1);
    assert.equal(d28.dateText, 'Summer 1');
    assert.equal(gameCalendar(56).season, 'autumn');
    assert.equal(gameCalendar(84).season, 'winter');
    const d111 = gameCalendar(111);
    assert.equal(d111.season, 'winter');
    assert.equal(d111.dayOfSeason, 28);
    assert.equal(d111.dayOfYear, 112);
    assert.equal(d111.year, 1);
    const d112 = gameCalendar(112);
    assert.equal(d112.season, 'spring');
    assert.equal(d112.dayOfSeason, 1);
    assert.equal(d112.year, 2);
    assert.equal(d112.dayName, 'Mon');
    assert.equal(d112.yearText, 'Year 2');
  });

  it('supports other season lengths', () => {
    assert.equal(gameCalendar(7, 7).season, 'summer');
    assert.equal(gameCalendar(27, 7).season, 'winter');
    assert.equal(gameCalendar(28, 7).year, 2);
    assert.equal(gameCalendar(28, 7).dateText, 'Spring 1');
  });

  it('wraps negative days instead of producing garbage', () => {
    const d = gameCalendar(-1);
    assert.equal(d.dayOfWeek, 6);
    assert.equal(d.season, 'winter');
    assert.equal(d.dayOfSeason, 28);
    assert.equal(d.year, 0);
  });

  it('rejects non-integer input', () => {
    assert.throws(() => gameCalendar(1.5), RangeError);
    assert.throws(() => gameCalendar('1'), TypeError);
    assert.throws(() => gameCalendar(1, 0), RangeError);
    assert.throws(() => gameCalendar(1, 2.5), RangeError);
  });
});

describe('realTimeToTotal and realCalendar', () => {
  it('maps a local instant to day * 1440 + fractional minute', () => {
    const total = realTimeToTotal(localMs(2026, 9, 23, 18, 40, 30));
    const day = Math.floor(total / MINUTES_PER_DAY);
    assert.equal(day, Math.floor(Date.UTC(2026, 9, 23) / 86_400_000) + 3);
    assertClose(total - day * MINUTES_PER_DAY, 1120.5);
    assertClose(realTimeToTotal(localMs(2026, 9, 23)) % MINUTES_PER_DAY, 0);
    assertClose(realTimeToTotal(localMs(2026, 9, 23, 23, 59, 59, 999)) % MINUTES_PER_DAY, 1439 + 59.999 / 60);
    assert.equal(realDayOf(2026, 9, 24), day + 1);
  });

  it('numbers days so that day % 7 is the real weekday with Monday = 0', () => {
    assert.equal(realCalendar(realDayOf(1970, 0, 1)).dayName, 'Thu');
    for (let i = 0; i < 420; i++) {
      const d = new Date(2026, 0, 1 + i, 12);
      const cal = realCalendar(realDayOf(d.getFullYear(), d.getMonth(), d.getDate()));
      assert.equal(cal.dayOfWeek, (d.getDay() + 6) % 7, d.toDateString());
      assert.equal(cal.dateText, `${MONTHS[d.getMonth()]} ${d.getDate()}`);
      assert.equal(cal.year, d.getFullYear());
    }
  });

  it('uses meteorological seasons and the real year', () => {
    assert.deepEqual(realCalendar(realDayOf(2026, 9, 23)), {
      dayOfWeek: 4, dayName: 'Fri', seasonIndex: 2, season: 'autumn', dayOfSeason: 53, dayOfYear: 296, year: 2026,
      dateText: 'Oct 23', yearText: '2026',
    });
    const cases = [
      [[2026, 2, 1], 'spring', 1, 60],
      [[2026, 4, 31], 'spring', 92, 151],
      [[2026, 5, 1], 'summer', 1, 152],
      [[2026, 8, 1], 'autumn', 1, 244],
      [[2026, 10, 30], 'autumn', 91, 334],
      [[2026, 11, 1], 'winter', 1, 335],
      [[2027, 0, 1], 'winter', 32, 1],
      [[2027, 0, 15], 'winter', 46, 15],
      [[2028, 1, 29], 'winter', 91, 60],
      [[2028, 2, 1], 'spring', 1, 61],
      [[1970, 0, 1], 'winter', 32, 1],
    ];
    for (const [[y, mo, d], season, dayOfSeason, dayOfYear] of cases) {
      const cal = realCalendar(realDayOf(y, mo, d));
      assert.equal(cal.season, season, `${y}-${mo + 1}-${d} season`);
      assert.equal(cal.dayOfSeason, dayOfSeason, `${y}-${mo + 1}-${d} dayOfSeason`);
      assert.equal(cal.dayOfYear, dayOfYear, `${y}-${mo + 1}-${d} dayOfYear`);
      assert.equal(cal.year, y);
    }
  });

  it('reject bad input', () => {
    assert.throws(() => realTimeToTotal(NaN), TypeError);
    assert.throws(() => realTimeToTotal('now'), TypeError);
    assert.throws(() => realCalendar(1.5), RangeError);
    assert.throws(() => realCalendar(null), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: construction', () => {
  it('returns a frozen clock exposing the whole contract API', () => {
    const clock = createClock();
    assert.ok(Object.isFrozen(clock));
    const methods = [
      'update', 'setSpeed', 'pause', 'resume', 'skipTo', 'onHour', 'onMinute', 'onDayStart', 'onTideChange',
      'serialize', 'restore', 'formatTime', 'dateLabel', 'tidesForDay', 'setRealClock', 'clearListeners', 'snapshot',
    ];
    for (const m of methods) assert.equal(typeof clock[m], 'function', m);
    const getters = [
      'minute', 'hour', 'day', 'dayOfWeek', 'season', 'year', 'phase', 'isNight', 'tide', 'tideState', 'isLowTide',
      'nextLowTide', 'tidesToday', 'isSpringTide', 'total', 'minuteOfHour', 'dayName', 'seasonIndex', 'dayOfSeason',
      'dayOfYear', 'daylight', 'isHighTide', 'nextHighTide', 'moonPhase', 'tideRange', 'speed', 'paused',
      'realClock', 'minutesPerSecond',
    ];
    for (const g of getters) assert.notEqual(clock[g], undefined, g);
    assert.throws(() => {
      clock.extra = 1;
    }, TypeError);
  });

  it('starts at 18:40 on Monday, Spring 1 at dusk by default', () => {
    const clock = createClock();
    assert.equal(clock.total, 1120);
    assert.equal(clock.minute, 1120);
    assert.equal(clock.hour, 18);
    assert.equal(clock.minuteOfHour, 40);
    assert.equal(clock.day, 0);
    assert.equal(clock.dayOfWeek, 0);
    assert.equal(clock.dayName, 'Mon');
    assert.equal(clock.season, 'spring');
    assert.equal(clock.seasonIndex, 0);
    assert.equal(clock.dayOfSeason, 1);
    assert.equal(clock.dayOfYear, 1);
    assert.equal(clock.year, 1);
    assert.equal(clock.phase, 'dusk');
    assert.equal(clock.isNight, false);
    assertClose(clock.daylight, daylightOfMinute(1120));
    assert.equal(clock.speed, 1);
    assert.equal(clock.paused, false);
    assert.equal(clock.realClock, false);
    assert.equal(clock.minutesPerSecond, 1);
    assert.equal(clock.formatTime(), '18:40');
    assert.equal(clock.formatTime({ hour12: true }), '6:40 PM');
    assert.equal(clock.dateLabel(), 'Mon, Spring 1');
    assert.equal(clock.dateLabel({ year: true }), 'Mon, Spring 1, Year 1');
  });

  it('accepts no options, an empty object, null and undefined', () => {
    for (const o of [undefined, {}, null]) assert.doesNotThrow(() => createClock(o));
  });

  it('honours startDay and startMinute', () => {
    const clock = createClock({ startDay: 30, startMinute: 90.5 });
    assert.equal(clock.day, 30);
    assert.equal(clock.minute, 90.5);
    assert.equal(clock.hour, 1);
    assert.equal(clock.minuteOfHour, 30);
    assert.equal(clock.dayOfWeek, 2);
    assert.equal(clock.season, 'summer');
    assert.equal(clock.dayOfSeason, 3);
    assert.equal(clock.formatTime(), '01:30');
    assert.equal(clock.dateLabel(), 'Wed, Summer 3');
  });

  it('rejects invalid options with the right error types', () => {
    assert.throws(() => createClock([]), TypeError);
    assert.throws(() => createClock('fast'), TypeError);
    assert.throws(() => createClock({ minutesPerDay: 0 }), RangeError);
    assert.throws(() => createClock({ minutesPerDay: -1 }), RangeError);
    assert.throws(() => createClock({ minutesPerDay: '24' }), TypeError);
    assert.throws(() => createClock({ minutesPerDay: Infinity }), TypeError);
    assert.throws(() => createClock({ startDay: -1 }), RangeError);
    assert.throws(() => createClock({ startDay: 1.5 }), RangeError);
    assert.throws(() => createClock({ startMinute: 1440 }), RangeError);
    assert.throws(() => createClock({ startMinute: -1 }), RangeError);
    assert.throws(() => createClock({ startMinute: NaN }), TypeError);
    assert.throws(() => createClock({ seed: {} }), TypeError);
    assert.throws(() => createClock({ seed: NaN }), TypeError);
    assert.throws(() => createClock({ realClock: 1 }), TypeError);
    assert.throws(() => createClock({ now: 'Date.now' }), TypeError);
    assert.throws(() => createClock({ daysPerSeason: 0 }), RangeError);
    assert.throws(() => createClock({ daysPerSeason: 7.5 }), RangeError);
    assert.throws(() => createClock({ lowTide: 0 }), RangeError);
    assert.throws(() => createClock({ highTide: 1 }), RangeError);
    assert.throws(() => createClock({ lowTide: 0.5, highTide: 0.5 }), RangeError);
    assert.throws(() => createClock({ lowTide: 0.6, highTide: 0.4 }), RangeError);
    assert.throws(() => createClock({ maxDt: 0 }), RangeError);
    assert.throws(() => createClock({ maxDt: NaN }), TypeError);
    assert.throws(() => createClock({ maxCatchUpMinutes: -5 }), RangeError);
    assert.doesNotThrow(() => createClock({ maxDt: Infinity, maxCatchUpMinutes: Infinity }));
    assert.doesNotThrow(() => createClock({ seed: null }));
    assert.doesNotThrow(() => createClock({ seed: 7 }));
  });
});

describe('createClock: update()', () => {
  it('advances one in-game minute per real second at the default 24 real minutes per day', () => {
    const clock = createClock({ maxDt: Infinity });
    clock.update(1000);
    assert.equal(clock.total, 1121);
    clock.update(500);
    assert.equal(clock.total, 1121.5);
    clock.update(0);
    assert.equal(clock.total, 1121.5);
  });

  it('clamps realDt to maxDt (250 ms by default) so a hidden tab does not fast-forward the world', () => {
    const clock = createClock();
    clock.update(60_000);
    assertClose(clock.total, 1120.25);
    const loose = createClock({ maxDt: 2000 });
    loose.update(60_000);
    assertClose(loose.total, 1122);
  });

  it('scales with minutesPerDay and speed', () => {
    const fast = createClock({ minutesPerDay: 12, maxDt: Infinity });
    fast.update(1000);
    assertClose(fast.total, 1122);
    const slow = createClock({ minutesPerDay: 48, maxDt: Infinity });
    slow.update(1000);
    assertClose(slow.total, 1120.5);
    const sped = createClock({ maxDt: Infinity });
    sped.setSpeed(3);
    sped.update(1000);
    assertClose(sped.total, 1123);
    assert.equal(sped.speed, 3);
    assert.equal(sped.minutesPerSecond, 3);
    sped.setSpeed(0);
    sped.update(1000);
    assertClose(sped.total, 1123);
    assert.equal(sped.minutesPerSecond, 0);
  });

  it('pause() freezes time and resume() continues from the same instant', () => {
    const clock = createClock({ maxDt: Infinity });
    clock.pause();
    assert.equal(clock.paused, true);
    assert.equal(clock.minutesPerSecond, 0);
    clock.update(5000);
    assert.equal(clock.total, 1120);
    clock.pause();
    clock.resume();
    clock.resume();
    assert.equal(clock.paused, false);
    clock.update(1000);
    assert.equal(clock.total, 1121);
  });

  it('rejects a bad realDt even while paused', () => {
    const clock = createClock();
    assert.throws(() => clock.update(-1), RangeError);
    assert.throws(() => clock.update(NaN), TypeError);
    assert.throws(() => clock.update(Infinity), TypeError);
    assert.throws(() => clock.update('16'), TypeError);
    assert.throws(() => clock.update(), TypeError);
    clock.pause();
    assert.throws(() => clock.update(-1), RangeError);
    assert.throws(() => clock.update(undefined), TypeError);
  });

  it('setSpeed validates its multiplier', () => {
    const clock = createClock();
    assert.throws(() => clock.setSpeed(-1), RangeError);
    assert.throws(() => clock.setSpeed(NaN), TypeError);
    assert.throws(() => clock.setSpeed(Infinity), TypeError);
    assert.throws(() => clock.setSpeed('2'), TypeError);
    assert.equal(clock.speed, 1);
    clock.setSpeed(0.5);
    assert.equal(clock.speed, 0.5);
  });

  it('rolls minute and day over midnight and cycles the week', () => {
    const clock = clockAt(1439.5);
    clock.update(1000);
    assert.equal(clock.day, 1);
    assertClose(clock.minute, 0.5);
    assert.equal(clock.hour, 0);
    assert.equal(clock.dayOfWeek, 1);
    assert.equal(clock.dayName, 'Tue');
    assert.equal(clock.phase, 'night');
    const week = clockAt(6 * MINUTES_PER_DAY + 1439);
    assert.equal(week.dayName, 'Sun');
    week.update(minutes(1));
    assert.equal(week.dayName, 'Mon');
    assert.equal(week.dayOfSeason, 8);
  });

  it('keeps minute in [0, 1440) and consistent with day under float accumulation', () => {
    const clock = clockAt(1430, { seed: 'drift' });
    for (let i = 0; i < 20_000; i++) {
      clock.update(100 / 3);
      const { day, minute, total } = clock;
      assert.ok(minute >= 0 && minute < MINUTES_PER_DAY, `minute ${minute}`);
      assertClose(day * MINUTES_PER_DAY + minute, total, 1e-6);
      assert.equal(Number.isInteger(day), true);
    }
    assert.ok(clock.day >= 1);
  });

  it('is deterministic for the same seed and the same call sequence', () => {
    const drive = (clock) => {
      const dts = [16.7, 33.3, 250, 999, 7, 0, 1234.5];
      for (let i = 0; i < 300; i++) {
        if (i % 50 === 0) clock.setSpeed(1 + (i % 100) / 50);
        if (i === 120) clock.pause();
        if (i === 140) clock.resume();
        clock.update(dts[i % dts.length]);
      }
    };
    const a = createClock({ seed: 'tidepool' });
    const b = createClock({ seed: 'tidepool' });
    drive(a);
    drive(b);
    assert.equal(a.total, b.total);
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert.deepEqual(a.tidesToday, b.tidesToday);
    const c = createClock({ seed: 'other' });
    drive(c);
    assert.equal(c.total, a.total);
    assert.notEqual(c.tide, a.tide);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: boundary events', () => {
  it('fires onMinute once per whole minute crossed, in order, with a frozen payload', () => {
    const clock = clockAt(59.5);
    const seen = [];
    clock.onMinute((e) => {
      assert.ok(Object.isFrozen(e));
      seen.push(e);
    });
    clock.update(2600);
    assert.deepEqual(seen, [
      { day: 0, hour: 1, minute: 60, total: 60 },
      { day: 0, hour: 1, minute: 61, total: 61 },
      { day: 0, hour: 1, minute: 62, total: 62 },
    ]);
    assertClose(clock.total, 62.1);
    clock.update(400);
    assert.equal(seen.length, 3, 'no boundary crossed');
    clock.update(500);
    assert.equal(seen.length, 4);
    assert.equal(seen[3].minute, 63);
  });

  it('does not fire for the starting minute or an exact landing already reached', () => {
    const clock = clockAt(60);
    const seen = [];
    clock.onMinute((e) => seen.push(e.minute));
    clock.update(0);
    assert.deepEqual(seen, []);
    clock.update(minutes(1));
    assert.deepEqual(seen, [61]);
    clock.update(0);
    assert.deepEqual(seen, [61]);
  });

  it('fires onHour at :00 and onDayStart at 00:00, coarse before fine, then tide', () => {
    const clock = clockAt(1439.5);
    const trace = [];
    clock.onMinute((e) => trace.push(['minute', e.day, e.hour, e.minute]));
    clock.onHour((e) => trace.push(['hour', e.day, e.hour]));
    clock.onDayStart((e) => trace.push(['day', e.day, e.dayOfWeek, e.dayName, e.season, e.year]));
    clock.update(1000);
    assert.deepEqual(trace, [
      ['day', 1, 1, 'Tue', 'spring', 1],
      ['hour', 1, 0],
      ['minute', 1, 0, 0],
    ]);
    trace.length = 0;
    clock.update(minutes(60));
    assert.equal(trace.filter((t) => t[0] === 'hour').length, 1);
    assert.deepEqual(trace.find((t) => t[0] === 'hour'), ['hour', 1, 1]);
    assert.equal(trace.filter((t) => t[0] === 'minute').length, 60);
    assert.equal(trace.filter((t) => t[0] === 'day').length, 0);
  });

  it('reports the boundary time from its getters while a listener runs', () => {
    const clock = clockAt(59.5);
    let during;
    clock.onHour(() => {
      during = { minute: clock.minute, hour: clock.hour, total: clock.total, time: clock.formatTime() };
    });
    clock.update(1500);
    assert.deepEqual(during, { minute: 60, hour: 1, total: 60, time: '01:00' });
    assert.equal(clock.total, 61);
  });

  it('fires onDayStart with the new calendar at season and year boundaries', () => {
    const clock = clockAt(28 * MINUTES_PER_DAY - 0.5);
    const days = [];
    clock.onDayStart((e) => days.push(e));
    clock.update(1000);
    assert.deepEqual(days, [{ day: 28, dayOfWeek: 0, dayName: 'Mon', season: 'summer', year: 1 }]);
    const yearEnd = clockAt(112 * MINUTES_PER_DAY - 1);
    yearEnd.onDayStart((e) => days.push(e));
    yearEnd.update(minutes(1));
    assert.deepEqual(days[1], { day: 112, dayOfWeek: 0, dayName: 'Mon', season: 'spring', year: 2 });
  });

  it('returns idempotent unsubscribe functions and lets the same listener register twice', () => {
    const clock = clockAt(0);
    let count = 0;
    const fn = () => {
      count++;
    };
    const off1 = clock.onMinute(fn);
    const off2 = clock.onMinute(fn);
    clock.update(minutes(1));
    assert.equal(count, 2);
    off1();
    off1();
    clock.update(minutes(1));
    assert.equal(count, 3);
    off2();
    clock.update(minutes(1));
    assert.equal(count, 3);
  });

  it('lets a listener unsubscribe itself or a sibling during dispatch', () => {
    const clock = clockAt(0);
    const trace = [];
    let offB;
    const offA = clock.onMinute(() => {
      trace.push('a');
      offA();
      offB();
    });
    offB = clock.onMinute(() => trace.push('b'));
    clock.onMinute(() => trace.push('c'));
    clock.update(minutes(1));
    assert.deepEqual(trace, ['a', 'c']);
    clock.update(minutes(1));
    assert.deepEqual(trace, ['a', 'c', 'c']);
  });

  it('clearListeners() drops everything', () => {
    const clock = clockAt(1439);
    let hits = 0;
    const bump = () => {
      hits++;
    };
    clock.onMinute(bump);
    clock.onHour(bump);
    clock.onDayStart(bump);
    clock.onTideChange(bump);
    clock.clearListeners();
    clock.update(minutes(400));
    assert.equal(hits, 0);
  });

  it('validates listeners', () => {
    const clock = createClock();
    for (const bad of [undefined, null, 'fn', 42, {}]) {
      assert.throws(() => clock.onMinute(bad), TypeError);
      assert.throws(() => clock.onHour(bad), TypeError);
      assert.throws(() => clock.onDayStart(bad), TypeError);
      assert.throws(() => clock.onTideChange(bad), TypeError);
    }
  });

  it('fires nothing while paused or at creation', () => {
    const clock = clockAt(1439.9);
    let hits = 0;
    clock.onMinute(() => hits++);
    clock.onDayStart(() => hits++);
    clock.pause();
    clock.update(minutes(10));
    assert.equal(hits, 0);
  });

  it('a throwing listener aborts the advance at that boundary and leaves the clock usable', () => {
    const clock = clockAt(59.5);
    const seen = [];
    let explode = true;
    clock.onMinute((e) => {
      seen.push(e.minute);
      if (explode && e.minute === 61) throw new Error('boom');
    });
    assert.throws(() => clock.update(2500), /boom/);
    assert.equal(clock.total, 61);
    assert.deepEqual(seen, [60, 61]);
    explode = false;
    clock.update(0);
    clock.update(1000);
    assert.equal(clock.total, 62);
    assert.deepEqual(seen, [60, 61, 62]);
  });

  it('refuses to be advanced or reconfigured from inside its own listener', () => {
    const clock = clockAt(59.5);
    const errors = [];
    clock.onMinute(() => {
      for (const attempt of [
        () => clock.update(1),
        () => clock.skipTo(100),
        () => clock.restore(clock.serialize()),
        () => clock.setRealClock(true),
      ]) {
        try {
          attempt();
        } catch (err) {
          errors.push(err);
        }
      }
    });
    clock.update(1000);
    assert.equal(errors.length, 4);
    for (const err of errors) assert.match(err.message, /inside one of its own listeners/);
    assert.equal(clock.total, 60.5);
    clock.update(1000);
    assert.equal(clock.total, 61.5);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: tide', () => {
  it('starts at high water on the canonical schedule at 18:40', () => {
    const clock = createClock();
    assert.ok(clock.tide > 0.999);
    assert.equal(clock.tideState, 'high');
    assert.equal(clock.isHighTide, true);
    assert.equal(clock.isLowTide, false);
    assertClose(clock.nextLowTide, 2 * TIDE_PERIOD_MINUTES - 1120);
    assertClose(clock.nextHighTide, 2.5 * TIDE_PERIOD_MINUTES - 1120);
  });

  it('nextLowTide and nextHighTide are 0 exactly at the extremes and count down between them', () => {
    const low = clockAt(TIDE_PERIOD_MINUTES * 3);
    assert.equal(low.nextLowTide, 0);
    assertClose(low.tide, 0);
    assert.equal(low.isLowTide, true);
    assertClose(low.nextHighTide, HALF_PERIOD);
    const high = clockAt(HALF_PERIOD);
    assert.equal(high.nextHighTide, 0);
    assertClose(high.nextLowTide, HALF_PERIOD);
    low.update(minutes(100));
    assertClose(low.nextLowTide, TIDE_PERIOD_MINUTES - 100);
    assertClose(low.nextHighTide, HALF_PERIOD - 100);
  });

  it('any 12.5-hour window contains a low water', () => {
    for (const seed of [undefined, 'foo', 'Wildshift', 99]) {
      const { tideOffset } = scheduleForSeed(seed);
      for (let t = 0; t < 3 * MINUTES_PER_DAY; t += 7.25) {
        const clock = clockAt(t, { seed });
        const wait = clock.nextLowTide;
        assert.ok(wait >= 0 && wait <= TIDE_PERIOD_MINUTES && wait < 12.5 * 60, `seed ${seed} t ${t}: ${wait}`);
        assertClose(tideAt(t + wait, tideOffset), 0, 1e-6);
      }
    }
  });

  it('lists the low and high waters of each day, ascending and alternating', () => {
    const clock = createClock();
    assert.deepEqual(clock.tidesToday, [
      { minute: 0, kind: 'low', time: '00:00' },
      { minute: 372.5, kind: 'high', time: '06:12' },
      { minute: 745, kind: 'low', time: '12:25' },
      { minute: 1117.5, kind: 'high', time: '18:37' },
    ]);
    assert.ok(Object.isFrozen(clock.tidesToday));
    assert.ok(Object.isFrozen(clock.tidesToday[0]));
    assert.deepEqual(clock.tidesForDay(1).map((e) => [e.minute, e.kind]), [
      [50, 'low'], [422.5, 'high'], [795, 'low'], [1167.5, 'high'],
    ]);
  });

  it('lows drift 50 minutes later each day and the sequence is continuous across days', () => {
    const clock = createClock({ seed: 'drift' });
    let previous = null;
    const counts = { 3: 0, 4: 0 };
    for (let day = 0; day < 120; day++) {
      const tides = clock.tidesForDay(day);
      assert.ok(tides.length === 3 || tides.length === 4, `day ${day} has ${tides.length}`);
      counts[tides.length]++;
      for (const entry of tides) {
        assert.ok(entry.minute >= 0 && entry.minute < MINUTES_PER_DAY);
        assert.equal(entry.time, formatMinute(entry.minute));
        const absolute = day * MINUTES_PER_DAY + entry.minute;
        assertClose(tideAt(absolute, scheduleForSeed('drift').tideOffset), entry.kind === 'low' ? 0 : 1, 1e-9);
        if (previous) {
          assertClose(absolute - previous.absolute, HALF_PERIOD);
          assert.notEqual(entry.kind, previous.kind);
        }
        previous = { absolute, kind: entry.kind };
      }
    }
    assert.ok(counts[3] > 0 && counts[4] > counts[3]);
    const firstLow = (day) => clock.tidesForDay(day).find((e) => e.kind === 'low');
    const todaysLow = firstLow(0);
    const laterLow = firstLow(1);
    assertClose(laterLow.minute - todaysLow.minute, 50);
  });

  it('shifts the whole schedule by the seed offset', () => {
    const clock = createClock({ seed: 'foo' });
    assert.deepEqual(clock.tidesToday.map((e) => e.minute), [10, 382.5, 755, 1127.5]);
    assert.equal(clock.tidesToday[0].kind, 'low');
  });

  it('tidesForDay validates its day', () => {
    const clock = createClock();
    assert.throws(() => clock.tidesForDay(1.5), RangeError);
    assert.throws(() => clock.tidesForDay('0'), TypeError);
    assert.equal(clock.tidesForDay(-1).length >= 3, true);
  });

  it('onTideChange walks the four states with previous/state/tide payloads', () => {
    const clock = clockAt(0);
    const events = [];
    clock.onTideChange((e) => {
      assert.ok(Object.isFrozen(e));
      events.push({ ...e, at: clock.total });
    });
    for (let i = 0; i < TIDE_PERIOD_MINUTES + 200; i++) clock.update(minutes(1));
    assert.deepEqual(events.map((e) => [e.previous, e.state]), [
      ['low', 'rising'], ['rising', 'high'], ['high', 'falling'], ['falling', 'low'], ['low', 'rising'],
    ]);
    for (const e of events) assert.equal(e.tide, tideAt(e.at));
    assert.equal(events[0].at, 110);
    assert.equal(events[1].at, 263);
    assert.equal(events[2].at, 483);
    assert.equal(events[3].at, 636);
    assert.equal(events[4].at, TIDE_PERIOD_MINUTES + 110);
    for (const e of events) assert.equal(e.state, tideStateAt(e.at));
  });

  it('fires onTideChange for sub-minute crossings as well', () => {
    // The rising crossing of tide = 0.2 sits at minute acos(0.6) / 2pi * period = 109.9498.
    const crossing = (Math.acos(1 - 2 * DEFAULT_LOW_TIDE) / (2 * Math.PI)) * TIDE_PERIOD_MINUTES;
    assert.ok(crossing > 109.9 && crossing < 109.98, `crossing at ${crossing}`);
    const clock = clockAt(109.5);
    const events = [];
    clock.onTideChange((e) => events.push([e.previous, e.state, clock.total]));
    clock.update(400); // -> 109.9, still low
    assert.deepEqual(events, []);
    clock.update(80); // -> 109.98: crossed without touching a whole minute
    assert.deepEqual(events, [['low', 'rising', 109.98]]);
    assert.equal(clock.tideState, 'rising');
    clock.update(20); // -> 110.0: the whole-minute step must not report it again
    assert.equal(events.length, 1);
  });

  it('honours custom thresholds for state, isLowTide and isHighTide', () => {
    const clock = clockAt(100, { lowTide: 0.05, highTide: 0.95 });
    assert.equal(clock.tideState, 'rising');
    assert.equal(clock.isLowTide, false);
    const strict = clockAt(HALF_PERIOD - 60, { lowTide: 0.05, highTide: 0.95 });
    assert.equal(strict.tideState, 'rising');
    assert.equal(strict.isHighTide, false);
    const def = clockAt(HALF_PERIOD - 60);
    assert.equal(def.tideState, 'high');
  });
});

describe('createClock: moon and spring tides', () => {
  it('has a new moon on day 0 and spring tides around every new and full moon', () => {
    const spring = [];
    for (let day = 0; day < 32; day++) {
      if (createClock({ startDay: day, startMinute: 0 }).isSpringTide) spring.push(day);
    }
    assert.deepEqual(spring, [0, 1, 14, 15, 16, 28, 29, 30, 31]);
    assert.equal(createClock({ startDay: 0, startMinute: 0 }).moonPhase, 0);
    assertClose(clockAt(LUNAR_MONTH_DAYS * MINUTES_PER_DAY / 2).moonPhase, 0.5);
    assertClose(clockAt(LUNAR_MONTH_DAYS * MINUTES_PER_DAY).moonPhase, 0);
    assert.equal(clockAt(1.5 * MINUTES_PER_DAY).isSpringTide, true);
    assert.equal(clockAt(1.5 * MINUTES_PER_DAY + 1).isSpringTide, false);
    assert.equal(clockAt(13.25 * MINUTES_PER_DAY - 1).isSpringTide, false);
    assert.equal(clockAt(13.25 * MINUTES_PER_DAY).isSpringTide, true);
  });

  it('spring tides recur roughly every 14 days', () => {
    const clock = clockAt(0, { seed: 'moon' });
    const starts = [];
    let was = clock.isSpringTide;
    for (let day = 1; day <= 365; day++) {
      // skipTo(0) at 00:00 is a no-op by contract, so hop through noon to reach the next midnight.
      clock.skipTo(720, { silent: true });
      clock.skipTo(0, { silent: true });
      assert.equal(clock.day, day);
      assert.equal(clock.minute, 0);
      const is = clock.isSpringTide;
      if (is && !was) starts.push(clock.day);
      was = is;
    }
    assert.ok(starts.length >= 23 && starts.length <= 25, `found ${starts.length} spring windows`);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i] - starts[i - 1];
      assert.ok(gap === 14 || gap === 15, `gap ${gap}`);
    }
  });

  it('tideRange is 1 at syzygy and 0.6 at the quarters', () => {
    assertClose(clockAt(0).tideRange, 1);
    assertClose(clockAt(LUNAR_MONTH_DAYS * MINUTES_PER_DAY / 2).tideRange, 1);
    assertClose(clockAt(LUNAR_MONTH_DAYS * MINUTES_PER_DAY / 4).tideRange, 0.6);
    assertClose(clockAt(LUNAR_MONTH_DAYS * MINUTES_PER_DAY * 0.75).tideRange, 0.6);
  });

  it('moves with the seed', () => {
    assert.equal(createClock({ seed: 'foo' }).isSpringTide, false);
    assertClose(createClock({ seed: 'foo', startMinute: 0 }).moonPhase, 22.14 / LUNAR_MONTH_DAYS);
    assert.equal(clockAt(7.5 * MINUTES_PER_DAY, { seed: 'foo' }).isSpringTide, true);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: phase, daylight and isNight', () => {
  it('derives phase and daylight from the minute of day', () => {
    for (const [minute, phase] of [[0, 'night'], [300, 'dawn'], [420, 'morning'], [660, 'midday'], [840, 'afternoon'], [1050, 'dusk'], [1170, 'evening'], [1320, 'night']]) {
      const clock = clockAt(5 * MINUTES_PER_DAY + minute);
      assert.equal(clock.phase, phase);
      assertClose(clock.daylight, daylightOfMinute(minute));
    }
  });

  it('isNight is true for evening and night only', () => {
    for (const m of [0, 299, 1170, 1319, 1320, 1439.5]) assert.equal(clockAt(m).isNight, true, `minute ${m}`);
    for (const m of [300, 420, 720, 1050, 1169]) assert.equal(clockAt(m).isNight, false, `minute ${m}`);
    for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
      const clock = clockAt(m);
      if (clock.isNight) assert.equal(clock.daylight, 0, `minute ${m}`);
    }
  });
});

// ---------------------------------------------------------------------------

describe('createClock: skipTo()', () => {
  it('advances to a later minute today, firing boundary events on the way', () => {
    const clock = clockAt(600);
    let count = 0;
    clock.onMinute(() => count++);
    clock.skipTo(700);
    assert.equal(clock.total, 700);
    assert.equal(count, 100);
  });

  it('wraps to tomorrow when the minute already passed and fires onDayStart once', () => {
    const clock = clockAt(700);
    const days = [];
    clock.onDayStart((e) => days.push(e.day));
    clock.skipTo(500);
    assert.equal(clock.day, 1);
    assert.equal(clock.minute, 500);
    assert.deepEqual(days, [1]);
  });

  it('is a no-op for the current minute', () => {
    const clock = clockAt(700);
    let count = 0;
    clock.onMinute(() => count++);
    clock.skipTo(700);
    assert.equal(clock.total, 700);
    assert.equal(count, 0);
  });

  it('works while paused and with a fractional target', () => {
    const clock = clockAt(10);
    clock.pause();
    clock.skipTo(12.25);
    assert.equal(clock.total, 12.25);
  });

  it('silent skips fire nothing but keep tide tracking in sync', () => {
    const clock = clockAt(0);
    let hits = 0;
    const tideEvents = [];
    clock.onMinute(() => hits++);
    clock.onHour(() => hits++);
    clock.onDayStart(() => hits++);
    clock.onTideChange((e) => tideEvents.push(e.state));
    clock.skipTo(HALF_PERIOD, { silent: true });
    assert.equal(clock.total, HALF_PERIOD);
    assert.equal(hits, 0);
    assert.deepEqual(tideEvents, []);
    clock.update(minutes(1));
    assert.deepEqual(tideEvents, [], 'already high before the skip was observed');
    assert.equal(hits, 1);
  });

  it('validates input and is unavailable in real-clock mode', () => {
    const clock = createClock();
    assert.throws(() => clock.skipTo(1440), RangeError);
    assert.throws(() => clock.skipTo(-1), RangeError);
    assert.throws(() => clock.skipTo('noon'), TypeError);
    assert.throws(() => clock.skipTo(100, { silent: 'yes' }), TypeError);
    const real = createClock({ realClock: true, now: () => localMs(2026, 9, 23, 12) });
    assert.throws(() => real.skipTo(100), /unavailable while the clock follows real time/);
  });
});

describe('createClock: maxCatchUpMinutes', () => {
  it('replays every minute up to the limit and resyncs silently beyond it', () => {
    const clock = clockAt(0, { maxCatchUpMinutes: 100 });
    let count = 0;
    const tides = [];
    clock.onMinute(() => count++);
    clock.onTideChange((e) => tides.push(e.state));
    clock.update(minutes(100));
    assert.equal(count, 100);
    assert.equal(clock.total, 100);
    clock.update(minutes(100.5));
    assert.equal(count, 100, 'a 100.5-minute jump exceeds the limit and is applied silently');
    assertClose(clock.total, 200.5);
    assert.deepEqual(tides, ['rising'], 'a resync still reports the tide-state change');
    clock.update(minutes(1));
    assert.equal(count, 101);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: serialize() and restore()', () => {
  it('round-trips through JSON exactly', () => {
    const clock = createClock({ seed: 'tidepool', maxDt: Infinity });
    clock.setSpeed(2.5);
    for (let i = 0; i < 97; i++) clock.update(33.3);
    clock.pause();
    const state = clock.serialize();
    assert.deepEqual(state, { version: 1, total: clock.total, speed: 2.5, paused: true, realClock: false, seed: 'tidepool' });
    const copy = createClock({ maxDt: Infinity });
    copy.restore(JSON.parse(JSON.stringify(state)));
    assert.equal(copy.total, clock.total);
    assert.equal(copy.speed, 2.5);
    assert.equal(copy.paused, true);
    assert.deepEqual(copy.snapshot(), clock.snapshot());
    assert.deepEqual(copy.tidesToday, clock.tidesToday);
    copy.resume();
    clock.resume();
    copy.update(1000);
    clock.update(1000);
    assert.equal(copy.total, clock.total);
  });

  it('serializes an absent seed as null and restores it', () => {
    const clock = createClock();
    assert.equal(clock.serialize().seed, null);
    const seeded = createClock({ seed: 'foo' });
    seeded.restore(clock.serialize());
    assert.equal(seeded.tidesToday[0].minute, 0);
    assert.equal(seeded.serialize().seed, null);
  });

  it('adopts the saved seed, so a save carries its own tide tables', () => {
    const clock = createClock();
    clock.restore({ version: 1, total: 0, speed: 1, paused: false, realClock: false, seed: 'foo' });
    assert.equal(clock.tidesToday[0].minute, 10);
    assert.equal(clock.serialize().seed, 'foo');
    clock.restore({ version: 1, total: 0, speed: 1, paused: false, realClock: false, seed: 42 });
    const { tideOffset } = scheduleForSeed(42);
    assert.ok(tideOffset > HALF_PERIOD, 'seed 42 is chosen so a high water precedes the first low of day 0');
    assert.deepEqual(clock.tidesToday.map((e) => [e.minute, e.kind]), [
      [tideOffset - HALF_PERIOD, 'high'], [tideOffset, 'low'], [tideOffset + HALF_PERIOD, 'high'], [tideOffset + TIDE_PERIOD_MINUTES, 'low'],
    ]);
    assert.equal(clock.tidesToday.find((e) => e.kind === 'low').minute, tideOffset);
  });

  it('fires nothing and resets tide tracking', () => {
    const clock = clockAt(0);
    let hits = 0;
    const tides = [];
    clock.onMinute(() => hits++);
    clock.onDayStart(() => hits++);
    clock.onTideChange((e) => tides.push(e.state));
    clock.restore({ version: 1, total: 6 * TIDE_PERIOD_MINUTES + HALF_PERIOD, speed: 1, paused: false, realClock: false, seed: null });
    assert.equal(hits, 0);
    assert.deepEqual(tides, []);
    assert.equal(clock.day, 3);
    assert.equal(clock.tideState, 'high');
    clock.update(minutes(1));
    assert.equal(hits, 1);
    assert.deepEqual(tides, []);
  });

  it('rejects malformed states without changing the clock', () => {
    const clock = createClock();
    const good = clock.serialize();
    const bad = [
      [null, TypeError],
      [[], TypeError],
      ['{}', TypeError],
      [{ ...good, version: 2 }, RangeError],
      [{ ...good, version: undefined }, RangeError],
      [{ ...good, total: -1 }, RangeError],
      [{ ...good, total: 'x' }, TypeError],
      [{ ...good, total: NaN }, TypeError],
      [{ ...good, speed: -2 }, RangeError],
      [{ ...good, paused: 'yes' }, TypeError],
      [{ ...good, realClock: undefined }, TypeError],
      [{ ...good, seed: {} }, TypeError],
    ];
    for (const [state, type] of bad) {
      assert.throws(() => clock.restore(state), type, JSON.stringify(state));
    }
    assert.deepEqual(clock.serialize(), good);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: snapshot()', () => {
  it('is a frozen mirror of the getters', () => {
    const clock = createClock({ seed: 'snap', startDay: 40, startMinute: 333.3 });
    const s = clock.snapshot();
    assert.ok(Object.isFrozen(s));
    for (const key of ['total', 'day', 'minute', 'hour', 'minuteOfHour', 'dayOfWeek', 'dayName', 'season', 'seasonIndex', 'dayOfSeason', 'dayOfYear', 'year', 'phase', 'daylight', 'isNight', 'tide', 'tideState', 'isLowTide', 'isHighTide', 'nextLowTide', 'nextHighTide', 'moonPhase', 'isSpringTide', 'tideRange', 'speed', 'paused', 'realClock']) {
      assert.equal(s[key], clock[key], key);
    }
    assert.equal(s.time, clock.formatTime());
    assert.equal(s.date, clock.dateLabel());
    assert.equal(s.time, '05:33');
    assert.equal(s.date, 'Sat, Summer 13');
  });
});

// ---------------------------------------------------------------------------

describe('createClock: real-clock mode', () => {
  it('maps the local wall clock to day, minute and the real calendar', () => {
    let ms = localMs(2026, 9, 23, 18, 40, 30);
    const clock = createClock({ realClock: true, now: () => ms, startDay: 99, startMinute: 5 });
    assert.equal(clock.realClock, true);
    assert.equal(clock.day, realDayOf(2026, 9, 23));
    assertClose(clock.minute, 1120.5);
    assert.equal(clock.hour, 18);
    assert.equal(clock.dayOfWeek, 4);
    assert.equal(clock.dayName, 'Fri');
    assert.equal(clock.season, 'autumn');
    assert.equal(clock.dayOfSeason, 53);
    assert.equal(clock.dayOfYear, 296);
    assert.equal(clock.year, 2026);
    assert.equal(clock.phase, 'dusk');
    assert.equal(clock.formatTime(), '18:40');
    assert.equal(clock.dateLabel(), 'Fri, Oct 23');
    assert.equal(clock.dateLabel({ year: true }), 'Fri, Oct 23, 2026');
    assertClose(clock.minutesPerSecond, 1 / 60);
    assert.equal(clock.total, realTimeToTotal(ms));
    assert.equal(clock.snapshot().date, 'Fri, Oct 23');
  });

  it('update() follows the wall clock, ignores realDt and speed, and fires boundary events', () => {
    let ms = localMs(2026, 9, 23, 18, 40, 30);
    const clock = createClock({ realClock: true, now: () => ms });
    const seen = [];
    clock.onMinute((e) => seen.push(e.minute));
    clock.setSpeed(60);
    clock.update();
    assert.deepEqual(seen, []);
    ms += 90_000;
    clock.update(-999);
    assert.deepEqual(seen, [1121, 1122]);
    assertClose(clock.minute, 1122);
    ms += 5 * 3_600_000 + 20 * 60_000;
    const days = [];
    clock.onDayStart((e) => days.push([e.day, e.dayName, e.season]));
    clock.update(16);
    assert.deepEqual(days, [[realDayOf(2026, 9, 24), 'Sat', 'autumn']]);
    assert.equal(clock.formatTime(), '00:02');
  });

  it('resyncs silently when the wall clock goes backwards', () => {
    let ms = localMs(2026, 9, 23, 18, 40, 30);
    const clock = createClock({ realClock: true, now: () => ms });
    let hits = 0;
    clock.onMinute(() => hits++);
    clock.onTideChange(() => hits++);
    ms -= 3 * 3_600_000;
    clock.update();
    assert.equal(hits, 0);
    assert.equal(clock.hour, 15);
    assertClose(clock.minute, 940.5);
  });

  it('pause() holds the displayed time until resume()', () => {
    let ms = localMs(2026, 9, 23, 18, 40, 30);
    const clock = createClock({ realClock: true, now: () => ms });
    clock.pause();
    ms += 10 * 60_000;
    clock.update();
    assertClose(clock.minute, 1120.5);
    assert.equal(clock.minutesPerSecond, 0);
    clock.resume();
    clock.update();
    assertClose(clock.minute, 1130.5);
  });

  it('setRealClock() switches modes: on jumps silently to the wall clock, off continues from there', () => {
    const ms = localMs(2026, 9, 23, 18, 40, 30);
    const clock = createClock({ maxDt: Infinity, now: () => ms });
    let hits = 0;
    clock.onMinute(() => hits++);
    assert.equal(clock.total, 1120);
    clock.setRealClock(true);
    assert.equal(clock.realClock, true);
    assert.equal(clock.total, realTimeToTotal(ms));
    assert.equal(hits, 0);
    clock.setRealClock(true);
    clock.setRealClock(false);
    assert.equal(clock.realClock, false);
    assert.equal(clock.total, realTimeToTotal(ms));
    const realDay = realDayOf(2026, 9, 23);
    assert.equal(clock.day, realDay);
    const cal = gameCalendar(realDay);
    assert.equal(cal.dayName, 'Fri', 'real-clock day numbering keeps the weekday');
    assert.equal(clock.dateLabel(), `${cal.dayName}, ${cal.dateText}`, 'the game calendar resumes from the absolute day number');
    clock.update(1000);
    assertClose(clock.total, realTimeToTotal(ms) + 1);
    assert.equal(hits, 1);
    assert.throws(() => clock.setRealClock('on'), TypeError);
  });

  it('serializes and restores the mode', () => {
    const ms = localMs(2026, 9, 23, 18, 40, 30);
    const real = createClock({ realClock: true, now: () => ms });
    const state = real.serialize();
    assert.equal(state.realClock, true);
    const other = createClock({ now: () => ms + 60_000 });
    other.restore(state);
    assert.equal(other.realClock, true);
    assert.equal(other.total, state.total);
    other.update();
    assertClose(other.total, state.total + 1);
  });

  it('rejects a now() that does not return a finite number', () => {
    assert.throws(() => createClock({ realClock: true, now: () => NaN }), TypeError);
    let bad = false;
    const clock = createClock({ realClock: true, now: () => (bad ? 'later' : localMs(2026, 0, 1)) });
    bad = true;
    assert.throws(() => clock.update(), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('createClock: calendar options', () => {
  it('uses daysPerSeason for season, dayOfSeason, dayOfYear and year', () => {
    const clock = createClock({ daysPerSeason: 7, startDay: 30, startMinute: 0 });
    assert.equal(clock.year, 2);
    assert.equal(clock.season, 'spring');
    assert.equal(clock.dayOfSeason, 3);
    assert.equal(clock.dayOfYear, 3);
    assert.equal(clock.dateLabel({ year: true }), 'Wed, Spring 3, Year 2');
  });
});
