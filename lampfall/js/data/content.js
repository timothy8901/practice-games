/**
 * DATA_CONTENT: the staging index for the real content chapters. [DATA-IDX, orchestrator-owned]
 *
 * js/data/index.js stays on the day-1 placeholders until every chapter has landed, so lanes that are
 * still working keep a green validator. This module assembles the same DATA shape from the real
 * chapter tables as they arrive (falling back to the placeholder table for chapters not written yet)
 * and is validated by `node tools/validate-content.mjs`. When every table here is real, js/data/index.js
 * re-exports this module and the placeholders are deleted.
 * @module data/content
 */

import { deepFreeze } from './ids.js';
import { DATA as PLACEHOLDER } from './index.js';
// GDD-08 letters and life threads
import { LETTERS } from './letters/index.js';
import { THREADS, THREAD_SCRIPTS } from './threads/index.js';
import { CREDITS } from './credits.js';
// GDD-02 economy
import { ITEMS } from './items.js';
import { LOANS, COMMISSIONS, COMMONS } from './loans.js';
import { SHOPS } from './shops.js';
import { DIALS, CHALLENGES, TOGGLE_ORDER } from './dials.js';
// GDD-03 creatures and GDD-04 battle
import { TYPES } from './types.js';
import { ABILITIES } from './abilities.js';
import { SPECIES, FAMILIES } from './species/index.js';
import { MOVES } from './moves/index.js';
import { TRAINERS, TRAINER_SCRIPTS } from './trainers.js';
import { SPIRES } from './spires.js';
// GDD-01 world
import { TILESETS } from './tilesets.js';
import { MAPS } from './maps/index.js';
import { ENCOUNTERS } from './encounters/index.js';
import { REGIONS } from './regions.js';
// GDD-05 town life
import { COLLECTIONS } from './collections.js';
import { FESTIVALS, WEATHER } from './town.js';

/** Which tables are real content (true) and which still fall back to placeholders (false). */
export const CONTENT_STATUS = Object.freeze({
  letters: true, threads: true, credits: true,
  items: true, loans: true, commissions: true, commons: true, shops: true, dials: true, challenges: true,
  collections: true, festivals: true, weather: true,
  types: true, moves: true, abilities: true, species: true, families: true, trainers: true, spires: true,
  npcs: false, schedules: false, scripts: false, eventScripts: false,
  maps: true, tilesets: true, regions: true, encounters: true,
});

export const DATA_CONTENT = deepFreeze({
  ...PLACEHOLDER,
  letters: LETTERS,
  threads: THREADS,
  scripts: { ...PLACEHOLDER.scripts, ...THREAD_SCRIPTS, ...TRAINER_SCRIPTS },
  credits: CREDITS,
  items: ITEMS,
  loans: LOANS,
  commissions: COMMISSIONS,
  commons: COMMONS,
  shops: SHOPS,
  dials: DIALS,
  challenges: CHALLENGES,
  toggleOrder: TOGGLE_ORDER,
  collections: COLLECTIONS,
  festivals: FESTIVALS,
  weather: WEATHER,
  types: TYPES,
  abilities: ABILITIES,
  species: SPECIES,
  families: FAMILIES,
  moves: MOVES,
  trainers: TRAINERS,
  spires: SPIRES,
  tilesets: TILESETS,
  maps: MAPS,
  encounters: ENCOUNTERS,
  regions: REGIONS,
});

export default DATA_CONTENT;
