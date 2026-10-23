/**
 * The 25 abilities (GDD-00 §16; GDD-ids §6). [DATA-SPECIES]
 *
 * Rows are pure data: `{id, name, text, ward, hook, hookParams?, tell?, ...}`. `hook` names one
 * behaviour in `battle/abilityHooks.HOOKS` (or null for an ability with no battle effect, or one the
 * engine reads from `ward`); `hookParams` tunes it. `tell` is the on-screen sign both sides can see
 * (pillar 1: every tell is shape + word, never colour alone).
 *
 * Wards (exactly three abilities, on four forms: Prismoth, Cairnward, Chillnub, Lumenveil):
 * Glasshide `strong-only`, Mirrorveil `no-status`, Stillcoat `min-power` 50. Their behaviour lives in
 * the engine's Ward check, so `hook` is null. Prismoth's old "Prism Ward" is retired into Glasshide.
 *
 * Dusksight is the one time-of-day ability: it carries no always-on hook; `nightHook` is the hook the
 * battle flow swaps in when the fight starts under night rules (18:00-06:00).
 * Pure data: imports only `./ids.js`.
 * @module data/abilities
 */

import { deepFreeze } from './ids.js';

/** Stillcoat's threshold: hits under this power do nothing (rules §8.1 estimate, kept). */
export const STILLCOAT_MIN_POWER = 50;

/** @type {ReadonlyArray<import('./index.js').Ability & Record<string, any>>} */
export const ABILITIES = deepFreeze([
  {
    id: 'shoresense', name: 'Shoresense',
    text: 'On switch-in it Reads the foe automatically. The foe\'s ability and any Ward go straight into the Field Log.',
    ward: null, hook: 'auto-read',
    tell: 'Its eyes surface first; the Read card fills in by itself.',
  },
  {
    id: 'featherbed', name: 'Featherbed',
    text: 'Halves damage from the first contact hit each battle.',
    ward: null, hook: 'soften-first-contact',
    hookParams: { mult: 0.5, text: 'Featherbed softened the hit. The fringe flattens.' },
    tell: 'The feather fringe on its near wing lies flat once it is spent.',
  },
  {
    id: 'big-sibling', name: 'Big Sibling',
    text: 'After each battle it takes part in, the lowest-level party member gets an extra 30% of its EXP. Lost if it faints.',
    ward: null, hook: 'exp-share-lowest', hookParams: { toLowest: 0.3 }, expShare: true,
    tell: 'An arrow on the EXP page points from it to the smallest of the party.',
  },
  {
    id: 'afterimage', name: 'Afterimage',
    text: 'Each evasion stage shows as a decoy (max 2). A hit that lands on a decoy pops it and deals no damage.',
    ward: null, hook: 'decoys',
    tell: 'Reflections of itself glide beside it, one per evasion stage.',
  },
  {
    id: 'unfixed', name: 'Unfixed',
    text: 'At the end of each turn its type moves to the next in a posted loop of four: Star, then three seeded types.',
    ward: null, hook: 'type-cycle',
    tell: 'The next two types hang as badges over its HP bar; one shard lights each turn.',
  },
  {
    id: 'last-ebb', name: 'Last Ebb',
    text: 'Below 25% HP its Brine and Hollow moves gain 30% power.',
    ward: null, hook: 'low-hp-type-boost', hookParams: { threshold: 0.25, mult: 1.3, types: ['Brine', 'Hollow'] },
    tell: 'Its HP bar turns sea-blue while the ebb is on.',
  },
  {
    id: 'empty-weave', name: 'Empty Weave',
    text: 'The first hit each battle that is not Strong against it deals half damage.',
    ward: null, hook: 'soften-first-non-strong',
    hookParams: { mult: 0.5, text: 'Empty Weave took the hit. The rope ring unravels.' },
    tell: 'A ring of old rope circles it until the weave is spent.',
  },
  {
    id: 'keen-glint', name: 'Keen Glint',
    text: 'Raises its crit chance two stages. Its ears glint on a turn its next hit will crit.',
    ward: null, hook: 'crit-boost', hookParams: { stages: 2, glint: true }, glint: true,
    tell: 'The ear edges glint white before a critical hit. If the ears glint, step back.',
  },
  {
    id: 'tailhum', name: 'Tailhum',
    text: 'On switch-in, reveals one foe move.',
    ward: null, hook: 'reveal-moves-on-entry', hookParams: { count: 1 },
    tell: 'The copper coil of its tail hums, and one foe move is written on the Read card.',
  },
  {
    id: 'plateshed', name: 'Plateshed',
    text: 'The first Strong hit each battle deals neutral damage, and one plate falls off.',
    ward: null, hook: 'neutralize-first-strong',
    hookParams: { text: 'Plateshed. A plate falls away and the hit lands neutral.' },
    tell: 'Count the plates: one is missing once it has been used.',
  },
  {
    id: 'skyroam', name: 'Skyroam',
    text: 'Moves one route per in-game hour. Once seen, it shows on the map. (No battle effect.)',
    ward: null, hook: null, roams: true,
  },
  {
    id: 'blank-slate', name: 'Blank Slate',
    text: 'Its Heartmark can carry any one of its techniques, chosen at its first Shift. (No battle effect.)',
    ward: null, hook: null, heartmarkChoice: true,
  },
  {
    id: 'unshifting', name: 'Unshifting',
    text: 'Cannot Shift and its type never changes. Any effect that would force a type or form change fails.',
    ward: null, hook: null, neverShifts: true, fixedType: true,
  },
  {
    id: 'furnace-jaw', name: 'Furnace Jaw',
    text: 'Its first Kiln move each battle never misses.',
    ward: null, hook: 'first-type-sure-hit', hookParams: { types: ['Kiln'] },
    tell: 'The jaw glows from inside until the first Kiln move is thrown.',
  },
  {
    id: 'glasshide', name: 'Glasshide',
    text: 'Ward. Only Strong hits land. Poison, burn and trap damage still work.',
    ward: { kind: 'strong-only' }, hook: null,
    tell: 'A hex-lattice shimmer every 4 seconds and a Ward ? badge.',
  },
  {
    id: 'mirrorveil', name: 'Mirrorveil',
    text: 'Ward. Status moves aimed at it fail. Plumbline still gets through.',
    ward: { kind: 'no-status' }, hook: null,
    tell: 'A hex-lattice shimmer every 4 seconds and a Ward ? badge.',
  },
  {
    id: 'stillcoat', name: 'Stillcoat',
    text: `Ward. Hits under ${STILLCOAT_MIN_POWER} power do nothing.`,
    ward: { kind: 'min-power', minPower: STILLCOAT_MIN_POWER }, hook: null,
    tell: 'A hex-lattice shimmer every 4 seconds and a Ward ? badge.',
  },
  {
    id: 'sodden', name: 'Sodden',
    text: 'Stops every creature on the field from using a self-KO move.',
    ward: null, hook: 'block-self-ko',
    tell: 'It drips. Anything that tries to burst just fizzles damply.',
  },
  {
    id: 'tidecall', name: 'Tidecall',
    text: 'Brine moves gain 20% power.',
    ward: null, hook: 'type-power-boost', hookParams: { types: ['Brine'], mult: 1.2 },
  },
  {
    id: 'ember-core', name: 'Ember Core',
    text: 'Kiln moves gain 20% power.',
    ward: null, hook: 'type-power-boost', hookParams: { types: ['Kiln'], mult: 1.2 },
  },
  {
    id: 'slatehide', name: 'Slatehide',
    text: 'Takes 25% less damage from physical hits.',
    ward: null, hook: 'category-damage-reduction', hookParams: { category: 'physical', mult: 0.75 },
  },
  {
    id: 'scavenger', name: 'Scavenger',
    text: 'Heals 1/8 of max HP after knocking out a foe.',
    ward: null, hook: 'heal-on-ko', hookParams: { fraction: 1 / 8 },
  },
  {
    id: 'still-mind', name: 'Still Mind',
    text: 'Cannot be numbed or chilled.',
    ward: null, hook: 'status-immunity', hookParams: { kinds: ['numb', 'chill'] },
  },
  {
    id: 'sure-footing', name: 'Sure Footing',
    text: 'Foes cannot lower its stats.',
    ward: null, hook: 'block-foreign-stat-drops',
  },
  {
    id: 'dusksight', name: 'Dusksight',
    text: 'From 18:00 to 06:00 its Hollow and Gust moves gain 20% power.',
    ward: null, hook: null,
    nightHook: { hook: 'type-power-boost', hookParams: { types: ['Hollow', 'Gust'], mult: 1.2 } },
    tell: 'After dark its eyes take the porchlight and keep it.',
  },
]);

/** Ids of the three Ward abilities. */
export const WARD_ABILITY_IDS = deepFreeze(ABILITIES.filter((a) => a.ward).map((a) => a.id));

export default ABILITIES;
