/**
 * ENCOUNTERS: every encounter table by id, merged from the per-region files (GDD-01 §6). [DATA-MAPS]
 *
 * Add a region file here; ids must be unique across files (a duplicate throws at import) and come
 * from `ids.manifest.ENCOUNTER_IDS` (extras are allowed there; list new ones in GDD-01 §8).
 * @module data/encounters/index
 */

import { PELLWICK_ENCOUNTERS } from './pellwick.js';
import { ISLE_ENCOUNTERS } from './isles.js';

/**
 * Merges region tables, refusing duplicate ids.
 * @param {...Record<string, ReadonlyArray<any>>} parts
 * @returns {Readonly<Record<string, ReadonlyArray<import('../index.js').EncounterRow>>>}
 */
function merge(...parts) {
  const out = {};
  for (const part of parts) {
    for (const [id, rows] of Object.entries(part)) {
      if (Object.hasOwn(out, id)) throw new Error(`data/encounters: table '${id}' is defined twice`);
      out[id] = rows;
    }
  }
  return Object.freeze(out);
}

/** @type {Readonly<Record<string, ReadonlyArray<import('../index.js').EncounterRow>>>} */
export const ENCOUNTERS = merge(PELLWICK_ENCOUNTERS, ISLE_ENCOUNTERS);

export default ENCOUNTERS;
