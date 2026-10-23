/**
 * Isle encounter tables: the six isles, the Bar's tide pools and the Lantern Stack perch (GDD-00 §2-§4,
 * §8; GDD-01 §6.3). [DATA-MAPS]
 *
 * One `<isle>-land` table (stepped into on tall grass / reeds / heather / thistles, the flats at Lowmoor,
 * the mirror-ice caves at Rimeholt) and one `<isle>-water` table (hooked on the isle's two reaches through
 * `reaches[].creatureTable`, never stepped) per isle region. Row format ARCHITECTURE §14.11 as
 * `systems/encounter` reads it:
 *  - `levels` are the DAY band, inside the region's posted wild band (GDD-00 §4). `systems/encounter` adds
 *    `encounterNightLevelBonus` (+2) at night (18:00-06:00): it is NOT written in here.
 *  - `mods` multiply `w` by day/night, the tide state (`low`/`rising`/`high`/`falling`) and the weather
 *    (`clear`/`overcast`/`rain`/`fog`/`storm`). The night tables lean Hollow, Glass and Rime; high tide
 *    brings Brine (GDD-00 §5). No form is exclusive to night or a tide (every night-leaning row keeps a day
 *    weight > 0 here or a day home on another isle).
 *  - Wards (Prismoth, Cairnward, Chillnub, Lumenveil) appear from Cairnhold on, never before (GDD-00 §8).
 *  - Errants (`errant: true`) never join the weighted pick. `roam: 'route'` rows are Skyroam routes: the
 *    Errant sits on one of the tables that list it and moves one table per game hour (GDD-00 §8).
 *    Squallcoil, the first Errant, roams from Emberstep onward (Emberstep, Drownwood, Thistlewind,
 *    Rimeholt); Hailcoil roams Rimeholt only. Their rows sit a level or two over the band: an Errant is a
 *    challenge (~22% start odds with a Tallow wick).
 *  - Lowmoor's starter rows: the two starters you did not pick live on Lowmoor from day 2 at ~15% each
 *    (GDD-00 §3); the row for a form you already hold drops out (`fieldLog ... held`).
 * @module data/encounters/isles
 */

/**
 * One frozen encounter row.
 * @param {string} species @param {number} lo @param {number} hi @param {number} w
 * @param {Record<string, number>} [mods] @param {object} [extra]
 */
const r = (species, lo, hi, w, mods, extra) => Object.freeze({ species, levels: Object.freeze([lo, hi]), w, ...(mods ? { mods: Object.freeze(mods) } : {}), ...extra });

/** A Skyroam route row for an Errant. */
const errant = (species, lo, hi) => r(species, lo, hi, 1, undefined, { errant: true, roam: 'route' });

/** The starter rows' gate: from day 2, and only while that form is not already held. */
const notHeld = (form) => Object.freeze({ all: [{ day: { gte: 2 } }, { not: { fieldLog: { form, state: 'held' } } }] });

/** @type {Readonly<Record<string, ReadonlyArray<import('../index.js').EncounterRow>>>} */
export const ISLE_ENCOUNTERS = Object.freeze({
  // ---- Lowmoor, Lv3-8: meadows, reed beds, the Brackenford flats -----------------------------------
  'lowmoor-land': Object.freeze([
    r('tossup', 3, 6, 18, { night: 0.7 }),
    r('puddlepip', 3, 5, 12, { high: 1.6, rising: 1.3, low: 0.7, rain: 1.3 }),
    r('wirewhisk', 4, 7, 10, { night: 0.5, rain: 1.5, storm: 2 }),
    r('mudfist', 5, 8, 9, { low: 1.4, high: 0.7 }),
    r('rushling', 4, 7, 5, { high: 1.5, night: 0.7 }),
    r('duskwisp', 3, 5, 4, { day: 0.2, night: 2.2, fog: 1.5 }),
    r('sloshkin', 3, 6, 15, { high: 1.2 }, { cond: notHeld('sloshkin') }),
    r('scrapling', 3, 6, 15, { low: 1.2 }, { cond: notHeld('scrapling') }),
    r('reedkit', 3, 6, 15, { rain: 1.2 }, { cond: notHeld('reedkit') }),
  ]),
  'lowmoor-water': Object.freeze([
    r('bilgebob', 4, 8, 45, { high: 1.5, low: 0.7 }),
    r('rillfin', 3, 7, 25, { high: 1.6, rising: 1.3, low: 0.5 }),
    r('rushling', 4, 8, 20, { day: 1.2, night: 0.7 }),
    r('puddlepip', 3, 6, 10, { rain: 1.5 }),
  ]),

  // ---- Cairnhold, Lv9-14: the quarry, the standing stones; the first Wards -------------------------
  'cairnhold-land': Object.freeze([
    r('mothling', 9, 12, 18, { day: 0.5, night: 1.8 }),
    r('prismoth', 11, 14, 12, { day: 0.6, night: 1.6, fog: 1.3 }),
    r('chillnub', 9, 13, 16, { night: 1.3, fog: 1.2 }),
    r('tossup', 9, 12, 16, { night: 0.7 }),
    r('mudfist', 10, 13, 14, { day: 1.2, night: 0.8 }),
    r('wirewhisk', 9, 12, 8, { rain: 1.4, storm: 2 }),
    r('rushling', 10, 13, 6, { high: 1.6, low: 0.6 }),
    r('knuckleback', 13, 14, 4, { day: 1.2 }),
    r('cairnward', 13, 14, 3, { day: 0.7, night: 1.5 }),
  ]),
  'cairnhold-water': Object.freeze([
    r('bilgebob', 10, 14, 40, { high: 1.4, low: 0.7 }),
    r('rillfin', 9, 13, 25, { high: 1.5, rising: 1.2 }),
    r('rushling', 9, 13, 20, { day: 1.2 }),
    r('chillnub', 9, 12, 15, { night: 1.4, fog: 1.2 }),
  ]),

  // ---- Emberstep, Lv15-20: the volcano, the spa terraces; Squallcoil's first route ------------------
  'emberstep-land': Object.freeze([
    r('sootling', 15, 19, 30, { day: 1.2, night: 0.8, rain: 0.6 }),
    r('sedgehare', 16, 20, 24, { day: 1.2 }),
    r('tossup', 15, 18, 12, { night: 0.7 }),
    r('rushling', 15, 18, 10, { high: 1.5, low: 0.7 }),
    r('mothling', 15, 18, 8, { day: 0.3, night: 2 }),
    r('wirewhisk', 15, 18, 6, { rain: 1.5, storm: 2.5 }),
    r('prismoth', 17, 20, 4, { day: 0.3, night: 2 }),
    r('emberjaw', 19, 20, 4, { day: 1.2 }),
    errant('squallcoil', 20, 22),
  ]),
  'emberstep-water': Object.freeze([
    r('rayling', 15, 20, 50, { high: 1.3 }),
    r('bilgebob', 15, 19, 20, { high: 1.4, low: 0.7 }),
    r('rillfin', 15, 18, 15, { high: 1.4, rising: 1.2 }),
    r('gillwick', 18, 20, 5, { night: 1.3 }),
  ]),

  // ---- Drownwood, Lv22-27: the drowned forest, the stilt town, the drowning street ------------------
  'drownwood-land': Object.freeze([
    r('rustcreel', 22, 26, 26, { low: 1.3 }),
    r('duskwisp', 22, 27, 22, { day: 0.6, night: 1.6, fog: 1.5 }),
    r('rushling', 22, 26, 20, { high: 1.5, low: 0.7 }),
    r('bilgebob', 22, 25, 10, { high: 1.6, low: 0.6, rain: 1.2 }),
    r('creelwight', 25, 27, 8, { day: 0.5, night: 2 }),
    r('siltback', 24, 27, 4, { low: 1.5 }),
    errant('squallcoil', 26, 28),
  ]),
  'drownwood-water': Object.freeze([
    r('bilgebob', 22, 27, 35, { high: 1.4 }),
    r('rushling', 22, 26, 25, { day: 1.2 }),
    r('rustcreel', 22, 26, 20, { low: 1.3 }),
    r('creelwight', 24, 27, 12, { day: 0.5, night: 2 }),
    r('brinelance', 25, 27, 4, { high: 1.5 }),
  ]),

  // ---- Thistlewind, Lv29-34: the moor, the windmills ------------------------------------------------
  'thistlewind-land': Object.freeze([
    r('skirl', 29, 33, 28, { day: 1.1 }),
    r('wirewhisk', 29, 32, 14, { rain: 1.4, storm: 1.8 }),
    r('tossup', 29, 32, 12, { night: 0.7 }),
    r('duskowl', 31, 34, 12, { day: 0.5, night: 1.8 }),
    r('coilcrest', 32, 34, 10, { rain: 1.4, storm: 2 }),
    r('knuckleback', 30, 33, 10, { day: 1.2 }),
    r('duskwisp', 29, 32, 8, { day: 0.3, night: 1.8, fog: 1.5 }),
    r('gillwick', 30, 33, 4, { high: 1.6, rain: 1.3 }),
    r('stillox', 34, 34, 2),
    errant('squallcoil', 32, 34),
  ]),
  'thistlewind-water': Object.freeze([
    r('gillwick', 29, 34, 45, { day: 1.1 }),
    r('rillfin', 29, 32, 25, { high: 1.4, rising: 1.2 }),
    r('bilgebob', 29, 33, 20, { high: 1.4, low: 0.7 }),
    r('strandrunner', 33, 34, 5, { high: 1.5 }),
  ]),

  // ---- Rimeholt, Lv36-41: the glacier, the mirror-ice caves; Hailcoil --------------------------------
  'rimeholt-land': Object.freeze([
    r('rimeplate', 36, 40, 30, { night: 1.2 }),
    r('chillnub', 36, 39, 18, { night: 1.3, fog: 1.2 }),
    r('floeback', 39, 41, 10, { night: 1.4 }),
    r('strandrunner', 38, 41, 10, { high: 1.6, low: 0.7 }),
    r('cragmitt', 38, 41, 8, { day: 1.2 }),
    r('prismoth', 36, 39, 8, { day: 0.4, night: 1.8 }),
    r('lumenveil', 40, 41, 5, { day: 0.5, night: 1.8, fog: 1.5 }),
    errant('hailcoil', 40, 42),
    errant('squallcoil', 38, 40),
  ]),
  'rimeholt-water': Object.freeze([
    r('strandrunner', 38, 41, 30, { high: 1.4 }),
    r('brinelance', 37, 41, 25, { night: 1.3 }),
    r('gillwick', 36, 40, 20, { day: 1.1 }),
    r('floeback', 38, 41, 15, { night: 1.3 }),
    r('bilgebob', 36, 40, 10, { high: 1.3 }),
  ]),

  // ---- The Bar, Lv40-44: the tide pools beside the Long Road (walkable around low water) ---------------
  'the-bar-pools': Object.freeze([
    r('strandrunner', 40, 44, 22, { high: 1.3 }),
    r('brinelance', 40, 44, 20, { night: 1.2 }),
    r('creelwight', 40, 43, 14, { day: 0.6, night: 1.8 }),
    r('gillwick', 40, 43, 14),
    r('hulkwight', 42, 44, 8, { day: 0.6, night: 1.5 }),
    r('floeback', 41, 44, 8, { night: 1.2 }),
    r('vesperay', 42, 44, 6, { day: 0.6, night: 1.6 }),
    r('bogmonarch', 43, 44, 3, { low: 1.3 }),
  ]),

  // ---- The Lantern Stack: the Passenger's perch after the Reading (the story gates the encounter) ------
  'lantern-stack-perch': Object.freeze([r('vagary', 50, 50, 1)]),
});

export default ISLE_ENCOUNTERS;
