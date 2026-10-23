// Battle test fixture: the verified prototype tables (proto/battle/*.js) reshaped into the
// content contract js/battle consumes (ARCHITECTURE §14.1-14.3, §5.1 change 2). The proto
// folder stays the source of truth for these numbers; nothing here is copied into js/.
import { TYPE_CHART, ORDINARY_TYPES, TYPES } from '../../../proto/battle/types.js';
import { MOVE_LIST } from '../../../proto/battle/moves.js';
import { ABILITY_LIST } from '../../../proto/battle/abilities.js';
import { SPECIES_LIST } from '../../../proto/battle/species.js';

/**
 * Prototype ability id -> hook key + params (the hook functions now live in
 * js/battle/abilityHooks.js; rows are pure data).
 */
const HOOK_OF = {
  shoresense: { hook: 'auto-read' },
  featherbed: { hook: 'soften-first-contact', hookParams: { mult: 0.5, text: 'Featherbed softened the hit. The fringe flattens.' } },
  'big-sibling': { hook: 'exp-share-lowest', hookParams: { toLowest: 0.3 } },
  'prism-ward': { hook: null },
  afterimage: { hook: 'decoys' },
  unfixed: { hook: 'type-cycle' },
  'last-ebb': { hook: 'low-hp-type-boost', hookParams: { threshold: 0.25, mult: 1.3, types: ['Brine', 'Hollow'] } },
  'empty-weave': { hook: 'soften-first-non-strong', hookParams: { mult: 0.5, text: 'Empty Weave took the hit. The rope ring unravels.' } },
  'keen-glint': { hook: 'crit-boost', hookParams: { stages: 2, glint: true } },
  tailhum: { hook: 'reveal-moves-on-entry', hookParams: { count: 1 } },
  plateshed: { hook: 'neutralize-first-strong', hookParams: { text: 'Plateshed. A plate falls away and the hit lands neutral.' } },
  skyroam: { hook: null },
  'blank-slate': { hook: null },
  unshifting: { hook: null },
  'furnace-jaw': { hook: 'first-type-sure-hit', hookParams: { types: ['Kiln'] } },
  glasshide: { hook: null },
  mirrorveil: { hook: null },
  stillcoat: { hook: null },
  sodden: { hook: 'block-self-ko' },
  tidecall: { hook: 'type-power-boost', hookParams: { types: ['Brine'], mult: 1.2 } },
  'ember-core': { hook: 'type-power-boost', hookParams: { types: ['Kiln'], mult: 1.2 } },
  slatehide: { hook: 'category-damage-reduction', hookParams: { category: 'physical', mult: 0.75 } },
  scavenger: { hook: 'heal-on-ko', hookParams: { fraction: 1 / 8 } },
  'still-mind': { hook: 'status-immunity', hookParams: { kinds: ['numb', 'chill'] } },
  'sure-footing': { hook: 'block-foreign-stat-drops' },
};

/** Ability rows in the data contract `{id, name, text, ward, hook, hookParams?}`. */
export const ABILITIES = Object.freeze(ABILITY_LIST.map((a) => {
  const h = HOOK_OF[a.id];
  if (!h) throw new Error(`fixture: no hook mapping for ${a.id}`);
  return Object.freeze({ id: a.id, name: a.name, text: a.text, ward: a.ward ? { ...a.ward } : null, hook: h.hook, ...(h.hookParams ? { hookParams: h.hookParams } : {}) });
}));

/** Species rows in the §14.1 contract (`learnset: [[level, moveId]]`, `familyId`). */
export const SPECIES = Object.freeze(SPECIES_LIST.map((s) => Object.freeze({
  id: s.id, name: s.name, types: s.types.slice(), familyId: s.family, stage: s.stage, base: { ...s.base }, ability: s.ability,
  learnset: s.learnset.map((e) => [e.level, e.move]), heartmark: s.heartmark, catchRate: s.catchRate, expYield: s.expYield, growth: s.growth,
  flags: { ...s.flags },
})));

/** Move rows (unchanged shape). */
export const MOVES = MOVE_LIST;

/** The type table: chart + Ward-readout types + the type rules that used to be hard-coded in the engine. */
export const TYPE_DATA = Object.freeze({
  names: TYPES,
  chart: TYPE_CHART,
  ordinary: ORDINARY_TYPES,
  statusImmunity: Object.freeze({ burn: 'Kiln', chill: 'Rime', poison: 'Rust', numb: 'Bolt' }),
  cures: Object.freeze([Object.freeze({ type: 'Kiln', status: 'chill' })]),
});

/** The injected battle data. */
export const DATA = Object.freeze({ species: SPECIES, moves: MOVES, abilities: ABILITIES, types: TYPE_DATA });
