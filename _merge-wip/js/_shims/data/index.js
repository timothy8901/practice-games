/** SHIM for js/data/index.js [DATA-IDX]. Delete at integration. Empty tables, frozen. */
import { DIALS } from './dials.js';

/** Every content table by name. Arrays are id-keyed rows; `dials` is the rule table object. */
export const DATA = Object.freeze({
  types: Object.freeze([]),
  moves: Object.freeze([]),
  abilities: Object.freeze([]),
  species: Object.freeze([]),
  families: Object.freeze([]),
  items: Object.freeze([]),
  loans: Object.freeze([]),
  shops: Object.freeze([]),
  dials: DIALS,
  trainers: Object.freeze([]),
  npcs: Object.freeze([]),
  schedules: Object.freeze([]),
  threads: Object.freeze([]),
  letters: Object.freeze([]),
  scripts: Object.freeze([]),
  maps: Object.freeze([]),
  tilesets: Object.freeze([]),
  encounters: Object.freeze([]),
  collections: Object.freeze([]),
  credits: Object.freeze([]),
});
