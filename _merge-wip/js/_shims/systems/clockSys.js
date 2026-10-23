/** SHIM for js/systems/clockSys.js [SYS-TIME]. Delete at integration. */
import { createClock } from '../../core/time.js';

/**
 * Clock options derived from a world (seed, settings).
 * @param {object} world
 * @returns {import('../../core/time.js').ClockOptions}
 */
export function optionsFrom(world) {
  return {
    seed: world.run.seed,
    minutesPerDay: world.settings?.minutesPerDay ?? 24,
    realClock: Boolean(world.settings?.realClock),
  };
}

/**
 * Advances the clock and mirrors its state into `world.clock`.
 * @param {object} world
 * @param {import('../../core/time.js').Clock} clock
 * @param {number} ms
 * @returns {{minutes: number}} ClockEvents (shim: elapsed in-game minutes only)
 */
export function tick(world, clock, ms) {
  const before = clock.total;
  clock.update(ms);
  world.clock = clock.serialize();
  return { minutes: clock.total - before };
}

/** @param {object} world @param {import('../../core/time.js').Clock} clock */
export function serializeInto(world, clock) {
  world.clock = clock.serialize();
}

/**
 * Adopts `world.clock` into a live clock, or resets the clock to a fresh start for this world's seed.
 * @param {object} world
 * @param {import('../../core/time.js').Clock} clock
 */
export function restoreFrom(world, clock) {
  if (world.clock && typeof world.clock === 'object') {
    clock.restore(world.clock);
  } else {
    clock.restore(createClock(optionsFrom(world)).serialize());
    world.clock = clock.serialize();
  }
}
