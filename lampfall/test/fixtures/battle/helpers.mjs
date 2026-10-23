// Shared fixtures for test/battle.*.test.mjs: rng stubs, a creature builder over the proto
// tables (creature construction belongs to systems/creature.js, so tests borrow the verified
// prototype builder) and a duel() that wires the injected DATA into createBattle.
import { makeRng } from '../../../js/core/rng.js';
import { makeCreature as protoMakeCreature } from '../../../proto/battle/creature.js';
import { createBattle } from '../../../js/battle/engine.js';
import { DATA, MOVES, SPECIES } from './data.mjs';

export { makeRng, DATA };

let uidSeq = 0;

/**
 * A creature built by the prototype builder with a string uid (ARCHITECTURE §5.1 change 3).
 * @param {Record<string, any>} opts makeCreature options
 */
export function makeCreature(opts) {
  return protoMakeCreature({ uid: `c${++uidSeq}`, ...opts });
}

/** Move row by id (fixture lookup). */
export function getMove(id) {
  const mv = MOVES.find((m) => m.id === id);
  if (!mv) throw new RangeError(`fixture: unknown move ${id}`);
  return mv;
}

/** Species row by id (fixture lookup). */
export function getSpecies(id) {
  const s = SPECIES.find((x) => x.id === id);
  if (!s) throw new RangeError(`fixture: unknown species ${id}`);
  return s;
}

/**
 * An Rng stub whose `next()` always returns `v` (so chance(p) is `v < p`), `int()` the low
 * bound, `pick()` the first element and `weighted()` the first positive-weight entry.
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

/** An Rng stub fed by a list of `next()` values (cycles when exhausted). */
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

/** Creature with explicit moves at full HP (no Heartmark unless given). */
export function mk(speciesId, level, moves, extra = {}) {
  return makeCreature({ speciesId, level, moves, heartmark: extra.heartmark === undefined ? null : extra.heartmark, nickname: extra.nickname || speciesId, rng: extra.rng || makeRng(`${speciesId}-${level}`), ...extra });
}

/** A battle between two creatures (or parties) with a stub rng; trainer by default. */
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
    data: opts.data || DATA,
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
    rules: opts.rules,
    holdOut: opts.holdOut,
    nextUid: opts.nextUid,
    tuning: opts.tuning,
    gainExp: opts.gainExp,
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
