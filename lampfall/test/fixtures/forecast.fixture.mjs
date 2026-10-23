// Test fixtures for the RULES-SHIFT / RULES-CAPTURE lane (systems/forecast, systems/capture).
// Content comes from the verified battle prototype (proto/battle/*), imported, never copied into js/.
// The Sloshkin row is the creatures-doc §6.2 table (proto SLOSHKIN_SHIFT_TABLE) turned into the
// §14.2 family format with per-dial weights; the other rows are small invented tables that reach
// the edge cases (empty card, Errant, a form that never Shifts, a form with no table row).
import { SPECIES, SLOSHKIN_SHIFT_TABLE } from '../../proto/battle/species.js';
import { MOVES } from '../../proto/battle/moves.js';
import { ABILITIES } from '../../proto/battle/abilities.js';
import { TYPES } from '../../proto/battle/types.js';
import { createNewWorld } from '../../js/state/schema.js';
import { makeRng } from '../../js/core/rng.js';
import { makeCreature } from '../../js/systems/creature.js';
import { refreshPending } from '../../js/systems/exp.js';
import * as wallet from '../../js/systems/wallet.js';

const byCard = (card) => SLOSHKIN_SHIFT_TABLE.pool.filter((r) => r.card === card).map((r) => ({ form: r.form, w: { ...r.weights } }));

/** Sloshkin row straight from the creatures doc (as seen from Sloshkin). */
export const SLOSHKIN_ROW = { up: byCard('up'), side: byCard('side'), down: byCard('down') };

export const FAMILIES = [
  {
    id: 'sloshkin', name: 'sloshkin line', windows: [9, 20, 34],
    shiftTable: {
      sloshkin: SLOSHKIN_ROW,
      skeinwing: {
        up: [{ form: 'bogmonarch', w: { drift: 70, flux: 50, freefall: 34 } }, { form: 'lumenveil', w: { drift: 30, flux: 50, freefall: 33 } }, { form: 'skeinwing', w: 33 }],
        side: [{ form: 'siltback', w: 100 }],
        down: [{ form: 'sloshkin', w: { drift: 100, flux: 70, freefall: 50 } }, { form: 'puddlepip', w: { drift: 0, flux: 30, freefall: 50 } }],
      },
      puddlepip: { up: [{ form: 'sloshkin', w: 100 }], side: [{ form: 'chillnub', w: 100 }], down: [] },
    },
    star: SLOSHKIN_SHIFT_TABLE.starTouched.form,
  },
  { id: 'squallcoil', name: 'errant', shiftTable: { squallcoil: { up: [{ form: 'vesperay', w: 1 }], side: [{ form: 'brinelance', w: 1 }], down: [{ form: 'puddlepip', w: 1 }] } } },
  { id: 'vagary', name: 'comet', shiftTable: {} },
  { id: 'tossup', name: 'no table', shiftTable: {} },
  { id: 'mudfist', name: 'mudfist', shiftTable: { mudfist: { up: [], side: [], down: [] } } },
];

export const ITEMS = [
  { id: 'fx-brine-glass', name: 'Fixture Brine skyglass', pocket: 'items', tilt: 'Brine' },
  { id: 'fx-rime-glass', name: 'Fixture Rime skyglass', pocket: 'items', tilt: 'Rime' },
  { id: 'fx-knot', name: 'Fixture Knot', pocket: 'items', blocksShifts: true },
];

/** Plain-tables data. */
export const DATA = Object.freeze({ species: SPECIES, moves: MOVES, abilities: ABILITIES, types: TYPES, families: FAMILIES, items: ITEMS });

/**
 * A creature with a seeded rng.
 * @param {string} uid
 * @param {string} speciesId
 * @param {number} level
 * @param {Record<string, any>} [extra]
 */
export function mk(uid, speciesId, level, extra = {}) {
  return makeCreature({ uid, speciesId, level, rng: makeRng(`fx:${uid}:${speciesId}`), ...extra }, DATA);
}

/**
 * A world on `dial` holding one creature with an open window at Lv20 (the Lv9 window already used),
 * `starsalt` Starsalt, `anchors` stones and `badges` badges.
 * @param {{seedCode?: string, dial?: string, speciesId?: string, uid?: string, level?: number, bond?: number,
 *   starsalt?: number, anchors?: number, badges?: string[], heldItem?: string|null, challenges?: string[]}} [o]
 */
export function setup(o = {}) {
  const world = createNewWorld({ seedCode: o.seedCode ?? 'FX-SHIFT', dial: o.dial ?? 'flux', challenges: o.challenges ?? [] });
  world.run.dial = o.dial ?? 'flux';
  const c = mk(o.uid ?? 'c1', o.speciesId ?? 'sloshkin', o.level ?? 20);
  c.windowsUsed = [9];
  c.bond = o.bond ?? 0;
  c.heldItem = o.heldItem ?? null;
  world.party.push(c);
  world.badges = o.badges ?? ['spire-1'];
  if (o.starsalt) wallet.earn(world, o.starsalt, { currency: 'starsalt' });
  if (o.anchors) wallet.earn(world, o.anchors, { currency: 'anchors' });
  refreshPending(world, c.uid, DATA);
  return { world, c };
}

/** Records every emitted event as [name, payload]. */
export function spyBus() {
  const events = [];
  return { events, bus: { emit: (evt, payload) => events.push([evt, payload]) } };
}

export { makeRng, SPECIES };
