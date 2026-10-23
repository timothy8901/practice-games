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

/**
 * A deterministic end-to-end scenario over the three modules (gifts, EXP, Shifts on every dial,
 * catches, Still Knot, round trips). Returns plain JSON so a child process can print it and the
 * adversarial test can compare it with an in-process run.
 * @param {string} [seedCode]
 */
export async function scenario(seedCode = 'XPROC') {
  const P = await import('../../js/systems/party.js');
  const C = await import('../../js/systems/creature.js');
  const E = await import('../../js/systems/exp.js');
  const w = world(seedCode);
  const rng = makeRng(seedCode);
  const out = [];
  for (const [speciesId, level] of [['sloshkin', 5], ['vagary', 40], ['scrapling', 7], ['tossup', 3], ['wirewhisk', 2], ['prismoth', 12], ['mudfist', 9]]) {
    out.push(P.giveCreature(w, { speciesId, level }, DATA, rng).uid);
  }
  P.giveExp(w, 'c1', 5000, DATA);
  P.giveExp(w, 'c5', 900, DATA);
  P.setHeldItem(w, 'c3', 'fx-knot', DATA);
  P.giveExp(w, 'c3', 4000, DATA);
  const dials = ['drift', 'flux', 'freefall'];
  const forms = ['skeinwing', 'brinelance', 'puddlepip', 'siltback'].filter((id) => SPECIES[id]);
  forms.forEach((formId, i) => C.shiftTo(w.party[0], formId, DATA, dials[i % 3], { rng }));
  P.applyOutcome(w, {
    party: w.party.map((c) => ({ ...C.serialize(c), hp: Math.floor(c.hp / 2) })),
    kind: 'trainer', source: 'rematch', curveLevel: 20,
    defeated: [{ speciesId: 'mudfist', level: 18 }, { speciesId: 'sedgehare', level: 21 }],
    participants: ['c1', 'c2'],
    caught: C.serialize(C.makeCreature({ uid: 'c999', speciesId: 'rushling', level: 11, rng }, DATA)),
  }, DATA, rng);
  const trips = [...w.party, ...w.box].map((c) => C.deserialize(JSON.parse(JSON.stringify(C.serialize(c))), DATA));
  return { uids: out, world: JSON.parse(JSON.stringify(w)), trips, pending: w.pendingShifts.slice(), open: w.party.map((c) => E.openWindows(c, DATA)) };
}
