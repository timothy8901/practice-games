/**
 * The world clock as a system. [SYS-TIME] — ARCHITECTURE-DRAFT §1, §2.4, §10.
 *
 * DAY-1 VERSION written by the integrator at Checkpoint 0 so `main.js` and the overworld stub bind
 * the live `core/time` clock to `world.clock` without a shim. The SYS-TIME lane owns this file and
 * may extend it freely; the exported names and shapes below are the contract the rest of the game
 * already calls.
 *
 * The only writer of `world.clock` (tools/lint-owners OWNERS). `world.clock` holds exactly
 * `clock.serialize()` (core/time `ClockState`), so a save carries the clock and a load restores it.
 * The clock advances only where a scene calls {@link tick} (overworld, fishing), which is how time is
 * frozen in battle, menus and dialogue by construction.
 *
 * Pure: no DOM; the clock and the bus are passed in.
 * @module systems/clockSys
 */
import { DEFAULT_MINUTES_PER_DAY, MINUTES_PER_DAY } from '../core/time.js';

/** @typedef {import('../core/time.js').Clock} Clock */
/** @typedef {import('../core/time.js').ClockOptions} ClockOptions */
/** @typedef {import('../core/time.js').ClockState} ClockState */
/** @typedef {{bus?: {emit: (evt: string, payload: any) => any}|null}} Ctx */

/**
 * What one {@link tick} crossed. Every field is `null` / `0` when nothing happened, so a caller can
 * test `events.minutes` or `events.hour !== null` without allocating.
 * @typedef {Object} ClockEvents
 * @property {number} minutes   in-game minutes elapsed (fractional)
 * @property {number|null} minute  whole minute of day just reached, or null
 * @property {number|null} hour    hour just reached, or null
 * @property {string|null} phase   phase just entered (`core/time` PHASES), or null
 * @property {string|null} tide    tide state just entered (`core/time` TIDE_STATES), or null
 * @property {number|null} day     day just begun, or null
 */

/**
 * Clock options derived from a world: its seed, day length and real-clock setting.
 * @param {import('../state/schema.js').World} world
 * @returns {ClockOptions}
 */
export function optionsFrom(world) {
  const mpd = Number(world?.settings?.minutesPerDay);
  return {
    seed: world?.run?.seed ?? null,
    minutesPerDay: Number.isFinite(mpd) && mpd > 0 ? mpd : DEFAULT_MINUTES_PER_DAY,
    realClock: world?.settings?.realClock === true,
  };
}

/**
 * Writes the live clock into `world.clock` (call inside a tx or a store snapshot hook).
 * @param {import('../state/schema.js').World} world
 * @param {Clock} clock
 * @returns {ClockState} the state written
 */
export function serializeInto(world, clock) {
  const state = clock.serialize();
  world.clock = state;
  return state;
}

/**
 * Adopts `world.clock` into the live clock (after boot or a load). A missing or malformed state
 * leaves the clock where it is and rewrites `world.clock` from it, so the two never disagree.
 * Read-only on a valid world.
 * @param {import('../state/schema.js').World} world
 * @param {Clock} clock
 * @returns {{ok: boolean, error?: string}}
 */
export function restoreFrom(world, clock) {
  try {
    clock.restore(world.clock);
    return { ok: true };
  } catch (e) {
    world.clock = clock.serialize();
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/**
 * Advances the clock by `ms` real milliseconds, mirrors it into `world.clock` and reports which
 * boundaries were crossed. With `ctx.bus` it emits `clock:minute`, `clock:hour`, `clock:phase`,
 * `tide:change`, `day:end` and `day:start` (§3.4), in that order. Call inside `store.tx`.
 *
 * Boundaries are found by comparing the clock before and after (no listeners, no per-tick closures),
 * so one tick reports the latest crossing of each kind; at the fixed 60 Hz step a tick covers well
 * under one in-game minute at any supported day length.
 * @param {import('../state/schema.js').World} world
 * @param {Clock} clock
 * @param {number} ms
 * @param {Ctx} [ctx]
 * @returns {ClockEvents}
 */
export function tick(world, clock, ms, ctx) {
  const total0 = clock.total;
  const minute0 = Math.floor(clock.minute);
  const hour0 = clock.hour;
  const phase0 = clock.phase;
  const tide0 = clock.tideState;
  const day0 = clock.day;
  clock.update(ms);
  world.clock = clock.serialize();

  /** @type {ClockEvents} */
  const ev = { minutes: Math.max(0, clock.total - total0), minute: null, hour: null, phase: null, tide: null, day: null };
  if (ev.minutes === 0) return ev;
  const minute1 = Math.floor(clock.minute);
  if (minute1 !== minute0 || clock.day !== day0) ev.minute = minute1;
  if (clock.hour !== hour0 || clock.day !== day0) ev.hour = clock.hour;
  if (clock.phase !== phase0) ev.phase = clock.phase;
  if (clock.tideState !== tide0) ev.tide = clock.tideState;
  if (clock.day !== day0) ev.day = clock.day;

  const bus = ctx?.bus;
  if (bus) {
    if (ev.minute !== null) bus.emit('clock:minute', { day: clock.day, hour: clock.hour, minute: ev.minute, total: Math.floor(clock.total) });
    if (ev.hour !== null) bus.emit('clock:hour', { day: clock.day, hour: ev.hour });
    if (ev.phase !== null) bus.emit('clock:phase', { phase: ev.phase, previous: phase0 });
    if (ev.tide !== null) bus.emit('tide:change', { state: ev.tide, previous: tide0, tide: clock.tide });
    if (ev.day !== null) {
      bus.emit('day:end', { day: day0 });
      bus.emit('day:start', { day: ev.day, dayOfWeek: clock.dayOfWeek, dayName: clock.dayName });
    }
  }
  return ev;
}

/**
 * Debug / script `setTime`: advances to the next occurrence of a minute of day (firing the clock's
 * own boundary listeners unless `silent`) and mirrors the result into `world.clock`.
 * @param {import('../state/schema.js').World} world
 * @param {Clock} clock
 * @param {number} minuteOfDay  any number; wrapped into `[0, 1440)`
 * @param {{silent?: boolean}} [opts]
 * @returns {ClockState}
 */
export function setTime(world, clock, minuteOfDay, opts = {}) {
  const m = Number(minuteOfDay);
  if (!Number.isFinite(m)) throw new TypeError(`clockSys.setTime: minute must be a finite number, got ${minuteOfDay}`);
  clock.skipTo(((Math.floor(m) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY, { silent: opts.silent === true });
  return serializeInto(world, clock);
}

/**
 * Performs the clock side effects `systems/settings.update` returns (`clock.realClock`,
 * `clock.minutesPerDay`) and mirrors the clock into `world.clock`. Effects of other kinds are ignored.
 * A day-length change needs `clock.setMinutesPerDay` (core/time, draft §13.6); while core lacks it the
 * effect is returned in `pending` so the caller can rebuild the clock from {@link optionsFrom}.
 * @param {import('../state/schema.js').World} world
 * @param {Clock & {setMinutesPerDay?: (n: number) => void}} clock
 * @param {Array<{kind: string, [k: string]: any}>} effects
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
