// Shared fixtures for the battle prototype tests.
import { makeRng } from '../../../js/core/rng.js';
import { makeCreature } from '../creature.js';
import { createBattle } from '../engine.js';

export { makeRng };

/**
 * An Rng stub whose `next()` always returns `v` (so chance(p) is `v < p`),
 * `int()` returns the low bound, `pick()` the first element and `weighted()`
 * the first positive-weight entry. Handy for forcing hits, misses and crits.
 */
export function constRng(v = 0.5) {
  return {
    next: () => v,
    int: (a) => a,
    chance: (p) => v < p,
    pick: (arr) => arr[0],
    weighted: (entries) => entries.find((e) => e.w > 0)?.v,
  };
}

/**
 * An Rng stub fed by a list of `next()` values (cycles when exhausted).
 */
export function seqRng(values) {
  let i = 0;
  const next = () => values[i++ % values.length];
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (entries) => entries.find((e) => e.w > 0)?.v,
  };
}

/** Creature with explicit moves at full HP. */
export function mk(speciesId, level, moves, extra = {}) {
  return makeCreature({ speciesId, level, moves, heartmark: extra.heartmark === undefined ? null : extra.heartmark, nickname: extra.nickname || speciesId, rng: extra.rng || makeRng(`${speciesId}-${level}`), ...extra });
}

/**
 * A trainer battle between two single creatures (or parties) with a stub rng.
 */
export function duel(a, b, opts = {}) {
  const partyA = Array.isArray(a) ? a : [a];
  const partyB = Array.isArray(b) ? b : [b];
  const kind = opts.kind || 'trainer';
  return createBattle({
    sides: [
      { party: partyA, bag: opts.bag, glint: opts.glint },
      kind === 'wild' ? { party: partyB } : { party: partyB, trainer: opts.trainer || { name: 'Rival' } },
    ],
    kind,
    dial: opts.dial || 'flux',
    rng: opts.rng || constRng(0.5),
    captureStance: opts.captureStance,
    curveLevel: opts.curveLevel,
    summit: opts.summit,
    source: opts.source,
    yard: opts.yard,
    foeAi: opts.foeAi,
    fieldLog: opts.fieldLog,
    prism: opts.prism,
  });
}

/** Events of a type. */
export function ofType(events, type) {
  return events.filter((e) => e.type === type);
}

/** Index of a move id in a creature's slots. */
export function slotOf(c, moveId) {
  const i = c.moves.findIndex((m) => m.id === moveId);
  if (i < 0) throw new Error(`${c.nickname} does not know ${moveId}`);
  return i;
}
