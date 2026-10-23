// Test fixtures for the RULES-CREATURE lane (systems/creature, party, exp).
// Content comes from the verified battle prototype (proto/battle/*), imported, never copied into js/.
import { SPECIES, SPECIES_LIST } from '../../proto/battle/species.js';
import { MOVES, MOVE_LIST } from '../../proto/battle/moves.js';
import { ABILITIES, ABILITY_LIST } from '../../proto/battle/abilities.js';
import { TYPES } from '../../proto/battle/types.js';
import { createRegistry } from '../../js/data/registry.js';
import { createNewWorld } from '../../js/state/schema.js';
import { makeRng } from '../../js/core/rng.js';
import { makeCreature } from '../../js/systems/creature.js';

/**
 * Families: one row per prototype `family`. Two rows carry windows (one non-default); the others
 * have none, so window levels fall back to the tuning default.
 */
const FAMILY_WINDOWS = { sloshkin: [9, 20, 34], wirewhisk: [4, 8] };
export const FAMILIES = [...new Set(SPECIES_LIST.map((s) => s.family))].map((id) => (FAMILY_WINDOWS[id]
  ? { id, name: `${id} line`, windows: FAMILY_WINDOWS[id], shiftTable: {} }
  : { id, name: `${id} line`, shiftTable: {} }));

/** Items: one Still-Knot-like row (`blocksShifts`) and one ordinary held item. */
export const ITEMS = [
  { id: 'fx-knot', name: 'Fixture Knot', pocket: 'items', blocksShifts: true },
  { id: 'fx-charm', name: 'Fixture Charm', pocket: 'items' },
];

/** Plain-tables data (objects keyed by id, as the prototype exports them). */
export const DATA = Object.freeze({ species: SPECIES, moves: MOVES, abilities: ABILITIES, types: TYPES, families: FAMILIES, items: ITEMS });

/** The same content through the real data registry (array tables with ids). */
export const REG = createRegistry({
  species: SPECIES_LIST,
  moves: MOVE_LIST,
  abilities: ABILITY_LIST,
  types: TYPES.map((name) => ({ id: name.toLowerCase(), name })),
  families: FAMILIES,
  items: ITEMS,
});

/**
 * Creature with a seeded rng (mark + Unfixed loop) and the given uid.
 * @param {string} uid
 * @param {string} speciesId
 * @param {number} level
 * @param {Record<string, any>} [extra]
 */
export function mk(uid, speciesId, level, extra = {}) {
  return makeCreature({ uid, speciesId, level, rng: makeRng(`fx:${uid}:${speciesId}`), ...extra }, extra.data ?? DATA);
}

/** A fresh world. */
export function world(seedCode = 'RULES-CREATURE') {
  return createNewWorld({ seedCode });
}

/** Records every emitted event as [name, payload]. */
export function spyBus() {
  const events = [];
  return { events, bus: { emit: (evt, payload) => events.push([evt, payload]) } };
}

export { makeRng, SPECIES };
