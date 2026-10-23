/**
 * Story flags and counters (`world.flags`, `world.counters`). Owner of both keys (lint-owners).
 *
 * Flags are namespaced ids (§8.1): `sp.` story, `th.<thread>.` thread, `np.<npc>.` neighbor,
 * `sys.` engine, `seen.<scriptId>` script seen. Values are `boolean | number | string`.
 * Counters are plain numbers; the uid sequence for creatures lives in counter `sys.uid`.
 *
 * Every function is `fn(world, ...args, ctx?)` and returns a plain Result. When `ctx.bus` is given
 * the domain event (`flag:set`, `counter:inc`) is emitted after the mutation (§3.4); the script
 * runner and debug hook call these without a bus and emit nothing.
 *
 * Pure. Lane: STATE.
 * @module systems/flags
 */

import { FLAG_NAMESPACES } from '../state/schema.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {boolean|number|string} FlagValue */
/** @typedef {{bus?: {emit: (evt: string, payload: any) => any}|null}} Ctx */

/** Counter holding the next creature uid sequence number (see schema Creature.uid). */
export const UID_COUNTER = 'sys.uid';

/**
 * Validates a flag or counter id: non-empty string with a known namespace prefix.
 * @param {unknown} id
 * @returns {string} the id
 * @throws {TypeError} when malformed
 */
export function assertFlagId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError(`flags: id must be a non-empty string, got ${String(id)}`);
  }
  if (!FLAG_NAMESPACES.some((ns) => id.startsWith(ns) && id.length > ns.length)) {
    throw new TypeError(`flags: id ${JSON.stringify(id)} must start with one of ${FLAG_NAMESPACES.join(' ')} and name something after it`);
  }
  return id;
}

/**
 * Whether `id` is a well-formed flag id (no throw).
 * @param {unknown} id
 * @returns {boolean}
 */
export function isFlagId(id) {
  try {
    assertFlagId(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sets a flag. `value` defaults to `true`.
 * @param {World} world
 * @param {string} id
 * @param {FlagValue} [value=true]
 * @param {Ctx} [ctx]
 * @returns {{changed: boolean, id: string, value: FlagValue, prev: FlagValue|null}}
 * @throws {TypeError} for a malformed id or a non-scalar value
 */
export function setFlag(world, id, value = true, ctx) {
  assertFlagId(id);
  if (!isScalar(value)) throw new TypeError(`flags.setFlag: value for ${id} must be boolean, number or string`);
  const prev = Object.prototype.hasOwnProperty.call(world.flags, id) ? world.flags[id] : null;
  const changed = prev !== value;
  if (changed) {
    world.flags[id] = value;
    ctx?.bus?.emit('flag:set', { id, value, prev });
  }
  return { changed, id, value, prev };
}

/**
 * Reads a flag; `fallback` (default `null`) when unset.
 * @template [F=null]
 * @param {World} world
 * @param {string} id
 * @param {F} [fallback]
 * @returns {FlagValue|F}
 */
export function getFlag(world, id, fallback = /** @type {any} */ (null)) {
  const v = world?.flags?.[id];
  return v === undefined ? fallback : v;
}

/**
 * Truthiness test: set and not `false` / `0` / `''`.
 * @param {World} world
 * @param {string} id
 * @returns {boolean}
 */
export function hasFlag(world, id) {
  return Boolean(world?.flags?.[id]);
}

/**
 * Removes a flag entirely (distinct from setting it `false`).
 * @param {World} world
 * @param {string} id
 * @param {Ctx} [ctx]
 * @returns {{changed: boolean, id: string, prev: FlagValue|null}}
 */
export function clearFlag(world, id, ctx) {
  assertFlagId(id);
  if (!Object.prototype.hasOwnProperty.call(world.flags, id)) return { changed: false, id, prev: null };
  const prev = world.flags[id];
  delete world.flags[id];
  ctx?.bus?.emit('flag:set', { id, value: null, prev });
  return { changed: true, id, prev };
}

/**
 * Marks a script as seen (`seen.<scriptId>`).
 * @param {World} world
 * @param {string} scriptId
 * @param {Ctx} [ctx]
 * @returns {ReturnType<typeof setFlag>}
 */
export function markSeen(world, scriptId, ctx) {
  if (typeof scriptId !== 'string' || !scriptId) throw new TypeError('flags.markSeen: scriptId must be a non-empty string');
  return setFlag(world, `seen.${scriptId}`, true, ctx);
}

/**
 * Increments a counter (creating it at 0) and returns the new value.
 * @param {World} world
 * @param {string} id
 * @param {number} [by=1] any finite number (negative decrements)
 * @param {Ctx} [ctx]
 * @returns {number} the new value
 * @throws {TypeError} for a malformed id or non-finite `by`
 */
export function inc(world, id, by = 1, ctx) {
  assertFlagId(id);
  if (typeof by !== 'number' || !Number.isFinite(by)) throw new TypeError(`flags.inc: by for ${id} must be a finite number`);
  const prev = typeof world.counters[id] === 'number' ? world.counters[id] : 0;
  const value = prev + by;
  world.counters[id] = value;
  ctx?.bus?.emit('counter:inc', { id, value, prev, by });
  return value;
}

/**
 * Reads a counter (0 when unset).
 * @param {World} world
 * @param {string} id
 * @returns {number}
 */
export function get(world, id) {
  const v = world?.counters?.[id];
  return typeof v === 'number' ? v : 0;
}

/**
 * Sets a counter to an exact value.
 * @param {World} world
 * @param {string} id
 * @param {number} value finite number
 * @param {Ctx} [ctx]
 * @returns {number} the value
 * @throws {TypeError}
 */
export function set(world, id, value, ctx) {
  assertFlagId(id);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`flags.set: value for ${id} must be a finite number`);
  const prev = get(world, id);
  world.counters[id] = value;
  if (prev !== value) ctx?.bus?.emit('counter:inc', { id, value, prev, by: value - prev });
  return value;
}

/**
 * Draws the next creature uid (`'c1'`, `'c2'`, ...) from the `sys.uid` counter.
 * @param {World} world
 * @returns {string}
 */
export function nextUid(world) {
  return `c${inc(world, UID_COUNTER, 1)}`;
}

/**
 * Flags whose id starts with `prefix`, as `{id: value}`.
 * @param {World} world
 * @param {string} prefix e.g. `'th.wren.'`
 * @returns {Record<string, FlagValue>}
 */
export function flagsWithPrefix(world, prefix) {
  /** @type {Record<string, FlagValue>} */
  const out = {};
  for (const [id, v] of Object.entries(world?.flags ?? {})) if (id.startsWith(prefix)) out[id] = v;
  return out;
}

/** @param {unknown} v */
function isScalar(v) {
  return typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
}
