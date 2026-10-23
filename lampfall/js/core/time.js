/**
 * World clock for an accelerated in-game day: time of day, a seasonal calendar,
 * day/night phase and daylight, a semi-diurnal tide and a lunar spring/neap cycle.
 *
 * Pure module: no DOM access, no timers and no module-level side effects, so it
 * runs unchanged under Node (`node --test`) and in the browser. The clock only
 * moves when the game calls {@link Clock#update update()}; in real-clock mode
 * `update()` reads the wall clock through an injectable `now()` instead.
 *
 * Units: `update(realDt)` takes real MILLISECONDS, the engine-wide convention
 * (see scene.js). Every other quantity is in in-game minutes unless stated.
 *
 * Time model: one number, `total`, counts in-game minutes since 00:00 of day 0.
 * Everything else (`day`, `minute`, `hour`, phase, calendar, tide, moon) is a
 * pure function of `total` and the construction options, so the clock is
 * deterministic: the same options (including `seed`) and the same sequence of
 * `update()` / `setSpeed()` / `skipTo()` calls always yield the same state, and
 * `serialize()` / `restore()` round-trip it exactly.
 *
 * Boundary events: when an advance crosses whole minutes the clock steps through
 * each one in order and, at each, fires `onDayStart` (at 00:00), then `onHour`
 * (at :00), then `onMinute`, then `onTideChange` if the tide state changed.
 * While a listener runs the clock's getters report that boundary, not the final
 * time. Silent jumps (`restore`, `setRealClock`, `skipTo(m, {silent: true})`, a
 * wall clock that went backwards, or a jump longer than `maxCatchUpMinutes`)
 * fire nothing, except that a resync longer than `maxCatchUpMinutes` still
 * reports a tide-state change.
 *
 * Listener rules match events.js: listeners run synchronously in registration
 * order; one registered during a dispatch first fires at the next boundary; one
 * removed during a dispatch (by its unsubscribe or `clearListeners()`) does not
 * fire if it has not run yet; a throwing listener aborts the advance at that
 * boundary (the clock stays there, usable) and the remaining listeners are skipped.
 *
 * Range: `total` never exceeds {@link MAX_TOTAL_MINUTES}; `update()` and `skipTo()`
 * stop there rather than drift into imprecise floats, and `restore()` rejects
 * anything beyond it. Real-clock mode is confined to the range `Date` can
 * represent and rejects instants outside it with a `RangeError`.
 *
 * @module core/time
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @typedef {'night'|'dawn'|'morning'|'midday'|'afternoon'|'dusk'|'evening'} Phase */
/** @typedef {'low'|'rising'|'high'|'falling'} TideState */
/** @typedef {'spring'|'summer'|'autumn'|'winter'} Season */

/** In-game minutes in one day. */
export const MINUTES_PER_DAY = 1440;
/** In-game minutes in one hour. */
export const MINUTES_PER_HOUR = 60;
/** Days in a week; `dayOfWeek` 0 is Monday. */
export const DAYS_PER_WEEK = 7;
/** Default real minutes one in-game day lasts (`minutesPerDay` option). */
export const DEFAULT_MINUTES_PER_DAY = 24;
/** Default minute of day the clock starts at: 18:40, dusk. */
export const DEFAULT_START_MINUTE = 18 * MINUTES_PER_HOUR + 40;
/** Default `maxDt`: the most real milliseconds one `update()` may advance by. */
export const DEFAULT_MAX_DT_MS = 250;
/** Default `maxCatchUpMinutes`: the longest jump that still replays every minute. */
export const DEFAULT_MAX_CATCH_UP_MINUTES = 7 * MINUTES_PER_DAY;
/** Default days per season (`daysPerSeason` option); four seasons make a year. */
export const DEFAULT_DAYS_PER_SEASON = 28;
/** Season ids in calendar order. @type {readonly Season[]} */
export const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
/** Short weekday names indexed by `dayOfWeek` (0 = Monday). */
export const DAY_NAMES = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
/** Day-phase ids in the order they occur after midnight. @type {readonly Phase[]} */
export const PHASES = Object.freeze(['night', 'dawn', 'morning', 'midday', 'afternoon', 'dusk', 'evening']);
/**
 * Minute of day at which each phase begins, ascending; 'night' wraps past
 * midnight so it appears first and last.
 * @type {ReadonlyArray<Readonly<{phase: Phase, start: number}>>}
 */
export const PHASE_TABLE = Object.freeze([
  Object.freeze({ phase: 'night', start: 0 }),
  Object.freeze({ phase: 'dawn', start: 5 * MINUTES_PER_HOUR }),
  Object.freeze({ phase: 'morning', start: 7 * MINUTES_PER_HOUR }),
  Object.freeze({ phase: 'midday', start: 11 * MINUTES_PER_HOUR }),
  Object.freeze({ phase: 'afternoon', start: 14 * MINUTES_PER_HOUR }),
  Object.freeze({ phase: 'dusk', start: 17 * MINUTES_PER_HOUR + 30 }),
  Object.freeze({ phase: 'evening', start: 19 * MINUTES_PER_HOUR + 30 }),
  Object.freeze({ phase: 'night', start: 22 * MINUTES_PER_HOUR }),
]);
/** Semi-diurnal tide period: 12 h 25 min, so lows drift ~50 min later each day. */
export const TIDE_PERIOD_MINUTES = 12 * MINUTES_PER_HOUR + 25;
/** Default `lowTide` threshold: `isLowTide` is `tide < 0.2`. */
export const DEFAULT_LOW_TIDE = 0.2;
/** Default `highTide` threshold: `isHighTide` is `tide > 0.8`. */
export const DEFAULT_HIGH_TIDE = 0.8;
/** Tide states as reported by `tideState`, in the order of one cycle. @type {readonly TideState[]} */
export const TIDE_STATES = Object.freeze(['low', 'rising', 'high', 'falling']);
/** Length of the lunar (spring/neap) cycle in days; spring tides come every half cycle. */
export const LUNAR_MONTH_DAYS = 29.5;
/** Days either side of a new or full moon that count as spring tide. */
export const SPRING_TIDE_HALF_WINDOW_DAYS = 1.5;
/** Shape version written by `serialize()` and accepted by `restore()`. */
export const CLOCK_STATE_VERSION = 1;
/**
 * Largest `total` the clock holds: `Number.MAX_SAFE_INTEGER` in-game minutes
 * (about 17 billion years), the point past which minute arithmetic stops being
 * exact. `update()` and `skipTo()` stop there; `restore()` rejects more.
 */
export const MAX_TOTAL_MINUTES = Number.MAX_SAFE_INTEGER;
/** Day number that holds {@link MAX_TOTAL_MINUTES}: the largest `day`, `startDay` or `tidesForDay()` argument. */
export const MAX_DAY = Math.floor(MAX_TOTAL_MINUTES / MINUTES_PER_DAY);

const TWO_PI = Math.PI * 2;
const MS_PER_DAY = 86_400_000;
/**
 * Day number of 1970-01-01 in real-clock mode. It was a Thursday, so offsetting
 * the days-since-epoch count by 3 makes `day % 7` land on 0 = Monday.
 */
const REAL_DAY_OFFSET = 3;
/**
 * `Date` covers ±1e8 days (±8.64e15 ms) around the epoch. Keeping one day of
 * margin on the instant means any time zone's local date still has a valid `Date`.
 */
const MAX_REAL_TIME_MS = 8.64e15 - MS_PER_DAY;
/** Real-clock day numbers whose `Date` is valid (see {@link realCalendar}). */
const MIN_REAL_DAY = -1e8 + REAL_DAY_OFFSET;
const MAX_REAL_DAY = 1e8 + REAL_DAY_OFFSET;
const MONTH_NAMES = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
/** First month (0-based) of each meteorological season, indexed like {@link SEASONS}. */
const SEASON_START_MONTHS = Object.freeze([2, 5, 8, 11]);
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_ALT_BASIS = 0x9e3779b9;
const FNV_PRIME = 0x01000193;

// ---------------------------------------------------------------------------
// Small internal helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable type name for error messages.
 * @param {unknown} v
 * @returns {string}
 */
function describe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : String(v);
  return typeof v;
}

/**
 * Validates a number, throwing a readable error naming `label`.
 * @param {string} label e.g. `'createClock: minutesPerDay'`
 * @param {unknown} value
 * @param {{min?: number, max?: number, exclusiveMin?: boolean, exclusiveMax?: boolean,
 *   integer?: boolean, allowInfinity?: boolean}} [rules]
 * @returns {number} `value`, now known to be a number
 */
function checkNumber(label, value, rules = {}) {
  const { min, max, exclusiveMin = false, exclusiveMax = false, integer = false, allowInfinity = false } = rules;
  const finite = typeof value === 'number' && Number.isFinite(value);
  if (!finite && !(allowInfinity && value === Infinity)) {
    const want = allowInfinity ? 'a finite number or Infinity' : 'a finite number';
    throw new TypeError(`${label} must be ${want}, got ${describe(value)}`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer, got ${value}`);
  }
  if (min !== undefined && (exclusiveMin ? value <= min : value < min)) {
    throw new RangeError(`${label} must be ${exclusiveMin ? '>' : '>='} ${min}, got ${value}`);
  }
  if (max !== undefined && (exclusiveMax ? value >= max : value > max)) {
    throw new RangeError(`${label} must be ${exclusiveMax ? '<' : '<='} ${max}, got ${value}`);
  }
  return value;
}

/**
 * Validates a boolean.
 * @param {string} label
 * @param {unknown} value
 * @returns {boolean}
 */
function checkBoolean(label, value) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean, got ${describe(value)}`);
  return value;
}

/**
 * Validates a listener.
 * @param {string} label
 * @param {unknown} fn
 * @returns {Function}
 */
function checkFunction(label, fn) {
  if (typeof fn !== 'function') throw new TypeError(`${label} must be a function, got ${describe(fn)}`);
  return fn;
}

/**
 * Validates a world seed and normalises it to the string that gets hashed.
 * Numbers hash via their decimal form, so `42` and `'42'` share a schedule.
 * @param {string} label
 * @param {unknown} seed
 * @returns {string|null} `null` when no seed was given
 */
function seedKey(label, seed) {
  if (seed === undefined || seed === null) return null;
  if (typeof seed === 'string') return seed;
  if (typeof seed === 'number' && Number.isFinite(seed)) return String(seed);
  throw new TypeError(`${label} must be a string, a finite number, null or undefined, got ${describe(seed)}`);
}

/**
 * Floored modulo: result always in `[0, n)` for positive `n`.
 * @param {number} a
 * @param {number} n
 * @returns {number}
 */
function mod(a, n) {
  const r = a % n;
  return r < 0 ? r + n : r;
}

/**
 * Hermite smoothstep on `[0, 1]`.
 * @param {number} t already clamped to `[0, 1]`
 * @returns {number}
 */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Two-digit zero padding for clock faces.
 * @param {number} n integer in `[0, 99]`
 * @returns {string}
 */
function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * FNV-1a over UTF-16 code units with a murmur3 finaliser, so similar seeds
 * still land on different offsets.
 * @param {string} str
 * @param {number} basis
 * @returns {number} uint32
 */
function hash32(str, basis) {
  let h = basis | 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), FNV_PRIME);
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Minute of day at which the named phase begins (first occurrence in the table).
 * @param {Phase} phase
 * @returns {number}
 */
function phaseStart(phase) {
  return PHASE_TABLE.find((entry) => entry.phase === phase).start;
}

const DAWN_START = phaseStart('dawn');
const DAWN_END = phaseStart('morning');
const DUSK_START = phaseStart('dusk');
const DUSK_END = phaseStart('evening');

/**
 * Splits a total-minute count into a day number and a minute of day. `%` is exact
 * in IEEE arithmetic, so `minute` is always in `[0, 1440)` even for huge totals,
 * and `day * 1440 + minute` reproduces `total` whenever `total` is a safe integer
 * or smaller.
 * @param {number} total finite
 * @returns {{day: number, minute: number}}
 */
function splitTotal(total) {
  let minute = total % MINUTES_PER_DAY;
  if (minute < 0) minute += MINUTES_PER_DAY;
  if (minute >= MINUTES_PER_DAY) minute = 0; // a rounding hair below zero rounded up to a full day
  return { day: Math.round((total - minute) / MINUTES_PER_DAY), minute };
}

// ---------------------------------------------------------------------------
// Pure helpers (exported so game systems and tests can use the same maths)
// ---------------------------------------------------------------------------

/**
 * Day phase for a minute of day.
 * @param {number} minute in `[0, 1440)`
 * @returns {Phase}
 * @throws {TypeError|RangeError} on a non-finite or out-of-range minute
 */
export function phaseOfMinute(minute) {
  checkNumber('phaseOfMinute: minute', minute, { min: 0, max: MINUTES_PER_DAY, exclusiveMax: true });
  let phase = PHASE_TABLE[0].phase;
  for (const entry of PHASE_TABLE) {
    if (entry.start > minute) break;
    phase = entry.phase;
  }
  return phase;
}

/**
 * Daylight amount for a minute of day: 0 from the start of evening to the start
 * of dawn, 1 from the start of morning to the start of dusk, and a smoothstep
 * ramp across dawn and dusk. Meant for sky tint and lighting.
 * @param {number} minute in `[0, 1440)`
 * @returns {number} in `[0, 1]`
 * @throws {TypeError|RangeError} on a non-finite or out-of-range minute
 */
export function daylightOfMinute(minute) {
  checkNumber('daylightOfMinute: minute', minute, { min: 0, max: MINUTES_PER_DAY, exclusiveMax: true });
  if (minute < DAWN_START || minute >= DUSK_END) return 0;
  if (minute < DAWN_END) return smoothstep((minute - DAWN_START) / (DAWN_END - DAWN_START));
  if (minute < DUSK_START) return 1;
  return 1 - smoothstep((minute - DUSK_START) / (DUSK_END - DUSK_START));
}

/**
 * Formats a minute of day as a clock face, truncating partial minutes.
 * @param {number} minute in `[0, 1440)`
 * @param {{hour12?: boolean}} [options] `hour12` gives `'6:05 PM'` instead of `'18:05'`
 * @returns {string}
 * @throws {TypeError|RangeError} on a non-finite or out-of-range minute
 */
export function formatMinute(minute, { hour12 = false } = {}) {
  checkNumber('formatMinute: minute', minute, { min: 0, max: MINUTES_PER_DAY, exclusiveMax: true });
  const whole = Math.floor(minute);
  const h = Math.floor(whole / MINUTES_PER_HOUR);
  const m = whole % MINUTES_PER_HOUR;
  if (!hour12) return `${pad2(h)}:${pad2(m)}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Position within the tide cycle: 0 at low water, 0.5 at high water.
 * @param {number} totalMinutes in-game minutes since 00:00 of day 0
 * @param {number} [tideOffset=0] minute of the first low water (see {@link scheduleForSeed})
 * @returns {number} in `[0, 1)`
 * @throws {TypeError} on non-finite input
 */
export function tidePhaseAt(totalMinutes, tideOffset = 0) {
  checkNumber('tidePhaseAt: totalMinutes', totalMinutes);
  checkNumber('tidePhaseAt: tideOffset', tideOffset);
  let r = (totalMinutes - tideOffset) % TIDE_PERIOD_MINUTES;
  if (r < 0) r += TIDE_PERIOD_MINUTES;
  if (r >= TIDE_PERIOD_MINUTES) r = 0; // r was a negative rounding hair below zero
  return r / TIDE_PERIOD_MINUTES;
}

/**
 * Normalised tide height: 0 at low water, 1 at high water, a raised cosine between.
 * @param {number} totalMinutes in-game minutes since 00:00 of day 0
 * @param {number} [tideOffset=0] minute of the first low water
 * @returns {number} in `[0, 1]`
 * @throws {TypeError} on non-finite input
 */
export function tideAt(totalMinutes, tideOffset = 0) {
  return 0.5 - 0.5 * Math.cos(TWO_PI * tidePhaseAt(totalMinutes, tideOffset));
}

/**
 * Tide state for a moment: `'low'` below `lowTide`, `'high'` above `highTide`,
 * otherwise `'rising'` before high water and `'falling'` after it.
 * @param {number} totalMinutes in-game minutes since 00:00 of day 0
 * @param {number} [tideOffset=0] minute of the first low water
 * @param {{lowTide?: number, highTide?: number}} [thresholds]
 * @returns {TideState}
 * @throws {TypeError} on non-finite input
 */
export function tideStateAt(totalMinutes, tideOffset = 0, { lowTide = DEFAULT_LOW_TIDE, highTide = DEFAULT_HIGH_TIDE } = {}) {
  const phase = tidePhaseAt(totalMinutes, tideOffset);
  const tide = 0.5 - 0.5 * Math.cos(TWO_PI * phase);
  if (tide < lowTide) return 'low';
  if (tide > highTide) return 'high';
  return phase < 0.5 ? 'rising' : 'falling';
}

/**
 * Derives the tide and moon schedule for a world seed. No seed gives the
 * canonical schedule (low water at 00:00 of day 0, new moon on day 0); any seed
 * shifts both deterministically so each world has its own tide tables.
 * @param {string|number|null|undefined} seed
 * @returns {Readonly<{tideOffset: number, moonOffset: number}>} `tideOffset` is a
 *   whole minute in `[0, 745)`; `moonOffset` is in days, in `[0, 29.5)`
 * @throws {TypeError} on an unsupported seed type
 */
export function scheduleForSeed(seed) {
  const key = seedKey('scheduleForSeed: seed', seed);
  if (key === null) return Object.freeze({ tideOffset: 0, moonOffset: 0 });
  const hundredths = Math.round(LUNAR_MONTH_DAYS * 100);
  return Object.freeze({
    tideOffset: hash32(key, FNV_OFFSET_BASIS) % TIDE_PERIOD_MINUTES,
    moonOffset: (hash32(key, FNV_ALT_BASIS) % hundredths) / 100,
  });
}

/**
 * Calendar facts for a day number.
 * @typedef {Object} CalendarInfo
 * @property {number} dayOfWeek 0 = Monday .. 6 = Sunday
 * @property {string} dayName short weekday name
 * @property {number} seasonIndex index into {@link SEASONS}
 * @property {Season} season
 * @property {number} dayOfSeason 1-based day within the season
 * @property {number} dayOfYear 1-based day within the year
 * @property {number} year game years are 1-based; real-clock years are the real year
 * @property {string} dateText `'Spring 1'` (game) or `'Oct 23'` (real)
 * @property {string} yearText `'Year 1'` (game) or `'2026'` (real)
 */

/**
 * The game calendar: `4 * daysPerSeason` days per year, starting in spring with
 * day 0 a Monday, so with the default 28-day seasons every season opens on a Monday.
 * @param {number} day integer day number (day 0 = Spring 1, Year 1)
 * @param {number} [daysPerSeason=28] positive integer
 * @returns {CalendarInfo}
 * @throws {TypeError|RangeError} on invalid input
 */
export function gameCalendar(day, daysPerSeason = DEFAULT_DAYS_PER_SEASON) {
  checkNumber('gameCalendar: day', day, { integer: true });
  checkNumber('gameCalendar: daysPerSeason', daysPerSeason, { integer: true, min: 1 });
  const daysPerYear = daysPerSeason * SEASONS.length;
  const dayOfYear0 = mod(day, daysPerYear);
  const seasonIndex = Math.floor(dayOfYear0 / daysPerSeason);
  const season = SEASONS[seasonIndex];
  const dayOfSeason = (dayOfYear0 % daysPerSeason) + 1;
  const year = Math.floor(day / daysPerYear) + 1;
  const dayOfWeek = mod(day, DAYS_PER_WEEK);
  return {
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    seasonIndex,
    season,
    dayOfSeason,
    dayOfYear: dayOfYear0 + 1,
    year,
    dateText: `${season[0].toUpperCase()}${season.slice(1)} ${dayOfSeason}`,
    yearText: `Year ${year}`,
  };
}

/**
 * Converts a wall-clock instant to the real-clock-mode total: the local calendar
 * day (numbered so weekdays match, Monday = 0) times 1440 plus the local minute
 * of day, including seconds and milliseconds as a fraction.
 * @param {number} ms milliseconds since the Unix epoch, as from `Date.now()`, within
 *   the range `Date` represents (about ±1e8 days)
 * @returns {number} in-game total minutes
 * @throws {TypeError|RangeError} on a non-finite instant or one `Date` cannot represent
 */
export function realTimeToTotal(ms) {
  checkNumber('realTimeToTotal: ms', ms, { min: -MAX_REAL_TIME_MS, max: MAX_REAL_TIME_MS });
  const d = new Date(ms);
  const minute = d.getHours() * MINUTES_PER_HOUR + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60_000;
  const dayIndex = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
  return (dayIndex + REAL_DAY_OFFSET) * MINUTES_PER_DAY + minute;
}

/**
 * The real calendar for a real-clock-mode day number (as produced by
 * {@link realTimeToTotal}): meteorological seasons (spring = March to May, and
 * so on), the real year and a `'Mon DD'` date text. Time-zone independent.
 * @param {number} day integer day number within the range `Date` represents
 * @returns {CalendarInfo}
 * @throws {TypeError|RangeError} on a non-integer day or one `Date` cannot represent
 */
export function realCalendar(day) {
  checkNumber('realCalendar: day', day, { integer: true, min: MIN_REAL_DAY, max: MAX_REAL_DAY });
  const d = new Date((day - REAL_DAY_OFFSET) * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const date = d.getUTCDate();
  const seasonIndex = (Math.floor(((mo + 1) % 12) / 3) + 3) % 4;
  const seasonStartYear = mo < 2 ? y - 1 : y; // January and February belong to the winter that began in December
  const today = Date.UTC(y, mo, date);
  const dayOfSeason = Math.round((today - Date.UTC(seasonStartYear, SEASON_START_MONTHS[seasonIndex], 1)) / MS_PER_DAY) + 1;
  const dayOfYear = Math.round((today - Date.UTC(y, 0, 1)) / MS_PER_DAY) + 1;
  const dayOfWeek = mod(day, DAYS_PER_WEEK);
  return {
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    seasonIndex,
    season: SEASONS[seasonIndex],
    dayOfSeason,
    dayOfYear,
    year: y,
    dateText: `${MONTH_NAMES[mo]} ${date}`,
    yearText: String(y),
  };
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

/**
 * Options for {@link createClock}.
 * @typedef {Object} ClockOptions
 * @property {number} [minutesPerDay=24] real minutes one in-game day lasts (> 0, and large enough that
 *   one real millisecond is a finite, non-zero number of in-game minutes)
 * @property {boolean} [realClock=false] follow the local wall clock instead of `update(realDt)`
 * @property {number} [startDay=0] day number at creation (integer in `[0, MAX_DAY]`; ignored in real-clock mode)
 * @property {number} [startMinute=1120] minute of day at creation, in `[0, 1440)` (ignored in real-clock mode)
 * @property {string|number|null} [seed] world seed; shifts the tide and moon schedules (see {@link scheduleForSeed})
 * @property {() => number} [now=Date.now] wall-clock source in ms since the Unix epoch; inject one in tests
 * @property {number} [daysPerSeason=28] game-calendar season length (positive integer)
 * @property {number} [lowTide=0.2] tide below this is `'low'`
 * @property {number} [highTide=0.8] tide above this is `'high'`; must exceed `lowTide`
 * @property {number} [maxDt=250] clamp on `realDt` per `update()`, in ms; `Infinity` disables the clamp.
 *   With the clamp, a hidden tab does not fast-forward the world when it comes back.
 * @property {number} [maxCatchUpMinutes=10080] an advance longer than this is applied as a silent
 *   resync instead of replaying every minute boundary; `Infinity` disables
 */

/**
 * Payload of `onMinute` listeners.
 * @typedef {Object} MinuteEvent
 * @property {number} day
 * @property {number} hour
 * @property {number} minute whole minute of day just reached, in `[0, 1439]`
 * @property {number} total
 */
/**
 * Payload of `onHour` listeners.
 * @typedef {Object} HourEvent
 * @property {number} day
 * @property {number} hour hour just reached, in `[0, 23]`
 */
/**
 * Payload of `onDayStart` listeners.
 * @typedef {Object} DayEvent
 * @property {number} day day just begun
 * @property {number} dayOfWeek
 * @property {string} dayName
 * @property {Season} season
 * @property {number} year
 */
/**
 * Payload of `onTideChange` listeners.
 * @typedef {Object} TideEvent
 * @property {TideState} state new tide state
 * @property {TideState} previous
 * @property {number} tide tide height at the change
 */

/**
 * Serialized clock state, JSON-safe.
 * @typedef {Object} ClockState
 * @property {number} version {@link CLOCK_STATE_VERSION}
 * @property {number} total in-game minutes since 00:00 of day 0
 * @property {number} speed
 * @property {boolean} paused
 * @property {boolean} realClock
 * @property {string|number|null} seed
 */

/**
 * Removes the listener it was returned for. Safe to call repeatedly.
 * @callback Unsubscribe
 * @returns {void}
 */

/**
 * The world clock. All properties are live getters.
 * @typedef {Object} Clock
 * @property {(realDt?: number) => void} update advance by `realDt` real milliseconds (clamped to `maxDt`,
 *   scaled by `minutesPerDay` and `speed`, never past {@link MAX_TOTAL_MINUTES}); in real-clock mode `realDt`
 *   is ignored and the wall clock is read (a `now()` outside the `Date` range throws a `RangeError`)
 * @property {number} total in-game minutes since 00:00 of day 0
 * @property {number} minute minute of day, `[0, 1440)`, fractional
 * @property {number} hour `[0, 23]`
 * @property {number} minuteOfHour `[0, 59]`
 * @property {number} day day number; 0-based from `startDay` (real-clock mode: an absolute day index)
 * @property {number} dayOfWeek 0 = Monday .. 6 = Sunday
 * @property {string} dayName
 * @property {Season} season
 * @property {number} seasonIndex
 * @property {number} dayOfSeason 1-based
 * @property {number} dayOfYear 1-based
 * @property {number} year game: 1-based; real-clock: the real year
 * @property {Phase} phase
 * @property {boolean} isNight dark outside: `phase` is `'evening'` or `'night'`
 * @property {number} daylight `[0, 1]`, see {@link daylightOfMinute}
 * @property {number} tide `[0, 1]`: 0 low water, 1 high water
 * @property {TideState} tideState
 * @property {boolean} isLowTide `tide < lowTide`
 * @property {boolean} isHighTide `tide > highTide`
 * @property {number} nextLowTide minutes until the next low water (0 exactly at low water)
 * @property {number} nextHighTide minutes until the next high water (0 exactly at high water)
 * @property {ReadonlyArray<Readonly<{minute: number, kind: 'low'|'high', time: string}>>} tidesToday
 *   low and high waters of the current day, ascending (`time` is the `'HH:MM'` form of `minute`)
 * @property {(day: number) => ReadonlyArray<Readonly<{minute: number, kind: 'low'|'high', time: string}>>} tidesForDay
 *   the same for any day number
 * @property {number} moonPhase `[0, 1)`: 0 new moon, 0.5 full moon
 * @property {boolean} isSpringTide within {@link SPRING_TIDE_HALF_WINDOW_DAYS} of a new or full moon
 * @property {number} tideRange spring/neap amplitude factor in `[0.6, 1]` (1 at syzygy), for shoreline rendering
 * @property {number} speed current multiplier
 * @property {boolean} paused
 * @property {boolean} realClock
 * @property {number} minutesPerSecond in-game minutes gained per real second right now (0 while paused)
 * @property {(mult: number) => void} setSpeed multiplier `>= 0`; has no effect while following real time
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {(on: boolean) => void} setRealClock switch modes; switching on jumps silently to the wall clock
 * @property {(minute: number, options?: {silent?: boolean}) => void} skipTo debug: advance to the next
 *   occurrence of a minute of day (tomorrow's if it already passed; no-op if it is now), firing boundary
 *   events unless `silent`; throws in real-clock mode
 * @property {(fn: (e: MinuteEvent) => void) => Unsubscribe} onMinute
 * @property {(fn: (e: HourEvent) => void) => Unsubscribe} onHour
 * @property {(fn: (e: DayEvent) => void) => Unsubscribe} onDayStart
 * @property {(fn: (e: TideEvent) => void) => Unsubscribe} onTideChange
 * @property {() => void} clearListeners drop every listener (new game, teardown)
 * @property {() => ClockState} serialize
 * @property {(state: ClockState) => void} restore silently adopt a serialized state, including its seed;
 *   throws `TypeError`/`RangeError` on a malformed state and leaves the clock unchanged
 * @property {(options?: {hour12?: boolean}) => string} formatTime `'18:40'` or `'6:40 PM'`
 * @property {(options?: {year?: boolean}) => string} dateLabel `'Mon, Spring 1'` (`', Year 1'` with `year`);
 *   real-clock mode gives `'Fri, Oct 23'` (`', 2026'`)
 * @property {() => Readonly<Record<string, unknown>>} snapshot frozen copy of every scalar getter plus
 *   `time` and `date` strings, for HUDs, logs and tests
 */

/**
 * Creates a world clock. See the module notes for the time model and event order.
 * @param {ClockOptions|null} [options]
 * @returns {Clock} a frozen object with live getters
 * @throws {TypeError|RangeError} on invalid options
 */
export function createClock(options = {}) {
  const o = options ?? {};
  if (typeof o !== 'object' || Array.isArray(o)) {
    throw new TypeError(`createClock: options must be an object, got ${describe(o)}`);
  }
  const minutesPerDay = checkNumber('createClock: minutesPerDay', o.minutesPerDay ?? DEFAULT_MINUTES_PER_DAY, { min: 0, exclusiveMin: true });
  const startDay = checkNumber('createClock: startDay', o.startDay ?? 0, { integer: true, min: 0, max: MAX_DAY });
  const startMinute = checkNumber('createClock: startMinute', o.startMinute ?? DEFAULT_START_MINUTE, { min: 0, max: MINUTES_PER_DAY, exclusiveMax: true });
  const daysPerSeason = checkNumber('createClock: daysPerSeason', o.daysPerSeason ?? DEFAULT_DAYS_PER_SEASON, { integer: true, min: 1 });
  const lowTide = checkNumber('createClock: lowTide', o.lowTide ?? DEFAULT_LOW_TIDE, { min: 0, max: 1, exclusiveMin: true, exclusiveMax: true });
  const highTide = checkNumber('createClock: highTide', o.highTide ?? DEFAULT_HIGH_TIDE, { min: lowTide, max: 1, exclusiveMin: true, exclusiveMax: true });
  const maxDt = checkNumber('createClock: maxDt', o.maxDt ?? DEFAULT_MAX_DT_MS, { min: 0, exclusiveMin: true, allowInfinity: true });
  const maxCatchUpMinutes = checkNumber('createClock: maxCatchUpMinutes', o.maxCatchUpMinutes ?? DEFAULT_MAX_CATCH_UP_MINUTES, { min: 0, exclusiveMin: true, allowInfinity: true });
  const now = checkFunction('createClock: now', o.now ?? Date.now);
  seedKey('createClock: seed', o.seed);
  const thresholds = Object.freeze({ lowTide, highTide });
  /** In-game minutes per real millisecond at speed 1. */
  const minutesPerMs = MINUTES_PER_DAY / (minutesPerDay * MINUTES_PER_HOUR * 1000);
  if (!Number.isFinite(minutesPerMs) || minutesPerMs <= 0) {
    throw new RangeError(`createClock: minutesPerDay ${minutesPerDay} is outside the measurable range`);
  }

  let realClock = checkBoolean('createClock: realClock', o.realClock ?? false);
  let seed = o.seed ?? null;
  let { tideOffset, moonOffset } = scheduleForSeed(seed);
  let total = realClock ? realTimeToTotal(now()) : startDay * MINUTES_PER_DAY + startMinute;
  let speed = 1;
  let paused = false;
  let advancing = false;
  let lastTideState = tideStateAt(total, tideOffset, thresholds);

  /**
   * One registration per entry. `active` is cleared on removal so that a dispatch
   * already in flight (which iterates a snapshot) skips listeners removed mid-way.
   * @typedef {{fn: Function, active: boolean}} ListenerEntry
   */
  /** @type {{minute: ListenerEntry[], hour: ListenerEntry[], day: ListenerEntry[], tide: ListenerEntry[]}} */
  const listeners = { minute: [], hour: [], day: [], tide: [] };

  // -- derived values ------------------------------------------------------

  /** @returns {number} */
  const currentDay = () => splitTotal(total).day;
  /** @returns {number} */
  const currentMinute = () => splitTotal(total).minute;
  /** @returns {CalendarInfo} */
  const calendar = () => (realClock ? realCalendar(currentDay()) : gameCalendar(currentDay(), daysPerSeason));

  /**
   * Tide facts at the current time, computed once per call.
   * @returns {{phase: number, tide: number, state: TideState}}
   */
  function tideInfo() {
    const phase = tidePhaseAt(total, tideOffset);
    const tide = 0.5 - 0.5 * Math.cos(TWO_PI * phase);
    let state;
    if (tide < lowTide) state = 'low';
    else if (tide > highTide) state = 'high';
    else state = phase < 0.5 ? 'rising' : 'falling';
    return { phase, tide, state };
  }

  /** @returns {number} moon phase in `[0, 1)` */
  const moonPhase = () => mod(total / MINUTES_PER_DAY + moonOffset, LUNAR_MONTH_DAYS) / LUNAR_MONTH_DAYS;

  /**
   * Low and high waters within a day, ascending. Extremes sit every half period
   * from `tideOffset`: at tide phase 0 (low water) and half a period later (high
   * water). Uses `%`, which is exact, so the list is right even for far-off days.
   * @param {number} day integer in `[-MAX_DAY, MAX_DAY]`
   * @returns {ReadonlyArray<Readonly<{minute: number, kind: 'low'|'high', time: string}>>}
   */
  function tidesForDay(day) {
    checkNumber('clock.tidesForDay: day', day, { integer: true, min: -MAX_DAY, max: MAX_DAY });
    const half = TIDE_PERIOD_MINUTES / 2;
    const start = day * MINUTES_PER_DAY;
    // Whole minutes from the last low water to 00:00 (integers in, so `%` is exact even near 2^53);
    // the first extreme on or after 00:00 is then that low itself, the high half a period in, or the next low.
    const sinceLow = mod(start - tideOffset, TIDE_PERIOD_MINUTES);
    let first;
    let low;
    if (sinceLow === 0) {
      first = 0;
      low = true;
    } else if (sinceLow < half) {
      first = half - sinceLow;
      low = false;
    } else {
      first = TIDE_PERIOD_MINUTES - sinceLow;
      low = true;
    }
    const out = [];
    for (let minute = first; minute < MINUTES_PER_DAY; minute += half) {
      out.push(Object.freeze({ minute, kind: low ? 'low' : 'high', time: formatMinute(minute) }));
      low = !low;
    }
    return Object.freeze(out);
  }

  // -- events --------------------------------------------------------------

  /**
   * Registers a listener and returns its unsubscribe function.
   * @param {ListenerEntry[]} list
   * @param {string} label
   * @param {unknown} fn
   * @returns {Unsubscribe}
   */
  function subscribe(list, label, fn) {
    const entry = { fn: checkFunction(label, fn), active: true };
    list.push(entry);
    return () => {
      entry.active = false;
      const i = list.indexOf(entry);
      if (i !== -1) list.splice(i, 1);
    };
  }

  /**
   * Calls every listener in `list` with a frozen payload. Iterates a snapshot so
   * listeners may subscribe or unsubscribe mid-dispatch: a listener added now
   * first fires at the next boundary, and one removed now (itself or a sibling)
   * is skipped if it has not run yet, as on the events.js bus.
   * @param {ListenerEntry[]} list
   * @param {() => object} makePayload built only when someone listens
   */
  function emit(list, makePayload) {
    if (list.length === 0) return;
    const payload = Object.freeze(makePayload());
    for (const entry of list.slice()) {
      if (entry.active) entry.fn(payload);
    }
  }

  /**
   * Compares the tide state with the last one reported and fires `onTideChange`
   * on a difference (or just records it when `silent`).
   * @param {boolean} silent
   */
  function checkTide(silent) {
    const { tide, state } = tideInfo();
    if (state === lastTideState) return;
    const previous = lastTideState;
    lastTideState = state;
    if (!silent) emit(listeners.tide, () => ({ state, previous, tide }));
  }

  /**
   * Guards against a listener re-entering the clock while it is stepping.
   * @param {string} what method name for the error message
   */
  function assertIdle(what) {
    if (advancing) throw new Error(`clock.${what}: the clock cannot be changed from inside one of its own listeners`);
  }

  /**
   * Moves the clock forward to `target`, stepping through every whole minute in
   * `(total, target]` and firing boundary events, or jumping silently when
   * `silent` or when the gap exceeds `maxCatchUpMinutes`.
   * @param {number} target total minutes, `> total`
   * @param {boolean} silent
   */
  function advanceTo(target, silent) {
    advancing = true;
    try {
      if (silent || target - total > maxCatchUpMinutes) {
        total = target;
        checkTide(silent);
        return;
      }
      const first = Math.floor(total) + 1;
      const last = Math.floor(target);
      for (let m = first; m <= last; m++) {
        total = m;
        const minuteOfDay = m % MINUTES_PER_DAY;
        if (minuteOfDay === 0) {
          emit(listeners.day, () => {
            const cal = calendar();
            return { day: currentDay(), dayOfWeek: cal.dayOfWeek, dayName: cal.dayName, season: cal.season, year: cal.year };
          });
        }
        if (minuteOfDay % MINUTES_PER_HOUR === 0) {
          emit(listeners.hour, () => ({ day: currentDay(), hour: minuteOfDay / MINUTES_PER_HOUR }));
        }
        emit(listeners.minute, () => ({
          day: currentDay(),
          hour: Math.floor(minuteOfDay / MINUTES_PER_HOUR),
          minute: minuteOfDay,
          total: m,
        }));
        checkTide(false);
      }
      total = target;
      checkTide(false);
    } finally {
      advancing = false;
    }
  }

  /**
   * Adopts a new total without firing anything and forgets the old tide state.
   * @param {number} target
   */
  function jumpSilently(target) {
    total = target;
    lastTideState = tideStateAt(total, tideOffset, thresholds);
  }

  // -- public methods ------------------------------------------------------

  /** @param {number} [realDt] */
  function update(realDt) {
    assertIdle('update');
    if (realClock) {
      if (paused) return;
      const target = realTimeToTotal(now());
      if (target > total) advanceTo(target, false);
      else if (target < total) jumpSilently(target); // the wall clock went backwards (DST, NTP, manual change)
      return;
    }
    checkNumber('clock.update: realDt (ms)', realDt, { min: 0 });
    if (paused) return;
    const delta = Math.min(realDt, maxDt) * minutesPerMs * speed;
    const target = Math.min(total + delta, MAX_TOTAL_MINUTES);
    if (target > total) advanceTo(target, false);
  }

  /** @param {number} mult */
  function setSpeed(mult) {
    speed = checkNumber('clock.setSpeed: mult', mult, { min: 0 });
  }

  /** @param {boolean} on */
  function setRealClock(on) {
    assertIdle('setRealClock');
    checkBoolean('clock.setRealClock: on', on);
    if (on === realClock) return;
    if (on) jumpSilently(realTimeToTotal(now())); // may throw: then the mode is left unchanged
    realClock = on;
  }

  /**
   * @param {number} minute
   * @param {{silent?: boolean}} [options]
   */
  function skipTo(minute, { silent = false } = {}) {
    assertIdle('skipTo');
    if (realClock) throw new Error('clock.skipTo: unavailable while the clock follows real time');
    checkNumber('clock.skipTo: minute', minute, { min: 0, max: MINUTES_PER_DAY, exclusiveMax: true });
    checkBoolean('clock.skipTo: silent', silent);
    let target = currentDay() * MINUTES_PER_DAY + minute;
    if (target < total) target += MINUTES_PER_DAY;
    target = Math.min(target, MAX_TOTAL_MINUTES);
    if (target > total) advanceTo(target, silent);
  }

  /** @returns {ClockState} */
  function serialize() {
    return { version: CLOCK_STATE_VERSION, total, speed, paused, realClock, seed };
  }

  /** @param {ClockState} state */
  function restore(state) {
    assertIdle('restore');
    if (state === null || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError(`clock.restore: state must be an object, got ${describe(state)}`);
    }
    if (state.version !== CLOCK_STATE_VERSION) {
      throw new RangeError(`clock.restore: unsupported state version ${describe(state.version)} (expected ${CLOCK_STATE_VERSION})`);
    }
    const nextRealClock = checkBoolean('clock.restore: state.realClock', state.realClock);
    // A real-clock total must map to a day `Date` can represent (which allows pre-1970 negatives);
    // a game total is any safe non-negative minute count.
    const totalRange = nextRealClock
      ? { min: MIN_REAL_DAY * MINUTES_PER_DAY, max: (MAX_REAL_DAY + 1) * MINUTES_PER_DAY, exclusiveMax: true }
      : { min: 0, max: MAX_TOTAL_MINUTES };
    const nextTotal = checkNumber('clock.restore: state.total', state.total, totalRange);
    const nextSpeed = checkNumber('clock.restore: state.speed', state.speed, { min: 0 });
    const nextPaused = checkBoolean('clock.restore: state.paused', state.paused);
    seedKey('clock.restore: state.seed', state.seed);
    seed = state.seed ?? null;
    ({ tideOffset, moonOffset } = scheduleForSeed(seed));
    speed = nextSpeed;
    paused = nextPaused;
    realClock = nextRealClock;
    jumpSilently(nextTotal === 0 ? 0 : nextTotal); // normalise a JSON-safe -0
  }

  /** @returns {Readonly<Record<string, unknown>>} */
  function snapshot() {
    const cal = calendar();
    const { tide, state } = tideInfo();
    return Object.freeze({
      total,
      day: currentDay(),
      minute: currentMinute(),
      hour: clock.hour,
      minuteOfHour: clock.minuteOfHour,
      dayOfWeek: cal.dayOfWeek,
      dayName: cal.dayName,
      season: cal.season,
      seasonIndex: cal.seasonIndex,
      dayOfSeason: cal.dayOfSeason,
      dayOfYear: cal.dayOfYear,
      year: cal.year,
      phase: clock.phase,
      daylight: clock.daylight,
      isNight: clock.isNight,
      tide,
      tideState: state,
      isLowTide: tide < lowTide,
      isHighTide: tide > highTide,
      nextLowTide: clock.nextLowTide,
      nextHighTide: clock.nextHighTide,
      moonPhase: moonPhase(),
      isSpringTide: clock.isSpringTide,
      tideRange: clock.tideRange,
      speed,
      paused,
      realClock,
      time: formatMinute(currentMinute()),
      date: clock.dateLabel(),
    });
  }

  /** @type {Clock} */
  const clock = Object.freeze({
    update,
    get total() {
      return total;
    },
    get minute() {
      return currentMinute();
    },
    get hour() {
      return Math.floor(currentMinute() / MINUTES_PER_HOUR);
    },
    get minuteOfHour() {
      return Math.floor(currentMinute()) % MINUTES_PER_HOUR;
    },
    get day() {
      return currentDay();
    },
    get dayOfWeek() {
      return calendar().dayOfWeek;
    },
    get dayName() {
      return calendar().dayName;
    },
    get season() {
      return calendar().season;
    },
    get seasonIndex() {
      return calendar().seasonIndex;
    },
    get dayOfSeason() {
      return calendar().dayOfSeason;
    },
    get dayOfYear() {
      return calendar().dayOfYear;
    },
    get year() {
      return calendar().year;
    },
    get phase() {
      return phaseOfMinute(currentMinute());
    },
    get isNight() {
      const phase = phaseOfMinute(currentMinute());
      return phase === 'night' || phase === 'evening';
    },
    get daylight() {
      return daylightOfMinute(currentMinute());
    },
    get tide() {
      return tideInfo().tide;
    },
    get tideState() {
      return tideInfo().state;
    },
    get isLowTide() {
      return tideInfo().tide < lowTide;
    },
    get isHighTide() {
      return tideInfo().tide > highTide;
    },
    get nextLowTide() {
      const { phase } = tideInfo();
      return phase === 0 ? 0 : (1 - phase) * TIDE_PERIOD_MINUTES;
    },
    get nextHighTide() {
      const { phase } = tideInfo();
      return (phase <= 0.5 ? 0.5 - phase : 1.5 - phase) * TIDE_PERIOD_MINUTES;
    },
    get tidesToday() {
      return tidesForDay(currentDay());
    },
    tidesForDay,
    get moonPhase() {
      return moonPhase();
    },
    get isSpringTide() {
      const age = moonPhase() * LUNAR_MONTH_DAYS;
      const half = LUNAR_MONTH_DAYS / 2;
      const distance = Math.min(age, Math.abs(age - half), LUNAR_MONTH_DAYS - age);
      return distance <= SPRING_TIDE_HALF_WINDOW_DAYS;
    },
    get tideRange() {
      return 0.6 + 0.4 * Math.abs(Math.cos(TWO_PI * moonPhase()));
    },
    get speed() {
      return speed;
    },
    get paused() {
      return paused;
    },
    get realClock() {
      return realClock;
    },
    get minutesPerSecond() {
      if (paused) return 0;
      return realClock ? 1 / 60 : minutesPerMs * 1000 * speed;
    },
    setSpeed,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    setRealClock,
    skipTo,
    onMinute: (fn) => subscribe(listeners.minute, 'clock.onMinute: fn', fn),
    onHour: (fn) => subscribe(listeners.hour, 'clock.onHour: fn', fn),
    onDayStart: (fn) => subscribe(listeners.day, 'clock.onDayStart: fn', fn),
    onTideChange: (fn) => subscribe(listeners.tide, 'clock.onTideChange: fn', fn),
    clearListeners() {
      for (const list of Object.values(listeners)) {
        for (const entry of list) entry.active = false;
        list.length = 0;
      }
    },
    serialize,
    restore,
    formatTime: (options) => formatMinute(currentMinute(), options),
    dateLabel({ year = false } = {}) {
      const cal = calendar();
      const label = `${cal.dayName}, ${cal.dateText}`;
      return year ? `${label}, ${cal.yearText}` : label;
    },
    snapshot,
  });

  return clock;
}
