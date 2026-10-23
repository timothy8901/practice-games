/**
 * Isle encounter tables: SKELETON for the isle author (GDD-01 §6). [DATA-MAPS]
 *
 * Every isle table id from `ids.manifest.ENCOUNTER_IDS` is present so the manifest check passes and
 * the isle maps can name their spawns today. Each holds a minimal unconditional starter set drawn
 * from that isle's "Holds" column in GDD-00 §4 at its wild band; the isle author replaces the rows
 * (day/night/tide `mods`, Errant `roam` routes, rarities) and keeps the ids. Format and the night
 * +2 rule as in `encounters/pellwick.js`.
 * @module data/encounters/isles
 */

/** @param {string} species @param {number} lo @param {number} hi @param {number} w @param {object} [extra] */
const r = (species, lo, hi, w, extra) => Object.freeze({ species, levels: [lo, hi], w, ...extra });

/** @type {Readonly<Record<string, ReadonlyArray<import('../index.js').EncounterRow>>>} */
export const ISLE_ENCOUNTERS = Object.freeze({
  // Lowmoor 3-8: the two starters you did not pick are wild on the Brackenford flats (15% each).
  'lowmoor-land': Object.freeze([r('sloshkin', 3, 8, 15), r('scrapling', 3, 8, 15), r('reedkit', 3, 8, 15), r('tossup', 3, 6, 20), r('puddlepip', 3, 5, 15), r('wirewhisk', 4, 8, 10), r('mudfist', 5, 8, 10)]),
  'lowmoor-water': Object.freeze([r('bilgebob', 4, 8, 50), r('rillfin', 3, 7, 30), r('rushling', 4, 8, 20)]),
  // Cairnhold 9-14: the first Wards (none before here).
  'cairnhold-land': Object.freeze([r('mothling', 9, 13, 30), r('prismoth', 11, 14, 20), r('chillnub', 9, 13, 25), r('tossup', 9, 12, 22), r('cairnward', 13, 14, 3)]),
  'cairnhold-water': Object.freeze([r('bilgebob', 10, 14, 50), r('rillfin', 9, 13, 30), r('rushling', 9, 13, 20)]),
  // Emberstep 15-20: Squallcoil (the first Errant) roams from here.
  'emberstep-land': Object.freeze([r('sootling', 15, 19, 35), r('sedgehare', 16, 20, 30), r('tossup', 15, 18, 20), r('emberjaw', 19, 20, 5), r('squallcoil', 20, 22, 1, { errant: true, roam: 'route' })]),
  'emberstep-water': Object.freeze([r('rayling', 15, 20, 60), r('bilgebob', 15, 19, 25), r('rillfin', 15, 18, 15)]),
  // Drownwood 22-27.
  'drownwood-land': Object.freeze([r('rustcreel', 22, 26, 30), r('duskwisp', 22, 27, 25), r('rushling', 22, 26, 25), r('creelwight', 25, 27, 10)]),
  'drownwood-water': Object.freeze([r('bilgebob', 22, 27, 40), r('rushling', 22, 26, 30), r('rustcreel', 22, 26, 20)]),
  // Thistlewind 29-34.
  'thistlewind-land': Object.freeze([r('skirl', 29, 33, 35), r('wirewhisk', 29, 32, 20), r('tossup', 29, 32, 18), r('duskowl', 31, 34, 15), r('coilcrest', 32, 34, 10), r('stillox', 34, 34, 2)]),
  'thistlewind-water': Object.freeze([r('gillwick', 29, 34, 50), r('rillfin', 29, 32, 30), r('bilgebob', 29, 33, 20)]),
  // Rimeholt 36-41: Hailcoil (Errant).
  'rimeholt-land': Object.freeze([r('rimeplate', 36, 40, 35), r('chillnub', 36, 39, 30), r('floeback', 39, 41, 10), r('lumenveil', 40, 41, 5), r('hailcoil', 41, 43, 1, { errant: true, roam: 'route' })]),
  'rimeholt-water': Object.freeze([r('strandrunner', 38, 41, 30), r('gillwick', 36, 40, 30), r('brinelance', 37, 41, 20), r('bilgebob', 36, 40, 20)]),
  // The Bar 40-44: the tide pools among the wreck ribs.
  'the-bar-pools': Object.freeze([r('strandrunner', 40, 44, 25), r('brinelance', 40, 44, 25), r('creelwight', 40, 44, 15), r('gillwick', 40, 44, 15), r('hulkwight', 42, 44, 10), r('vesperay', 42, 44, 10)]),
  // The Lantern Stack: the Passenger's perch after the Reading (spawn/roamer gated by the story).
  'lantern-stack-perch': Object.freeze([r('vagary', 50, 50, 1)]),
});

export default ISLE_ENCOUNTERS;
