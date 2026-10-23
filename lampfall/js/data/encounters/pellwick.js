/**
 * Pellwick's encounter tables (GDD-00 §4: the reed edges are the only wild encounters in town,
 * Lv2-5; §2 lit.calls: Errants come to the lit point at night; §9: any reach can hook a wild
 * Bilgebob, Creelwight or Rushling). Row format ARCHITECTURE §14.11 + `systems/encounter`:
 *  - `levels` are the DAY band; `systems/encounter` adds `encounterNightLevelBonus` (+2) at night
 *    (18:00-06:00), so night-leaning rows are written low ([2, 3] -> Lv4-5 at night).
 *  - `mods` multiply `w` by day/night, tide state and weather (`{day, night, low, rising, high,
 *    falling, <weather>}`): the night table leans Hollow / Glass, high tide brings Brine (GDD-00 §5).
 *  - Errant rows (`errant: true, roam: 'lit'`) never join the weighted pick; the lit point shares one
 *    `errantLitChance` (1 in 120) roll at night while `lit.calls` holds.
 * No form here is exclusive to night or a tide: each also lives by day on an isle (GDD-00 §4).
 * @module data/encounters/pellwick
 */

/** @type {Readonly<Record<string, ReadonlyArray<import('../index.js').EncounterRow & {mods?: Record<string, number>, roam?: string}>>>} */
export const PELLWICK_ENCOUNTERS = Object.freeze({
  // The reed edges: the marsh delta, the river margins by Pell's and below the bridge, the marsh
  // foot under the point. Corin's Capture Stance lesson meets a Tossup here (scripted, Lv4).
  'pellwick-reeds': Object.freeze([
    // Town wilds stay inside GDD-00 §4's Lv2-5 at every hour: the encounter system adds +2 at night,
    // so each row that can roll after dark is split into a day row (its full range, mods.night 0) and a
    // night copy capped at Lv2-3 (mods.day 0) that lands on Lv4-5 with the bonus. Night weights are the
    // old day weight x the old night factor, so the mix by hour is unchanged.
    Object.freeze({ species: 'tossup', levels: [2, 5], w: 30, mods: { night: 0 } }),
    Object.freeze({ species: 'tossup', levels: [2, 3], w: 18, mods: { day: 0 } }),
    Object.freeze({ species: 'puddlepip', levels: [2, 4], w: 18, mods: { night: 0, high: 1.8, rising: 1.3, low: 0.6, rain: 1.25 } }),
    Object.freeze({ species: 'puddlepip', levels: [2, 3], w: 18, mods: { day: 0, high: 1.8, rising: 1.3, low: 0.6, rain: 1.25 } }),
    Object.freeze({ species: 'wirewhisk', levels: [3, 5], w: 16, mods: { night: 0, rain: 1.5, storm: 2 } }),
    Object.freeze({ species: 'wirewhisk', levels: [2, 3], w: 6, mods: { day: 0, rain: 1.5, storm: 2 } }),
    Object.freeze({ species: 'rushling', levels: [2, 4], w: 12, mods: { night: 0, high: 1.5 } }),
    Object.freeze({ species: 'rushling', levels: [2, 3], w: 6, mods: { day: 0, high: 1.5 } }),
    Object.freeze({ species: 'rillfin', levels: [2, 4], w: 10, mods: { night: 0, high: 2, rising: 1.4, low: 0.4 } }),
    Object.freeze({ species: 'rillfin', levels: [2, 3], w: 10, mods: { day: 0, high: 2, rising: 1.4, low: 0.4 } }),
    Object.freeze({ species: 'duskwisp', levels: [2, 3], w: 14, mods: { day: 0.15, night: 1.6, fog: 1.5 } }),
    Object.freeze({ species: 'skirl', levels: [2, 3], w: 10, mods: { day: 0.4, night: 1.2 } }),
    Object.freeze({ species: 'mothling', levels: [2, 3], w: 6, mods: { day: 0.1, night: 1.5 } }),
  ]),
  // Hooked on any of the four reaches (fishing `reaches[].creatureTable`), never stepped into.
  'pellwick-reach': Object.freeze([
    Object.freeze({ species: 'bilgebob', levels: [3, 5], w: 50, mods: { high: 1.5, low: 0.7 } }),
    Object.freeze({ species: 'rushling', levels: [3, 5], w: 30, mods: { day: 1.2, night: 0.7 } }),
    Object.freeze({ species: 'creelwight', levels: [4, 5], w: 10, mods: { day: 0.5, night: 2 } }),
  ]),
  // The lit point at night after the Relighting (spawn gated on lit.calls + dusk/evening/night). Night-only,
  // so rows are written at Lv2-3: the +2 night bonus puts them on the town's Lv4-5 ceiling. The Errants
  // keep their route levels and roll at the system's errantLitChance (1 in 120), not by weight.
  'pellwick-point-night': Object.freeze([
    Object.freeze({ species: 'duskwisp', levels: [2, 3], w: 40 }),
    Object.freeze({ species: 'skirl', levels: [2, 3], w: 30 }),
    Object.freeze({ species: 'mothling', levels: [2, 3], w: 30 }),
    Object.freeze({ species: 'duskowl', levels: [3, 3], w: 19 }),
    Object.freeze({ species: 'squallcoil', levels: [30, 34], w: 1, errant: true, roam: 'lit', cond: { flag: 'lit.calls' } }),
    Object.freeze({ species: 'hailcoil', levels: [38, 41], w: 1, errant: true, roam: 'lit', cond: { flag: 'lit.calls' } }),
  ]),
});

export default PELLWICK_ENCOUNTERS;
