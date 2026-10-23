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

/** Which tables are real content (true) and which still fall back to placeholders (false). */
export const CONTENT_STATUS = Object.freeze({
  letters: true, threads: true, credits: true,
  types: false, moves: false, abilities: false, species: false, families: false,
  items: false, loans: false, shops: false, dials: false, challenges: false, trainers: false,
  npcs: false, schedules: false, scripts: false, eventScripts: false,
  maps: false, tilesets: false, regions: false, encounters: false, collections: false,
});

export const DATA_CONTENT = deepFreeze({
  ...PLACEHOLDER,
  letters: LETTERS,
  threads: THREADS,
  scripts: { ...PLACEHOLDER.scripts, ...THREAD_SCRIPTS },
  credits: CREDITS,
});

export default DATA_CONTENT;
