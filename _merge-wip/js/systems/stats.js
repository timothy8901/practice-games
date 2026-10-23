/**
 * Run statistics (`world.stats`): fixed counters shown on the Seed Card and used by the crash
 * summary (`stats.battles`) and the battle fork label (`battle:<n>`). Owner of `world.stats`.
 *
 * Keys are fixed by `schema.STAT_COUNTERS`; an unknown key is a programmer error and throws.
 *
 * Pure. Lane: STATE.
 * @module systems/stats
 */

import { STAT_COUNTERS } from '../state/schema.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Stats} Stats */
/** @typedef {keyof Stats} StatKey */
/** @typedef {{bus?: {emit: (evt: string, payload: any) => any}|null}} Ctx */

/** The counter keys, in display order. */
export const KEYS = STAT_COUNTERS;

/**
 * @param {unknown} key
 * @returns {StatKey}
 * @throws {TypeError} for an unknown key
 */
export function assertKey(key) {
  if (typeof key !== 'string' || !STAT_COUNTERS.includes(key)) {
    throw new TypeError(`stats: unknown counter ${String(key)} (one of ${STAT_COUNTERS.join(', ')})`);
  }
  return /** @type {StatKey} */ (key);
}

/**
 * Reads a counter.
 * @param {World} world
 * @param {StatKey} key
 * @returns {number}
 */
export function get(world, key) {
  assertKey(key);
  const v = world?.stats?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Adds `by` (default 1) to a counter and returns the new value. Emits `stat:inc` when a bus is given.
 * @param {World} world
 * @param {StatKey} key
 * @param {number} [by=1]
 * @param {Ctx} [ctx]
 * @returns {number}
 * @throws {TypeError}
 */
export function inc(world, key, by = 1, ctx) {
  assertKey(key);
  if (typeof by !== 'number' || !Number.isFinite(by)) throw new TypeError(`stats.inc: by for ${key} must be a finite number`);
  const prev = get(world, key);
  const value = prev + by;
  world.stats[key] = value;
  ctx?.bus?.emit('stat:inc', { key, value, prev, by });
  return value;
}

/**
 * Sets a counter to an exact value.
 * @param {World} world
 * @param {StatKey} key
 * @param {number} value finite, >= 0
 * @param {Ctx} [ctx]
 * @returns {number}
 * @throws {TypeError}
 */
export function set(world, key, value, ctx) {
  assertKey(key);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`stats.set: value for ${key} must be a finite number >= 0`);
  }
  const prev = get(world, key);
  world.stats[key] = value;
  if (prev !== value) ctx?.bus?.emit('stat:inc', { key, value, prev, by: value - prev });
  return value;
}

/**
 * Adds real play time in milliseconds (`stats.playMs`). Called by the main loop's overworld update
 * with the simulated step, so paused menus do not count.
 * @param {World} world
 * @param {number} ms
 * @returns {number} total play ms
 */
export function addPlayMs(world, ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) throw new TypeError('stats.addPlayMs: ms must be a finite number >= 0');
  const value = get(world, 'playMs') + ms;
  world.stats.playMs = value;
  return value;
}

/**
 * Snapshot of every counter (a copy).
 * @param {World} world
 * @returns {Stats}
 */
export function all(world) {
  /** @type {any} */
  const out = {};
  for (const k of STAT_COUNTERS) out[k] = get(world, /** @type {StatKey} */ (k));
  return out;
}

/**
 * Formats play time as `H:MM` (hours unbounded).
 * @param {number} ms
 * @returns {string}
 */
export function formatPlayTime(ms) {
  const totalMin = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 60000));
  return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`;
}
