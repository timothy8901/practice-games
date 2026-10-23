/**
 * Every creature form and family (GDD-00 §8: 42 forms = 40 in 14 Shift families + Stillox + the
 * Vagary; GDD-03). [DATA-SPECIES]
 *
 * Each `<family>.js` exports `{forms, family}` (ARCHITECTURE §8.4, §14.1-§14.2). This index merges
 * them in manifest order into the two DATA tables, `SPECIES` (42 rows) and `FAMILIES` (16 rows), and
 * keeps the small pure learnset helpers the prototype kept beside its species list.
 *
 * Species flags this chapter fills (all optional to the engine): `roleTag`, `sprite` ('drawn' |
 * 'brief'), `size`, `palette` (planned master-palette keys), `heartmarkHighlight`, `heartmarkAnchors`
 * `{head, chest, back, tail}` in sprite pixels, `feature` (the one spot-able feature), `idle`,
 * `mustNotReadAs`, `habitat`, `log` (Field Log entry), `teachable` (disc moves it can be taught), and
 * the engine-read flags `hpMultiplier`, `neverShifts`, `errant`, `starTouched`.
 * Pure data: imports only sibling data files.
 * @module data/species
 */

import { deepFreeze } from '../ids.js';
import * as sloshkin from './sloshkin.js';
import * as scrapling from './scrapling.js';
import * as sedgehare from './sedgehare.js';
import * as prismoth from './prismoth.js';
import * as vesperay from './vesperay.js';
import * as bilgebob from './bilgebob.js';
import * as creelwight from './creelwight.js';
import * as wirewhisk from './wirewhisk.js';
import * as rimeplate from './rimeplate.js';
import * as caldermaw from './caldermaw.js';
import * as rillfin from './rillfin.js';
import * as tossup from './tossup.js';
import * as errant from './errant.js';
import * as duskowl from './duskowl.js';
import * as stillox from './stillox.js';
import * as vagary from './vagary.js';

/** The family modules, in manifest order (`FAMILY_IDS`). */
export const FAMILY_MODULES = Object.freeze([
  sloshkin, scrapling, sedgehare, prismoth, vesperay, bilgebob, creelwight, wirewhisk,
  rimeplate, caldermaw, rillfin, tossup, errant, duskowl, stillox, vagary,
]);

/** Field Log order: GDD-00 §8 roster order (manifest `SPECIES_IDS`). */
const ORDER = [
  'puddlepip', 'sloshkin', 'siltback', 'skeinwing', 'bogmonarch', 'scrapling', 'mudfist', 'knuckleback',
  'cragmitt', 'reedkit', 'rushling', 'sedgehare', 'mothling', 'prismoth', 'cairnward', 'lumenveil',
  'rayling', 'vesperay', 'bilgebob', 'brinelance', 'rustcreel', 'creelwight', 'hulkwight', 'wirewhisk',
  'coilcrest', 'chillnub', 'rimeplate', 'floeback', 'sootling', 'emberjaw', 'caldermaw', 'rillfin',
  'gillwick', 'strandrunner', 'tossup', 'squallcoil', 'hailcoil', 'skirl', 'duskwisp', 'duskowl',
  'stillox', 'vagary',
];

const ALL_FORMS = FAMILY_MODULES.flatMap((m) => m.forms);
const RANK = new Map(ORDER.map((id, i) => [id, i]));

/** The 42 species rows (DATA.species), in Field Log order. @type {ReadonlyArray<import('../index.js').Species>} */
export const SPECIES = deepFreeze(ALL_FORMS.slice().sort((a, b) => (RANK.get(a.id) ?? 99) - (RANK.get(b.id) ?? 99)));

/** The 16 family rows (DATA.families). @type {ReadonlyArray<import('../index.js').Family>} */
export const FAMILIES = deepFreeze(FAMILY_MODULES.map((m) => m.family));

/** Species by id. */
export const SPECIES_BY_ID = deepFreeze(Object.fromEntries(SPECIES.map((s) => [s.id, s])));

/** Families by id. */
export const FAMILIES_BY_ID = deepFreeze(Object.fromEntries(FAMILIES.map((f) => [f.id, f])));

/**
 * Moves a form learns by `level`, in learn order, de-duplicated.
 * @param {import('../index.js').Species} s  @param {number} level
 * @returns {string[]}
 */
export function learnableAt(s, level) {
  const out = [];
  for (const [lv, mv] of s.learnset) if (lv <= level && !out.includes(mv)) out.push(mv);
  return out;
}

/**
 * Whether a form's level-up learnset contains a move.
 * @param {import('../index.js').Species} s  @param {string} moveId
 * @returns {boolean}
 */
export function canLearn(s, moveId) {
  return s.learnset.some((r) => r[1] === moveId);
}

/**
 * Whether a technique disc can teach this form a move: its learnset or its `flags.teachable` list.
 * @param {import('../index.js').Species} s  @param {string} moveId
 * @returns {boolean}
 */
export function canBeTaught(s, moveId) {
  return canLearn(s, moveId) || (Array.isArray(s.flags.teachable) && s.flags.teachable.includes(moveId));
}

export default SPECIES;
