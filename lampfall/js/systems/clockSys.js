/**
 * The world clock as a system. [SYS-TIME] — ARCHITECTURE-DRAFT §1, §2.4, §3.4, §10; GDD-00 §4, §5.
 *
 * The only writer of `world.clock` (tools/lint-owners OWNERS). `world.clock` holds exactly
 * `clock.serialize()` (core/time `ClockState`), so a save carries the clock and a load restores it.
 * The clock advances only where a scene calls {@link tick} (overworld, fishing): battle, Forecast,
 * capture, menus, dialogue, shops, ceremonies and the Day Page freeze time by never calling it.
 *
 * What this module adds on top of core/time (GDD-00 §5):
 *  - **Day length.** 24 real minutes per day by default (1 real minute = 1 game hour), with the
 *    12 / 24 / 48 options and Real Clock (`settings.minutesPerDay` / `settings.realClock`), applied to
 *    the live clock by {@link applySettingsEffects} through `clock.setMinutesPerDay`.
 *  - **Game days.** core/time counts days from 0; the GDD counts from 1. Day *n* of the GDD is core
 *    day *n − 1*, so {@link gameDay} is `floor(total / 1440) + 1`. Day 1 is a Sunday
 *    (`CLOCK_DAY1_WEEKDAY`); Saturdays are days 7, 14, 21.
 *  - **Night** is 18:00–06:00 ({@link isNight}); the **eight three-hour day-parts** the music follows
 *    are {@link DAY_PARTS} ({@link dayPart}).
 *  - **The seeded tide.** Day 1's low is at 16:40 (`TIDE_DAY1_LOW`), so the mainland causeway (±1 h)
 *    closes at 17:40 behind the player; then 05:05 and 17:30 on day 2, 05:55 and 18:20 on day 3 (two
 *    lows 12 h 25 m apart, ~50 min later each day: core/time's `TIDE_PERIOD_MINUTES`). core/time
 *    derives its tide offset from the clock's seed, so this module gives the clock a fixed tide seed
 *    ({@link tideSeedFor}) whose offset lands the day-1 low on 16:40 for every run seed. The live clock,
 *    `state/selectors` (which read `world.clock.seed`) and the helpers here therefore all agree.
 *  - **Spring tides** every 7 days, on days 7, 14, 21 … ({@link isSpringTide}; the GDD rule, not
 *    core/time's lunar model).
 *  - **Tide windows** for every tide-gated way ({@link tideWindow}): causeway ±2.5 h, stepping stones
 *    ±2 h, flats ±1.5 h, the Bar ±1.5 h of the day's *lower* low (any tide once it is lit), the Lantern
 *    Stack spur ±1.5 h of every low, the mainland causeway ±1 h; each reports open/closed and the
 *    minutes until it changes. {@link gateTide} turns a window into the tide state `world/warps` and
 *    `world/tide` already understand.
 *  - **Rest** ({@link rest}, {@link restOptions}, {@link sit}, {@link stand}): Lie down any time (heal,
 *    10 game minutes); Nap till dusk from 12:00 (wakes 18:00); Sleep till dawn from 21:00, rolling
 *    through the 05:40 builds anchor to the 06:00 morning; the porch Sit runs the clock ×6. Real Clock
 *    never skips.
 *  - **Day hooks for dayFlow**: `day:end` / `day:start` at midnight and `clock:anchor` at the 05:40
 *    builds and 06:00 morning anchors, emitted in time order by {@link tick} and {@link rest}.
 *
 * Every designer number is read from the tuning table by a documented key with a {@link DEFAULTS}
 * fallback equal to the GDD-00 value ({@link tuningOf}). Pure: no DOM, no randomness; the clock, the
 * data and the bus are passed in.
 * @module systems/clockSys
 */
import {
  DEFAULT_MINUTES_PER_DAY, DEFAULT_HIGH_TIDE, MINUTES_PER_DAY, MINUTES_PER_HOUR, TIDE_PERIOD_MINUTES, DAYS_PER_WEEK, DAY_NAMES,
  scheduleForSeed, tideAt, tideStateAt, formatMinute,
} from '../core/time.js';
import { tideSeedFor as stateTideSeedFor, TIDE_SEED_PREFIX as STATE_TIDE_SEED_PREFIX, DAY1_LOW_MINUTE } from '../state/schema.js';

/** @typedef {import('../core/time.js').Clock} Clock */
/** @typedef {import('../core/time.js').ClockOptions} ClockOptions */
/** @typedef {import('../core/time.js').ClockState} ClockState */
/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {import('../state/schema.js').World} World */
/** @typedef {{emit: (evt: string, payload: any) => any}} Bus */
/**
 * Context most functions take: the domain-event bus and the content data (a Registry, the `DATA`
 * object, `{tuning}`, or a flat tuning table — see {@link tuningOf}).
 * @typedef {{bus?: Bus|null, data?: any}} Ctx
 */

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * One music day-part (GDD-00 §5 table).
 * @typedef {Object} DayPart
 * @property {string} id        kebab-case id
 * @property {number} start     minute of day it begins
 * @property {string} track     the day-part theme id (`proto/music/tracks.js`)
 * @property {string} name      display name
 * @property {string} tideWord  word used for a tide in this part ("by the *afternoon* tide")
 */

/**
 * @typedef {Object} ClockTuning
 * @property {number} CLOCK_DEFAULT_MINUTES_PER_DAY  real minutes per game day by default (24)
 * @property {number[]} CLOCK_DAY_LENGTHS          day-length options offered in Settings besides Real Clock
 * @property {number} CLOCK_NIGHT_START            minute of day night rules begin (18:00)
 * @property {number} CLOCK_NIGHT_END              minute of day night rules end (06:00)
 * @property {DayPart[]} CLOCK_DAY_PARTS           the day-parts, ascending `start`, first at 0
 * @property {{id: string, minute: number}[]} CLOCK_ANCHORS   daily hooks emitted as `clock:anchor`
 * @property {number} CLOCK_DAY1_WEEKDAY           weekday of day 1, 0 = Monday … 6 = Sunday
 * @property {number} TIDE_DAY1_LOW                minute of day of day 1's evening low (16:40); always a lower low
 * @property {number} TIDE_SPRING_EVERY_DAYS       spring tide period in days
 * @property {number} TIDE_SPRING_FIRST_DAY        first spring-tide day
 * @property {Record<string, number>} TIDE_WINDOWS half-widths in game minutes around a low, per way kind
 * @property {string} TIDE_BAR_LIT_FLAG            flag that opens the Bar at any tide (GDD-00 §2 `lit.bar`)
 * @property {number} REST_LIE_MINUTES             Lie down: game minutes it takes
 * @property {number} REST_LIE_HEAL                Lie down: heal fraction of max HP (1 = full)
 * @property {number} REST_NAP_FROM                Nap till dusk: earliest minute of day
 * @property {number} REST_NAP_WAKE                Nap till dusk: wake minute (dusk)
 * @property {number} REST_NAP_HEAL                Nap: heal fraction
 * @property {number} REST_SLEEP_FROM              Sleep till dawn: earliest minute of day
 * @property {number} REST_SLEEP_WAKE              Sleep till dawn: wake minute (dawn)
 * @property {number} REST_SLEEP_HEAL              Sleep: heal fraction
 * @property {number} REST_SIT_SPEED               porch Sit: clock speed multiplier
 */

/**
 * Designer-tunable defaults, every one the GDD-00 §4/§5 value. [GDD values]
 * @type {Readonly<ClockTuning>}
 */
export const DEFAULTS = deepFreeze({
  CLOCK_DEFAULT_MINUTES_PER_DAY: DEFAULT_MINUTES_PER_DAY,
  CLOCK_DAY_LENGTHS: [12, 24, 48],
  CLOCK_NIGHT_START: 18 * 60,
  CLOCK_NIGHT_END: 6 * 60,
  CLOCK_DAY_PARTS: [
    { id: 'deep-night', start: 0, track: 'h_night_deep', name: 'Deep night', tideWord: 'night' },
    { id: 'pre-dawn', start: 3 * 60, track: 'h_predawn', name: 'Pre-dawn', tideWord: 'dawn' },
    { id: 'morning', start: 6 * 60, track: 'h_morning', name: 'Morning', tideWord: 'morning' },
    { id: 'late-morning', start: 9 * 60, track: 'h_late_morning', name: 'Late morning', tideWord: 'morning' },
    { id: 'midday', start: 12 * 60, track: 'h_midday', name: 'Midday', tideWord: 'midday' },
    { id: 'afternoon', start: 15 * 60, track: 'h_afternoon', name: 'Afternoon', tideWord: 'afternoon' },
    { id: 'dusk', start: 18 * 60, track: 'h_dusk', name: 'Dusk', tideWord: 'evening' },
    { id: 'night', start: 21 * 60, track: 'h_night', name: 'Night', tideWord: 'night' },
  ],
  CLOCK_ANCHORS: [
    { id: 'builds', minute: 5 * 60 + 40 },
    { id: 'morning', minute: 6 * 60 },
  ],
  CLOCK_DAY1_WEEKDAY: 6,
  TIDE_DAY1_LOW: DAY1_LOW_MINUTE,
  TIDE_SPRING_EVERY_DAYS: 7,
  TIDE_SPRING_FIRST_DAY: 7,
  TIDE_WINDOWS: { causeway: 150, stones: 120, flats: 90, bar: 90, spur: 90, mainland: 60 },
  TIDE_BAR_LIT_FLAG: 'lit.bar',
  REST_LIE_MINUTES: 10,
  REST_LIE_HEAL: 1,
  REST_NAP_FROM: 12 * 60,
  REST_NAP_WAKE: 18 * 60,
  REST_NAP_HEAL: 1,
  REST_SLEEP_FROM: 21 * 60,
  REST_SLEEP_WAKE: 6 * 60,
  REST_SLEEP_HEAL: 1,
  REST_SIT_SPEED: 6,
});

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));
/** The default day-parts (GDD-00 §5). Use {@link dayParts} for the tuned table. */
export const DAY_PARTS = DEFAULTS.CLOCK_DAY_PARTS;
/** Tide-gated way kinds with a window in the default tuning. */
export const TIDE_WINDOW_KINDS = Object.freeze(Object.keys(DEFAULTS.TIDE_WINDOWS));
/** Bed rest kinds ({@link rest}). */
export const REST_KINDS = Object.freeze(['lie', 'nap', 'sleep']);
/** Prefix of the clock seeds {@link tideSeedFor} searches. */
export const TIDE_SEED_PREFIX = STATE_TIDE_SEED_PREFIX;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isMinute = (v) => isInt(v) && v >= 0 && v < MINUTES_PER_DAY;
const isFrac = (v) => isNum(v) && v >= 0 && v <= 1;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** @type {Record<keyof ClockTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  CLOCK_DEFAULT_MINUTES_PER_DAY: [(v) => isNum(v) && v > 0, 'number > 0'],
  CLOCK_DAY_LENGTHS: [(v) => Array.isArray(v) && v.length > 0 && v.every((n) => isNum(n) && n > 0) && new Set(v).size === v.length, 'non-empty array of distinct numbers > 0'],
  CLOCK_NIGHT_START: [isMinute, 'integer minute 0..1439'],
  CLOCK_NIGHT_END: [isMinute, 'integer minute 0..1439'],
  CLOCK_DAY_PARTS: [validDayParts, 'non-empty [{id, start, track, name, tideWord}] with unique kebab ids, integer starts ascending from 0'],
  CLOCK_ANCHORS: [(v) => Array.isArray(v) && v.every((a) => isObj(a) && typeof a.id === 'string' && ID_RE.test(a.id) && isMinute(a.minute)) && new Set(v.map((a) => a.id)).size === v.length, '[{id: kebab id (unique), minute: 0..1439}]'],
  CLOCK_DAY1_WEEKDAY: [(v) => isInt(v) && v >= 0 && v < DAYS_PER_WEEK, 'integer 0..6 (0 = Monday)'],
  TIDE_DAY1_LOW: [isMinute, 'integer minute 0..1439'],
  TIDE_SPRING_EVERY_DAYS: [(v) => isInt(v) && v >= 1, 'integer >= 1'],
  TIDE_SPRING_FIRST_DAY: [(v) => isInt(v) && v >= 1, 'integer >= 1'],
  TIDE_WINDOWS: [(v) => isObj(v) && Object.keys(v).length > 0 && Object.entries(v).every(([k, h]) => ID_RE.test(k) && isNum(h) && h > 0 && h < TIDE_PERIOD_MINUTES / 2), `{kind: half-width minutes, 0 < h < ${TIDE_PERIOD_MINUTES / 2}}`],
  TIDE_BAR_LIT_FLAG: [(v) => typeof v === 'string' && v.length > 0, 'non-empty flag id'],
  REST_LIE_MINUTES: [(v) => isNum(v) && v >= 0 && v < MINUTES_PER_DAY, 'minutes 0..1439'],
  REST_LIE_HEAL: [isFrac, 'fraction 0..1'],
  REST_NAP_FROM: [isMinute, 'integer minute 0..1439'],
  REST_NAP_WAKE: [isMinute, 'integer minute 0..1439'],
  REST_NAP_HEAL: [isFrac, 'fraction 0..1'],
  REST_SLEEP_FROM: [isMinute, 'integer minute 0..1439'],
  REST_SLEEP_WAKE: [isMinute, 'integer minute 0..1439'],
  REST_SLEEP_HEAL: [isFrac, 'fraction 0..1'],
  REST_SIT_SPEED: [(v) => isNum(v) && v >= 1, 'number >= 1'],
};

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function validDayParts(v) {
  if (!Array.isArray(v) || v.length === 0) return false;
  const ids = new Set();
  let prev = -1;
  for (const p of v) {
    if (!isObj(p) || typeof p.id !== 'string' || !ID_RE.test(p.id) || ids.has(p.id)) return false;
    if (!isMinute(p.start) || p.start <= prev) return false;
    if (typeof p.track !== 'string' || typeof p.name !== 'string' || typeof p.tideWord !== 'string') return false;
    ids.add(p.id);
    prev = p.start;
  }
  return v[0].start === 0;
}

/** @type {WeakMap<object, Readonly<ClockTuning>>} */
const TUNING_CACHE = new WeakMap();
/** Tunings this module already resolved (passed back in, they are used as they are). @type {WeakSet<object>} */
const RESOLVED = new WeakSet([DEFAULTS]);

/**
 * Finds the tuning table in whatever `data` the caller has: `null`/`undefined` (defaults), an object
 * with a `tuning` table (`DATA`, `{tuning}`), a Registry that lists a `tuning` table, or a flat tuning
 * table itself.
 * @param {any} data
 * @returns {object|null}
 */
function tuningSource(data) {
  if (data == null) return null;
  if (typeof data !== 'object' && typeof data !== 'function') throw new TypeError(`clockSys: data must be an object, got ${typeof data}`);
  if (isObj(data.tuning)) return data.tuning;
  if (Array.isArray(data.tables) && data.tables.includes('tuning') && typeof data.raw === 'function') {
    const t = data.raw('tuning');
    return isObj(t) ? t : null;
  }
  return data;
}

/**
 * The resolved tuning: every {@link TUNING_KEYS} key from the data's tuning table, validated, over
 * {@link DEFAULTS}. Keys of other modules are ignored. Cached per tuning table.
 * @param {any} [data]  Registry | DATA | {tuning} | flat tuning table | a tuning this returned | null
 * @returns {Readonly<ClockTuning>}
 * @throws {TypeError} when a known key has a malformed value
 */
export function tuningOf(data) {
  if (data != null && RESOLVED.has(data)) return data;
  const src = tuningSource(data);
  if (src === null) return DEFAULTS;
  const hit = TUNING_CACHE.get(src);
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const v = /** @type {any} */ (src)[key];
    const [pred, desc] = SPEC[/** @type {keyof ClockTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`clockSys tuning ${key}: expected ${desc}, got ${JSON.stringify(v)}`);
    out[key] = v;
  }
  const frozen = deepFreeze(structuredClone(out));
  TUNING_CACHE.set(src, frozen);
  RESOLVED.add(frozen);
  return frozen;
}

// ---------------------------------------------------------------------------------------------
// The tide seed
// ---------------------------------------------------------------------------------------------

/**
 * Floored modulo, result in `[0, n)`.
 * @param {number} a
 * @param {number} n
 * @returns {number}
 */
function mod(a, n) {
  const r = a % n;
  return r < 0 ? r + n : r;
}

/**
 * core/time tide offset (minute of the first low after 00:00 of core day 0) that puts a low at
 * `day1Low` on game day 1.
 * @param {number} day1Low minute of day, integer
 * @returns {number} integer in `[0, 745)`
 */
export function tideOffsetFor(day1Low) {
  if (!isMinute(day1Low)) throw new TypeError(`clockSys.tideOffsetFor: day1Low must be an integer minute 0..1439, got ${day1Low}`);
  return mod(day1Low, TIDE_PERIOD_MINUTES);
}

/**
 * The clock seed whose core/time tide schedule (`scheduleForSeed(seed).tideOffset`) puts a low at
 * `day1Low` on game day 1: the first `'lampfall:tide:<i>'` that hashes to the right offset. Pure and
 * memoized; the run seed never touches the tide (it feeds every other random stream). The search
 * lives in `state/schema` (so `createNewWorld` can stamp the seed without importing a system).
 * @param {number} [day1Low=DEFAULTS.TIDE_DAY1_LOW] minute of day of day 1's low
 * @returns {string}
 * @throws {TypeError} on a bad minute; Error if no seed is found (cannot happen for the core hash)
 */
export function tideSeedFor(day1Low = DEFAULTS.TIDE_DAY1_LOW) {
  tideOffsetFor(day1Low);
  return stateTideSeedFor(day1Low);
}

// ---------------------------------------------------------------------------------------------
// Binding the live clock to world.clock
// ---------------------------------------------------------------------------------------------

/**
 * What one {@link tick} (or {@link rest}) crossed. Every field is `null` / `0` when nothing happened,
 * so a caller can test `events.minutes` or `events.hour !== null` cheaply.
 * @typedef {Object} ClockEvents
 * @property {number} minutes        in-game minutes elapsed (fractional)
 * @property {number|null} minute    whole minute of day just reached, or null
 * @property {number|null} hour      hour just reached, or null
 * @property {string|null} phase     core/time phase just entered (PHASES), or null
 * @property {string|null} dayPart   GDD day-part id just entered ({@link DAY_PARTS}), or null
 * @property {string|null} tide      tide state just entered (TIDE_STATES), or null
 * @property {number|null} day       core day just begun (game day − 1), or null
 * @property {string[]|null} anchors anchor ids crossed in time order (`'builds'`, `'morning'`), or null
 */

/**
 * Clock options derived from a world: the tide seed, the day length and the real-clock setting.
 * The seed is {@link tideSeedFor} (the run seed does not shape the tide; see the module notes).
 * @param {World} world
 * @param {any} [data] tuning source ({@link tuningOf})
 * @returns {ClockOptions}
 */
export function optionsFrom(world, data) {
  const t = tuningOf(data);
  const mpd = Number(world?.settings?.minutesPerDay);
  return {
    seed: tideSeedFor(t.TIDE_DAY1_LOW),
    minutesPerDay: Number.isFinite(mpd) && mpd > 0 ? mpd : t.CLOCK_DEFAULT_MINUTES_PER_DAY,
    realClock: world?.settings?.realClock === true,
  };
}

/**
 * Writes the live clock into `world.clock` (call inside a tx or from a store snapshot hook).
 * @param {World} world
 * @param {Clock} clock
 * @returns {ClockState} the state written
 */
export function serializeInto(world, clock) {
  const state = clock.serialize();
  world.clock = state;
  return state;
}

/**
 * Adopts `world.clock` into the live clock (after boot or a load), with the tide seed in place of
 * whatever seed the state carries (saves written before `createNewWorld` stored the tide seed carry
 * the run seed), so every run gets the GDD tide. Speed is reset to 1 and the clock unpaused: a porch
 * Sit (×6) never survives a load. `world.clock` is not written on success (boot and
 * `world:replaced` run outside a tx); the next {@link tick} or snapshot mirrors the normalized seed.
 * A missing or malformed state leaves the clock where it is and rewrites `world.clock` from it, so the
 * two never disagree.
 * @param {World} world
 * @param {Clock} clock
 * @param {any} [data] tuning source
 * @returns {{ok: boolean, error?: string}}
 */
export function restoreFrom(world, clock, data) {
  try {
    const state = world.clock;
    if (!isObj(state)) throw new TypeError(`world.clock must be an object, got ${state === null ? 'null' : typeof state}`);
    // A load never resumes a porch Sit or a pause: the scene stack is not saved, so a ×6 speed or a
    // paused flag captured by an autosave mid-Sit (`day:start` fires while you sit through midnight)
    // would leave the clock racing or stopped with no bench to stand up from.
    clock.restore({ ...state, seed: tideSeedFor(tuningOf(data).TIDE_DAY1_LOW), speed: 1, paused: false });
    return { ok: true };
  } catch (e) {
    world.clock = clock.serialize();
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/** @returns {ClockEvents} */
function noEvents() {
  return { minutes: 0, minute: null, hour: null, phase: null, dayPart: null, tide: null, day: null, anchors: null };
}

/**
 * Snapshot of the clock facts {@link report} compares before and after an advance.
 * @param {Clock} clock
 * @param {Readonly<ClockTuning>} t
 */
function facts(clock, t) {
  return {
    total: clock.total,
    minute: Math.floor(clock.minute),
    hour: clock.hour,
    phase: clock.phase,
    dayPart: dayPartAt(clock.minute, t).id,
    tide: clock.tideState,
    day: clock.day,
  };
}

/** Longest span (in-game minutes) whose every midnight and anchor is reported; longer jumps collapse. */
const MAX_REPORT_MINUTES = 7 * MINUTES_PER_DAY;

/**
 * The midnights and anchors in `(t0, t1]`, in time order (a midnight before an anchor at the same
 * instant). A span longer than {@link MAX_REPORT_MINUTES} (a real-clock resync after days away)
 * reports only its last day.
 * @param {number} t0
 * @param {number} t1
 * @param {Readonly<ClockTuning>} t
 * @returns {Array<{at: number, kind: 'day', day: number} | {at: number, kind: 'anchor', id: string, minute: number, day: number}>}
 */
function crossings(t0, t1, t) {
  const from = t1 - t0 > MAX_REPORT_MINUTES ? Math.floor(t1 / MINUTES_PER_DAY) * MINUTES_PER_DAY - 0.5 : t0;
  /** @type {any[]} */
  const out = [];
  const firstDay = Math.floor(from / MINUTES_PER_DAY) + 1;
  const lastDay = Math.floor(t1 / MINUTES_PER_DAY);
  for (let d = firstDay; d <= lastDay; d++) out.push({ at: d * MINUTES_PER_DAY, order: 0, kind: 'day', day: d });
  for (const a of t.CLOCK_ANCHORS) {
    for (let d = Math.floor(from / MINUTES_PER_DAY); d <= lastDay; d++) {
      const at = d * MINUTES_PER_DAY + a.minute;
      if (at > from && at <= t1 && at > t0) out.push({ at, order: 1, kind: 'anchor', id: a.id, minute: a.minute, day: d });
    }
  }
  out.sort((x, y) => x.at - y.at || x.order - y.order);
  return out;
}

/**
 * Builds the {@link ClockEvents} for an advance from `before` to the clock's current time and emits
 * the domain events: the arrival summary (`clock:minute`, `clock:hour`, `clock:phase`,
 * `clock:dayPart`, `tide:change`), then every midnight (`day:end`, `day:start`) and anchor
 * (`clock:anchor`) crossed, in time order.
 * @param {ReturnType<typeof facts>} before
 * @param {Clock} clock
 * @param {Readonly<ClockTuning>} t
 * @param {Bus|null|undefined} bus
 * @param {{realClock: boolean}} mode
 * @returns {ClockEvents}
 */
function report(before, clock, t, bus, mode) {
  const ev = noEvents();
  const after = facts(clock, t);
  ev.minutes = Math.max(0, after.total - before.total);
  if (ev.minutes === 0) return ev;
  const dayChanged = after.day !== before.day;
  if (after.minute !== before.minute || dayChanged) ev.minute = after.minute;
  if (after.hour !== before.hour || dayChanged) ev.hour = after.hour;
  if (after.phase !== before.phase) ev.phase = after.phase;
  if (after.dayPart !== before.dayPart) ev.dayPart = after.dayPart;
  if (after.tide !== before.tide) ev.tide = after.tide;
  if (dayChanged) ev.day = after.day;
  const list = crossings(before.total, after.total, t);
  const anchors = list.filter((c) => c.kind === 'anchor').map((c) => /** @type {any} */ (c).id);
  if (anchors.length) ev.anchors = anchors;

  if (bus) {
    if (ev.minute !== null) bus.emit('clock:minute', { day: after.day, hour: after.hour, minute: ev.minute, total: Math.floor(after.total) });
    if (ev.hour !== null) bus.emit('clock:hour', { day: after.day, hour: ev.hour });
    if (ev.phase !== null) bus.emit('clock:phase', { phase: ev.phase, previous: before.phase });
    if (ev.dayPart !== null) {
      const part = dayPartAt(clock.minute, t);
      bus.emit('clock:dayPart', { dayPart: part.id, previous: before.dayPart, track: part.track, night: isNightAt(clock.minute, t) });
    }
    if (ev.tide !== null) bus.emit('tide:change', { state: ev.tide, previous: before.tide, tide: clock.tide });
    for (const c of list) {
      if (c.kind === 'day') {
        bus.emit('day:end', { day: c.day - 1, gameDay: c.day });
        const wd = weekdayOfDay(c.day + 1, t, mode.realClock ? c.day : null);
        bus.emit('day:start', { day: c.day, gameDay: c.day + 1, dayOfWeek: wd, dayName: DAY_NAMES[wd], spring: springOn(c.day + 1, t, mode.realClock ? c.day : null) });
      } else {
        bus.emit('clock:anchor', { id: c.id, minute: c.minute, day: c.day, gameDay: c.day + 1 });
      }
    }
  }
  return ev;
}

/**
 * Advances the clock by `ms` real milliseconds (core/time applies the day length, the speed and the
 * 250 ms clamp), mirrors it into `world.clock` and reports which boundaries were crossed. With
 * `ctx.bus` it emits, in order: `clock:minute`, `clock:hour`, `clock:phase`, `clock:dayPart`,
 * `tide:change`, then each midnight (`day:end` then `day:start`) and each anchor (`clock:anchor`
 * `{id, minute, day, gameDay}`) crossed, in time order. Call inside `store.tx`, and only from the
 * scenes where time runs (overworld, fishing).
 *
 * Payloads: `clock:minute {day, hour, minute, total}`, `clock:hour {day, hour}`,
 * `clock:phase {phase, previous}`, `clock:dayPart {dayPart, previous, track, night}`,
 * `tide:change {state, previous, tide}`, `day:end {day, gameDay}`,
 * `day:start {day, gameDay, dayOfWeek, dayName, spring}` (`day` is core's 0-based day, `gameDay` the
 * GDD's 1-based one; `dayOfWeek` is 0 = Monday on the GDD calendar).
 * @param {World} world
 * @param {Clock} clock
 * @param {number} ms
 * @param {Ctx} [ctx]
 * @returns {ClockEvents}
 */
export function tick(world, clock, ms, ctx) {
  const t = tuningOf(ctx?.data);
  const before = facts(clock, t);
  clock.update(ms);
  world.clock = clock.serialize();
  return report(before, clock, t, ctx?.bus, { realClock: clock.realClock });
}

/**
 * Debug / script `setTime`: advances to the next occurrence of a minute of day (firing the clock's
 * own boundary listeners unless `silent`) and mirrors the result into `world.clock`. Domain events
 * are not emitted (use {@link rest} for an in-fiction skip).
 * @param {World} world
 * @param {Clock} clock
 * @param {number} minuteOfDay  any number; wrapped into `[0, 1440)`
 * @param {{silent?: boolean}} [opts]
 * @returns {ClockState}
 */
export function setTime(world, clock, minuteOfDay, opts = {}) {
  const m = Number(minuteOfDay);
  if (!Number.isFinite(m)) throw new TypeError(`clockSys.setTime: minute must be a finite number, got ${minuteOfDay}`);
  clock.skipTo(mod(Math.floor(m), MINUTES_PER_DAY), { silent: opts.silent === true });
  return serializeInto(world, clock);
}

/**
 * Performs the clock side effects `systems/settings.update` returns (`clock.realClock`,
 * `clock.minutesPerDay`) on the live clock and mirrors it into `world.clock`. Effects of other kinds
 * are ignored. A clock without `setMinutesPerDay` (a test double) gets the day-length effect back in
 * `pending`, so the caller can rebuild the clock from {@link optionsFrom}.
 * @param {World} world
 * @param {Clock & {setMinutesPerDay?: (n: number) => void}} clock
 * @param {Array<{kind: string, [k: string]: any}>|null|undefined} effects
 * @returns {{applied: string[], pending: string[]}}
 */
export function applySettingsEffects(world, clock, effects) {
  /** @type {string[]} */ const applied = [];
  /** @type {string[]} */ const pending = [];
  for (const e of effects ?? []) {
    if (e?.kind === 'clock.realClock') {
      clock.setRealClock(e.realClock === true);
      applied.push(e.kind);
    } else if (e?.kind === 'clock.minutesPerDay') {
      if (typeof clock.setMinutesPerDay === 'function') { clock.setMinutesPerDay(e.minutesPerDay); applied.push(e.kind); }
      else pending.push(e.kind);
    }
  }
  if (applied.length) serializeInto(world, clock);
  return { applied, pending };
}

/**
 * One Settings day-length choice.
 * @typedef {{id: string, minutesPerDay: number|null, realClock: boolean}} DayLengthOption
 */

/**
 * The day-length choices for the Settings screen: each `CLOCK_DAY_LENGTHS` entry (ids `'12'`, `'24'`,
 * `'48'`) then Real Clock (id `'real'`, `minutesPerDay: null`). Apply one by passing
 * `{minutesPerDay, realClock}` to `systems/settings.update`.
 * @param {any} [data]
 * @returns {DayLengthOption[]}
 */
export function dayLengthOptions(data) {
  const t = tuningOf(data);
  return [
    ...t.CLOCK_DAY_LENGTHS.map((n) => ({ id: String(n), minutesPerDay: n, realClock: false })),
    { id: 'real', minutesPerDay: null, realClock: true },
  ];
}

/**
 * The world's current day-length choice: `'real'` under Real Clock, else the option matching
 * `settings.minutesPerDay` (or `'custom'` for any other value).
 * @param {World} world
 * @param {any} [data]
 * @returns {DayLengthOption & {id: string}}
 */
export function dayLengthOf(world, data) {
  if (world?.settings?.realClock === true) return { id: 'real', minutesPerDay: null, realClock: true };
  const t = tuningOf(data);
  const mpd = Number(world?.settings?.minutesPerDay);
  const n = Number.isFinite(mpd) && mpd > 0 ? mpd : t.CLOCK_DEFAULT_MINUTES_PER_DAY;
  return { id: t.CLOCK_DAY_LENGTHS.includes(n) ? String(n) : 'custom', minutesPerDay: n, realClock: false };
}

// ---------------------------------------------------------------------------------------------
// Time of day and calendar (pure reads of world.clock)
// ---------------------------------------------------------------------------------------------

/**
 * `world.clock.total`, or 0 when unreadable.
 * @param {World} world
 * @returns {number}
 */
function totalOf(world) {
  const v = world?.clock?.total;
  return isNum(v) ? v : 0;
}

/**
 * Game day number, 1-based as the GDD counts (day 1 = core day 0). Under Real Clock the clock counts
 * absolute days, so the number is large but still advances once per real midnight.
 * @param {World} world
 * @returns {number}
 */
export function gameDay(world) {
  return Math.floor(totalOf(world) / MINUTES_PER_DAY) + 1;
}

/**
 * Minute of day of the world clock, `[0, 1440)`, fractional.
 * @param {World} world
 * @returns {number}
 */
export function minuteOfDay(world) {
  return mod(totalOf(world), MINUTES_PER_DAY);
}

/**
 * The tuned day-parts table.
 * @param {any} [data]
 * @returns {readonly DayPart[]}
 */
export function dayParts(data) {
  return tuningOf(data).CLOCK_DAY_PARTS;
}

/**
 * The day-part containing a minute of day.
 * @param {number} minute  any finite number; wrapped into `[0, 1440)`
 * @param {any} [data]     tuning source
 * @returns {DayPart}
 */
export function dayPartAt(minute, data) {
  if (!isNum(minute)) throw new TypeError(`clockSys.dayPartAt: minute must be a finite number, got ${minute}`);
  const parts = tuningOf(data).CLOCK_DAY_PARTS;
  const m = mod(minute, MINUTES_PER_DAY);
  let found = parts[0];
  for (const p of parts) {
    if (p.start > m) break;
    found = p;
  }
  return found;
}

/**
 * The world's current day-part.
 * @param {World} world
 * @param {any} [data]
 * @returns {DayPart}
 */
export function dayPart(world, data) {
  return dayPartAt(minuteOfDay(world), data);
}

/**
 * Night rules at a minute of day (18:00 inclusive to 06:00 exclusive by default; a window that does
 * not wrap midnight works too).
 * @param {number} minute any finite number; wrapped into `[0, 1440)`
 * @param {any} [data] tuning source
 * @returns {boolean}
 */
export function isNightAt(minute, data) {
  if (!isNum(minute)) throw new TypeError(`clockSys.isNightAt: minute must be a finite number, got ${minute}`);
  const t = tuningOf(data);
  const m = mod(minute, MINUTES_PER_DAY);
  const s = t.CLOCK_NIGHT_START;
  const e = t.CLOCK_NIGHT_END;
  if (s === e) return false;
  return s > e ? m >= s || m < e : m >= s && m < e;
}

/**
 * Whether night rules (GDD-00 §5: night encounters, night fish, glowing flats, Ludo, porch talk) apply.
 * @param {World} world
 * @param {any} [data]
 * @returns {boolean}
 */
export function isNight(world, data) {
  return isNightAt(minuteOfDay(world), data);
}

/**
 * Weekday index (0 = Monday) of a game day.
 * @param {number} day game day (1-based)
 * @param {Readonly<ClockTuning>} t
 * @param {number|null} realDay core real-clock day number when the clock follows real time
 * @returns {number}
 */
function weekdayOfDay(day, t, realDay) {
  if (realDay !== null) return mod(realDay, DAYS_PER_WEEK);
  return mod(t.CLOCK_DAY1_WEEKDAY + day - 1, DAYS_PER_WEEK);
}

/**
 * Spring tide on a game day.
 * @param {number} day game day (1-based)
 * @param {Readonly<ClockTuning>} t
 * @param {number|null} realDay core real-clock day number when the clock follows real time
 * @returns {boolean}
 */
function springOn(day, t, realDay) {
  const every = t.TIDE_SPRING_EVERY_DAYS;
  if (realDay !== null) {
    // Real Clock: keep the GDD's weekday (spring tide on the weekday day FIRST falls on) for a weekly period.
    if (every === DAYS_PER_WEEK) return mod(realDay, DAYS_PER_WEEK) === weekdayOfDay(t.TIDE_SPRING_FIRST_DAY, t, null);
    return mod(realDay, every) === 0;
  }
  return day >= t.TIDE_SPRING_FIRST_DAY && (day - t.TIDE_SPRING_FIRST_DAY) % every === 0;
}

/**
 * The real-clock day number when the world clock follows real time, else null.
 * @param {World} world
 * @returns {number|null}
 */
function realDayOf(world) {
  return world?.clock?.realClock === true ? Math.floor(totalOf(world) / MINUTES_PER_DAY) : null;
}

/**
 * The world's weekday: day 1 is a Sunday, so days 7, 14, 21 are Saturdays (Lantern Market). Under
 * Real Clock it is the device's weekday.
 * @param {World} world
 * @param {any} [data]
 * @returns {{index: number, name: string, isSaturday: boolean}} `index` 0 = Monday … 6 = Sunday
 */
export function weekday(world, data) {
  const index = weekdayOfDay(gameDay(world), tuningOf(data), realDayOf(world));
  return { index, name: DAY_NAMES[index], isSaturday: index === 5 };
}

/**
 * Spring tide today (GDD-00 §4: every 7 days, days 7, 14, 21 …, bares the Old Quay). This is the GDD
 * rule; core/time's lunar `isSpringTide` is not used by the game.
 * @param {World} world
 * @param {any} [data]
 * @returns {boolean}
 */
export function isSpringTide(world, data) {
  return springOn(gameDay(world), tuningOf(data), realDayOf(world));
}

/**
 * Spring tide on a given game day (game clock; for the Tide Table's week view).
 * @param {number} day game day, integer >= 1
 * @param {any} [data]
 * @returns {boolean}
 */
export function isSpringTideDay(day, data) {
  if (!isInt(day)) throw new TypeError(`clockSys.isSpringTideDay: day must be an integer, got ${day}`);
  return springOn(day, tuningOf(data), null);
}

// ---------------------------------------------------------------------------------------------
// Tide schedule and windows
// ---------------------------------------------------------------------------------------------

/** Half the tide period: low to high. */
const HALF_PERIOD = TIDE_PERIOD_MINUTES / 2;

/**
 * The tide model for a tuning: offset, the index of day 1's low, and the low-index helpers.
 * @param {Readonly<ClockTuning>} t
 */
function tideModel(t) {
  const offset = tideOffsetFor(t.TIDE_DAY1_LOW);
  const anchorK = Math.round((t.TIDE_DAY1_LOW - offset) / TIDE_PERIOD_MINUTES);
  /** @param {number} k */
  const lowAt = (k) => offset + k * TIDE_PERIOD_MINUTES;
  /** @param {number} total */
  const nearestK = (total) => Math.round((total - offset) / TIDE_PERIOD_MINUTES);
  /**
   * Whether some lower-parity low falls in core day `d`.
   * @param {number} d
   */
  const dayHasParityLow = (d) => {
    const step = 2 * TIDE_PERIOD_MINUTES;
    const first = t.TIDE_DAY1_LOW;
    const j = Math.ceil((d * MINUTES_PER_DAY - first) / step);
    return first + j * step < (d + 1) * MINUTES_PER_DAY;
  };
  /**
   * The day's lower low: every other low counting from day 1's 16:40 low (lower lows come 24 h 50 m
   * apart), and on a calendar day that holds none of those (about one day in thirty) its own lows.
   * @param {number} k
   */
  const isLower = (k) => mod(k - anchorK, 2) === 0 || !dayHasParityLow(Math.floor(lowAt(k) / MINUTES_PER_DAY));
  return { offset, lowAt, nearestK, isLower };
}

/**
 * One tide extreme.
 * @typedef {Object} TideExtreme
 * @property {'low'|'high'} kind
 * @property {number} minute    minute of day (fractional for highs: lows fall on whole minutes)
 * @property {string} time      `'HH:MM'`
 * @property {number} total     absolute in-game minute
 * @property {number} day       game day (1-based)
 * @property {boolean} lower    true for the day's lower low (always false for highs)
 */

/**
 * @param {number} total
 * @param {'low'|'high'} kind
 * @param {boolean} lower
 * @returns {TideExtreme}
 */
function extreme(total, kind, lower) {
  const minute = mod(total, MINUTES_PER_DAY);
  return { kind, minute, time: formatMinute(minute), total, day: Math.floor(total / MINUTES_PER_DAY) + 1, lower };
}

/**
 * Low and high waters of a game day, ascending (the Tide Table). Day 1: lows 04:15 and 16:40 (the
 * lower); day 2: 05:05 and 17:30; day 3: 05:55 and 18:20.
 * @param {number} day game day, integer >= 1
 * @param {any} [data]
 * @returns {TideExtreme[]}
 */
export function tidesForDay(day, data) {
  if (!isInt(day) || day < 1) throw new TypeError(`clockSys.tidesForDay: day must be an integer >= 1, got ${day}`);
  const m = tideModel(tuningOf(data));
  const start = (day - 1) * MINUTES_PER_DAY;
  const end = start + MINUTES_PER_DAY;
  /** @type {TideExtreme[]} */
  const out = [];
  for (let k = m.nearestK(start) - 1; m.lowAt(k) < end; k++) {
    const low = m.lowAt(k);
    if (low >= start) out.push(extreme(low, 'low', m.isLower(k)));
    const high = low + HALF_PERIOD;
    if (high >= start && high < end) out.push(extreme(high, 'high', false));
  }
  return out.sort((a, b) => a.total - b.total);
}

/**
 * The next `n` low waters after the world clock (strictly later), for the Day Page and the Sleep
 * confirmation ("what the night still holds").
 * @param {World} world
 * @param {number} [n=2]
 * @param {any} [data]
 * @returns {TideExtreme[]}
 */
export function nextLows(world, n = 2, data) {
  if (!isInt(n) || n < 0) throw new TypeError(`clockSys.nextLows: n must be an integer >= 0, got ${n}`);
  const m = tideModel(tuningOf(data));
  const now = totalOf(world);
  let k = m.nearestK(now);
  if (m.lowAt(k) <= now) k++;
  /** @type {TideExtreme[]} */
  const out = [];
  for (let i = 0; i < n; i++, k++) out.push(extreme(m.lowAt(k), 'low', m.isLower(k)));
  return out;
}

/**
 * The tide height the world clock implies (core/time's raised cosine with the tide seed's offset).
 * Equal to `clock.tide` unless the tide is frozen for debugging.
 * @param {World} world
 * @param {any} [data]
 * @returns {number} `[0, 1]`
 */
export function tideHeight(world, data) {
  return tideAt(totalOf(world), tideModel(tuningOf(data)).offset);
}

/**
 * Options for the tide-window helpers.
 * @typedef {Object} TideOpts
 * @property {any} [data]          tuning source
 * @property {number} [total]      evaluate at this absolute minute instead of `world.clock.total`
 * @property {Clock} [clock]       the live clock: its `total`, and its pinned tide when `freezeTide` is on
 * @property {number} [tide]       a tide height `[0, 1]` that overrides time (debug / frozen tide)
 * @property {boolean} [barLit]    override the Bar's lit flag (`TIDE_BAR_LIT_FLAG` in `world.flags`)
 */

/** Tide offset per clock seed (core's hash is cheap, but this runs every frame per gated warp). @type {Map<string|number|null, number>} */
const OFFSET_CACHE = new Map();

/**
 * The tide offset a live clock itself uses (from its serialized seed), or `fallback` when the clock
 * cannot say (a test double without `serialize`).
 * @param {Clock} clock
 * @param {number} fallback
 * @returns {number}
 */
function clockOffset(clock, fallback) {
  if (typeof clock.serialize !== 'function') return fallback;
  const seed = clock.serialize().seed ?? null;
  let off = OFFSET_CACHE.get(seed);
  if (off === undefined) {
    off = scheduleForSeed(seed).tideOffset;
    if (OFFSET_CACHE.size > 64) OFFSET_CACHE.clear();
    OFFSET_CACHE.set(seed, off);
  }
  return off;
}

/**
 * Resolves when to evaluate and whether a frozen height overrides the schedule.
 * @param {World} world
 * @param {TideOpts} o
 * @param {ReturnType<typeof tideModel>} m
 * @returns {{total: number, frozen: number|null}}
 */
function tideMoment(world, o, m) {
  const total = isNum(o.total) ? o.total : o.clock ? o.clock.total : totalOf(world);
  if (o.tide !== undefined && o.tide !== null) {
    if (!isFrac(o.tide)) throw new TypeError(`clockSys: tide override must be a number in [0, 1], got ${o.tide}`);
    return { total, frozen: o.tide };
  }
  if (o.clock && !isNum(o.total)) {
    // Pinned iff the live height differs from the clock's OWN schedule (its seed's offset): comparing
    // with this tuning's offset would mistake a clock built from other options for a frozen one.
    const live = o.clock.tide;
    if (isNum(live) && Math.abs(live - tideAt(total, clockOffset(o.clock, m.offset))) > 1e-9) return { total, frozen: live };
  }
  return { total, frozen: null };
}

/**
 * Minutes from the nearest low water (0 at low water, up to 372.5 at high water).
 * @param {World} world
 * @param {TideOpts} [opts]
 * @returns {number}
 */
export function minutesFromLow(world, opts = {}) {
  const m = tideModel(tuningOf(opts.data));
  const { total, frozen } = tideMoment(world, opts, m);
  if (frozen !== null) return (Math.acos(1 - 2 * frozen) / (2 * Math.PI)) * TIDE_PERIOD_MINUTES;
  return Math.abs(total - m.lowAt(m.nearestK(total)));
}

/**
 * A tide-gated way's state.
 * @typedef {Object} TideWindow
 * @property {string} kind
 * @property {boolean} open                  passable now
 * @property {number|null} minutesUntilChange in-game minutes until it closes (open) or opens (closed);
 *   null when it never changes (a lit Bar, or a frozen debug tide)
 * @property {TideExtreme|null} low          the low the window belongs to (the current one while open,
 *   the next qualifying one while closed); null when the answer does not depend on a low
 * @property {boolean} always                open at any tide (the lit Bar)
 */

/**
 * Whether a tide-gated way is open, and for how long. A window is half-open around its low
 * (`low − h <= now < low + h`, `h` from `TIDE_WINDOWS`): causeway 150, stones 120, flats 90, bar 90
 * (the day's lower low only; any tide once `TIDE_BAR_LIT_FLAG` is set), spur 90 (the Lantern Stack,
 * every low), mainland 60. A frozen tide (`opts.tide`, or `opts.clock` with `freezeTide` on) is read
 * as the equivalent distance from low water (the Bar then follows every low).
 * @param {World} world
 * @param {string} kind a `TIDE_WINDOWS` key
 * @param {TideOpts} [opts]
 * @returns {TideWindow}
 * @throws {RangeError} for an unknown kind
 */
export function tideWindow(world, kind, opts = {}) {
  const t = tuningOf(opts.data);
  const half = t.TIDE_WINDOWS[kind];
  if (half === undefined) throw new RangeError(`clockSys.tideWindow: unknown way kind ${JSON.stringify(kind)} (have ${Object.keys(t.TIDE_WINDOWS).join(', ')})`);
  const isBar = kind === 'bar';
  if (isBar) {
    const lit = opts.barLit ?? world?.flags?.[t.TIDE_BAR_LIT_FLAG] === true;
    if (lit) return { kind, open: true, minutesUntilChange: null, low: null, always: true };
  }
  const m = tideModel(t);
  const { total, frozen } = tideMoment(world, opts, m);
  if (frozen !== null) {
    const d = (Math.acos(1 - 2 * frozen) / (2 * Math.PI)) * TIDE_PERIOD_MINUTES;
    return { kind, open: d < half, minutesUntilChange: null, low: null, always: false };
  }
  const qualifies = isBar ? m.isLower : () => true;
  const k = m.nearestK(total);
  const low = m.lowAt(k);
  if (qualifies(k) && total >= low - half && total < low + half) {
    return { kind, open: true, minutesUntilChange: low + half - total, low: extreme(low, 'low', m.isLower(k)), always: false };
  }
  let next = total < low - half ? k : k + 1;
  for (let guard = 0; !qualifies(next) && guard < 8; guard++) next++;
  const nextLow = m.lowAt(next);
  return { kind, open: false, minutesUntilChange: nextLow - half - total, low: extreme(nextLow, 'low', m.isLower(next)), always: false };
}

/**
 * Every configured way's window, keyed by kind.
 * @param {World} world
 * @param {TideOpts} [opts]
 * @returns {Record<string, TideWindow>}
 */
export function tideWindows(world, opts = {}) {
  /** @type {Record<string, TideWindow>} */
  const out = {};
  for (const kind of Object.keys(tuningOf(opts.data).TIDE_WINDOWS)) out[kind] = tideWindow(world, kind, opts);
  return out;
}

/**
 * The tide state to hand `world/warps.resolveWarp` / `world/tide` for a way of this kind: `'low'`
 * while the window is open (a `tide: 'low'` tile or cond passes), otherwise the real tide state with
 * `'low'` replaced by `'rising'`/`'falling'` (a narrow window like the mainland's ±1 h closes while
 * core/time still reads low water).
 * @param {World} world
 * @param {string} kind
 * @param {TideOpts} [opts]
 * @returns {TideState}
 */
export function gateTide(world, kind, opts = {}) {
  const w = tideWindow(world, kind, opts);
  if (w.open) return 'low';
  const m = tideModel(tuningOf(opts.data));
  const { total, frozen } = tideMoment(world, opts, m);
  if (frozen !== null) return frozen > DEFAULT_HIGH_TIDE ? 'high' : 'rising';
  const state = tideStateAt(total, m.offset);
  if (state !== 'low') return state;
  return total >= m.lowAt(m.nearestK(total)) ? 'rising' : 'falling';
}

// ---------------------------------------------------------------------------------------------
// Rest
// ---------------------------------------------------------------------------------------------

/**
 * One bed option as the rest menu shows it.
 * @typedef {Object} RestOption
 * @property {'lie'|'nap'|'sleep'} kind
 * @property {boolean} available
 * @property {'too-early'|'too-late'|null} reason   why not (the Sleep line: "Too early. Someone's always buying.")
 * @property {number} wakeMinute    minute of day you would get up
 * @property {number} minutes       game minutes the rest skips (0 under Real Clock)
 * @property {number} heal          heal fraction of max HP it grants
 */

/**
 * @param {number} m minute of day
 * @param {'lie'|'nap'|'sleep'} kind
 * @param {Readonly<ClockTuning>} t
 * @param {boolean} realClock
 * @returns {RestOption}
 */
function restOption(m, kind, t, realClock) {
  /** @type {RestOption['reason']} */
  let reason = null;
  let wake;
  let heal;
  if (kind === 'lie') {
    wake = mod(m + t.REST_LIE_MINUTES, MINUTES_PER_DAY);
    heal = t.REST_LIE_HEAL;
  } else if (kind === 'nap') {
    wake = t.REST_NAP_WAKE;
    heal = t.REST_NAP_HEAL;
    // outside the window: "too late" if dusk is nearer behind than noon is ahead
    if (!inWindow(m, t.REST_NAP_FROM, t.REST_NAP_WAKE)) reason = minutesAfter(m, t.REST_NAP_WAKE) < minutesAfter(t.REST_NAP_FROM, m) ? 'too-late' : 'too-early';
  } else {
    wake = t.REST_SLEEP_WAKE;
    heal = t.REST_SLEEP_HEAL;
    if (!inWindow(m, t.REST_SLEEP_FROM, t.REST_SLEEP_WAKE)) reason = 'too-early';
  }
  const minutes = realClock || reason ? 0 : kind === 'lie' ? t.REST_LIE_MINUTES : minutesAfter(wake, m);
  return { kind, available: reason === null, reason, wakeMinute: realClock ? m : wake, minutes, heal };
}

/**
 * Whether `m` lies in the half-open daily window `[from, to)`, which may wrap midnight.
 * @param {number} m
 * @param {number} from
 * @param {number} to
 * @returns {boolean}
 */
function inWindow(m, from, to) {
  if (from === to) return false;
  return from < to ? m >= from && m < to : m >= from || m < to;
}

/**
 * Minutes from `b` forward to `a` on the daily circle, `[0, 1440)`.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function minutesAfter(a, b) {
  return mod(a - b, MINUTES_PER_DAY);
}

/**
 * The bed menu: Lie down (any time), Nap till dusk (from 12:00) and Sleep till dawn (from 21:00),
 * each with availability, wake time, minutes skipped and heal; plus the next two lows for the Sleep
 * confirmation's "what the night still holds". Under Real Clock every option is available and skips
 * nothing (Rest still saves and heals).
 * @param {World} world
 * @param {any} [data]
 * @returns {{options: RestOption[], nextLows: TideExtreme[], realClock: boolean}}
 */
export function restOptions(world, data) {
  const t = tuningOf(data);
  const realClock = world?.clock?.realClock === true;
  const m = minuteOfDay(world);
  return { options: REST_KINDS.map((k) => restOption(m, /** @type {any} */ (k), t, realClock)), nextLows: nextLows(world, 2, data), realClock };
}

/**
 * The outcome of a rest: the clock events it caused plus what the caller must do next.
 * @typedef {ClockEvents & {
 *   ok: boolean, kind: string, reason: 'too-early'|'too-late'|'unknown-kind'|null, skipped: boolean,
 *   wakeMinute: number, heal: number, save: boolean, dayPage: boolean
 * }} RestResult
 * `heal` is the fraction of max HP to restore (party lane), `save` asks for the verified save Rest
 * always makes, `dayPage` asks for Dimity's Day Page (Sleep only; the porch Sit shows it too).
 */

/**
 * Rests at home. Lie down: any time, heal, 10 game minutes. Nap till dusk: from 12:00, wakes at
 * 18:00. Sleep till dawn: from 21:00 (or after midnight), wakes at 06:00, crossing the 05:40 builds
 * anchor on the way (so `day:end`/`day:start` and `clock:anchor builds` then `clock:anchor morning`
 * reach dayFlow in order). The skip itself is silent for the clock's own listeners; the domain events
 * are emitted here like {@link tick}'s. Under Real Clock nothing is skipped (`skipped: false`), the rest
 * still heals and saves. A refused rest changes nothing. Call inside `store.tx`.
 * @param {World} world
 * @param {Clock} clock
 * @param {'lie'|'nap'|'sleep'} kind
 * @param {Ctx} [ctx]
 * @returns {RestResult}
 */
export function rest(world, clock, kind, ctx) {
  const t = tuningOf(ctx?.data);
  if (!REST_KINDS.includes(kind)) {
    return { ...noEvents(), ok: false, kind: String(kind), reason: 'unknown-kind', skipped: false, wakeMinute: clock.minute, heal: 0, save: false, dayPage: false };
  }
  const realClock = clock.realClock;
  const opt = restOption(clock.minute, kind, t, realClock);
  const base = { ok: opt.available, kind, reason: opt.reason, wakeMinute: opt.wakeMinute, heal: opt.available ? opt.heal : 0, save: opt.available, dayPage: opt.available && kind === 'sleep' };
  if (!opt.available) return { ...noEvents(), ...base, skipped: false };
  if (realClock || opt.minutes === 0) {
    world.clock = clock.serialize();
    return { ...noEvents(), ...base, skipped: false };
  }
  const before = facts(clock, t);
  clock.skipTo(opt.wakeMinute, { silent: true });
  world.clock = clock.serialize();
  return { ...report(before, clock, t, ctx?.bus, { realClock: false }), ...base, skipped: true };
}

/**
 * Sits on the porch bench: the clock runs ×`REST_SIT_SPEED` (6) until {@link stand}. The caller shows
 * the Day Page and makes the verified save BEFORE calling this, so the save never carries the ×6
 * speed. Real Clock cannot be sped up (`speed` stays 1). Call inside `store.tx`.
 * @param {World} world
 * @param {Clock} clock
 * @param {Ctx} [ctx]
 * @returns {{ok: true, speed: number, realClock: boolean, dayPage: true, save: true}}
 */
export function sit(world, clock, ctx) {
  const t = tuningOf(ctx?.data);
  if (!clock.realClock) clock.setSpeed(t.REST_SIT_SPEED);
  world.clock = clock.serialize();
  return { ok: true, speed: clock.realClock ? 1 : t.REST_SIT_SPEED, realClock: clock.realClock, dayPage: true, save: true };
}

/**
 * Stands up from the porch bench (or clears any speed-up): clock speed back to 1. Call inside `store.tx`.
 * @param {World} world
 * @param {Clock} clock
 * @returns {{ok: true, speed: 1}}
 */
export function stand(world, clock) {
  clock.setSpeed(1);
  world.clock = clock.serialize();
  return { ok: true, speed: 1 };
}

// ---------------------------------------------------------------------------------------------
// Snapshot for HUD / Day Page
// ---------------------------------------------------------------------------------------------

/**
 * Every clock fact a HUD, the Day Page or a script host wants, from `world.clock` alone.
 * @param {World} world
 * @param {any} [data]
 * @returns {{gameDay: number, minute: number, hour: number, time: string, dayPart: DayPart, night: boolean,
 *   weekday: {index: number, name: string, isSaturday: boolean}, spring: boolean, tide: number,
 *   tideState: TideState, tides: TideExtreme[]}}
 */
export function snapshot(world, data) {
  const t = tuningOf(data);
  const m = minuteOfDay(world);
  const day = gameDay(world);
  const offset = tideModel(t).offset;
  return {
    gameDay: day,
    minute: m,
    hour: Math.floor(m / MINUTES_PER_HOUR),
    time: formatMinute(m),
    dayPart: dayPartAt(m, t),
    night: isNightAt(m, t),
    weekday: weekday(world, data),
    spring: isSpringTide(world, data),
    tide: tideAt(totalOf(world), offset),
    tideState: tideStateAt(totalOf(world), offset),
    tides: tidesForDay(Math.max(1, day), data),
  };
}

// ---------------------------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------------------------

/**
 * Deep-freezes plain objects and arrays in place.
 * @template T
 * @param {T} v
 * @returns {T}
 */
function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(/** @type {any} */ (v)[k]);
  }
  return v;
}
