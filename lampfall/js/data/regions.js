/**
 * REGIONS: the curve-level regions every map names (GDD-00 §4; GDD-ids §8; GDD-01 §4). [DATA-MAPS]
 *
 * `curveLevel` is the posted curve (ace − 3) the ferry card and the catch-up EXP rule read;
 * `wild` is the day wild-level band (night tables add +2 on the isles, GDD-00 §4); `music` names a
 * region theme override (null = the hourly day-part theme). Pellwick's band is the reed edges'.
 * @module data/regions
 */

/** @type {ReadonlyArray<Readonly<{id: string, name: string, curveLevel: number, wild: readonly [number, number] | null, music: string | null}>>} */
export const REGIONS = Object.freeze([
  Object.freeze({ id: 'pellwick', name: 'Pellwick', curveLevel: 4, wild: Object.freeze([2, 5]), music: null }),
  Object.freeze({ id: 'lowmoor', name: 'Lowmoor', curveLevel: 6, wild: Object.freeze([3, 8]), music: null }),
  Object.freeze({ id: 'cairnhold', name: 'Cairnhold', curveLevel: 13, wild: Object.freeze([9, 14]), music: null }),
  Object.freeze({ id: 'emberstep', name: 'Emberstep', curveLevel: 19, wild: Object.freeze([15, 20]), music: null }),
  Object.freeze({ id: 'drownwood', name: 'Drownwood', curveLevel: 26, wild: Object.freeze([22, 27]), music: null }),
  Object.freeze({ id: 'thistlewind', name: 'Thistlewind', curveLevel: 33, wild: Object.freeze([29, 34]), music: null }),
  Object.freeze({ id: 'rimeholt', name: 'Rimeholt', curveLevel: 40, wild: Object.freeze([36, 41]), music: null }),
  Object.freeze({ id: 'the-bar', name: 'The Bar', curveLevel: 41, wild: Object.freeze([40, 44]), music: null }),
  Object.freeze({ id: 'shardcrown', name: 'Shardcrown', curveLevel: 47, wild: Object.freeze([44, 48]), music: 'summit' }),
]);

export default REGIONS;
