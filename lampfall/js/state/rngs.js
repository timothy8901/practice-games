/**
 * Named rng fork registry (ARCHITECTURE §9). The master is `makeRng(world.run.seed)`; nobody draws
 * from it. Every random decision draws from a fork named by label:
 *
 *  - STATELESS forks (`fresh`, `day`, `creature`, `battle`) are rebuilt from seed + label on every
 *    call; the caller positions them (e.g. `forecast` skips `creature.shiftCount` draws). Nothing is
 *    saved: the same label always starts the same stream.
 *  - STATEFUL forks (`stream`) keep advancing across calls; their positions are written into
 *    `world.rng[label]` by {@link Rngs.commit} (which `store.snapshot()` runs) and restored from
 *    there after a load, so a save/restore continues the stream instead of replaying it.
 *
 * Pure. Lane: STATE.
 * @module state/rngs
 */

import { makeRng } from '../core/rng.js';

/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {import('./schema.js').World} World */
/** @typedef {import('./store.js').Store} Store */

/**
 * @typedef {Object} Rngs
 * @property {(label: string) => Rng} stream   STATEFUL: cached Rng restored from `world.rng[label]` or freshly forked; state written back by `commit()`
 * @property {(label: string) => Rng} fresh    STATELESS: a new fork each call (callers position it themselves)
 * @property {(kind: string, day: number) => Rng} day   `fresh(`${kind}:${day}`)`: a reload mid-day reproduces the day's plan
 * @property {(kind: string, day: number) => Rng} dayFork   alias of `day`
 * @property {(uid: string) => Rng} creature   `fresh(`shift:${uid}`)`; forecast skips `c.shiftCount` draws
 * @property {(world?: World) => Rng} battle   `fresh(`battle:${world.stats.battles}`)`
 * @property {(world?: World) => void} commit  writes every stateful stream's `state()` into `world.rng` (defaults to the store's world)
 * @property {() => void} reset                drops every cached stream (called on `world:replaced`; also useful in tests)
 * @property {() => string[]} labels           labels of the stateful streams currently cached
 * @property {() => number} seed               the master seed in use
 */

/**
 * Stateless fork derived from a seed and a label. Equal inputs always give an equal stream.
 * @param {number|string} seed
 * @param {string} label
 * @returns {Rng}
 */
export function forkFor(seed, label) {
  return makeRng(seed).fork(label);
}

/**
 * Builds the registry over a store. The master seed is read from `store.world.run.seed` each time
 * it is needed, so a `replace()` with a different run re-seeds everything; the stateful cache is
 * cleared on `world:replaced` and re-filled lazily from the new `world.rng`.
 *
 * `commit` is registered as a snapshot hook, so `store.snapshot()` (and every save) persists the
 * stateful positions without anyone remembering to call it.
 *
 * @param {Store} store
 * @returns {Rngs}
 * @throws {TypeError} when `store` lacks a `world`
 */
export function createRngs(store) {
  if (!store || typeof store !== 'object' || !('world' in store)) {
    throw new TypeError('createRngs: store must be a Store');
  }

  /** @type {Map<string, Rng>} */
  const streams = new Map();
  /** @type {number|null} seed the cache was built for */
  let cachedSeed = null;

  /** @returns {number} */
  function seed() {
    const s = store.world?.run?.seed;
    if (!Number.isInteger(s) || s < 0) {
      throw new TypeError(`rngs: world.run.seed must be a non-negative integer, got ${String(s)}`);
    }
    return s;
  }

  /** Drops the cache if the world's seed changed under us. */
  function syncSeed() {
    const s = seed();
    if (cachedSeed !== s) {
      streams.clear();
      cachedSeed = s;
    }
    return s;
  }

  /** @param {string} label */
  function assertLabel(label) {
    if (typeof label !== 'string' || label.length === 0) {
      throw new TypeError(`rngs: label must be a non-empty string, got ${String(label)}`);
    }
  }

  /**
   * @param {string} label
   * @returns {Rng}
   */
  function fresh(label) {
    assertLabel(label);
    return forkFor(seed(), label);
  }

  /**
   * @param {string} label
   * @returns {Rng}
   */
  function stream(label) {
    assertLabel(label);
    const s = syncSeed();
    let rng = streams.get(label);
    if (!rng) {
      rng = forkFor(s, label);
      const saved = store.world?.rng?.[label];
      if (Array.isArray(saved) && saved.length === 4) {
        try {
          rng.restore(saved);
        } catch {
          // A corrupt saved state falls back to the fresh fork: deterministic and never fatal.
        }
      }
      streams.set(label, rng);
    }
    return rng;
  }

  /**
   * @param {string} kind
   * @param {number} dayNumber
   * @returns {Rng}
   */
  function day(kind, dayNumber) {
    if (typeof kind !== 'string' || kind.length === 0) throw new TypeError('rngs.day: kind must be a non-empty string');
    if (!Number.isInteger(dayNumber)) throw new TypeError('rngs.day: day must be an integer');
    return fresh(`${kind}:${dayNumber}`);
  }

  /**
   * @param {string} uid
   * @returns {Rng}
   */
  function creature(uid) {
    if (typeof uid !== 'string' || uid.length === 0) throw new TypeError('rngs.creature: uid must be a non-empty string');
    return fresh(`shift:${uid}`);
  }

  /**
   * @param {World} [world]
   * @returns {Rng}
   */
  function battle(world = store.world) {
    const n = world?.stats?.battles;
    if (!Number.isInteger(n)) throw new TypeError('rngs.battle: world.stats.battles must be an integer');
    return fresh(`battle:${n}`);
  }

  /**
   * @param {World} [world]
   */
  function commit(world = store.raw ? store.raw() : store.world) {
    if (!world || typeof world !== 'object') throw new TypeError('rngs.commit: world must be an object');
    if (world.rng === null || typeof world.rng !== 'object') world.rng = {};
    for (const [label, rng] of streams) world.rng[label] = rng.state();
  }

  function reset() {
    streams.clear();
    cachedSeed = null;
  }

  if (typeof store.onSnapshot === 'function') store.onSnapshot((w) => commit(w));
  if (store.bus && typeof store.bus.on === 'function') store.bus.on('world:replaced', reset);

  return {
    stream,
    fresh,
    day,
    dayFork: day,
    creature,
    battle,
    commit,
    reset,
    labels: () => [...streams.keys()],
    seed,
  };
}
